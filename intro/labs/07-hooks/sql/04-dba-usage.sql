-- ===========================================================================
-- 04. 실제 운영에서 쓰는 방법
-- ===========================================================================
\echo '--- ① 총 실행 시간이 가장 큰 쿼리 (튜닝 우선순위) ---'
SELECT left(query, 45) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 1) AS 총ms,
       round(100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::int AS "전체대비%"
FROM   pg_stat_statements
ORDER  BY total_exec_time DESC LIMIT 5;

\echo ''
\echo '  ⚠ "평균이 느린 쿼리"가 아니라 "총합이 큰 쿼리"부터 봐야 합니다.'
\echo '     1초짜리 쿼리 10번(10초)보다 10ms 짜리 10만번(1000초)이 더 큰 문제입니다.'

\echo ''
\echo '--- ② 호출당 읽는 블록이 많은 쿼리 (I/O 범인) ---'
SELECT left(query, 45) AS 쿼리, calls,
       round((shared_blks_hit + shared_blks_read)::numeric / nullif(calls,0), 1) AS 호출당_블록
FROM   pg_stat_statements
WHERE  calls > 0
ORDER  BY 호출당_블록 DESC NULLS LAST LIMIT 5;

\echo ''
\echo '--- ③ 캐시 히트율이 낮은 쿼리 (디스크를 때리는 쿼리) ---'
SELECT left(query, 40) AS 쿼리,
       shared_blks_hit AS 캐시히트, shared_blks_read AS 디스크읽기,
       round(100.0 * shared_blks_hit /
             nullif(shared_blks_hit + shared_blks_read, 0), 1) AS "히트율%"
FROM   pg_stat_statements
WHERE  shared_blks_hit + shared_blks_read > 0
ORDER  BY shared_blks_read DESC LIMIT 5;

\echo ''
\echo '--- ④ 실행 시간 편차가 큰 쿼리 (가끔 튀는 쿼리) ---'
SELECT left(query, 45) AS 쿼리, calls,
       round(mean_exec_time::numeric, 2)   AS 평균ms,
       round(stddev_exec_time::numeric, 2) AS 표준편차,
       round(max_exec_time::numeric, 2)    AS 최대ms
FROM   pg_stat_statements
WHERE  calls > 1 ORDER BY stddev_exec_time DESC NULLS LAST LIMIT 5;

\echo ''
\echo '--- 운영 팁 ---'
\echo '  · 통계는 서버 시작 이후 누적입니다. 배포 전후 비교하려면 배포 직전에 reset 하세요.'
\echo '  · pg_stat_statements_reset() 은 기본적으로 superuser 만 실행할 수 있습니다.'
\echo '    (pg_read_all_stats 는 "통계를 보는" 권한이지 reset 권한이 아닙니다.'
\echo '     필요하면 GRANT EXECUTE ON FUNCTION pg_stat_statements_reset ... 으로 따로 줍니다)'
\echo '  · track=all 은 함수 내부 쿼리까지 잡아 유용하지만 오버헤드가 조금 더 큽니다.'
\echo '  · 이 extension 은 오버헤드가 작아서(보통 1~2%) 사실상 항상 켜두는 것이 권장됩니다.'
\echo '  · RDS/Cloud SQL 등 대부분의 매니지드 DB 가 기본 제공하거나 켤 수 있습니다.'
