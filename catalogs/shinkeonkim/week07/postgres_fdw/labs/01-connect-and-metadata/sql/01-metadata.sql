SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name='postgres_fdw';
SELECT extname, extversion FROM pg_extension WHERE extname='postgres_fdw';
SELECT srvname, srvoptions FROM pg_foreign_server;
SELECT foreign_table_schema, foreign_table_name FROM information_schema.foreign_tables;
SELECT id, title FROM remote_school.books WHERE id IN (1,1000,2000) ORDER BY id;
