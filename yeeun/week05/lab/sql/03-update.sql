-- 03: UPDATE also enforced by CHECK
\echo --- 03 update ---

UPDATE product_json_demo
SET data = '{"name":"Keyboard","price":45000}'::jsonb
WHERE id = 1
RETURNING id, data;

\echo --- invalid UPDATE ---
DO $$
BEGIN
  UPDATE product_json_demo
  SET data = '{"name":"Keyboard","price":"오만원"}'::jsonb
  WHERE id = 1;
  RAISE EXCEPTION 'expected check failure on UPDATE';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'FAIL as expected: bad UPDATE → check_violation';
END $$;

SELECT id, data FROM product_json_demo ORDER BY id;

SELECT version();
SELECT extname, extversion FROM pg_extension WHERE extname = 'postgres-json-schema';
