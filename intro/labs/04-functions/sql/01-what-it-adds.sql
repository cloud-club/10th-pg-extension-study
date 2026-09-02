-- ===========================================================================
-- 01. 이 부류의 Extension 은 카탈로그에 "무엇을" 남기는가
--
--     extension 을 처음 만났을 때, 이 쿼리 하나면 성격을 알 수 있습니다.
-- ===========================================================================
\echo '--- 설치 ---'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS tablefunc;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
\echo '  ^ 함수만 있고 타입/연산자클래스/인덱스AM 이 0 입니다.'
\echo '    이것이 가장 단순한 부류 - "함수 라이브러리" 형태의 extension 입니다.'
\echo '    C 로 짠 함수를 SQL 함수로 노출하기만 합니다.'

\echo ''
\echo '--- 로딩 방식 확인: 이 부류는 미리 로드할 필요가 없다 ---'
SHOW shared_preload_libraries;
\echo '  (비어 있음 = 함수를 처음 호출할 때 .so 가 자동으로 dlopen 된다)'
