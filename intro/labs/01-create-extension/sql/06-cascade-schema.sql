-- ===========================================================================
-- 06. requires / CASCADE / SCHEMA / trusted
-- ===========================================================================
\echo '--- earthdistance 는 cube 를 requires 한다 ---'
\echo '  [컨테이너 셸] $ cat /usr/share/postgresql/16/extension/earthdistance.control'
\! cat /usr/share/postgresql/16/extension/earthdistance.control

\echo ''
\echo '--- [실험] 의존 extension 없이 설치하면? ---'
DROP EXTENSION IF EXISTS earthdistance;
DROP EXTENSION IF EXISTS cube;
DO $$
BEGIN
    EXECUTE 'CREATE EXTENSION earthdistance';
    RAISE NOTICE '설치됨';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '거부됨: %', SQLERRM;
END $$;

\echo ''
\echo '--- CASCADE 를 붙이면 requires 를 재귀적으로 먼저 설치한다 ---'
CREATE EXTENSION earthdistance CASCADE;
SELECT extname, extversion FROM pg_extension WHERE extname IN ('cube','earthdistance');

\echo ''
\echo '--- extension 간 의존성도 pg_depend 에 기록된다 (deptype=''n'') ---'
SELECT src.extname AS extension, tgt.extname AS depends_on, d.deptype
FROM   pg_depend d
JOIN   pg_extension src ON src.oid = d.objid    AND d.classid    = 'pg_extension'::regclass
JOIN   pg_extension tgt ON tgt.oid = d.refobjid AND d.refclassid = 'pg_extension'::regclass;

\echo ''
\echo '--- 전용 스키마에 설치하기 (운영 권장 패턴) ---'
CREATE SCHEMA IF NOT EXISTS ext;
DROP EXTENSION IF EXISTS citext;
CREATE EXTENSION citext SCHEMA ext;
SELECT e.extname, n.nspname AS schema, e.extrelocatable
FROM   pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE  e.extname = 'citext';

\echo '  -> relocatable=true 이므로 나중에 옮길 수 있다'
ALTER EXTENSION citext SET SCHEMA public;
SELECT e.extname, n.nspname AS schema
FROM   pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE  e.extname = 'citext';

\echo ''
\echo '--- trusted extension: superuser 없이 설치 가능한 것들 (PG 13+) ---'
\echo '  [컨테이너 셸] $ grep -l "trusted = true" /usr/share/postgresql/16/extension/*.control | xargs -n1 basename | sed \'s/.control//\' | head -20'
\! grep -l "trusted = true" /usr/share/postgresql/16/extension/*.control | xargs -n1 basename | sed 's/.control//' | head -20

\echo ''
\echo '--- [실험] 일반 유저로 trusted / non-trusted 설치 시도 ---'
DROP EXTENSION IF EXISTS citext;      -- superuser 로 미리 정리
DO $$ BEGIN
    CREATE ROLE app_user LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT CREATE ON DATABASE study TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

SET ROLE app_user;
DO $$
BEGIN
    EXECUTE 'CREATE EXTENSION citext';           -- trusted = true
    RAISE NOTICE 'citext      (trusted=true)  -> 설치 성공';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'citext      -> %', SQLERRM; END $$;
DO $$
BEGIN
    EXECUTE 'CREATE EXTENSION pageinspect';      -- superuser = true
    RAISE NOTICE 'pageinspect (superuser=true) -> 설치 성공';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pageinspect -> %', SQLERRM; END $$;
RESET ROLE;

\echo ''
\echo '=> 클라우드 매니지드 DB(RDS/Supabase/Neon)에서 superuser 가 없어도'
\echo '   trusted extension 은 설치할 수 있는 이유가 이것이다'
