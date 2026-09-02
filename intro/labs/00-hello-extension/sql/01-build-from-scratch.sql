-- ===========================================================================
-- 01. 맨손으로 Extension 만들기
--
--     컴파일러도, Makefile 도, 빌드 도구도 쓰지 않습니다.
--     텍스트 파일 두 개를 만들면 그게 extension 입니다.
-- ===========================================================================

-- (재실행 가능하도록 초기화 - 처음 돌릴 때는 아무것도 지우지 않는다)
DROP EXTENSION IF EXISTS hello;
\echo '  [컨테이너 셸] $ rm -f /usr/share/postgresql/16/extension/hello.control /usr/share/postgresql/16/extension/hello--*.sql'
\! rm -f /usr/share/postgresql/16/extension/hello.control /usr/share/postgresql/16/extension/hello--*.sql

\echo '+----------------------------------------------------------+'
\echo '| STEP 0. 지금은 hello 라는 extension 이 존재하지 않는다   |'
\echo '+----------------------------------------------------------+'
SELECT count(*) AS "설치 가능한가?" FROM pg_available_extensions WHERE name = 'hello';

DO $$ BEGIN
    PERFORM hello('세계');
EXCEPTION WHEN undefined_function THEN RAISE NOTICE '함수도 없다: %', SQLERRM; END $$;

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| STEP 1. control 파일 만들기  (파일 1 / 2)                |'
\echo '+----------------------------------------------------------+'
\echo '  extension 의 이름표입니다. 이게 없으면 CREATE EXTENSION 이 불가능합니다.'
\echo ''

\echo '  [컨테이너 셸] $ printf "%s\\n" "comment = \'내가 만든 첫 extension\'" "default_version = \'1.0\'" "relocatable = true" > /usr/share/postgresql/16/extension/hello.control'
\! printf "%s\n" "comment = '내가 만든 첫 extension'" "default_version = '1.0'" "relocatable = true" > /usr/share/postgresql/16/extension/hello.control

\echo '  [컨테이너 셸] $ echo \'  → 만들어진 hello.control :\' ; echo ; sed \'s/^/      /\' /usr/share/postgresql/16/extension/hello.control'
\! echo '  → 만들어진 hello.control :' ; echo ; sed 's/^/      /' /usr/share/postgresql/16/extension/hello.control

\echo ''
\echo '  세 줄이 전부입니다.'
\echo '  module_pathname 이 없으므로 .so 파일도 필요 없습니다 (= SQL-only extension).'

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| STEP 2. 설치 스크립트 만들기  (파일 2 / 2)               |'
\echo '+----------------------------------------------------------+'
\echo '  파일명 규칙: <이름>--<버전>.sql   →   hello--1.0.sql'
\echo ''

\echo '  [컨테이너 셸] $ printf "%s\\n" "CREATE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \\$\\$ SELECT \'Hello, \' || name || \'!\' \\$\\$;" > /usr/share/postgresql/16/extension/hello--1.0.sql'
\! printf "%s\n" "CREATE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT 'Hello, ' || name || '!' \$\$;" > /usr/share/postgresql/16/extension/hello--1.0.sql

\echo '  [컨테이너 셸] $ echo \'  → 만들어진 hello--1.0.sql :\' ; echo ; sed \'s/^/      /\' /usr/share/postgresql/16/extension/hello--1.0.sql'
\! echo '  → 만들어진 hello--1.0.sql :' ; echo ; sed 's/^/      /' /usr/share/postgresql/16/extension/hello--1.0.sql

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| STEP 3. 끝. PostgreSQL 이 알아서 인식한다                |'
\echo '+----------------------------------------------------------+'
\echo '  서버를 재시작할 필요도, 무엇을 등록할 필요도 없습니다.'
\echo '  PostgreSQL 은 이 디렉토리를 그때그때 읽습니다.'
\echo ''
SELECT name, default_version, comment FROM pg_available_extensions WHERE name = 'hello';

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| STEP 4. 설치하고 써보기                                  |'
\echo '+----------------------------------------------------------+'
CREATE EXTENSION hello;

SELECT hello('세계')      AS 인사,
       hello('PG 스터디') AS 인사2;

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| STEP 5. 방금 무슨 일이 일어났나                          |'
\echo '+----------------------------------------------------------+'
SELECT oid, extname, extversion, extrelocatable FROM pg_extension WHERE extname='hello';

\echo ''
\echo '  그리고 hello() 함수에는 "hello extension 소속" 도장이 찍혔습니다:'
SELECT p.proname AS 함수, e.extname AS 소속, d.deptype
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
JOIN   pg_proc p      ON p.oid = d.objid
WHERE  d.refclassid = 'pg_extension'::regclass
  AND  d.classid    = 'pg_proc'::regclass
  AND  d.deptype    = 'e' AND e.extname = 'hello';

\echo ''
\echo '  → hello--1.0.sql 안에는 그냥 CREATE FUNCTION 만 썼습니다.'
\echo '    "소속"은 PostgreSQL 이 자동으로 붙여준 것입니다.'

\echo ''
\echo '  그래서 이제 함수를 개별로 지울 수 없습니다:'
DO $$ BEGIN
    EXECUTE 'DROP FUNCTION hello(text)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  %', SQLERRM; END $$;

\echo ''
\echo '  대신 extension 을 지우면 함께 사라집니다:'
DROP EXTENSION hello;
DO $$ BEGIN
    PERFORM hello('세계');
EXCEPTION WHEN undefined_function THEN RAISE NOTICE '  함수도 같이 사라졌다'; END $$;

CREATE EXTENSION hello;   -- 다음 스크립트를 위해 복구
