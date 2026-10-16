CREATE TABLE work (id int PRIMARY KEY, attempts int NOT NULL DEFAULT 0, done boolean NOT NULL DEFAULT false);
INSERT INTO work(id) SELECT generate_series(1,40);
CREATE TABLE effects (id int PRIMARY KEY REFERENCES work, worker int NOT NULL);
CREATE FUNCTION consume(w int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE item int;
BEGIN
 FOR item IN SELECT id FROM work WHERE NOT done ORDER BY id
             LIMIT 5 FOR UPDATE SKIP LOCKED LOOP
   PERFORM pg_sleep(0.05);
   INSERT INTO effects VALUES(item,w);
   UPDATE work SET done=true, attempts=attempts+1 WHERE id=item;
 END LOOP;
END $$;
CREATE TABLE fault_effects (id int PRIMARY KEY);
CREATE FUNCTION fail_after_write() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO fault_effects VALUES(1);
 RAISE EXCEPTION 'intentional failure after insert';
END $$;
