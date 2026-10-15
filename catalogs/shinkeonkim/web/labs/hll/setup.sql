CREATE EXTENSION IF NOT EXISTS hll;
DROP SCHEMA IF EXISTS hll_lab CASCADE;
CREATE SCHEMA hll_lab;
CREATE TABLE hll_lab.events(day date NOT NULL,user_id integer);
INSERT INTO hll_lab.events
SELECT DATE '2026-01-01'+d, d*2500+(i-1)%10000+1
FROM generate_series(0,6) d CROSS JOIN generate_series(1,30000) i;
ANALYZE hll_lab.events;
