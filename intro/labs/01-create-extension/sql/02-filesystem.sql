-- ===========================================================================
-- 02. Extension 은 결국 "파일 3종"이다
--     $SHAREDIR/extension/*.control  +  *.sql   /   $LIBDIR/*.so
-- ===========================================================================
\echo '--- pg_config 로 경로 확인 ---'
\echo '  [컨테이너 셸] $ pg_config --sharedir'
\! pg_config --sharedir
\echo '  [컨테이너 셸] $ pg_config --pkglibdir'
\! pg_config --pkglibdir
\echo '  [컨테이너 셸] $ pg_config --pgxs'
\! pg_config --pgxs

\echo ''
\echo '--- control 파일이 몇 개나 있나 (= 설치 가능한 extension 수) ---'
\echo '  [컨테이너 셸] $ ls /usr/share/postgresql/16/extension/*.control | wc -l'
\! ls /usr/share/postgresql/16/extension/*.control | wc -l

\echo ''
\echo '--- uuid-ossp 를 이루는 파일들 ---'
\echo '  [컨테이너 셸] $ ls -l /usr/share/postgresql/16/extension/ | grep uuid'
\! ls -l /usr/share/postgresql/16/extension/ | grep uuid
\echo '  [컨테이너 셸] $ ls -l /usr/lib/postgresql/16/lib/ | grep uuid'
\! ls -l /usr/lib/postgresql/16/lib/ | grep uuid

\echo ''
\echo '--- control 파일 내용 (= ExtensionControlFile 구조체로 파싱되는 원본) ---'
\echo '  [컨테이너 셸] $ cat /usr/share/postgresql/16/extension/uuid-ossp.control'
\! cat /usr/share/postgresql/16/extension/uuid-ossp.control

\echo ''
\echo '--- 설치 SQL 스크립트 앞부분 (MODULE_PATHNAME 치환에 주목) ---'
\echo '  [컨테이너 셸] $ head -20 /usr/share/postgresql/16/extension/uuid-ossp--1.1.sql'
\! head -20 /usr/share/postgresql/16/extension/uuid-ossp--1.1.sql

\echo ''
\echo '--- SQL-only extension 은 .so 가 없다 (intagg: control + sql 뿐) ---'
\echo '  [컨테이너 셸] $ cat /usr/share/postgresql/16/extension/intagg.control'
\! cat /usr/share/postgresql/16/extension/intagg.control
\echo '  ^ module_pathname 이 없습니다 = 치환할 .so 가 없다는 뜻입니다.'

\echo ''
\echo '--- 이름만 보고 판단하면 안 된다: unaccent 는 C extension 이다 ---'
\echo '  [컨테이너 셸] $ grep module_pathname /usr/share/postgresql/16/extension/unaccent.control; ls /usr/lib/postgresql/16/lib/unaccent.so'
\! grep module_pathname /usr/share/postgresql/16/extension/unaccent.control; ls /usr/lib/postgresql/16/lib/unaccent.so
\echo '  ^ "사전 파일을 읽는 extension" 이지만 그 사전을 읽는 코드가 C 로 짜여 있습니다.'
