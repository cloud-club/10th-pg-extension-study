-- 01: extension + table with JSON Schema CHECK
\echo --- 01 setup ---

CREATE EXTENSION IF NOT EXISTS "postgres-json-schema";

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'postgres-json-schema';

DROP TABLE IF EXISTS product_json_demo;
CREATE TABLE product_json_demo (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    CONSTRAINT product_json_demo_data_schema CHECK (
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

\echo --- schema probe (function only) ---
SELECT validate_json_schema('{"type":"object"}'::jsonb, '{}'::jsonb) AS object_ok;
SELECT validate_json_schema('{"type":"object"}'::jsonb, '1'::jsonb) AS number_as_root;
