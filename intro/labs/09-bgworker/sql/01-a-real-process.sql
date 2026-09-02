-- ===========================================================================
-- 01. Background Worker - extension 이 프로세스를 띄운다
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

\echo '--- 지금 돌고 있는 서버 프로세스들 ---'
SELECT pid, backend_type AS 프로세스종류, application_name,
       now() - backend_start AS 가동시간
FROM   pg_stat_activity
WHERE  backend_type <> 'client backend'
ORDER  BY backend_type;

\echo ''
\echo '  ^ "pg_cron launcher" 가 보입니다.'
\echo '    checkpointer, autovacuum launcher 와 나란히 있습니다 - 같은 지위입니다.'
\echo ''
\echo '    다른 extension 들은 "내 세션 안에서 함수로 실행"됩니다.'
\echo '    이 부류는 "내 세션과 무관하게 계속 도는 프로세스"를 갖습니다.'
\echo '    아무도 접속하지 않아도 일합니다.'

\echo ''
\echo '--- 왜 shared_preload_libraries 가 필수인가 ---'
SHOW shared_preload_libraries;
\echo ''
\echo '  _PG_init() 에서 RegisterBackgroundWorker() 를 호출하는데,'
\echo '  postmaster 는 시작할 때 워커 목록을 확정하고 그때 fork 합니다.'
\echo '  나중에 세션에서 로드하면 등록할 postmaster 가 이미 지나가버린 뒤입니다.'

\echo ''
\echo '--- 이 extension 은 전용 스키마와 테이블을 갖습니다 ---'
SELECT c.relname AS 테이블, c.relkind AS 종류
FROM   pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE  n.nspname='cron' AND c.relkind IN ('r','v') ORDER BY c.relname;

\echo ''
\echo '--- 그리고 그 데이터는 pg_dump 로 백업됩니다 ---'
SELECT extname, extconfig::regclass[] AS "데이터까지 덤프되는 테이블"
FROM   pg_extension WHERE extname='pg_cron';
\echo '  ^ pg_extension_config_dump() 로 등록한 것입니다.'
\echo '    스케줄 정의는 "사용자 데이터"이므로 백업되어야 합니다.'
\echo '    (lab02 에서 만든 greetkor_config 와 같은 메커니즘)'
