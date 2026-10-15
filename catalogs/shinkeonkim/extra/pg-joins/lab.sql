\pset pager off
SELECT version();
DROP SCHEMA IF EXISTS join_lab CASCADE;
CREATE SCHEMA join_lab;
CREATE TABLE join_lab.students(id integer PRIMARY KEY, name text);
CREATE TABLE join_lab.orders(id integer PRIMARY KEY, student_id integer, category integer, region integer, payload text);
INSERT INTO join_lab.students SELECT i, 'student-'||i FROM generate_series(1,10000) i;
INSERT INTO join_lab.orders SELECT i, (i-1)%10000+1, i%100, (i/100)%100, repeat('x',100) FROM generate_series(1,100000) i;
CREATE INDEX ON join_lab.orders(student_id);
CREATE INDEX ON join_lab.orders(category);
CREATE INDEX ON join_lab.orders(region);
ANALYZE join_lab.students;
ANALYZE join_lab.orders;
SET max_parallel_workers_per_gather = 0;
\echo CASE default
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
\echo CASE nested-loop
BEGIN;
SET LOCAL enable_hashjoin=off;
SET LOCAL enable_mergejoin=off;
SELECT count(*) AS verified_rows FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
ROLLBACK;
\echo CASE hash
BEGIN;
SET LOCAL enable_nestloop=off;
SET LOCAL enable_mergejoin=off;
SELECT count(*) AS verified_rows FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
ROLLBACK;
\echo CASE merge
BEGIN;
SET LOCAL enable_nestloop=off;
SET LOCAL enable_hashjoin=off;
SELECT count(*) AS verified_rows FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE s.id<=100;
ROLLBACK;
\echo CASE bitmap
BEGIN;
SET LOCAL enable_seqscan=off;
SET LOCAL enable_nestloop=off;
SET LOCAL enable_mergejoin=off;
SELECT count(*) AS verified_rows FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE o.category=1 OR o.region=2;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id WHERE o.category=1 OR o.region=2;
ROLLBACK;
\echo CASE hash-low-memory
BEGIN;
SET LOCAL enable_nestloop=off;
SET LOCAL enable_mergejoin=off;
SET LOCAL work_mem='64kB';
SET LOCAL hash_mem_multiplier=1;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id;
ROLLBACK;
\echo CASE hash-high-memory
BEGIN;
SET LOCAL enable_nestloop=off;
SET LOCAL enable_mergejoin=off;
SET LOCAL work_mem='16MB';
SET LOCAL hash_mem_multiplier=1;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT s.id, o.id FROM join_lab.students s JOIN join_lab.orders o ON o.student_id=s.id;
ROLLBACK;
