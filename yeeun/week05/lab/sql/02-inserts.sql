-- 02: valid insert + invalid cases (expect errors; capture with DO blocks)
\echo --- 02 inserts ---

\echo --- valid ---
INSERT INTO product_json_demo(data)
VALUES ('{"name":"Keyboard","price":50000}'::jsonb)
RETURNING id, data;

\echo --- invalid: price as string ---
DO $$
BEGIN
  INSERT INTO product_json_demo(data)
  VALUES ('{"name":"Keyboard","price":"50000"}'::jsonb);
  RAISE EXCEPTION 'expected check failure (price string)';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL as expected: price string → check_violation';
END $$;

\echo --- invalid: missing price ---
DO $$
BEGIN
  INSERT INTO product_json_demo(data)
  VALUES ('{"name":"Keyboard"}'::jsonb);
  RAISE EXCEPTION 'expected check failure (missing price)';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL as expected: missing price → check_violation';
END $$;

\echo --- invalid: additionalProperties ---
DO $$
BEGIN
  INSERT INTO product_json_demo(data)
  VALUES ('{"name":"Keyboard","price":50000,"hello":"world"}'::jsonb);
  RAISE EXCEPTION 'expected check failure (additionalProperties)';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL as expected: additionalProperties → check_violation';
END $$;

\echo --- invalid: negative price ---
DO $$
BEGIN
  INSERT INTO product_json_demo(data)
  VALUES ('{"name":"Keyboard","price":-1000}'::jsonb);
  RAISE EXCEPTION 'expected check failure (minimum)';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL as expected: price < 0 → check_violation';
END $$;

SELECT count(*) AS rows_after_inserts FROM product_json_demo;
