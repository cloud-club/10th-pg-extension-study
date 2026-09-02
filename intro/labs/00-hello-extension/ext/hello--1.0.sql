CREATE FUNCTION hello(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT 'Hello, ' || name || '!' $$;
