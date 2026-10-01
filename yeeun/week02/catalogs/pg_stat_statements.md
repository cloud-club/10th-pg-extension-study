# pg_stat_statements

> 실행된 SQL을 Query 단위로 누적 집계해서 **어떤 쿼리가 DB 시간을 많이 쓰는지** 확인할 수 있게 해주는 성능 진단 Extension

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 운영 · 성능 진단 |
| 버전 | PostgreSQL 18 기준 조사 / 실제 `extversion`은 실습 환경에서 기록 |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | PostgreSQL 공식 `contrib/pg_stat_statements` / [공식 Documentation](https://www.postgresql.org/docs/current/pgstatstatements.html) |
| 정리한 사람 | 김예은 |
| 회차 | `week02` |

---

## 1. Before / After — 없으면 뭐가 불편한가

### Before

특정 SQL이 느리다는 걸 이미 알면 `EXPLAIN ANALYZE`로 분석할 수 있습니다.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM books
WHERE genre = '소설';
```

그런데 질문이 이렇게 바뀌면 이야기가 달라집니다.

```text
어떤 SQL이 문제인지 모름

SQL A : 평균 8초 / 하루 1회
SQL B : 평균 80ms / 하루 200,000회

→ 실제 DB 자원을 더 많이 소비하는 SQL은?
```

| 수단 | 한계 |
| --- | --- |
| `pg_stat_activity` | **지금** 실행 중인 쿼리만. 누적 집계 없음 |
| Slow Query Log (`log_min_duration_statement`) | 임계값(예: 1초) **넘는 개별 실행**만 남김. **짧고 잦은 SQL**은 놓치기 쉬움 |

<sub>Slow Query Log = “느린 한 방”을 찾는 대표 방법. 이 Extension의 대체재가 아니라, **누적(total) 관점이 빠지기 쉬운** 대비 대상입니다.</sub>

### After

Query Pattern별 통계를 DB에서 바로 조회합니다.

```sql
SELECT
    query,
    calls,              -- 이 패턴이 몇 번 실행됐는지
    total_exec_time,    -- 누적 실행 시간 (우선순위용)
    mean_exec_time,     -- 1회 평균 실행 시간
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

예시:

```text
Query A  calls=1        mean=8,000ms     total=8,000ms
Query B  calls=200,000  mean=80ms        total=16,000,000ms
```

→ “가장 느린 SQL”(mean)이 아니라 **전체 DB 시간을 많이 쓴 SQL**(total)을 우선순위로 잡습니다.

**정규화:** 상수는 `$1` 등으로 바뀌고 Query ID 기준으로 묶입니다.  
Parameter만 다른 SQL도 같은 패턴의 `calls` / `total`로 누적됩니다.

재현 스크립트: [`../lab/`](../lab/)

---

## 2. 설치 & 데모

`CREATE EXTENSION`만으로는 부족합니다. 서버 시작 시 module preload가 필요합니다.

```conf
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
compute_query_id = on
```

`shared_preload_libraries` 변경 → **재시작 필요** (Shared Memory 사용).

```sql
SHOW shared_preload_libraries;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_stat_statements';
```

### 데모 흐름

예시 데이터: `books` (데미안, 코스모스, 클린 코드 등 · 장르 `소설`/`과학`/`기술`)

1. [`../lab/sql/01-setup.sql`](../lab/sql/01-setup.sql) — extension + `books`
2. [`../lab/sql/02-normalize.sql`](../lab/sql/02-normalize.sql) — 장르만 다른 동일 패턴
3. [`../lab/sql/03-mean-vs-total.sql`](../lab/sql/03-mean-vs-total.sql) — mean vs total

핵심 확인: `'소설' / '과학' / '기술'` literal이 달라도 **같은 Query Pattern으로 집계되는지**  
(= 정규화 → `genre = $1`, `calls`가 합쳐지는지).

전체 Top-N:

```sql
SELECT
    query,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## 3. 트레이드오프 — 언제 쓰고 언제 피하나

| | 내용 |
| --- | --- |
| 이럴 때 쓴다 | 어떤 SQL이 반복적으로 자원을 많이 쓰는지 찾고 싶을 때 |
| 이럴 때 쓴다 | Slow Query뿐 아니라 **자주 호출되어 누적 비용이 큰 SQL**을 찾을 때 |
| 이럴 때 쓴다 | 튜닝 전·후 호출 횟수·실행시간 변화를 보고 싶을 때 |
| 이럴 때는 피한다 | 특정 SQL 하나의 정확한 plan만 필요하면 → `EXPLAIN ANALYZE` |
| 비용 | 모든 SQL 추적 → 일정 Tracking Overhead |
| 비용 | `pg_stat_statements.max`에 비례한 Shared Memory |
| 비용 | 최초 preload 설정 시 서버 재시작 |
| 비용 | `track_planning` 활성화 시 동시성 높은 환경에서 추가 부하 가능 (공식 문서 경고) |
| 대안 | `EXPLAIN ANALYZE`, `pg_stat_activity`, Slow Query Log, `auto_explain`, APM / Managed Performance Insights |

역할 분리:

```text
pg_stat_statements  →  "무슨 SQL부터 튜닝하지?"
EXPLAIN ANALYZE     →  "이 SQL이 왜 느리지?"
```

---

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS PostgreSQL | ○ | PG 10+ 기본 `shared_preload_libraries`에 포함되는 경우 많음. Parameter Group 확인 |
| AWS Aurora PostgreSQL | ○ | 지원 Extension 목록에 포함 |
| Supabase | ○ | Dashboard 또는 SQL로 활성화 |
| Neon | ○ | 공식 지원 |
| GCP Cloud SQL | ○ | 지원 Extension 목록에 포함 |

### `shared_preload_libraries`

| 환경 | 필요 | 재시작 |
| --- | --- | --- |
| 일반 PostgreSQL | ○ | ○ |
| Managed | Provider가 preload해 두었거나 Parameter/Flag로 관리 | Provider 정책 따름 |

Managed에서는 `postgresql.conf` 직접 수정 가능 여부보다 **지원 여부 + preload 설정 제공 여부**가 핵심입니다.

---

## 5. (선택) 내부 동작 원리

SQL 문자열 전체 비교가 아니라 **Query Identifier**로 구조를 식별합니다.

예를 들어 다음 SQL이 실행됐다고 가정합니다.

```sql
SELECT * FROM books WHERE genre = '소설';
SELECT * FROM books WHERE genre = '과학';
```

통계에서는 상수를 Parameter 형태로 정규화한 대표 Query를 이용할 수 있습니다.

```sql
SELECT * FROM books WHERE genre = $1;
```

흐름 (단순화):

```text
SQL 실행
      ↓
Parser / Planner / Executor
      ↓
Query ID (jumble — 상수 제외한 구조 해시)
      ↓
pg_stat_statements Shared Hash Table
      ↓
calls / total_exec_time / mean / rows / buffers / WAL ...
```

Query Text는 Shared Memory 통계와 별도 파일에 두고 View 조회 시 조인합니다.

---

## 6. (선택) 벤치마크 / 실습 결과

재현: [`../lab/`](../lab/) 에서 `./run.sh`

| 항목 | 결과 |
| --- | --- |
| 환경 | PostgreSQL **16.15** (Docker `postgres:16-bookworm`, aarch64) |
| Extension | `pg_stat_statements` **1.10** |
| preload | `shared_preload_libraries = pg_stat_statements` |
| `compute_query_id` | `on` |

### 정규화 (`./run.sh 02`)

`genre = '소설' / '과학' / '기술'` 을 각각 2회(총 6회) 실행한 뒤:

| queryid | query (정규화) | calls | total_ms | avg_ms |
| --- | --- | ---: | ---: | ---: |
| `6096163514989826317` | `SELECT count(*) FROM books WHERE genre = $1` | **6** | 49.25 | 8.208 |

→ literal이 달라도 **한 row · calls=6** 으로 합쳐짐.

### mean vs total (`./run.sh 03`)

| 정렬 | 1등 | calls | avg_ms | total_ms |
| --- | --- | ---: | ---: | ---: |
| `mean_exec_time` | `SELECT pg_sleep($1)` | 2 | **53.58** | 107.16 |
| `total_exec_time` | `… WHERE genre = $1` | 50 | 8.00 | **399.84** |

→ **평균이 큰 쿼리**와 **누적 DB 시간을 많이 쓴 쿼리**의 순위가 뒤집힘.  
우선순위는 보통 `total_exec_time` 쪽에 가깝다.

---

## 추가로 확인한 내용

PostgreSQL 18 실습 시 Minor도 확인.  
2026-08 PostgreSQL 프로젝트는 PG18 `pg_stat_statements` 관련 보안 수정이 **18.6**에 들어갔습니다. → **18.6+** 권장.

---

## 참고 링크

- [pg_stat_statements 공식 문서](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [Packaging Related Objects into an Extension](https://www.postgresql.org/docs/current/extend-extensions.html)
- [Additional Supplied Modules and Extensions](https://www.postgresql.org/docs/current/contrib.html)
- [pg_available_extensions](https://www.postgresql.org/docs/current/view-pg-available-extensions.html)
- [PostgreSQL License](https://www.postgresql.org/about/licence/)
- [contrib/pg_stat_statements 소스](https://github.com/postgres/postgres/tree/master/contrib/pg_stat_statements)
