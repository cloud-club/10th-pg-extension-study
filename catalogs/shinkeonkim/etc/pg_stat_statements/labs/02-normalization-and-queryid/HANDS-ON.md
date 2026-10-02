# Lab 02 직접 해보기 - 쿼리 정규화와 그 함정

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - 기본 정규화

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT pg_stat_statements_reset();
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1, 50000) g;

SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;
```

```sql
SELECT left(query, 45), calls, total_exec_time
FROM   pg_stat_statements WHERE query LIKE '%t_demo%' ORDER BY total_exec_time DESC;
```

세 쿼리가 `id < $1` 하나로 합쳐지고 `calls = 3` 이 됩니다. 이게 정규화입니다.

## STEP 2 - 함정: IN 리스트는 길이가 달라도 합쳐지지 않는다

(적어도 이 lab 이 쓰는 PostgreSQL 버전에서는)

```sql
SELECT pg_stat_statements_reset();
SELECT count(*) FROM t_demo WHERE id IN (1, 2, 3);
SELECT count(*) FROM t_demo WHERE id IN (10, 20, 30, 40, 50);
SELECT count(*) FROM t_demo WHERE id IN (100, 200, 300, 400, 500, 600, 700);

SELECT queryid, left(query, 45), calls
FROM   pg_stat_statements WHERE query LIKE '%IN (%' ORDER BY calls DESC;
```

3개짜리 / 5개짜리 / 7개짜리가 **서로 다른 queryid 세 개**로 남습니다. 애플리케이션이 가변 길이 `IN` 리스트를 계속 만들면 pg_stat_statements 통계가 사실상 무력화될 수 있다는 뜻입니다 (더 최신 PostgreSQL 은 이 문제를 다루는 기능이 추가되었습니다 - 정확한 도입 버전은 [`../../docs/03-version-history.md`](../../docs/03-version-history.md) 참고).

## STEP 3 - `track=all` 과 `toplevel`

```sql
CREATE OR REPLACE FUNCTION count_demo(threshold int) RETURNS bigint AS $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM t_demo WHERE id < threshold;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

SELECT count_demo(1000);
SELECT count_demo(2000);

SELECT toplevel, left(query, 55), calls
FROM   pg_stat_statements
WHERE  (query LIKE '%t_demo%' AND query LIKE '%threshold%') OR query LIKE '%count_demo%'
ORDER  BY toplevel DESC;
```

`toplevel = false` 행이 함수 안에서 실행된 쿼리입니다. `track=top`(기본값)이었다면 아예 안 잡혔을 것입니다.

## STEP 4 - `queryid` 로 `pg_stat_activity` 와 조인

```sql
SHOW compute_query_id;
SELECT pid, query_id, left(query, 40) AS query
FROM   pg_stat_activity WHERE pid = pg_backend_pid();
```

같은 모양의 쿼리는 실행 중이든 통계에 쌓여있든 같은 `queryid` 를 갖습니다 - "지금 느린 이 쿼리, 평소에도 느렸나?"를 조인 한 번으로 답할 수 있습니다.

---

## 정리

| | |
|---|---|
| 기본 정규화 | 리터럴은 `$1`로 지워지고 같은 모양끼리 합쳐진다 |
| 함정 | 리스트(`IN (...)`) 의 길이는 버전에 따라 다르게 취급된다 - 직접 확인할 것 |
| `track=all` | 함수/트리거 내부 쿼리까지 잡되, `toplevel` 컬럼으로 구분해야 한다 |

## 다음 단계

- 이전 랩: [`../01-preload-and-footprint/`](../01-preload-and-footprint)
- 다음 랩: [`../03-metrics-deep-dive/`](../03-metrics-deep-dive)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
