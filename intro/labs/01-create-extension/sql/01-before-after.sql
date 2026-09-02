-- ===========================================================================
-- 01. Extension이 없던 시절 vs 있는 시절
-- ===========================================================================
\echo '--- [1] extension 없이 uuid_generate_v4() 를 부르면? ---'
DO $$
BEGIN
    PERFORM uuid_generate_v4();
    RAISE NOTICE '성공 (이미 설치되어 있음)';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '실패: %', SQLERRM;
    RAISE NOTICE '=> 9.1 이전이라면 소스 패치 or LOAD ''..so'' + CREATE FUNCTION 을 손으로 해야 했다';
END $$;

\echo ''
\echo '--- [2] Extension 시스템 도입 후: 한 줄 ---'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT uuid_generate_v4() AS v4, uuid_generate_v1() AS v1;

\echo ''
\echo '--- [3] 이 한 줄이 만들어낸 것 ---'
SELECT e.oid, e.extname, e.extversion, n.nspname AS schema, e.extrelocatable
FROM   pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE  e.extname = 'uuid-ossp';

\echo ''
\echo '--- [4] 설치 가능한 extension 은 파일 시스템이 결정한다 ---'
SELECT count(*) AS available_extensions FROM pg_available_extensions;
SELECT name, default_version, left(comment, 50) AS comment
FROM   pg_available_extensions
WHERE  name IN ('uuid-ossp','pgcrypto','hstore','citext','pg_trgm','postgres_fdw')
ORDER  BY name;
