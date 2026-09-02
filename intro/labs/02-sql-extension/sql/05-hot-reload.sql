-- ===========================================================================
-- 05. 개발 루프 - 소스를 고치고 다시 설치하기
--     (compose 가 ./ext 를 /build/greetkor 에 마운트해두었다)
-- ===========================================================================
\echo '--- 호스트의 ext/ 가 컨테이너에 그대로 보인다 ---'
\echo '  [컨테이너 셸] $ ls /build/greetkor'
\! ls /build/greetkor

\echo ''
\echo '--- make install 을 다시 돌리면 $SHAREDIR 파일이 갱신된다 ---'
\echo '  [컨테이너 셸] $ cd /build/greetkor && make install 2>&1 | tail -5'
\! cd /build/greetkor && make install 2>&1 | tail -5

\echo ''
\echo '--- 하지만 이미 설치된 extension 은 자동으로 바뀌지 않는다 ---'
\echo '    SQL-only extension 개발 중이라면 이 사이클이 가장 빠르다:'
\echo '      1) ext/greetkor--1.0.sql 수정'
\echo '      2) make install'
\echo '      3) DROP EXTENSION greetkor; CREATE EXTENSION greetkor;'
\echo '    배포 후에는 절대 이렇게 하면 안 되고, 업그레이드 스크립트를 새로 써야 한다.'

DROP EXTENSION greetkor;
CREATE EXTENSION greetkor;    -- default_version = 1.1
SELECT extname, extversion FROM pg_extension WHERE extname='greetkor';
SELECT greet('스터디') AS result;
