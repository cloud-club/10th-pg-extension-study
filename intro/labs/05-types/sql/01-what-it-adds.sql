-- ===========================================================================
-- 01. 이 부류의 Extension 은 카탈로그에 "무엇을" 남기는가
--
--     extension 을 처음 만났을 때, 이 쿼리 하나면 성격을 알 수 있습니다.
-- ===========================================================================
\echo '--- 설치 ---'
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
CREATE EXTENSION IF NOT EXISTS intarray;

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
\echo '  ^ 타입 컬럼에 숫자가 있습니다. 새 데이터 타입을 추가하는 부류입니다.'
\echo '    타입 하나를 추가하려면 함수가 줄줄이 따라옵니다:'
\echo '      typinput / typoutput   - 텍스트 ↔ 내부 표현  (필수)'
\echo '      typreceive / typsend   - 바이너리 프로토콜용  (선택이지만 보통 만든다)'
\echo '      비교 연산자 · 인덱스 지원 함수 ...'
\echo '    그래서 함수 개수도 같이 많아집니다.'

\echo ''
\echo '--- 로딩 방식 확인: 이 부류는 미리 로드할 필요가 없다 ---'
SHOW shared_preload_libraries;
\echo '  (비어 있음 = 함수를 처음 호출할 때 .so 가 자동으로 dlopen 된다)'
