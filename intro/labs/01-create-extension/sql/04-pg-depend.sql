-- ===========================================================================
-- 04. pg_depend - Extension 멤버십의 실체
--     "이 함수가 어느 extension 소속인가?" 를 푸는 단 하나의 장치
-- ===========================================================================
\echo '--- deptype 별 분포 ---'
SELECT deptype,
       CASE deptype
         WHEN 'e' THEN 'EXTENSION      - extension 멤버, 단독 DROP 불가'
         WHEN 'n' THEN 'NORMAL         - 일반 참조, DROP 시 CASCADE 필요'
         WHEN 'a' THEN 'AUTO           - 부모 DROP 시 자동 삭제'
         WHEN 'i' THEN 'INTERNAL       - 부모의 일부로 취급'
         WHEN 'p' THEN 'PIN            - 시스템 객체, 삭제 불가'
         WHEN 'x' THEN 'AUTO_EXTENSION - 멤버는 아니지만 extension 과 함께 삭제되는 객체'
       END AS meaning,
       count(*)
FROM   pg_depend GROUP BY deptype ORDER BY deptype;

\echo ''
\echo '--- extension 소속 객체를 종류별로 집계 ---'
SELECT e.extname, d.classid::regclass AS object_catalog, count(*)
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
GROUP  BY e.extname, d.classid ORDER BY e.extname, count DESC;

\echo ''
\echo '--- [실험] extension 소속 함수를 개별 DROP 하면? ---'
DO $$
BEGIN
    EXECUTE 'DROP FUNCTION gen_salt(text)';
    RAISE NOTICE '삭제됨 (예상 밖)';
EXCEPTION WHEN dependent_objects_still_exist OR OTHERS THEN
    RAISE NOTICE '거부됨: %', SQLERRM;
    RAISE NOTICE '=> deptype=''e'' 가 개별 삭제를 막는다';
END $$;

\echo ''
\echo '--- [실험] 반대로 DROP EXTENSION 은 CASCADE 없이도 전부 지운다 ---'
SELECT count(*) AS before_drop FROM pg_proc WHERE proname LIKE 'uuid_generate%';
DROP EXTENSION "uuid-ossp";
SELECT count(*) AS after_drop  FROM pg_proc WHERE proname LIKE 'uuid_generate%';
CREATE EXTENSION "uuid-ossp";   -- 다음 스크립트를 위해 복구

\echo ''
\echo '--- [실험] 내가 만든 함수를 extension 소속으로 편입시키기 ---'
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE FUNCTION my_helper(t text) RETURNS text LANGUAGE sql AS $$ SELECT upper(t) $$;

SELECT count(*) AS is_member_before
FROM pg_depend d JOIN pg_proc p ON p.oid = d.objid
WHERE p.proname = 'my_helper' AND d.deptype = 'e';

ALTER EXTENSION hstore ADD FUNCTION my_helper(text);

SELECT count(*) AS is_member_after
FROM pg_depend d JOIN pg_proc p ON p.oid = d.objid
WHERE p.proname = 'my_helper' AND d.deptype = 'e';

ALTER EXTENSION hstore DROP FUNCTION my_helper(text);   -- 다시 독립
DROP FUNCTION my_helper(text);
