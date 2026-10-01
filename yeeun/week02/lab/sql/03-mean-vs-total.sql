-- ===========================================================================
-- 03. mean vs total
-- mean  = 1회 평균 ("한 방이 느린가")
-- total = 누적 합  ("전체로 얼마나 잡아먹었나") ≈ mean × calls
-- Slow Query Log는 보통 mean/한 방 쪽에 가깝고, 튜닝 우선순위는 보통 total
-- ===========================================================================
SELECT pg_stat_statements_reset() IS NOT NULL AS reset_ok;

\echo '--- A: 한 번이 느린 쿼리 (소수 실행) ---'
SELECT pg_sleep(0.05);
SELECT pg_sleep(0.05);

\echo '--- B: 한 번은 가볍지만 아주 자주 실행 (소설 권수 조회) ---'
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';

\echo '--- ORDER BY mean_exec_time (느린 쿼리) ---'
SELECT
    left(query, 70) AS query,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND calls > 0
ORDER BY mean_exec_time DESC
LIMIT 5;

\echo '--- ORDER BY total_exec_time (비싼 쿼리 = 누적 시간) ---'
SELECT
    left(query, 70) AS query,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND calls > 0
ORDER BY total_exec_time DESC
LIMIT 5;

\echo ''
\echo '  기대:'
\echo '  · mean 1등  ≈ SELECT pg_sleep($1)'
\echo '  · total 1등 ≈ genre = $1 count'
