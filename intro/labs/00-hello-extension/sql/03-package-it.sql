-- ===========================================================================
-- 03. 배포용으로 정리하기 - PGXS Makefile
--
--     지금까지는 파일을 손으로 복사했습니다.
--     남에게 나눠주려면 "어디로 복사할지"를 자동화해야 합니다.
-- ===========================================================================

\echo '--- 우리가 손으로 한 일 = 결국 cp 두 번 ---'
\echo '  [컨테이너 셸] $ echo "  cp hello.control     $(pg_config --sharedir)/extension/"'
\! echo "  cp hello.control     $(pg_config --sharedir)/extension/"
\echo '  [컨테이너 셸] $ echo "  cp hello--1.0.sql    $(pg_config --sharedir)/extension/"'
\! echo "  cp hello--1.0.sql    $(pg_config --sharedir)/extension/"

\echo ''
\echo '  문제: 이 경로는 OS/버전/설치방식마다 다릅니다.'
\echo '        Ubuntu, macOS(Homebrew), Docker, RDS 전부 다릅니다.'
\echo '        → PGXS 가 pg_config 에게 물어봐서 알아서 해줍니다.'

\echo ''
\echo '--- Makefile 4줄이면 끝 ---'
\echo '  [컨테이너 셸] $ cat /lab/ext/Makefile'
\! cat /lab/ext/Makefile

\echo ''
\echo '  이제 사용자는 이것만 하면 됩니다:'
\echo '      git clone <repo> && cd hello && make install'
\echo '      psql -c "CREATE EXTENSION hello;"'

\echo ''
\echo '--- 완성본 파일 목록 (호스트의 ext/ 디렉토리) ---'
\echo '  [컨테이너 셸] $ ls -l /lab/ext/'
\! ls -l /lab/ext/

\echo ''
\echo '--- 손으로 만든 것과 완성본이 같은지 확인 ---'
\echo '  [컨테이너 셸] $ diff /lab/ext/hello.control /usr/share/postgresql/16/extension/hello.control && echo "  hello.control      : 동일"'
\! diff /lab/ext/hello.control /usr/share/postgresql/16/extension/hello.control && echo "  hello.control      : 동일"
\echo '  [컨테이너 셸] $ diff /lab/ext/hello--1.0.sql /usr/share/postgresql/16/extension/hello--1.0.sql && echo "  hello--1.0.sql     : 동일"'
\! diff /lab/ext/hello--1.0.sql /usr/share/postgresql/16/extension/hello--1.0.sql && echo "  hello--1.0.sql     : 동일"
\echo '  [컨테이너 셸] $ diff /lab/ext/hello--1.0--1.1.sql /usr/share/postgresql/16/extension/hello--1.0--1.1.sql && echo "  hello--1.0--1.1.sql: 동일"'
\! diff /lab/ext/hello--1.0--1.1.sql /usr/share/postgresql/16/extension/hello--1.0--1.1.sql && echo "  hello--1.0--1.1.sql: 동일"

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 다음 단계                                                |'
\echo '+----------------------------------------------------------+'
\echo '  lab02 - 같은 것을 PGXS 로 제대로 빌드하고, pg_dump 연동까지'
\echo '  lab03 - C 로 짜서 .so 를 만들고, 서버 안에서 실행하기'
