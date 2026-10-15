# pg_stat_statements — 무엇을, 왜

> 설정과 성공 여부에 따라 수집 대상이 되는 SQL 문을 "모양"별로 정규화해 서버 전역에서 누적 통계로 추적하는, PostgreSQL 공식 contrib 모듈이다.

## 한 줄로

애플리케이션이 `WHERE id = 1`, `WHERE id = 2`, `WHERE id = 3`... 을 수백만 번 날려도, pg_stat_statements 는 이걸 **`WHERE id = $1` 하나의 항목**으로 묶어 "이 모양의 쿼리가 총 몇 번, 얼마나 걸렸는지"를 서버가 켜져 있는 동안 계속 누적한다. 로그를 파싱하지 않고 SQL 한 줄로 "지금 뭐가 느린가"에 답할 수 있게 해주는 것이 이 모듈의 존재 이유다.

## 역할과 할 수 있는 것

pg_stat_statements 는 새로운 SQL 기능을 추가하지 않는다. PostgreSQL 실행기(executor)와 플래너(planner) 안에 **훅(hook)** 으로 끼어들어, 모든 쿼리가 끝날 때마다 그 쿼리의 통계를 서버 공유 메모리의 해시테이블에 누적하고, 그 내용을 `pg_stat_statements` 뷰로 노출한다. 뷰 하나로 볼 수 있는 것은 대략:

| 범주 | 예시 컬럼 |
| --- | --- |
| 호출 빈도 | `calls`, `rows` |
| 실행 시간 | `total_exec_time`, `mean_exec_time`, `stddev_exec_time`, `min/max_exec_time` |
| 계획 시간 | `plans`, `total_plan_time`, `mean_plan_time` (`track_planning=on`일 때만) |
| 버퍼 I/O | `shared_blks_hit/read/dirtied/written`, `local_blks_*`, `temp_blks_*` |
| 시간 단위 I/O | `blk_read_time`, `blk_write_time` (`track_io_timing=on`일 때만) |
| WAL | `wal_records`, `wal_fpi`, `wal_bytes` |
| JIT | `jit_functions`, `jit_generation_time` 등 |

정확한 컬럼 목록은 PostgreSQL 메이저 버전마다 다르다 - 이 문서의 숫자를 외우지 말고 [`labs/01-preload-and-footprint/`](../labs/01-preload-and-footprint) 처럼 `information_schema.columns` 로 직접 확인하는 습관이 중요하다 (버전별 변화는 [02](02-internals-and-source.md)·[03](03-version-history.md) 참고).

## Before / After

**Before (pg_stat_statements 없이 "뭐가 느린가"를 찾는 법)**

```sql
-- 방법 1: 로그에서 찾는다
-- postgresql.conf: log_min_duration_statement = 200
-- => 로그를 grep/awk 로 파싱해서 직접 집계해야 한다. 상수가 다른 같은 모양의
--    쿼리를 사람이 눈으로 normalize 해야 하고, 서버 재시작 전까지의 누적치도 없다.

-- 방법 2: 지금 이 순간 실행 중인 쿼리만 본다
SELECT pid, now() - query_start AS 경과, query
FROM   pg_stat_activity
WHERE  state = 'active';
-- => "지금 도는 것"만 보인다. 이미 끝난 쿼리, 어쩌다 한 번 느렸던 쿼리는 알 수 없다.
```

**After**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- shared_preload_libraries 필요 (02 참고)

SELECT left(query, 60) AS 쿼리, calls, total_exec_time, mean_exec_time
FROM   pg_stat_statements
ORDER  BY total_exec_time DESC
LIMIT  10;
-- => 서버가 켜진 이후 "어떤 모양의 쿼리가 전체 시간을 얼마나 잡아먹었는지"가 SQL 한 줄로 나온다.
```

## 왜 필요한가

- **로그 파싱이 필요 없다.** `log_min_duration_statement` 로 로그를 남기고 별도 도구(pgBadger 등)로 집계하는 대신, 서버 안에서 바로 집계된 통계를 SQL 로 질의한다.
- **정규화가 핵심이다.** 리터럴 값만 다른 쿼리를 하나로 묶지 않으면, 프로덕션 트래픽에서는 사실상 "같은 쿼리가 몇 번 돌았는지"조차 알 수 없다 (수백만 개의 서로 다른 문자열).
- **누적 통계라서 드물게 발생하는 문제도 잡힌다.** 한 번은 빠르고 가끔 느린 쿼리도 `stddev_exec_time`, `max_exec_time` 으로 드러난다.
- **상시 수집을 검토할 수 있다.** 오버헤드는 부하와 수집 옵션에 따라 달라지므로 [운영 가이드](04-production-playbook.md)와 실측 결과를 함께 보고 결정한다.

## 이 모듈이 아닌 것

- **로그 대체 도구가 아니다.** 쿼리 텍스트 자체(리터럴 포함)를 보존하지 않는다 - 그건 `log_statement`/`auto_explain` 의 역할이다.
- **실시간 프로파일러가 아니다.** "지금 이 순간 뭐가 도는가"는 `pg_stat_activity` 의 역할이고, pg_stat_statements 는 "누적된 과거"를 본다. 두 뷰는 `query_id=queryid`와 `datid=dbid`, `usesysid=userid`, 최상위 여부를 함께 고려해 연결한다.
- **자동으로 튜닝해주지 않는다.** 어디를 봐야 하는지 가리켜줄 뿐, `EXPLAIN` 으로 원인을 파는 것은 여전히 사람의 몫이다.

## 더 읽기

- [내부 동작과 코드베이스](02-internals-and-source.md) - 왜 서버 재시작이 필요한가, 실제 소스는 어떻게 생겼나
- [버전별 변천사](03-version-history.md) - 이 표의 컬럼들이 언제 생겼나
- [실무 활용 가이드](04-production-playbook.md) - 매니지드 DB 지원, 보안, 대안 도구
- 실습: [`../labs/`](../labs)

## 참고 링크

- [PostgreSQL 공식 문서 - F.32. pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
