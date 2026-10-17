-- 05: size after pg_repack (run CLI between 04 and 05)
\echo --- 05 after pg_repack ---

ANALYZE repack_demo;

SELECT
    pg_size_pretty(pg_relation_size('repack_demo')) AS table_size,
    pg_size_pretty(pg_indexes_size('repack_demo')) AS indexes_size,
    pg_size_pretty(pg_total_relation_size('repack_demo')) AS total_size;

SELECT count(*) AS live_rows FROM repack_demo;

SELECT
    relname,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'repack_demo';
