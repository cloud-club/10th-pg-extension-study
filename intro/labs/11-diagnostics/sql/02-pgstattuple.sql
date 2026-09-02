-- ===========================================================================
-- 02. pgstattuple - 테이블이 얼마나 부풀었나(bloat)
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pgstattuple;

DROP TABLE IF EXISTS t_bloat;
CREATE TABLE t_bloat AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,100000) g;

-- 기준선 정리: CREATE TABLE AS 는 파일을 조금 넉넉하게 늘려놓고 끝난다
-- (PostgreSQL 이 대량 INSERT 때 블록을 여러 개씩 미리 확장하기 때문).
-- 그 빈 꼬리를 먼저 걷어내지 않으면, 뒤에서 부르는 첫 VACUUM 이 그것까지
-- 잘라내면서 "VACUUM 이 파일을 줄였다"처럼 보인다. 실습의 요점이 흐려진다.
VACUUM t_bloat;

\echo '--- 처음 상태 ---'
SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플,
       round(dead_tuple_percent::numeric, 2) AS "죽은%",
       round(free_percent::numeric, 2) AS "여유%"
FROM   pgstattuple('t_bloat');

\echo ''
\echo '--- 1/3 을 삭제합니다 ---'
DELETE FROM t_bloat WHERE id % 3 = 0;

SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플,
       round(dead_tuple_percent::numeric, 2) AS "죽은%",
       round(free_percent::numeric, 2) AS "여유%"
FROM   pgstattuple('t_bloat');

\echo ''
\echo '  ^ 삭제해도 파일 크기는 그대로입니다. MVCC 때문에 행이 "죽은 튜플"로 남습니다.'

\echo ''
\echo '--- VACUUM 후 ---'
VACUUM t_bloat;
SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플,
       round(free_percent::numeric, 2) AS "여유%"
FROM   pgstattuple('t_bloat');

\echo ''
\echo '  ^ 죽은 튜플은 0 이 되었지만 파일 크기는 여전히 그대로입니다.'
\echo '    VACUUM 은 공간을 "재사용 가능"하게 만들 뿐, OS 에 돌려주지 않습니다.'
\echo '    (다음 INSERT 가 그 자리를 씁니다 - 그래서 대개 이걸로 충분합니다)'

\echo ''
\echo '--- 파일을 실제로 줄이려면 ---'
VACUUM FULL t_bloat;
SELECT pg_size_pretty(table_len) AS "VACUUM FULL 후", round(free_percent::numeric,2) AS "여유%"
FROM   pgstattuple('t_bloat');

\echo ''
\echo '  ⚠ VACUUM FULL 은 ACCESS EXCLUSIVE 락을 잡습니다. 그동안 읽기도 막힙니다.'
\echo '     운영 중인 큰 테이블에는 쓸 수 없습니다.'
\echo '     → 무중단 대안: pg_repack (extension). 락 없이 테이블을 재구성합니다.'

\echo ''
\echo '--- 인덱스 bloat 도 볼 수 있습니다 ---'
CREATE INDEX idx_bloat ON t_bloat (id);
SELECT version, index_size, root_block_no, internal_pages, leaf_pages,
       round(avg_leaf_density::numeric, 1) AS "리프밀도%"
FROM   pgstatindex('idx_bloat');

\echo ''
\echo '  ^ avg_leaf_density 가 낮으면 인덱스가 부풀어 있다는 뜻입니다.'
\echo '    REINDEX CONCURRENTLY 로 정리할 수 있습니다.'

\echo ''
\echo '  ⚠ pgstattuple 은 테이블 전체를 읽습니다. 큰 테이블에서는 느립니다.'
\echo '     빠른 근사치가 필요하면 pgstattuple_approx() 를 쓰세요.'
SELECT round(approx_free_percent::numeric,2) AS "근사 여유%", approx_free_space
FROM   pgstattuple_approx('t_bloat');
