-- ===========================================================================
-- 02. 스크립트가 만든 객체가 어떻게 extension 소속이 되었나
-- ===========================================================================
\echo '--- greetkor 소속 객체 전부 ---'
SELECT d.classid::regclass AS catalog,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT p.proname FROM pg_proc  p WHERE p.oid = d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT c.relname FROM pg_class c WHERE c.oid = d.objid)
         ELSE d.objid::text
       END AS object_name,
       d.deptype
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass
  AND  d.deptype = 'e' AND e.extname = 'greetkor';

\echo ''
\echo '  ^ greetkor--1.0.sql 안에서 CREATE FUNCTION 이 실행될 때마다'
\echo '    recordDependencyOnCurrentExtension() 이 위 행들을 자동으로 넣었다.'

\echo ''
\echo '--- [실험] 소속 함수 단독 DROP ---'
DO $$ BEGIN
    EXECUTE 'DROP FUNCTION greet(text)';
    RAISE NOTICE '삭제됨';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END $$;

\echo ''
\echo '--- \dx+ 와 같은 정보: psql 메타커맨드로도 볼 수 있다 ---'
\echo '\\dx+ greetkor'
\dx+ greetkor
