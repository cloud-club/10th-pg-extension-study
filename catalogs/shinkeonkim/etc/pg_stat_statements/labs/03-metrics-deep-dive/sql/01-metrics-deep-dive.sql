-- ===========================================================================
-- 03. calls / total_exec_time 말고 나머지 컬럼들이 실제로 무엇을 재는가
--
--     pg_stat_statements 는 "느리다"만 말해주지 않는다. 왜 느린지의 단서
--     (I/O, WAL, 계획 시간, JIT, temp 파일)까지 컬럼으로 갖고 있다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT pg_stat_statements_reset();

\echo '--- (1) 공유 버퍼 I/O: 공유 버퍼 hit와 read를 구분 ---'
DROP TABLE IF EXISTS t_big;
CREATE TABLE t_big AS SELECT g AS id, repeat('x', 500) AS pad FROM generate_series(1, 200000) g;
VACUUM ANALYZE t_big;

-- 캐시를 확실히 비우기 어렵지만(공유 버퍼는 컨테이너 재시작 없이 못 비운다),
-- "처음 읽기"와 "다시 읽기"를 비교하는 것만으로도 히트율의 의미는 충분히 보인다.
SELECT count(*) FROM t_big WHERE pad LIKE 'x%';   -- 생성/VACUUM이 이미 버퍼를 데웠을 수 있다
SELECT count(*) FROM t_big WHERE pad LIKE 'x%';   -- 재실행; 버퍼 상주 여부는 실제 카운터로 판단한다

SELECT left(query, 40) AS 쿼리, calls,
       shared_blks_hit AS 캐시히트, shared_blks_read AS 공유버퍼미스,
       round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS "히트율%"
FROM   pg_stat_statements WHERE query LIKE '%t_big%' AND query LIKE '%pad%';

\echo '  ^ 이 값은 두 실행의 누적 카운터다. 두 번째 실행의 read 증가량은 별도 스냅샷 차분으로 판단한다.'
\echo '    shared_blks_read는 공유 버퍼 미스이며 OS 캐시에서 공급될 수도 있다. 물리 디스크 I/O 횟수가 아니다.'

\echo ''
\echo '--- (2) WAL: 이 쿼리가 복제/디스크에 얼마나 부담을 주는가 (PostgreSQL 13+) ---'
SELECT pg_stat_statements_reset();

UPDATE t_big SET pad = pad || '' WHERE id <= 50000;

SELECT left(query, 30) AS 쿼리, calls, rows,
       wal_records AS "WAL레코드", wal_fpi AS "풀페이지이미지", pg_size_pretty(wal_bytes) AS "WAL크기"
FROM   pg_stat_statements WHERE query LIKE 'UPDATE t_big%';

\echo '  ^ UPDATE 는 SELECT 와 달리 WAL 을 만든다. wal_bytes 가 큰 쿼리는'
\echo '    스트리밍 복제 지연이나 아카이브 저장 비용의 원인일 수 있다.'
\echo '    풀페이지이미지(wal_fpi)가 크게 튀면 checkpoint 직후 첫 쓰기라는 뜻이다.'

\echo ''
\echo '--- (3) 계획(Plan) 시간: 실행이 아니라 "계획을 세우는" 데 걸리는 시간 (PostgreSQL 13+) ---'
\echo '    이 lab 은 docker-compose.yml 에서 pg_stat_statements.track_planning=on 으로 켜뒀다.'
\echo '    (기본값은 off - 매 쿼리마다 계획 시간까지 측정하면 오버헤드가 추가되기 때문)'
SHOW pg_stat_statements.track_planning;
SELECT pg_stat_statements_reset();

DROP TABLE IF EXISTS t_join_a; DROP TABLE IF EXISTS t_join_b;
CREATE TABLE t_join_a AS SELECT g AS id, g % 100 AS grp FROM generate_series(1, 20000) g;
CREATE TABLE t_join_b AS SELECT g AS id, g % 100 AS grp FROM generate_series(1, 20000) g;
CREATE INDEX ON t_join_a (grp);
CREATE INDEX ON t_join_b (grp);
ANALYZE t_join_a; ANALYZE t_join_b;

SELECT count(*) FROM t_join_a a JOIN t_join_b b ON a.grp = b.grp WHERE a.id < 5000;

SELECT left(query, 45) AS 쿼리, calls, plans,
       round(total_plan_time::numeric, 3) AS "계획ms_총합",
       round(mean_plan_time::numeric, 3)  AS "계획ms_평균",
       round(total_exec_time::numeric, 3) AS "실행ms_총합"
FROM   pg_stat_statements WHERE query LIKE '%t_join_a%';

\echo '  ^ 조인·서브쿼리가 많은 복잡한 쿼리는 "계획을 세우는 시간"만으로도 무시 못 할 비용이 든다.'
\echo '    total_plan_time 이 total_exec_time 에 맞먹는다면, PREPARE 로 계획을 재사용하는'
\echo '    것을 검토할 신호다.'

\echo ''
\echo '--- (4) temp 파일: work_mem 이 부족해서 디스크에 정렬/해시를 쓰는 쿼리 ---'
SELECT pg_stat_statements_reset();

SET work_mem = '64kB';  -- 일부러 작게 잡아 정렬이 디스크로 밀려나게 한다
-- 작은 LIMIT에서는 top-N 정렬이 메모리 안에 들어가 temp를 쓰지 않을 수 있다.
-- LIMIT이 있어도 n·행 크기·실행계획에 따라 spill할 수 있다.
-- 여기서는 LIMIT 없는 전체 정렬로 temp 사용을 재현한다. 결과를
-- 화면에 쏟아내지 않도록 바깥에서 count(*) 로만 감싼다.
SELECT count(*) FROM (SELECT pad FROM t_big ORDER BY pad) x;
RESET work_mem;

SELECT left(query, 40) AS 쿼리, calls,
       temp_blks_read AS "temp읽기", temp_blks_written AS "temp쓰기"
FROM   pg_stat_statements WHERE query LIKE 'SELECT count(*) FROM (SELECT pad%';

\echo '  ^ temp_blks_written > 0 이면 그 쿼리가 디스크에 임시 파일을 쓰고 있다는 뜻이다.'
\echo '    work_mem 을 늘리거나 쿼리를 고쳐야 할 가장 직접적인 신호 중 하나다.'

\echo ''
\echo '--- (5) JIT 컴파일 비용 (PostgreSQL 15+에서 pg_stat_statements 로 노출) ---'
SELECT pg_stat_statements_reset();
SHOW jit;

SET jit_above_cost = 0;      -- 비용에 상관없이 강제로 JIT 을 태운다 (실습용)
SET jit_inline_above_cost = 0;
SET jit_optimize_above_cost = 0;

SELECT count(*) FROM t_join_a a JOIN t_join_b b ON a.grp = b.grp;

RESET jit_above_cost; RESET jit_inline_above_cost; RESET jit_optimize_above_cost;

SELECT left(query, 40) AS 쿼리, calls,
       jit_functions AS "JIT함수수",
       round(jit_generation_time::numeric, 2)  AS "JIT생성ms",
       round(jit_inlining_time::numeric, 2)    AS "JIT인라인ms",
       round(jit_optimization_time::numeric, 2) AS "JIT최적화ms",
       round(jit_emission_time::numeric, 2)    AS "JIT코드생성ms"
FROM   pg_stat_statements WHERE query LIKE '%t_join_a a JOIN%';

\echo '  ^ JIT 은 대형 분석 쿼리의 실행은 빠르게 하지만, 컴파일 자체가 비용이다.'
\echo '    짧은 OLTP 쿼리에 JIT 이 잘못 켜지면 "컴파일 비용 > 절약한 실행 시간" 이 되어'
\echo '    오히려 느려진다 - jit_* 컬럼이 그 증거를 보여준다.'

\echo ''
\echo '--- (6) 이 항목들을 언제부터 볼 수 있었는지는 docs/03-version-history.md 에서 정리한다 ---'
