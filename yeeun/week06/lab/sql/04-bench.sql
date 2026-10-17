-- 04: scale bench — plain vs EXCLUDE, then chunked 100M (LOGGED, COMMIT per chunk)
\echo --- 04 scale bench ---

CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TABLE IF EXISTS bench_plain CASCADE;
DROP TABLE IF EXISTS bench_exclude CASCADE;
DROP TABLE IF EXISTS bench_scale CASCADE;
DROP PROCEDURE IF EXISTS bench_load_scale(bigint, bigint, int);

-- LOGGED: UNLOGGED 는 비정상 종료 시 데이터가 사라짐
CREATE TABLE bench_plain (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    during TSRANGE NOT NULL
);

CREATE TABLE bench_exclude (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    during TSRANGE NOT NULL,
    CONSTRAINT bench_exclude_no_overlap
        EXCLUDE USING gist (
            room_id WITH =,
            during WITH &&
        )
);

CREATE OR REPLACE FUNCTION bench_fill_rows(dest regclass, n bigint, rooms int DEFAULT 1000)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format($f$
    INSERT INTO %s (room_id, during)
    SELECT
      (g %% %s) + 1,
      tsrange(
        TIMESTAMP '2020-01-01' + make_interval(hours => (g / %s)::int),
        TIMESTAMP '2020-01-01' + make_interval(hours => (g / %s)::int + 1)
      )
    FROM generate_series(0, %s - 1) AS g
  $f$, dest, rooms, rooms, rooms, n);
END;
$$;

\echo --- A) 100,000 INSERT · plain ---
DO $$
DECLARE t0 timestamptz; elapsed double precision;
BEGIN
  t0 := clock_timestamp();
  PERFORM bench_fill_rows('bench_plain'::regclass, 100000);
  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH plain_100k_sec=%', round(elapsed::numeric, 3);
  RAISE NOTICE 'BENCH plain_100k_rows_per_sec=%', round((100000 / elapsed)::numeric, 0);
END $$;
TRUNCATE bench_plain RESTART IDENTITY;

\echo --- B) 100,000 INSERT · EXCLUDE+GiST ---
DO $$
DECLARE t0 timestamptz; elapsed double precision;
BEGIN
  t0 := clock_timestamp();
  PERFORM bench_fill_rows('bench_exclude'::regclass, 100000);
  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH exclude_100k_sec=%', round(elapsed::numeric, 3);
  RAISE NOTICE 'BENCH exclude_100k_rows_per_sec=%', round((100000 / elapsed)::numeric, 0);
END $$;

\echo --- C) 1,000,000 INSERT · EXCLUDE+GiST ---
TRUNCATE bench_exclude RESTART IDENTITY;
DO $$
DECLARE t0 timestamptz; elapsed double precision;
BEGIN
  t0 := clock_timestamp();
  PERFORM bench_fill_rows('bench_exclude'::regclass, 1000000);
  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH exclude_1m_sec=%', round(elapsed::numeric, 3);
  RAISE NOTICE 'BENCH exclude_1m_rows_per_sec=%', round((1000000 / elapsed)::numeric, 0);
END $$;

\echo --- D) conflict INSERT latency @1M rows ---
DO $$
DECLARE t0 timestamptz; elapsed double precision;
BEGIN
  t0 := clock_timestamp();
  BEGIN
    INSERT INTO bench_exclude(room_id, during)
    VALUES (1, tsrange(TIMESTAMP '2020-01-01', TIMESTAMP '2020-01-01' + interval '1 hour'));
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;
  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH conflict_at_1m_ms=%', round((elapsed * 1000)::numeric, 3);
END $$;

SELECT
  pg_size_pretty(pg_total_relation_size('bench_exclude')) AS exclude_1m_total_size,
  (SELECT count(*) FROM bench_exclude) AS exclude_rows;

\echo --- E) scale to 100M · EXCLUDE · COMMIT per 1M chunk ---
DROP TABLE IF EXISTS bench_exclude;
-- UNLOGGED: 속도 우선. 비정상 종료 시 테이블이 비워질 수 있음 → 완료까지 Docker 유지.
CREATE UNLOGGED TABLE bench_scale (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    during TSRANGE NOT NULL,
    CONSTRAINT bench_scale_no_overlap
        EXCLUDE USING gist (
            room_id WITH =,
            during WITH &&
        )
);

CREATE OR REPLACE PROCEDURE bench_load_scale(
  target bigint DEFAULT 100000000,
  chunk bigint DEFAULT 1000000,
  rooms int DEFAULT 1000
)
LANGUAGE plpgsql AS $$
DECLARE
  loaded bigint := 0;
  this_chunk bigint;
  t0 timestamptz := clock_timestamp();
  t_chunk timestamptz;
  elapsed double precision;
  chunk_elapsed double precision;
BEGIN
  SELECT COALESCE(max(id), 0) INTO loaded FROM bench_scale;
  -- id 는 1부터지만 fill 은 0-based g 를 쓰므로, resume 시 loaded = count
  SELECT count(*) INTO loaded FROM bench_scale;
  RAISE NOTICE 'BENCH scale_resume_from=%', loaded;

  WHILE loaded < target LOOP
    this_chunk := LEAST(chunk, target - loaded);
    t_chunk := clock_timestamp();
    INSERT INTO bench_scale (room_id, during)
    SELECT
      (g % rooms) + 1,
      tsrange(
        TIMESTAMP '2020-01-01' + make_interval(hours => (g / rooms)::int),
        TIMESTAMP '2020-01-01' + make_interval(hours => (g / rooms)::int + 1)
      )
    FROM generate_series(loaded, loaded + this_chunk - 1) AS g;
    loaded := loaded + this_chunk;
    COMMIT;
    chunk_elapsed := extract(epoch FROM (clock_timestamp() - t_chunk));
    elapsed := extract(epoch FROM (clock_timestamp() - t0));
    RAISE NOTICE 'BENCH scale_loaded=% chunk_sec=% total_sec=% rows_per_sec=%',
      loaded,
      round(chunk_elapsed::numeric, 2),
      round(elapsed::numeric, 1),
      round((loaded / greatest(elapsed, 0.001))::numeric, 0);
  END LOOP;
  RAISE NOTICE 'BENCH_DONE_SCALE_SEC=%',
    round(extract(epoch FROM (clock_timestamp() - t0))::numeric, 1);
END;
$$;

CALL bench_load_scale(100000000, 1000000, 1000);

SELECT
  (SELECT count(*) FROM bench_scale) AS scale_rows,
  pg_size_pretty(pg_relation_size('bench_scale')) AS heap,
  pg_size_pretty(pg_indexes_size('bench_scale')) AS indexes,
  pg_size_pretty(pg_total_relation_size('bench_scale')) AS total_with_indexes;

\echo --- F) overlap query @100M ---
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM bench_scale
WHERE room_id = 1
  AND during && tsrange(
    TIMESTAMP '2020-01-01' + interval '1000 hours',
    TIMESTAMP '2020-01-01' + interval '1001 hours'
  );

\echo --- G) conflict INSERT latency @100M ---
DO $$
DECLARE t0 timestamptz; elapsed double precision;
BEGIN
  t0 := clock_timestamp();
  BEGIN
    INSERT INTO bench_scale(room_id, during)
    VALUES (1, tsrange(TIMESTAMP '2020-01-01', TIMESTAMP '2020-01-01' + interval '1 hour'));
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;
  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH conflict_at_100m_ms=%', round((elapsed * 1000)::numeric, 3);
END $$;

SELECT version();
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
