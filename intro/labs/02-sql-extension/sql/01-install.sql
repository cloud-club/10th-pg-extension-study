-- ===========================================================================
-- 01. 내가 만든 extension 설치하기
-- ===========================================================================
\echo '--- make install 이 심어놓은 파일들 ---'
\echo '  [컨테이너 셸] $ ls -l /usr/share/postgresql/16/extension/ | grep greetkor'
\! ls -l /usr/share/postgresql/16/extension/ | grep greetkor

\echo ''
\echo '--- PostgreSQL 이 control 파일을 읽어 "설치 가능"으로 인식한다 ---'
SELECT name, default_version, comment FROM pg_available_extensions WHERE name = 'greetkor';
SELECT name, version, installed, trusted, relocatable
FROM   pg_available_extension_versions WHERE name = 'greetkor' ORDER BY version;

\echo ''
-- 재실행 가능하도록 정리
DROP EXTENSION IF EXISTS greetkor CASCADE;

\echo '--- 설치 전: 함수가 없다 ---'
DO $$ BEGIN
    PERFORM greet('세계');
EXCEPTION WHEN undefined_function THEN RAISE NOTICE '%', SQLERRM; END $$;

\echo ''
\echo '--- 1.0 으로 설치 (default_version 은 1.1 이지만 명시적으로 낮은 버전 선택) ---'
CREATE EXTENSION greetkor VERSION '1.0';

SELECT extname, extversion FROM pg_extension WHERE extname='greetkor';
SELECT greet('세계') AS greet, farewell('세계') AS farewell;
