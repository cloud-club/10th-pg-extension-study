-- ===========================================================================
-- 04. SPI - C 함수 안에서 SQL 실행하기
-- ===========================================================================
DROP TABLE IF EXISTS sample_rows;
CREATE TABLE sample_rows AS SELECT g AS id, 'row-' || g AS label FROM generate_series(1, 1234) g;

\echo '--- 일반 SQL count ---'
SELECT count(*) AS sql_count FROM sample_rows;

\echo ''
\echo '--- C 함수가 SPI_connect / SPI_execute 로 같은 일을 수행 ---'
SELECT myext_count_rows('sample_rows') AS spi_count;

\echo ''
\echo '--- quote_identifier 덕분에 이상한 테이블명도 안전하게 처리 ---'
CREATE TABLE "weird name" (x int);
INSERT INTO "weird name" SELECT generate_series(1,7);
SELECT myext_count_rows('weird name') AS quoted_ok;
DROP TABLE "weird name";

\echo ''
\echo '--- 없는 테이블이면 서버가 죽는 게 아니라 정상적으로 ERROR 가 난다 ---'
DO $$ BEGIN
    PERFORM myext_count_rows('no_such_table');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END $$;

\echo ''
\echo '=> C extension 은 서버 프로세스 안에서 직접 실행된다.'
\echo '   빠른 대신, 잘못 짜면 백엔드 프로세스 전체가 크래시한다.'
\echo '   그래서 myext.control 에 superuser = true, trusted = false 로 두었다.'
