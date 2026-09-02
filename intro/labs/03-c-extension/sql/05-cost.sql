-- ===========================================================================
-- 05. 왜 C 로 짜는가 - SQL/PLpgSQL 구현과 비교
-- ===========================================================================
CREATE OR REPLACE FUNCTION plpgsql_add(a int, b int) RETURNS int
LANGUAGE plpgsql IMMUTABLE STRICT AS $$ BEGIN RETURN a + b; END $$;

CREATE OR REPLACE FUNCTION sql_add(a int, b int) RETURNS int
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT a + b $$;

\echo '--- 100만 번 호출 비교 (인자가 generate_series 라 상수 폴딩이 안 일어난다) ---'
\echo '\\timing on'
\timing on

\echo ''
\echo '[C extension]'
SELECT sum(myext_add(g, 1)) FROM generate_series(1, 1000000) g;

\echo ''
\echo '[LANGUAGE sql]'
SELECT sum(sql_add(g, 1)) FROM generate_series(1, 1000000) g;

\echo ''
\echo '[LANGUAGE plpgsql]'
SELECT sum(plpgsql_add(g, 1)) FROM generate_series(1, 1000000) g;

\echo '\\timing off'
\timing off

\echo ''
\echo '=> 이 정도 단순 연산에서는 차이가 크지 않을 수 있다.'
\echo '   C 가 진짜 필요한 순간은 이런 경우다:'
\echo '     - 새 데이터 타입 (vector, geometry) - 저장 포맷을 직접 정의해야 함'
\echo '     - 새 인덱스 액세스 메서드 (HNSW, GiST) - 커널 API 구현 필요'
\echo '     - Hook (pg_stat_statements) - 실행기 내부에 끼어들어야 함'
\echo '     - Background Worker (pg_cron) - 별도 프로세스 등록 필요'
\echo '   단순 계산 로직이라면 SQL 함수로 충분하다.'
