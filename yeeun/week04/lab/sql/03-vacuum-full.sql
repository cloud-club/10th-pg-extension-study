-- 03: VACUUM FULL — rewrite · size shrink (takes ACCESS EXCLUSIVE)
\echo --- 03 VACUUM FULL ---

VACUUM FULL repack_demo;
ANALYZE repack_demo;

SELECT
    pg_size_pretty(pg_relation_size('repack_demo')) AS table_size,
    pg_size_pretty(pg_indexes_size('repack_demo')) AS indexes_size,
    pg_size_pretty(pg_total_relation_size('repack_demo')) AS total_size;

SELECT
    relname,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'repack_demo';
