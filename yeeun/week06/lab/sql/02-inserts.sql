-- 02: INSERT success / exclusion_violation / other room
\echo --- 02 inserts ---

\echo --- room1 10-11 ---
INSERT INTO reservation_demo(room_id, during)
VALUES (1, tsrange('2026-10-20 10:00', '2026-10-20 11:00'))
RETURNING id, room_id, during;

\echo --- room1 11-12 (adjacent, OK) ---
INSERT INTO reservation_demo(room_id, during)
VALUES (1, tsrange('2026-10-20 11:00', '2026-10-20 12:00'))
RETURNING id, room_id, during;

\echo --- room1 10:30-11:30 (overlap → fail) ---
DO $$
BEGIN
  INSERT INTO reservation_demo(room_id, during)
  VALUES (1, tsrange('2026-10-20 10:30', '2026-10-20 11:30'));
  RAISE EXCEPTION 'expected exclusion_violation';
EXCEPTION WHEN exclusion_violation THEN
  RAISE NOTICE 'FAIL as expected: overlapping same room → exclusion_violation (23P01)';
END $$;

\echo --- room2 same time (OK) ---
INSERT INTO reservation_demo(room_id, during)
VALUES (2, tsrange('2026-10-20 10:30', '2026-10-20 11:30'))
RETURNING id, room_id, during;

SELECT count(*) AS rows_after FROM reservation_demo;
SELECT id, room_id, during FROM reservation_demo ORDER BY id;
