-- ===========================================================================
-- 01. 이 부류의 Extension 은 카탈로그에 "무엇을" 남기는가
--
--     extension 을 처음 만났을 때, 이 쿼리 하나면 성격을 알 수 있습니다.
-- ===========================================================================
\echo '--- 설치 ---'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;

\echo ''
\echo '--- 이 extension 들이 추가한 객체를 종류별로 집계 ---'
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)     AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)     AS 타입,
       count(*) FILTER (WHERE d.classid='pg_operator'::regclass) AS 연산자,
       count(*) FILTER (WHERE d.classid='pg_opclass'::regclass)  AS 연산자클래스,
       count(*) FILTER (WHERE d.classid='pg_am'::regclass)       AS 인덱스AM,
       count(*) FILTER (WHERE d.classid='pg_class'::regclass)    AS 테이블뷰,
       count(*) FILTER (WHERE d.classid='pg_foreign_data_wrapper'::regclass) AS FDW
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND  e.extname <> 'plpgsql'
GROUP  BY e.extname ORDER BY e.extname;

\echo ''
\echo '  ^ 연산자클래스 컬럼에 숫자가 있고, 인덱스AM 은 0 입니다.'
\echo '    이 부류는 "새 인덱스를 만들지" 않습니다.'
\echo '    기존 인덱스(GiST/GIN)에게 "이 타입은 이렇게 색인하라"고 알려줄 뿐입니다.'

\echo ''
\echo '--- 로딩 방식 확인: 이 부류는 미리 로드할 필요가 없다 ---'
SHOW shared_preload_libraries;
\echo '  (비어 있음 = 함수를 처음 호출할 때 .so 가 자동으로 dlopen 된다)'
