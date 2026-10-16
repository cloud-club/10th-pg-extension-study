ALTER SERVER school_remote OPTIONS (SET fetch_size '100');
EXPLAIN (ANALYZE, VERBOSE) SELECT id,title FROM remote_school.books WHERE id<=10000;
ALTER SERVER school_remote OPTIONS (SET fetch_size '1000');
EXPLAIN (ANALYZE, VERBOSE) SELECT id,title FROM remote_school.books WHERE id<=10000;
ALTER SERVER school_remote OPTIONS (SET fetch_size '100');
