-- ===========================================================================
-- 01. preload 가 왜 필수인가 + 이 extension 이 카탈로그에 남기는 흔적
--
--     intro/labs/07-hooks 에서 이미 다룬 내용이지만, 여기서는 pg_stat_statements
--     자체가 주제이므로 조금 더 깊이 들어간다. (docs/02-internals-and-source.md 참고)
-- ===========================================================================
\echo '--- 이 서버가 미리 로드한 라이브러리 ---'
SHOW shared_preload_libraries;
\echo '  (docker-compose.yml 의 command 에서 지정했다. 이게 없으면 이 lab 전체가 성립하지 않는다)'

\echo ''
\echo '--- CREATE EXTENSION ---'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT extname AS 이름, extversion AS 버전 FROM pg_extension WHERE extname = 'pg_stat_statements';

\echo ''
\echo '--- 지금 이 PostgreSQL 버전에 실제로 존재하는 컬럼 전체 ---'
\echo '    (pg_stat_statements 는 PostgreSQL 메이저 버전이 바뀔 때마다 컬럼이 늘어난다.'
\echo '     책이나 블로그의 컬럼 목록을 외우지 말고, 항상 이렇게 직접 확인하는 습관을 들이자)'
SELECT ordinal_position AS 순서, column_name AS 컬럼, data_type AS 타입
FROM   information_schema.columns
WHERE  table_name = 'pg_stat_statements'
ORDER  BY ordinal_position;

\echo ''
\echo '--- 카탈로그에 남긴 흔적: 함수 몇 개 + 뷰 두 개가 전부다 ---'
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid = d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid = d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
  AND  e.extname = 'pg_stat_statements'
ORDER  BY 1, 2;

\echo ''
\echo '  ^ 이게 전부라면, 이 익스텐션은 왜 서버 재시작까지 요구할 만큼 특별할까?'
\echo '    답은 카탈로그가 아니라 공유 메모리와 실행기 훅에 있다.'

\echo ''
\echo '--- 공유 메모리를 실제로 확보했다는 증거 ---'
SELECT name AS 이름, pg_size_pretty(size) AS 크기, allocated_size AS 실제바이트
FROM   pg_shmem_allocations
WHERE  name ILIKE '%stat_statements%'
ORDER  BY size DESC;

\echo ''
\echo '  ^ 이 영역은 서버가 뜰 때 딱 한 번 할당된다.'
\echo '    pg_stat_statements.max 를 늘리려면 이 영역 크기가 바뀌어야 하므로,'
\echo '    설정을 바꾼 뒤에는 반드시 서버 재시작이 필요하다 (CREATE EXTENSION 으로는 안 된다).'

\echo ''
\echo '--- _PG_init() 이 등록하는 두 가지 (요약) ---'
\echo '  1) 실행기/플래너 훅 체인에 자기 함수를 끼워넣는다'
\echo '       post_parse_analyze_hook, planner_hook, ExecutorStart/End_hook, ProcessUtility_hook'
\echo '     → 서버가 시작할 때 등록해야 그 이후 접속하는 "모든" 세션의 쿼리를 잡을 수 있다.'
\echo '       pg_stat_statements는 preload 밖의 _PG_init에서 조기 반환하므로 LOAD만으로 수집할 수 없다.'
\echo ''
\echo '  2) 공유 메모리 + LWLock 을 요청한다'
\echo '       RequestAddinShmemSpace(pgss_memsize());'
\echo '       RequestNamedLWLockTranche("pg_stat_statements", 1);'
\echo '     → PostgreSQL 은 공유 메모리를 서버 기동 시 한 번에 잡는다. 런타임에 늘릴 수 없다.'
\echo ''
\echo '  그래서 뷰를 뒷받침하는 함수(pg_stat_statements_internal 등)에는 이런 방어 코드가'
\echo '  있다 (실제로 재현해보려면 아래 STEP 을 보라 - preload 없이는 pgss 공유메모리 포인터가'
\echo '  NULL 이라서 CREATE EXTENSION 은 성공해도 조회하는 순간 이 에러가 난다):'
\echo '       if (!pgss || !pgss_hash)'
\echo '           ereport(ERROR, (errmsg("pg_stat_statements must be loaded via shared_preload_libraries")));'

\echo ''
\echo '--- 직접 재현: preload 없이 CREATE EXTENSION 만 하면 어떻게 되나 ---'
\echo '    이 컨테이너는 이미 preload 되어 있으므로 여기서는 재현할 수 없다.'
\echo '    HANDS-ON.md 의 "직접 실험해볼 것" 섹션에서'
\echo '    docker-compose.yml 의 shared_preload_libraries 줄을 지우고 재기동해 직접 확인해보라.'
\echo '    (CREATE EXTENSION 은 성공하지만 SELECT * FROM pg_stat_statements 는 에러가 난다)'
