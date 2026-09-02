-- ===========================================================================
-- 00. 먼저 "옛날 방식"으로 만들어봅니다  (~ PostgreSQL 9.0)
--
--     9.1 이전에는 extension 이라는 개념 자체가 없었습니다.
--     기능을 추가하려면 그냥 SQL 스크립트를 실행했습니다:
--         $ psql -d mydb -f /usr/share/postgresql/8.4/contrib/hstore.sql
--
--     여기서는 그 방식으로 old_hello() 를 만듭니다.
--     이어지는 스크립트에서 만들 hello() 와 "하는 일이 완전히 같은" 함수입니다.
--     달라지는 건 오직 하나 - 포장했느냐입니다.
-- ===========================================================================

DROP FUNCTION IF EXISTS old_hello(text);

\echo '+----------------------------------------------------------+'
\echo '| 옛날 방식: 그냥 CREATE FUNCTION                          |'
\echo '+----------------------------------------------------------+'

CREATE FUNCTION old_hello(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT 'Hello, ' || name || '!' $$;

\echo ''
\echo '--- 잘 됩니다 ---'
SELECT old_hello('세계') AS 결과;

\echo ''
\echo '  ^ 동작에는 아무 문제가 없습니다.'
\echo '    "그럼 extension 이 왜 필요하지?" 라는 의문이 드는 게 정상입니다.'
\echo '    지금부터 그 답을 하나씩 확인합니다.'

\echo ''
\echo '--- ① DB 는 이걸 "패키지"로 보지 않습니다 ---'
\echo '\\dx'
\dx
\echo '  ^ 목록에 old_hello 가 없습니다. 그냥 함수 하나가 떠 있을 뿐입니다.'

\echo ''
\echo '--- ② 소속이 어디에도 기록되지 않았습니다 ---'
SELECT count(*) AS "old_hello 의 소속 기록"
FROM   pg_depend d JOIN pg_proc p ON p.oid = d.objid
WHERE  p.proname = 'old_hello' AND d.deptype = 'e';

\echo ''
\echo '  ^ 0 건. 내가 만든 다른 함수들과 구분할 방법이 없습니다.'
\echo '    함수가 100개라면 "어느 게 이 패키지 소속인지" 아무도 모릅니다.'

\echo ''
\echo '--- ③ 버전이라는 개념이 없습니다 ---'
\echo '    old_hello 가 몇 버전인가요? 답할 방법이 없습니다.'
\echo '    다음 버전을 배포하려면? 사용자가 스크립트를 다시 실행해야 하는데,'
\echo '    무엇이 바뀌었는지는 직접 diff 를 떠서 알아내야 합니다.'

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 이제 같은 함수를 extension 으로 만들어봅니다             |'
\echo '|   -> 01-build-from-scratch.sql                           |'
\echo '| 마지막에 둘을 나란히 비교합니다                          |'
\echo '|   -> 04-compare.sql                                      |'
\echo '+----------------------------------------------------------+'
