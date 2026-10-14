CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS dblink;
CREATE EXTENSION IF NOT EXISTS file_fdw;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE SERVER IF NOT EXISTS school_remote FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'remote', port '5432', dbname 'school', application_name 'week07-labs',
 connect_timeout '5', fetch_size '100', keep_connections 'true',
 use_remote_estimate 'false', extensions '');
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER SERVER school_remote
OPTIONS (user 'fdw_reader', password 'study_only');
CREATE SCHEMA IF NOT EXISTS remote_school;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='remote_school' AND c.relname='books') THEN
   IMPORT FOREIGN SCHEMA public LIMIT TO (books, publishers, tx_probe)
   FROM SERVER school_remote INTO remote_school;
 END IF;
END $$;
CREATE SERVER IF NOT EXISTS writable_remote FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'remote', port '5432', dbname 'school', application_name 'week07-writer', connect_timeout '5');
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER SERVER writable_remote
OPTIONS (user 'fdw_writer', password 'study_write_only');
CREATE SCHEMA IF NOT EXISTS writable_school;
CREATE FOREIGN TABLE IF NOT EXISTS writable_school.tx_probe (id integer, value text)
SERVER writable_remote OPTIONS (schema_name 'public', table_name 'tx_probe');
CREATE TABLE IF NOT EXISTS public.favorite_books (book_id integer PRIMARY KEY, reader_name text);
INSERT INTO public.favorite_books VALUES (1,'Alice'),(1000,'Bob'),(2000,'Carol') ON CONFLICT DO NOTHING;
ANALYZE public.favorite_books;
CREATE OR REPLACE FUNCTION public.local_small(n integer) RETURNS boolean
LANGUAGE plpgsql VOLATILE AS $$ BEGIN RETURN n <= 10; END $$;
CREATE SERVER IF NOT EXISTS csv_files FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE IF NOT EXISTS public.csv_books (id integer, title text)
SERVER csv_files OPTIONS (filename '/lab/books.csv', format 'csv', header 'true');
