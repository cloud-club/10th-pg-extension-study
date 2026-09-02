-- ===========================================================================
-- 03. 반대 방향 - .so 없이 SQL 만으로 된 extension
--     그리고 "이름이 일치하지 않는" 경우
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS intarray;
CREATE EXTENSION IF NOT EXISTS intagg;     -- 내장 함수 위에 SQL 로만 얹은 extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

\echo '--- 각 extension 이 실제로 어떤 .so 를 쓰는가 ---'
SELECT e.extname AS extension,
       coalesce(string_agg(DISTINCT p.probin, ', '), '(없음)') AS 공유_라이브러리,
       CASE WHEN count(p.probin) > 0 THEN 'C extension'
            ELSE 'SQL-only extension' END AS 종류
FROM   pg_extension e
LEFT   JOIN pg_depend d ON d.refobjid=e.oid AND d.deptype='e' AND d.classid='pg_proc'::regclass
LEFT   JOIN pg_proc p ON p.oid=d.objid
GROUP  BY e.extname ORDER BY 종류, e.extname;

\echo ''
\echo '  두 가지를 보세요:'
\echo ''
\echo '  (1) intagg 는 probin 이 비어 있습니다 = 자기 .so 가 없는 extension.'
\echo '      PostgreSQL 내장 함수(array_agg_transfn / array_unnest)를'
\echo '      LANGUAGE INTERNAL 로 다시 노출해 집계 함수를 만든 것뿐입니다.'
\echo ''
\echo '  (2) intarray 의 라이브러리는 intarray.so 가 아니라 _int.so 입니다.'

\echo ''
\echo '--- 파일로 교차 확인 ---'
\echo '  [컨테이너 셸] $ echo "  extension 파일:"; ls /usr/share/postgresql/16/extension/ | grep -E "^int(array|agg)\\." | sed \'s/^/    /\''
\! echo "  extension 파일:"; ls /usr/share/postgresql/16/extension/ | grep -E "^int(array|agg)\." | sed 's/^/    /'
\echo '  [컨테이너 셸] $ echo "  라이브러리 파일:"; ls /usr/lib/postgresql/16/lib/ | grep -E "^(_int|intarray|intagg)\\.so" | sed \'s/^/    /\''
\! echo "  라이브러리 파일:"; ls /usr/lib/postgresql/16/lib/ | grep -E "^(_int|intarray|intagg)\.so" | sed 's/^/    /'
\echo '  [컨테이너 셸] $ echo "  intarray.control 의 module_pathname:"; grep module_pathname /usr/share/postgresql/16/extension/intarray.control | sed \'s/^/    /\''
\! echo "  intarray.control 의 module_pathname:"; grep module_pathname /usr/share/postgresql/16/extension/intarray.control | sed 's/^/    /'
\echo '  [컨테이너 셸] $ echo "  intagg.control (module_pathname 없음):"; sed \'s/^/    /\' /usr/share/postgresql/16/extension/intagg.control'
\! echo "  intagg.control (module_pathname 없음):"; sed 's/^/    /' /usr/share/postgresql/16/extension/intagg.control

\echo ''
\echo '  → extension 이름 · control 파일 이름 · .so 이름은 각각 별개입니다.'
\echo '    유일한 연결고리는 control 파일의 module_pathname 입니다.'
\echo '    "extension 이름으로 .so 를 찾으면 되겠지"라고 가정하면 안 됩니다.'
