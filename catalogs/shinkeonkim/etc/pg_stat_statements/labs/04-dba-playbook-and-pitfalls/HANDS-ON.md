# Lab 04 직접 해보기 - 실무 플레이북과 세 가지 함정

```bash
./run.sh up
./run.sh psql
```

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT pg_stat_statements_reset();
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1, 50000) g;
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 5000;
SELECT h FROM t_demo WHERE id = 1;
SELECT h FROM t_demo WHERE id = 2;
SELECT h FROM t_demo WHERE id = 3;
```

## STEP 1 - 실무 진단 쿼리 4가지

**총 시간 기준 정렬** - 튜닝 우선순위는 여기서 시작합니다.

```sql
SELECT left(query, 40), calls,
       round(100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::int AS "전체대비%"
FROM   pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;
```

1초짜리를 1번 부르는 쿼리보다 1ms짜리를 10만 번 부르는 쪽이 서버를 더 힘들게 합니다 - `mean_exec_time` 이 아니라 `total_exec_time` 으로 정렬하는 이유입니다.

**N+1 의심** - 유난히 `calls` 가 많은 단순 쿼리.

```sql
SELECT left(query, 40), calls, round(mean_exec_time::numeric, 3)
FROM   pg_stat_statements
WHERE  calls > 2 AND query ILIKE 'SELECT h FROM t_demo%'
ORDER  BY calls DESC LIMIT 5;
```

**실행 시간 편차** - 평균은 멀쩡한데 가끔 튀는 쿼리.

```sql
SELECT left(query, 40), calls,
       round(mean_exec_time::numeric, 2) AS 평균ms,
       round(stddev_exec_time::numeric, 2) AS 표준편차,
       round(max_exec_time::numeric, 2) AS 최대ms
FROM   pg_stat_statements WHERE calls > 1 ORDER BY stddev_exec_time DESC NULLS LAST LIMIT 5;
```

**배포 전후 비교** - 배포 전 같은 길이 구간의 스냅샷을 먼저 보관하고 배포 후 동일 부하 구간과 비교합니다. reset을 하더라도 이전 스냅샷을 잃지 않아야 합니다.

```sql
SELECT * FROM pg_stat_statements_info;   -- stats_reset 으로 "이 통계가 언제부터인지" 확인
```

## STEP 2 - 선택적 리셋 (PostgreSQL 14+)

```sql
SELECT queryid, left(query, 40), calls
FROM   pg_stat_statements
WHERE  query LIKE 'SELECT count(*) FROM t_demo WHERE id < %'
ORDER  BY queryid;

SELECT queryid FROM pg_stat_statements
WHERE query LIKE 'SELECT count(*) FROM t_demo WHERE id < %'
ORDER BY queryid LIMIT 1 \gset target_
SELECT pg_stat_statements_reset(0, 0, :target_queryid);
```

userid/dbid의 0은 와일드카드이므로 같은 queryid의 다른 사용자/DB 항목도 대상입니다. 이 실습은 한 사용자·DB로 통제했습니다.

## STEP 3 - 함정 1: `dealloc` 은 "쫓겨난 항목 수"가 아니다

```sql
SHOW pg_stat_statements.max;    -- 1000
SELECT pg_stat_statements_reset();

DO $$
DECLARE i int; cols text;
BEGIN
  FOR i IN 1..1200 LOOP
    SELECT string_agg('length(''a'')', ',') INTO cols FROM generate_series(1, i);
    EXECUTE format('SELECT %s', cols);
  END LOOP;
END $$;

SELECT count(*) FROM pg_stat_statements;                     -- max(1000) 를 넘지 못한다
SELECT dealloc, stats_reset FROM pg_stat_statements_info;    -- 그런데 dealloc 은 한 자리 수
```

실제 PostgreSQL 소스(`entry_dealloc()`)를 보면 해시테이블이 가득 찰 때마다 `max(10, 전체의 5%)` 를 한 번에 쫓아내고, `dealloc` 카운터는 **그 GC 가 실행된 횟수만** 1씩 올립니다. `dealloc=5` 인데 실제로 지워진 항목은 수백 개일 수 있습니다. 운영에서 `dealloc` 이 계속 증가한다면 `max` 를 늘려야 한다는 신호입니다.

## STEP 4 - 함정 2: 권한 없는 쿼리 텍스트는 `NULL` 이 아니다

```sql
CREATE ROLE demo_alice LOGIN;
CREATE ROLE demo_bob_viewer LOGIN;
CREATE ROLE demo_carol_bystander LOGIN;
GRANT pg_read_all_stats TO demo_bob_viewer;
GRANT SELECT ON t_demo TO demo_alice;

SET SESSION AUTHORIZATION demo_alice;
SELECT count(*) FROM t_demo WHERE id = 999999;
RESET SESSION AUTHORIZATION;
```

세 가지 시점에서 같은 쿼리를 조회해보세요 (rolname 으로 찾습니다 - query 로 찾으면 권한 없는 시점에서 애초에 안 걸립니다).

```sql
-- 슈퍼유저 시점: 항상 전부 보인다
SELECT r.rolname, s.queryid, left(s.query, 40), s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';

-- carol(권한도 없고 본인이 실행하지도 않은 구경꾼) 시점
SET SESSION AUTHORIZATION demo_carol_bystander;
SELECT r.rolname, s.queryid, left(s.query, 40), s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';
RESET SESSION AUTHORIZATION;
```

행 자체(`calls` 등 통계)는 그대로 보이지만, `queryid` 는 `NULL`, `query` 는 실제 텍스트 대신 문자열 `<insufficient privilege>` 로 가려집니다. `pg_read_all_stats` 를 가진 `demo_bob_viewer` 로 다시 조회하면 실제 쿼리 텍스트가 보입니다.

```sql
DROP OWNED BY demo_alice, demo_bob_viewer, demo_carol_bystander;
DROP ROLE demo_alice, demo_bob_viewer, demo_carol_bystander;
```

---

## 정리

| 신호 | 의미 |
|---|---|
| `total_exec_time` 로 정렬 | 누적 실행시간으로 쿼리별 비용을 비교한다 |
| `calls` 급증 | N+1 의심 |
| `stddev_exec_time` 큼 | 가끔 튀는 쿼리 - 락 대기/플랜 변경 의심 |
| `dealloc` 이 계속 증가 | `pg_stat_statements.max` 부족 (단, dealloc ≠ 쫓겨난 개수) |
| 권한 없는 `query` | `NULL` 이 아니라 `<insufficient privilege>` |

## 다음 단계

- 이전 랩: [`../03-metrics-deep-dive/`](../03-metrics-deep-dive)
- 새 랩: [`../05-fastapi-slow-query-monitor/`](../05-fastapi-slow-query-monitor) - 이 진단 쿼리들을 실제 백엔드(FastAPI)에 붙여보기
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
