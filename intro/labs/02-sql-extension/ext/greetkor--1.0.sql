-- greetkor--1.0.sql : 최초 설치 스크립트
-- 이 파일이 실행되는 동안 creating_extension = true 이므로,
-- 여기서 만든 모든 객체에 pg_depend deptype='e' 가 자동으로 붙는다.

-- CREATE EXTENSION 이 아닌 방법으로 이 파일을 실행하는 것을 막는 관용구
\echo Use "CREATE EXTENSION greetkor" to load this file. \quit

CREATE FUNCTION greet(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT '안녕하세요, ' || name || '님!' $$;

CREATE FUNCTION farewell(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT '안녕히 가세요, ' || name || '님!' $$;
