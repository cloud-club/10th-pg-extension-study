-- ===========================================================================
-- 01. preload 가 왜 필수인가 + pg_cron 은 "딱 한 DB"에만 설치된다는 제약
-- ===========================================================================
\echo '--- 이 서버가 미리 로드한 라이브러리 ---'
SHOW shared_preload_libraries;
SHOW cron.database_name;

\echo ''
\echo '--- CREATE EXTENSION (cron.database_name 과 같은 DB - 성공) ---'
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';

\echo ''
\echo '--- 다른 데이터베이스에서 CREATE EXTENSION 을 하면 어떻게 되나 ---'
\echo '    (pg_cron 은 클러스터 전체에서 cron.database_name 으로 지정한 DB 에만 설치할 수 있다)'
\c otherdb
\echo '  지금은 otherdb 에 접속한 상태다.'
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    EXECUTE 'CREATE EXTENSION pg_cron';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'can only create extension in database%' THEN RAISE; END IF;
    failed := true;
    RAISE NOTICE '예상한 단일 DB 제약 오류: %', SQLERRM;
  END;
  IF NOT failed THEN RAISE EXCEPTION '예상했던 설치 거절이 발생하지 않았다'; END IF;
END $$;
\c study
\echo '  다시 study 로 돌아왔다.'

\echo ''
\echo '  ^ 이 제약 때문에 여러 DB 에서 잡을 돌리고 싶으면 study 에서'
\echo '    cron.schedule_in_database() 를 써야 한다 (02 에서 다룬다).'
\echo '    launcher 는 cron.database_name 의 cron.job 테이블만 읽고,'
\echo '    필요하면 다른 DB 로 접속해서 실행할 뿐이다.'

\echo ''
\echo '--- 프로세스로 보인다 - checkpointer, autovacuum launcher 와 같은 지위 ---'
SELECT pid, backend_type AS 프로세스종류, application_name
FROM   pg_stat_activity
WHERE  backend_type <> 'client backend'
ORDER  BY backend_type;

\echo ''
\echo '  ^ "pg_cron launcher" 가 보인다. _PG_init() 에서 RegisterBackgroundWorker() 로'
\echo '    등록하는데, postmaster 는 시작할 때 워커 목록을 확정하고 그때 fork 한다.'
\echo '    나중에 세션에서 로드하면 등록할 postmaster 가 이미 지나간 뒤다.'
\echo '    (worker.bgw_start_time = BgWorkerStart_RecoveryFinished 라서, 이 launcher 는'
\echo '     서버가 완전히 기동을 마친 뒤에만 뜬다 - 스탠바이(hot standby) 에서는 안 뜬다)'

\echo ''
\echo '--- cron.job 테이블 - 이것도 하나의 평범한 사용자 테이블이다 ---'
\d cron.job

\echo ''
\echo '--- Row-Level Security: 자기 작업만 보인다 ---'
SELECT c.relname, c.relrowsecurity AS RLS_켜짐
FROM   pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'cron' AND c.relname = 'job';

SELECT polname, pg_get_expr(polqual, polrelid) AS 조건
FROM   pg_policy WHERE polrelid = 'cron.job'::regclass;

\echo '  ^ username = current_user 조건이다. 슈퍼유저나 BYPASSRLS 권한이 없는 한'
\echo '    "SELECT * FROM cron.job" 을 해도 남의 작업은 안 보인다.'

\echo ''
\echo '--- 스케줄 정의는 사용자 데이터라서 pg_dump 대상이다 ---'
SELECT extname, extconfig::regclass[] AS "pg_dump 대상 테이블"
FROM   pg_extension WHERE extname = 'pg_cron';
\echo '  ^ pg_extension_config_dump() 로 등록한 것이다. CREATE EXTENSION 만 하면'
\echo '    빈 테이블이 생기지만, 그 안에 넣은 스케줄은 데이터이므로 별도로 백업 대상에 넣는다.'
