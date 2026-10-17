-- 02: bulk delete → size + dead tuples → VACUUM → size again
\echo --- 02 delete · vacuum ---

DELETE FROM repack_demo WHERE id <= 80000;

\echo --- after DELETE (before VACUUM / ANALYZE) ---
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

SELECT count(*) AS live_rows FROM repack_demo;

VACUUM repack_demo;

\echo --- after VACUUM ---
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
