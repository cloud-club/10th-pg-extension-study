-- ===========================================================================
-- 01. .so 가 로드되는 순간 관찰하기
-- ===========================================================================
\echo '--- 빌드 산출물 ---'
\echo '  [컨테이너 셸] $ ls -l /usr/lib/postgresql/16/lib/myext.so'
\! ls -l /usr/lib/postgresql/16/lib/myext.so
\echo '  [컨테이너 셸] $ ls -l /usr/share/postgresql/16/extension/ | grep myext'
\! ls -l /usr/share/postgresql/16/extension/ | grep myext

\echo ''
\echo '--- .so 안에 어떤 심볼이 들어있나 ---'
\echo '    (빌드 단계에서 nm 으로 뽑아둔 목록. Pg_magic_func 와 _PG_init 에 주목)'
\echo '  [컨테이너 셸] $ grep -E "myext|Pg_magic|_PG_init" /lab/myext.symbols'
\! grep -E "myext|Pg_magic|_PG_init" /lab/myext.symbols

\echo ''
\echo '--- .so 로딩은 세션마다다 (새 세션은 아직 안 읽었다) ---'
DROP EXTENSION IF EXISTS myext;
CREATE EXTENSION myext;


\echo '  [증명] 새 세션에서 곧바로 GUC 를 조회하면 아직 없다'
\echo '         (_PG_init 이 아직 실행되지 않았다는 뜻)'
\echo '  [컨테이너 셸] $ psql -U postgres -d study -c "SHOW myext.repeat_count;" 2>&1 | head -2'
\! psql -U postgres -d study -c "SHOW myext.repeat_count;" 2>&1 | head -2

\echo ''
\echo '  [증명] 같은 세션에서 함수를 먼저 호출하면 GUC 가 생긴다'
\echo '  [컨테이너 셸] $ psql -U postgres -d study -c "SELECT myext_add(1,1); SHOW myext.repeat_count;" 2>&1 | tail -6'
\! psql -U postgres -d study -c "SELECT myext_add(1,1); SHOW myext.repeat_count;" 2>&1 | tail -6

\echo ''
\echo '--- CREATE FUNCTION 은 "이 심볼을 쓰겠다"는 선언만 남긴다 ---'
SELECT p.proname, l.lanname AS language,
       p.probin  AS shared_library,
       p.prosrc  AS c_symbol,
       p.proisstrict AS is_strict, p.provolatile
FROM   pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE  p.proname LIKE 'myext%'
ORDER  BY p.proname;

\echo ''
\echo '  ^ probin 이 $libdir/myext - control 파일의 module_pathname 이 치환된 결과'
\echo '    prosrc 는 C 심볼 이름. 이 조합으로 dlopen + dlsym 이 일어난다.'

\echo ''
\echo '--- 이 세션은 CREATE EXTENSION 때 이미 로드했으므로 그냥 호출된다 ---'
SELECT myext_add(2, 3) AS first_call;

\echo ''
\echo '--- _PG_init 이 등록한 GUC 도 이미 보인다 ---'
SELECT name, setting, min_val, max_val, context, short_desc
FROM   pg_settings WHERE name LIKE 'myext%';

\echo ''
\echo '=> 정리: .so 로딩은 세션(프로세스)마다 일어난다.'
\echo '   CREATE EXTENSION 을 실행한 세션은 CREATE FUNCTION ... LANGUAGE C 가'
\echo '   심볼을 확인하느라 그때 이미 읽는다 (.so 를 치우면 CREATE EXTENSION 이 실패한다).'
\echo '   새 세션은 그 함수를 처음 부를 때 비로소 dlopen 한다 - 위 증명이 그것이다.'
\echo '   서버 시작 시점에 로드가 필요한 extension(pg_stat_statements 등)은'
\echo '   shared_preload_libraries 를 써야 한다 - lab07 참고.'
