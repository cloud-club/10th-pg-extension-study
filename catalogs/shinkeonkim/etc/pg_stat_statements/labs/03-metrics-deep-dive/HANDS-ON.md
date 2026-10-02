# Lab 03 직접 해보기 - calls/시간 말고 나머지 컬럼들

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - I/O 히트율

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT pg_stat_statements_reset();
CREATE TABLE t_big AS SELECT g AS id, repeat('x', 500) AS pad FROM generate_series(1, 200000) g;
VACUUM ANALYZE t_big;

SELECT count(*) FROM t_big WHERE pad LIKE 'x%';   -- 첫 실행
SELECT count(*) FROM t_big WHERE pad LIKE 'x%';   -- 재실행

SELECT left(query, 40), shared_blks_hit, shared_blks_read,
       round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS "히트율%"
FROM   pg_stat_statements WHERE query LIKE '%t_big%' AND query LIKE '%pad%';
```

위 카운터는 두 실행의 누적값입니다. read는 공유 버퍼 미스이며 OS 캐시에서 읽을 수도 있습니다. 실행별 차이를 알려면 각 실행 전후의 스냅샷 차분을 비교합니다.

## STEP 2 - WAL (이 쿼리가 복제/디스크에 주는 부담)

```sql
SELECT pg_stat_statements_reset();
UPDATE t_big SET pad = pad || '' WHERE id <= 50000;

SELECT left(query, 30), wal_records, wal_fpi, pg_size_pretty(wal_bytes)
FROM   pg_stat_statements WHERE query LIKE 'UPDATE t_big%';
```

`SELECT` 와 달리 `UPDATE` 는 WAL 을 만듭니다. `wal_bytes` 가 큰 쿼리는 스트리밍 복제 지연이나 아카이브 비용의 원인일 수 있습니다.

## STEP 3 - 계획(Plan) 시간

`track_planning=on` 일 때만 값이 채워집니다 (이 lab 은 켜뒀지만 기본값은 off 입니다 - 매 쿼리마다 계획 시간까지 측정하면 오버헤드가 추가되기 때문).

```sql
SHOW pg_stat_statements.track_planning;
SELECT pg_stat_statements_reset();

CREATE TABLE t_join_a AS SELECT g AS id, g % 100 AS grp FROM generate_series(1, 20000) g;
CREATE TABLE t_join_b AS SELECT g AS id, g % 100 AS grp FROM generate_series(1, 20000) g;
CREATE INDEX ON t_join_a (grp);
CREATE INDEX ON t_join_b (grp);
ANALYZE t_join_a; ANALYZE t_join_b;

SELECT count(*) FROM t_join_a a JOIN t_join_b b ON a.grp = b.grp WHERE a.id < 5000;

SELECT left(query, 45), calls, plans, total_plan_time, mean_plan_time, total_exec_time
FROM   pg_stat_statements WHERE query LIKE '%t_join_a%';
```

조인·서브쿼리가 많은 복잡한 쿼리는 "계획을 세우는 시간"만으로도 무시 못 할 비용이 듭니다. `total_plan_time` 이 `total_exec_time` 에 맞먹는다면 `PREPARE` 로 계획을 재사용하는 것을 검토할 신호입니다.

## STEP 4 - temp 파일 (함정 포함)

`work_mem` 부족의 직접적인 증거입니다. `ORDER BY ... LIMIT n`은 작은 n에서 top-N 최적화로 temp 사용을 피할 수 있지만, n·행 크기·실행계획에 따라 spill할 수 있습니다. 이 예제는 LIMIT 없는 전체 정렬을 사용합니다.

```sql
SELECT pg_stat_statements_reset();
SET work_mem = '64kB';

-- ✗ 이렇게 하면 temp 파일이 안 생긴다 (top-N heapsort 최적화)
-- SELECT * FROM t_big ORDER BY pad LIMIT 1;

-- ✓ LIMIT 없는 전체 정렬을 count(*)로 감싸 temp 사용을 관찰한다
SELECT count(*) FROM (SELECT pad FROM t_big ORDER BY pad) x;
RESET work_mem;

SELECT temp_blks_read, temp_blks_written
FROM   pg_stat_statements WHERE query LIKE 'SELECT count(*) FROM (SELECT pad%';
```

`temp_blks_written > 0` 이면 그 쿼리가 디스크에 임시 파일을 쓰고 있다는 뜻입니다 - `work_mem` 을 늘리거나 쿼리를 고쳐야 할 신호입니다.

## STEP 5 - JIT 컴파일 비용

짧은 쿼리에 JIT 이 잘못 켜지면 컴파일 비용이 절약한 실행 시간보다 커질 수 있습니다.

```sql
SELECT pg_stat_statements_reset();
SET jit_above_cost = 0; SET jit_inline_above_cost = 0; SET jit_optimize_above_cost = 0;

SELECT count(*) FROM t_join_a a JOIN t_join_b b ON a.grp = b.grp;

RESET jit_above_cost; RESET jit_inline_above_cost; RESET jit_optimize_above_cost;

SELECT jit_functions, jit_generation_time, jit_inlining_time, jit_optimization_time, jit_emission_time
FROM   pg_stat_statements WHERE query LIKE '%t_join_a a JOIN%';
```

JIT 은 대형 분석 쿼리의 실행은 빠르게 하지만, 컴파일 자체가 비용입니다. 짧은 OLTP 쿼리에 JIT 이 잘못 켜지면 "컴파일 비용 > 절약한 실행 시간"이 되어 오히려 느려집니다 - `jit_*` 컬럼이 그 증거입니다.

---

## 정리

| 신호 | 의미 |
|---|---|
| `shared_blks_read` 큼 | 캐시 미스 - `shared_buffers` 또는 인덱스 검토 |
| `wal_bytes` 큼 | 복제 지연·아카이브 비용의 원인 후보 |
| `total_plan_time ≈ total_exec_time` | `PREPARE` 로 계획 재사용 검토 |
| `temp_blks_written > 0` | `work_mem` 부족 - 디스크 정렬/해시 |
| `jit_generation_time` 큼 | 짧은 쿼리에 JIT 이 역효과를 낼 수 있음 |

## 다음 단계

- 이전 랩: [`../02-normalization-and-queryid/`](../02-normalization-and-queryid)
- 다음 랩: [`../04-dba-playbook-and-pitfalls/`](../04-dba-playbook-and-pitfalls)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
