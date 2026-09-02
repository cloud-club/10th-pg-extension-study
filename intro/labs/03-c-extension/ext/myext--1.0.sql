-- myext--1.0.sql : C 함수를 SQL 함수로 바인딩
\echo Use "CREATE EXTENSION myext" to load this file. \quit

-- AS 'MODULE_PATHNAME' 은 control 파일의 module_pathname 값으로 치환된다.
-- 두 번째 인자를 생략하면 SQL 함수명 == C 심볼명 으로 간주한다.
CREATE FUNCTION myext_add(a integer, b integer) RETURNS integer
AS 'MODULE_PATHNAME', 'myext_add'
LANGUAGE C STRICT IMMUTABLE;

CREATE FUNCTION myext_hello(name text) RETURNS text
AS 'MODULE_PATHNAME', 'myext_hello'
LANGUAGE C STRICT VOLATILE;

-- STRICT 를 붙이지 않았다 => NULL 인자로도 C 함수가 호출된다
CREATE FUNCTION myext_double_or_zero(n integer) RETURNS integer
AS 'MODULE_PATHNAME', 'myext_double_or_zero'
LANGUAGE C IMMUTABLE;

CREATE FUNCTION myext_shout(s text) RETURNS text
AS 'MODULE_PATHNAME', 'myext_shout'
LANGUAGE C STRICT STABLE;   -- GUC 를 읽으므로 IMMUTABLE 이 아니라 STABLE

CREATE FUNCTION myext_count_rows(relname text) RETURNS bigint
AS 'MODULE_PATHNAME', 'myext_count_rows'
LANGUAGE C STRICT VOLATILE;
