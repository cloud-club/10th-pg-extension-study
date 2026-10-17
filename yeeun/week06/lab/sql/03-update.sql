-- 03: UPDATE also enforced
\echo --- 03 update ---

\echo --- overlapping UPDATE (expect fail) ---
DO $$
BEGIN
  UPDATE reservation_demo
  SET during = tsrange('2026-10-20 10:30', '2026-10-20 11:30')
  WHERE room_id = 1
    AND during = tsrange('2026-10-20 11:00', '2026-10-20 12:00');
  RAISE EXCEPTION 'expected exclusion_violation on UPDATE';
EXCEPTION WHEN exclusion_violation THEN
  RAISE NOTICE 'FAIL as expected: overlapping UPDATE → exclusion_violation';
END $$;

\echo --- valid UPDATE (room2 later) ---
UPDATE reservation_demo
SET during = tsrange('2026-10-20 12:00', '2026-10-20 13:00')
WHERE room_id = 2
RETURNING id, room_id, during;

SELECT id, room_id, during FROM reservation_demo ORDER BY id;
SELECT version();
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
