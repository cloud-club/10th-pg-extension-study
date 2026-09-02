-- 기능 추가
CREATE FUNCTION bye(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT 'Bye, ' || name || '!' $$;

-- 기존 함수 수정은 반드시 CREATE OR REPLACE 로.
-- DROP 후 CREATE 하면 pg_depend 의 소속 정보가 끊어진다.
CREATE OR REPLACE FUNCTION hello(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT '안녕하세요, ' || name || '님!' $$;
