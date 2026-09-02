-- ===========================================================================
-- 03. GUC - _PG_init 이 등록한 커스텀 설정 파라미터
-- ===========================================================================
-- 주의: psql 세션이 바뀌면 .so 는 아직 로드되어 있지 않다.
-- LOAD 로 명시적으로 로드하거나, extension 함수를 한 번 호출하면 _PG_init 이 돈다.
LOAD 'myext';

\echo '--- 기본값 ---'
SHOW myext.repeat_count;
SELECT myext_shout('pg') AS with_default;

\echo ''
\echo '--- 세션에서 변경 (PGC_USERSET 이므로 일반 유저도 가능) ---'
SET myext.repeat_count = 5;
SELECT myext_shout('pg') AS with_5;

\echo ''
\echo '--- 트랜잭션 범위로 변경 ---'
BEGIN;
SET LOCAL myext.repeat_count = 1;
SELECT myext_shout('pg') AS inside_txn;
COMMIT;
SELECT myext_shout('pg') AS after_txn;

\echo ''
\echo '--- min/max 검증도 C 에서 등록한 대로 동작한다 (1..100) ---'
DO $$ BEGIN
    EXECUTE 'SET myext.repeat_count = 999';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '거부됨: %', SQLERRM; END $$;

RESET myext.repeat_count;

\echo ''
\echo '--- MarkGUCPrefixReserved 덕분에 오타난 파라미터도 걸러진다 ---'
DO $$ BEGIN
    EXECUTE 'SET myext.repeatcount = 3';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '거부됨: %', SQLERRM; END $$;
