SELECT * FROM dblink('host=remote dbname=school user=fdw_reader password=study_only',
 'SELECT id,title FROM public.books WHERE id<=3 ORDER BY id') AS r(id integer,title text);
SELECT * FROM public.csv_books ORDER BY id;
SELECT query,calls,rows,total_exec_time FROM pg_stat_statements WHERE query LIKE '%remote_school.books%' ORDER BY calls DESC LIMIT 5;
