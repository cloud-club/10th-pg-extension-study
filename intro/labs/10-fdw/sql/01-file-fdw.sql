-- ===========================================================================
-- 01. file_fdw - 서버 로컬 파일을 테이블처럼
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS file_fdw;

\echo '--- FDW 는 카탈로그에 무엇을 남기나 ---'
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass) AS 함수,
       count(*) FILTER (WHERE d.classid='pg_foreign_data_wrapper'::regclass) AS FDW
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='file_fdw'
GROUP  BY e.extname;

\echo ''
\echo '  ^ 함수 2개(handler, validator)와 FDW 1개.'
\echo '    handler 가 "이 외부 데이터를 어떻게 읽을지"를 구현한 C 함수입니다.'

SELECT fdwname AS FDW, fdwhandler::regproc AS handler, fdwvalidator::regproc AS validator
FROM   pg_foreign_data_wrapper ORDER BY fdwname;

\echo ''
\echo '--- 읽을 CSV 파일 ---'
\echo '  [컨테이너 셸] $ cat /lab/data/cities.csv'
\! cat /lab/data/cities.csv

\echo ''
\echo '--- 3단계: 서버 → 외부 테이블 ---'
\echo '  ① FDW      : 어떻게 읽을지 (extension 이 제공)'
\echo '  ② SERVER   : 어디서 읽을지'
\echo '  ③ FOREIGN TABLE : 무엇을 어떤 컬럼으로 읽을지'

CREATE SERVER IF NOT EXISTS csv_server FOREIGN DATA WRAPPER file_fdw;

DROP FOREIGN TABLE IF EXISTS cities;
CREATE FOREIGN TABLE cities (id int, city text, population bigint)
SERVER csv_server
OPTIONS (filename '/lab/data/cities.csv', format 'csv', header 'true');

\echo ''
\echo '--- 이제 그냥 테이블입니다 ---'
SELECT * FROM cities ORDER BY population DESC;

\echo ''
\echo '--- 집계도 조인도 됩니다 ---'
SELECT count(*) AS 도시수, sum(population) AS 총인구 FROM cities;

DROP TABLE IF EXISTS regions;
CREATE TABLE regions (city text, region text);
INSERT INTO regions VALUES ('서울','수도권'),('인천','수도권'),('부산','영남'),('대구','영남'),('대전','충청');

SELECT r.region AS 권역, sum(c.population) AS 인구
FROM   cities c JOIN regions r ON r.city = c.city
GROUP  BY r.region ORDER BY 인구 DESC;

\echo ''
\echo '--- 실행 계획 ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT city FROM cities WHERE population > 2000000;

\echo ''
\echo '  ^ Foreign Scan. 파일을 매번 처음부터 읽습니다.'
\echo '    인덱스가 없으므로 큰 파일에는 부적합합니다.'
\echo '    "한 번 읽고 말 로그/CSV 분석"이나 "COPY 전 미리보기"에 적합합니다.'

\echo ''
\echo '--- 쓰기는 안 됩니다 ---'
DO $$ BEGIN
    INSERT INTO cities VALUES (6, '울산', 1100000);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '거부됨: %', SQLERRM; END $$;

\echo ''
\echo '  ⚠ filename 은 "서버" 로컬 경로입니다. 클라이언트 PC 의 파일이 아닙니다.'
\echo '     그래서 superuser 또는 pg_read_server_files 권한이 필요합니다.'
\echo '     (아무나 /etc/passwd 를 테이블로 읽으면 안 되니까요)'
