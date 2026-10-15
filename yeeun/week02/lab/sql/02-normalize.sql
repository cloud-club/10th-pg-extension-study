-- ===========================================================================
-- 02. 정규화 확인
-- 목적: genre 상수만 다른 SQL이 genre = $1 한 줄로 합쳐지고 calls가 늘어나는지
--       → pg_stat_statements Extension의 핵심 동작
-- ===========================================================================
SELECT pg_stat_statements_reset() IS NOT NULL AS reset_ok;

\echo '--- genre literal 만 다른 동일 패턴 실행 ---'
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '과학';
SELECT count(*) FROM books WHERE genre = '기술';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '과학';
SELECT count(*) FROM books WHERE genre = '기술';

\echo '--- 정규화 결과 (calls 가 합쳐져야 함) ---'
SELECT
    queryid,
    left(query, 70) AS query,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 3) AS avg_ms,
    rows
FROM pg_stat_statements
WHERE query LIKE '%books%'
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC;

\echo ''
\echo '  기대: genre = $1 형태로 합쳐지고 calls >= 6'
