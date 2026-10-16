-- 04: rebuild bloated state, then pg_repack (online reorg)
-- 01~03 을 이미 돌렸으면 FULL 뒤 크기가 작아진 상태라,
-- DELETE 후 VACUUM만 한 상태에서 repack 효과를 보기 위해 다시 만든다.
\echo --- 04 rebuild bloat · pg_repack ---

TRUNCATE repack_demo RESTART IDENTITY;

INSERT INTO repack_demo(value)
SELECT repeat('A', 1000)
FROM generate_series(1, 100000);

DELETE FROM repack_demo WHERE id <= 80000;
VACUUM repack_demo;
ANALYZE repack_demo;

\echo --- before pg_repack (after DELETE + VACUUM only) ---
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
