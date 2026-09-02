-- ===========================================================================
-- 02. 버전 올리기 - 배포한 뒤에 기능을 추가하려면
--
--     "이미 설치한 사람"과 "새로 설치할 사람" 둘 다를 챙겨야 합니다.
--     그래서 파일이 두 개 필요합니다.
-- ===========================================================================

\echo '--- 현재 상태 ---'
SELECT extname, extversion FROM pg_extension WHERE extname='hello';
SELECT hello('세계') AS 현재_동작;

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| (1) 업그레이드 스크립트 - 이미 1.0 을 쓰는 사람용        |'
\echo '+----------------------------------------------------------+'
\echo '  파일명 규칙: <이름>--<이전>--<이후>.sql  →  hello--1.0--1.1.sql'
\echo ''

\echo '  [컨테이너 셸] $ printf "%s\\n" "-- 기능 추가" "CREATE FUNCTION bye(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \\$\\$ SELECT \'Bye, \' || name || \'!\' \\$\\$;" "" "-- 기존 함수 수정은 반드시 CREATE OR REPLACE 로." "-- DROP 후 CREATE 하면 pg_depend 의 소속 정보가 끊어진다." "CREATE OR REPLACE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \\$\\$ SELECT \'안녕하세요, \' || name || \'님!\' \\$\\$;" > /usr/share/postgresql/16/extension/hello--1.0--1.1.sql'
\! printf "%s\n" "-- 기능 추가" "CREATE FUNCTION bye(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT 'Bye, ' || name || '!' \$\$;" "" "-- 기존 함수 수정은 반드시 CREATE OR REPLACE 로." "-- DROP 후 CREATE 하면 pg_depend 의 소속 정보가 끊어진다." "CREATE OR REPLACE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT '안녕하세요, ' || name || '님!' \$\$;" > /usr/share/postgresql/16/extension/hello--1.0--1.1.sql

\echo '  [컨테이너 셸] $ sed \'s/^/      /\' /usr/share/postgresql/16/extension/hello--1.0--1.1.sql'
\! sed 's/^/      /' /usr/share/postgresql/16/extension/hello--1.0--1.1.sql

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| (2) control 파일의 default_version 올리기 - 새로 설치할  |'
\echo '|     사람이 곧바로 1.1 을 받도록                          |'
\echo '+----------------------------------------------------------+'
\echo '  [컨테이너 셸] $ sed -i "s/default_version = \'1.0\'/default_version = \'1.1\'/" /usr/share/postgresql/16/extension/hello.control'
\! sed -i "s/default_version = '1.0'/default_version = '1.1'/" /usr/share/postgresql/16/extension/hello.control
\echo '  [컨테이너 셸] $ cat /usr/share/postgresql/16/extension/hello.control'
\! cat /usr/share/postgresql/16/extension/hello.control

\echo ''
\echo '  이제 PostgreSQL 이 업그레이드 경로를 인식합니다:'
SELECT source, target, path FROM pg_extension_update_paths('hello') WHERE path IS NOT NULL;

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| (3) 업그레이드 실행                                      |'
\echo '+----------------------------------------------------------+'
ALTER EXTENSION hello UPDATE TO '1.1';

SELECT extname, extversion FROM pg_extension WHERE extname='hello';
SELECT hello('세계') AS 바뀐_함수, bye('세계') AS 새_함수;

\echo ''
\echo '  새로 추가한 bye() 도 자동으로 extension 소속이 되었습니다:'
\echo '\\dx+ hello'
\dx+ hello

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 여기까지가 extension 의 전부입니다                       |'
\echo '+----------------------------------------------------------+'
\echo '  [컨테이너 셸] $ ls -l /usr/share/postgresql/16/extension/hello*'
\! ls -l /usr/share/postgresql/16/extension/hello*
\echo ''
\echo '  파일 3개. 이게 배포 가능한 extension 입니다.'
\echo '  나머지(PGXS, .so, 회귀 테스트)는 전부 "편해지기 위한" 도구일 뿐입니다.'
