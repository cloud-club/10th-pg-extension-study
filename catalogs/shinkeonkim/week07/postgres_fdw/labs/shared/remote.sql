CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fdw_reader') THEN
    CREATE ROLE fdw_reader LOGIN PASSWORD 'study_only';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fdw_writer') THEN
    CREATE ROLE fdw_writer LOGIN PASSWORD 'study_write_only';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.publishers (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO public.publishers SELECT n, 'Publisher ' || n FROM generate_series(1,100) n ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.books (
  id integer PRIMARY KEY, title text NOT NULL, category text NOT NULL,
  publisher_id integer NOT NULL REFERENCES public.publishers(id), payload text NOT NULL
);
INSERT INTO public.books
SELECT n, CASE WHEN n % 1000=0 THEN 'PostgreSQL guide ' || n ELSE 'Network handbook ' || n END,
  CASE WHEN n % 2=0 THEN 'database' ELSE 'network' END,
  (n % 100)+1, repeat(md5(n::text),8)
FROM generate_series(1,100000) n ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS books_title_trgm ON public.books USING gin (title gin_trgm_ops);
CREATE TABLE IF NOT EXISTS public.tx_probe (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO public.tx_probe VALUES (1,'before') ON CONFLICT DO NOTHING;
GRANT CONNECT ON DATABASE school TO fdw_reader, fdw_writer;
GRANT USAGE ON SCHEMA public TO fdw_reader, fdw_writer;
GRANT SELECT ON public.books, public.publishers, public.tx_probe TO fdw_reader;
GRANT SELECT, UPDATE ON public.tx_probe TO fdw_writer;
ANALYZE public.books;
ANALYZE public.publishers;
