-- ===========================================================================
-- 01. 왜 이 부류는 CREATE EXTENSION 만으로 안 되는가
-- ===========================================================================
\echo '--- 이 서버는 무엇을 미리 로드했나 ---'
SHOW shared_preload_libraries;
\echo '  (docker-compose.yml 의 command 에서 지정했습니다)'

\echo ''
\echo '--- pg_stat_statements 의 _PG_init() 은 두 가지를 한다 ---'
\echo ''
\echo '  1) 실행기 훅(Hook)에 자기 함수를 끼워넣는다'
\echo '       prev_ExecutorEnd = ExecutorEnd_hook;'
\echo '       ExecutorEnd_hook = pgss_ExecutorEnd;'
\echo '     → 서버 시작 시 등록해야 "모든 세션"의 쿼리를 잡을 수 있다.'
\echo '       나중에 세션 하나에서 로드하면 그 세션 것만 잡힌다.'
\echo ''
\echo '  2) 공유 메모리를 요청한다'
\echo '       RequestAddinShmemSpace(pgss_memsize());'
\echo '       RequestNamedLWLockTranche("pg_stat_statements", 1);'
\echo '     → 공유 메모리는 서버가 뜰 때 한 번에 할당된다. 나중에 늘릴 수 없다.'

\echo ''
\echo '--- 그래서 소스에 이런 방어 코드가 있습니다 ---'
\echo '     if (!process_shared_preload_libraries_in_progress)'
\echo '         elog(ERROR, "pg_stat_statements must be loaded via shared_preload_libraries");'

\echo ''
\echo '--- 지금은 preload 되어 있으므로 CREATE EXTENSION 이 성공합니다 ---'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT extname, extversion FROM pg_extension WHERE extname='pg_stat_statements';

\echo ''
\echo '--- 이 extension 이 추가한 것 ---'
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid=d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND  e.extname='pg_stat_statements' ORDER BY 1, 2;

\echo ''
\echo '  ^ 함수 3개와 뷰 2개뿐입니다.'
\echo '    "무엇을 추가했나"만 보면 아주 작아 보이지만, 진짜 일은 카탈로그가 아니라'
\echo '    C 코드가 실행기에 끼어들어서 하고 있습니다.'
\echo '    카탈로그 집계만으로는 이 부류의 정체를 알 수 없다는 뜻이기도 합니다.'
