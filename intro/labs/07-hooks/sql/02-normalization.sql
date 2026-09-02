-- ===========================================================================
-- 02. 쿼리 정규화 - 이 extension 의 핵심 아이디어
-- ===========================================================================
SELECT pg_stat_statements_reset() IS NOT NULL AS 통계_초기화;

DROP TABLE IF EXISTS t_demo;
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;

\echo '--- 서로 다른 상수로 같은 모양의 쿼리를 여러 번 실행 ---'
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;
SELECT h FROM t_demo WHERE id = 42;
SELECT h FROM t_demo WHERE id = 4242;

\echo ''
\echo '--- 수집된 통계 ---'
SELECT left(query, 50) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 2) AS 총ms,
       round(mean_exec_time::numeric, 3)  AS 평균ms, rows AS 행수
FROM   pg_stat_statements
WHERE  query LIKE '%t_demo%' AND query NOT LIKE '%pg_stat%'
ORDER  BY total_exec_time DESC;

\echo ''
\echo '  ^ id < 100 / 200 / 300 이 "id < $1" 하나로 합쳐져 calls=3 이 되었습니다.'
\echo '    이것이 정규화(normalization)입니다.'
\echo ''
\echo '  왜 중요한가:'
\echo '    정규화가 없으면 상수만 다른 쿼리가 수백만 개의 별개 항목이 됩니다.'
\echo '    그러면 "무엇이 느린가"를 알 수 없습니다.'
\echo '    정규화 덕분에 "이 쿼리 패턴이 전체 시간의 60%를 쓴다"를 알 수 있습니다.'

\echo ''
\echo '--- queryid: 쿼리 모양의 지문 ---'
SELECT queryid, left(query, 45) AS 쿼리, calls
FROM   pg_stat_statements WHERE query LIKE '%t_demo%' ORDER BY calls DESC LIMIT 5;

\echo ''
\echo '--- 실행 중인 쿼리에도 같은 queryid 가 붙습니다 ---'
SHOW compute_query_id;
SELECT pid, query_id, left(query, 40) AS query
FROM   pg_stat_activity WHERE pid = pg_backend_pid();

\echo ''
\echo '  → pg_stat_activity(지금 뭐가 돌고 있나)와 pg_stat_statements(누적 통계)를'
\echo '    queryid 로 조인할 수 있습니다. "지금 느린 이 쿼리, 평소에도 느렸나?"'
