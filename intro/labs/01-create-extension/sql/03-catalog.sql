-- ===========================================================================
-- 03. CREATE EXTENSION 이 카탈로그에 남기는 흔적
-- ===========================================================================
\echo '--- 설치 전 스냅샷 ---'
SELECT count(*) AS pg_extension_rows FROM pg_extension;
SELECT count(*) AS pg_proc_rows      FROM pg_proc;

\echo ''
\echo '--- pgcrypto 설치 ---'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\echo ''
\echo '--- 설치 후: pg_extension 레코드 ---'
SELECT oid, extname, extversion, extrelocatable, extconfig, extcondition
FROM   pg_extension WHERE extname = 'pgcrypto';

\echo ''
\echo '--- pgcrypto 가 데려온 함수는 몇 개인가 (pg_depend deptype=''e'' 로 카운트) ---'
SELECT count(*) AS functions_owned_by_pgcrypto
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass
  AND  d.classid    = 'pg_proc'::regclass
  AND  d.deptype    = 'e'
  AND  e.extname    = 'pgcrypto';

\echo ''
\echo '--- 그 중 10개만 ---'
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
JOIN   pg_proc p      ON p.oid = d.objid
WHERE  d.refclassid = 'pg_extension'::regclass
  AND  d.classid    = 'pg_proc'::regclass
  AND  d.deptype    = 'e'
  AND  e.extname    = 'pgcrypto'
ORDER  BY p.proname
LIMIT  10;

\echo ''
\echo '--- 실제로 써보기: bcrypt 해싱 ---'
SELECT crypt('my_password', gen_salt('bf', 8)) AS bcrypt_hash;

\echo ''
\echo '--- 모든 설치된 extension 현황 ---'
SELECT e.extname, e.extversion, av.default_version AS latest,
       n.nspname AS schema,
       CASE WHEN e.extversion <> av.default_version
            THEN '업그레이드 가능' ELSE '최신' END AS status
FROM   pg_extension e
JOIN   pg_available_extensions av ON av.name = e.extname
JOIN   pg_namespace n ON n.oid = e.extnamespace
ORDER  BY e.extname;
