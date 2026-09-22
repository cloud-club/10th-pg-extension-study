# pg_stat_statements

> 설정과 성공 여부에 따라 수집 대상이 되는 SQL 문을 "모양"별로 정규화해 서버 전역에서 누적 통계로 추적하는, PostgreSQL 공식 contrib 모듈 - 로그 파싱 없이 "지금 뭐가 느린가"에 SQL 한 줄로 답하게 해준다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 성능 진단 |
| 버전 | 실습 환경: PostgreSQL 16.15 / pg_stat_statements 1.10 (버전별 차이는 [`docs/03-version-history.md`](docs/03-version-history.md)) |
| 라이선스 | PostgreSQL License (PostgreSQL 본체와 동일, contrib 모듈) |
| 저장소 · 문서 | [contrib/pg_stat_statements (postgres/postgres)](https://github.com/postgres/postgres/tree/master/contrib/pg_stat_statements) · [공식 문서](https://www.postgresql.org/docs/current/pgstatstatements.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | etc (week04 준비 자료에서 이동) |

이 문서는 아래 심화 조사와 실습 결과를 종합한 것이다. 근거와 세부 내용은 각 문서를 참고한다.

- [`docs/01-what-and-why.md`](docs/01-what-and-why.md) - 무엇을 하는지, 왜 필요한지
- [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md) - 내부 동작 원리와 실제 코드베이스
- [`docs/03-version-history.md`](docs/03-version-history.md) - 버전별 변천사
- [`docs/04-production-playbook.md`](docs/04-production-playbook.md) - 실무 활용, 매니지드 DB 지원, 보안
- [`labs/`](labs) - Docker 기반 실습 5개 (`./run.sh` 또는 각 lab 의 `HANDS-ON.md`)

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

```sql
-- 방법 1: 로그에서 찾는다 - postgresql.conf 에 log_min_duration_statement 설정 후
-- 로그를 grep/awk 로 파싱해 사람이 직접 집계해야 한다. 상수가 다른 같은 모양의
-- 쿼리를 눈으로 normalize 해야 하고, 서버가 죽 켜져 있는 동안의 누적치도 없다.

-- 방법 2: 지금 실행 중인 것만 본다 (이미 끝난 쿼리는 알 수 없다)
SELECT pid, now() - query_start AS 경과, query
FROM   pg_stat_activity WHERE state = 'active';
```

**After**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- shared_preload_libraries 필요

SELECT left(query, 60) AS 쿼리, calls, total_exec_time, mean_exec_time
FROM   pg_stat_statements
ORDER  BY total_exec_time DESC
LIMIT  10;
```

리터럴 값만 다른 쿼리(`WHERE id = 1`, `WHERE id = 2`, ...)를 하나의 "모양"으로 묶어, 서버가 켜진 이후 "어떤 쿼리가 전체 시간을 얼마나 잡아먹었는지"를 SQL 한 줄로 답한다. 자세한 설명: [`docs/01-what-and-why.md`](docs/01-what-and-why.md).

## 2. 설치 & 데모

```sql
-- 1) 서버 기동 옵션에 preload 필요 (postgresql.conf 또는 docker-compose command)
--    shared_preload_libraries = 'pg_stat_statements'
--    → 재시작 필수. CREATE EXTENSION 만으로는 동작하지 않는다 (docs/02 참고)

CREATE EXTENSION pg_stat_statements;
```

```sql
-- 실제 쿼리와 결과
SELECT pg_stat_statements_reset();

CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1, 50000) g;
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;

SELECT left(query, 45) AS 쿼리, calls, round(mean_exec_time::numeric, 3) AS 평균ms
FROM   pg_stat_statements WHERE query LIKE '%t_demo%';
```

```
                    쿼리                     | calls | 평균ms
----------------------------------------------+-------+--------
 SELECT count(*) FROM t_demo WHERE id < $1    |     3 |  0.023
```

세 번 실행한 쿼리가 `id < $1` 하나로 합쳐졌다. 전체 실습은 [`labs/`](labs) 에서 Docker 로 직접 돌려볼 수 있다 (`./run.sh`).

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 쿼리별 누적 비용을 비교해 튜닝 우선순위를 정할 때. 수집 비용을 실제 부하에서 확인한 뒤 상시 수집 여부를 정한다 |
| 이럴 때는 피한다 | `pg_stat_statements.track=all` + `track_planning=on` 을 초당 요청이 매우 많은 짧은 OLTP 워크로드에 무심코 함께 켤 때 - 항목 수와 측정 비용이 함께 늘어난다. 필요할 때만 켜고 끄는 걸 권장 |
| 비용 | 수집 설정·부하에 따라 달라진다. 아래 실험은 CPU 사용률이 아니라 TPS 변화를 측정했다. `shared_preload_libraries` 변경은 **서버 재시작**이 필요하다. 공유 메모리는 `pg_stat_statements.max` 로 고정 크기가 정해지며, 늘리려면 재시작해야 한다 |
| 대안 | 실시간 스냅샷만 필요하면 `pg_stat_activity`. 실제 실행계획까지 필요하면 `auto_explain` 과 함께. 시계열 히스토그램/백분위수가 필요하면 `pg_stat_monitor`(Percona) |

## 4. 매니지드 DB 지원 여부

RDS·Aurora·Supabase·Neon·Cloud SQL·Azure의 지원 안내와 설정 절차는 [운영 가이드](docs/04-production-playbook.md#매니지드-db-지원-현황)에서 확인한다. 지원 여부와 기본 활성화는 다르며, 실제 인스턴스의 preload·확장 설치·권한을 확인해야 한다.

---

## 5. 내부 동작 원리

- **훅 체인**: `_PG_init()` 이 `post_parse_analyze_hook`, `planner_hook`, `ExecutorStart_hook`, `ProcessUtility_hook` 등에 자기 함수를 끼워넣는다. 서버 기동 시 등록해야 그 이후 모든 세션의 쿼리를 잡을 수 있어 `shared_preload_libraries` 가 강제된다.
- **공유 메모리**: `RequestAddinShmemSpace()` / `RequestNamedLWLockTranche()` 로 서버 기동 시 한 번만 공유 해시테이블을 할당한다. 쿼리 텍스트 자체는 별도 파일에 저장하고 해시테이블은 그 오프셋만 가리킨다.
- **정규화(query jumbling)**: 파스 트리에서 상수 리터럴의 값은 무시하고 위치만 기록해 상수만 다른 쿼리를 같은 `queryid` 로 묶는다. PostgreSQL 14부터는 이 계산이 pg_stat_statements 밖 **코어 서버**로 옮겨졌다 (`compute_query_id` GUC).
- 자세한 소스 코드 인용과 자료구조: [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md)

## 6. 벤치마크 / 실습 결과

이 lab (`labs/`, PostgreSQL 16.15 / pg_stat_statements 1.10, Docker) 을 직접 돌리며 확인한 것 - **소스 코드로 재검증한 뒤에야 확정한 항목도 있다** (처음 가정이 틀렸던 것들을 아래에 그대로 남긴다. 조사할 때의 오해와 정정 과정 자체가 기록할 가치가 있다고 판단했다):

| 조건 | 결과 |
| --- | --- |
| `ORDER BY ... LIMIT n` 을 `work_mem='64kB'` 로 강제 | 이 예제의 작은 LIMIT에서는 top-N 정렬이 메모리 안에 들어갔다. LIMIT 없는 전체 정렬로 temp 사용을 재현했다. LIMIT이 있어도 n·행 크기·실행계획에 따라 spill할 수 있다 |
| 컬럼 개수가 다른 1200개의 `SELECT length('a'), length('a'), ...` 를 `pg_stat_statements.max=1000` 환경에서 실행 | 저장된 항목이 max 를 넘지 않고(956개), `pg_stat_statements_info.dealloc` 은 5 - 처음엔 "5개가 쫓겨났다"로 착각했지만, 실제 소스(`entry_dealloc()`)를 확인하니 **`dealloc` 은 GC 가 실행된 횟수**였다. 한 번의 GC 가 `max(10, 전체의 5%)` 를 한꺼번에 정리한다 (`USAGE_DEALLOC_PERCENT`) |
| `IN (1,2,3)` vs `IN (1..7)` 을 같은 세션에서 실행 | 이 PostgreSQL 16 환경에서는 **정규화되지 않고 별개의 queryid 세 개**로 남았다 - 최신(PostgreSQL 18) 문서에 나오는 "리스트 뭉치기" 예제와 다른 동작이라, 실제로 그 기능이 18에서 추가되었다는 걸 릴리스 노트로 재확인했다 |
| `pg_read_all_stats` 가 없는 role 로 다른 사용자의 쿼리를 조회 | 행 자체(calls 등)는 보이지만 `queryid` 는 `NULL`, `query` 는 `NULL` 이 아니라 **문자열 `<insufficient privilege>`** 로 채워졌다 - `WHERE query = ...` 로는 찾을 수 없다는 뜻 |
| `SELECT 1 AS probe_1` vs `SELECT 1 AS probe_2` (별칭만 다름) | 같은 queryid 로 합쳐졌다 - 별칭은 정규화/구분 대상이 아니다 |

각 항목의 재현 스크립트: [`labs/01-preload-and-footprint/`](labs/01-preload-and-footprint) ~ [`labs/04-dba-playbook-and-pitfalls/`](labs/04-dba-playbook-and-pitfalls).

## 7. 실제 백엔드에서 이렇게 쓴다

[`labs/05-fastapi-slow-query-monitor/`](labs/05-fastapi-slow-query-monitor) 는 FastAPI 로 짠 주문 조회 API 에 일부러 N+1 버그(유저의 주문을 한 번에 안 가져오고 건마다 별도 쿼리)를 심어두고, `pg_stat_statements` 를 그대로 노출하는 `/admin/top-queries`, `/admin/n-plus-one-suspects` 엔드포인트로 그 버그를 잡아낸다. 코드를 한 줄도 안 보고 API 트래픽만으로 "`SELECT * FROM orders WHERE id = $1` 이 calls=25 로 튄다"는 걸 확인할 수 있다 - psql 밖에서, 서비스 자신의 관리자 API 로 pg_stat_statements 를 노출하는 실무 패턴이다.

## 8. 실측 벤치마크

[실험 01](experiments/01-overhead-under-load/)의 과거 측정에서 baseline 대비 TPS는 track=top −3.6%, track=all −6.0%였다. 짧은 순차 측정의 관찰값이며 보편적인 CPU 오버헤드나 설정별 인과 효과로 일반화하지 않는다. [실험 02](experiments/02-max-sizing-vs-eviction-latency/)에서는 두 번의 측정으로 뚜렷한 지연 증가를 확인하지 못했다. dealloc은 통계 항목 제거 이벤트를 나타내며, 그 값만으로 성능 비용이 없다고 결론 내릴 수 없다.

---

## 참고 링크

- [PostgreSQL 공식 문서 - F.32. pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [contrib/pg_stat_statements 소스 (postgres/postgres, GitHub)](https://github.com/postgres/postgres/tree/master/contrib/pg_stat_statements)
- [PostgreSQL 16 하이라이트 - Normalization of utilities in pg_stat_statements (Michael Paquier)](https://paquier.xyz/postgresql-2/postgres-16-pgstatstatements-norm/)
- [Normalizing queries for pg_stat_statements < 9.2 (ioguix)](https://blog.ioguix.net/postgresql/2012/08/06/Normalizing-queries-for-pg_stat_statements.html)
- 나머지 인용 출처는 각 `docs/` 문서 하단의 "참고 링크" 참고
