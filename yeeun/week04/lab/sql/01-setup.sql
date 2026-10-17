-- 01: extension + demo table + bulk insert + size
\echo --- 01 setup · insert · size ---

CREATE EXTENSION IF NOT EXISTS pg_repack;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_repack';

DROP TABLE IF EXISTS repack_demo;
CREATE TABLE repack_demo (
    id BIGSERIAL PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO repack_demo(value)
SELECT repeat('A', 1000)
FROM generate_series(1, 100000);

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
