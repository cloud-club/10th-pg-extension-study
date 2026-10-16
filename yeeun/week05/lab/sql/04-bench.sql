-- 04: 20,000 INSERT 성능 (plain JSONB vs CHECK + validate_json_schema)
\echo --- 04 bench 20k INSERT ---

CREATE EXTENSION IF NOT EXISTS "postgres-json-schema";

DROP TABLE IF EXISTS bench_plain;
DROP TABLE IF EXISTS bench_schema;

CREATE TABLE bench_plain (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL
);

CREATE TABLE bench_schema (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    CONSTRAINT bench_schema_data_check CHECK (
        validate_json_schema(
            '{
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "price": { "type": "number", "minimum": 0 }
              },
              "required": ["name", "price"],
              "additionalProperties": false
            }'::jsonb,
            data
        )
    )
);

-- 워밍업 (공유 버퍼 / 플랜)
INSERT INTO bench_plain(data)
SELECT jsonb_build_object('name', 'warm', 'price', 1)
FROM generate_series(1, 100);
TRUNCATE bench_plain RESTART IDENTITY;

\echo --- A) plain JSONB · 20,000 INSERT ---
DO $$
DECLARE
  t0 timestamptz := clock_timestamp();
  elapsed double precision;
BEGIN
  INSERT INTO bench_plain(data)
  SELECT jsonb_build_object('name', 'Item-' || g, 'price', g)
  FROM generate_series(1, 20000) AS g;

  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH plain_20k_sec=%', round(elapsed::numeric, 3);
  RAISE NOTICE 'BENCH plain_20k_ms=%', round((elapsed * 1000)::numeric, 1);
END $$;

\echo --- B) CHECK + validate_json_schema · 20,000 INSERT ---
DO $$
DECLARE
  t0 timestamptz := clock_timestamp();
  elapsed double precision;
BEGIN
  INSERT INTO bench_schema(data)
  SELECT jsonb_build_object('name', 'Item-' || g, 'price', g)
  FROM generate_series(1, 20000) AS g;

  elapsed := extract(epoch FROM (clock_timestamp() - t0));
  RAISE NOTICE 'BENCH schema_20k_sec=%', round(elapsed::numeric, 3);
  RAISE NOTICE 'BENCH schema_20k_ms=%', round((elapsed * 1000)::numeric, 1);
END $$;

\echo --- 요약 ---
SELECT
  (SELECT count(*) FROM bench_plain)  AS plain_rows,
  (SELECT count(*) FROM bench_schema) AS schema_rows;

SELECT version();
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'postgres-json-schema';
