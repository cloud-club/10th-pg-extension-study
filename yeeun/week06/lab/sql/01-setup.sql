-- 01: btree_gist + reservation table (EXCLUDE)
\echo --- 01 setup ---

CREATE EXTENSION IF NOT EXISTS btree_gist;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'btree_gist';

DROP TABLE IF EXISTS reservation_demo;
CREATE TABLE reservation_demo (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    during TSRANGE NOT NULL,
    CONSTRAINT valid_reservation
        CHECK (NOT isempty(during)),
    CONSTRAINT no_overlapping_reservation
        EXCLUDE USING gist (
            room_id WITH =,
            during WITH &&
        )
);

\echo --- range probe ---
SELECT
    tsrange('2026-10-20 10:00', '2026-10-20 11:00')
    &&
    tsrange('2026-10-20 10:30', '2026-10-20 11:30') AS overlap_true;

SELECT
    tsrange('2026-10-20 10:00', '2026-10-20 11:00')
    &&
    tsrange('2026-10-20 11:00', '2026-10-20 12:00') AS overlap_false;
