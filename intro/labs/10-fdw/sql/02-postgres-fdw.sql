-- ===========================================================================
-- 02. postgres_fdw - 다른 PostgreSQL 서버를 테이블처럼
--     (여기서는 자기 자신에 연결해 원리를 봅니다)
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

\echo '--- 원격에 있다고 가정할 테이블 ---'
DROP TABLE IF EXISTS orders_remote;
CREATE TABLE orders_remote AS
SELECT g AS id,
       (ARRAY['서울','부산','인천','대구'])[1+(g%4)] AS city,
       (g % 100 + 1) * 1000 AS amount,
       now() - (g || ' hours')::interval AS ordered_at
FROM   generate_series(1, 100000) g;
CREATE INDEX ON orders_remote (city);
ANALYZE orders_remote;

\echo ''
\echo '--- 3단계 설정 ---'
CREATE SERVER IF NOT EXISTS remote_pg
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'localhost', port '5432', dbname 'study');

DROP USER MAPPING IF EXISTS FOR CURRENT_USER SERVER remote_pg;
CREATE USER MAPPING FOR CURRENT_USER SERVER remote_pg
  OPTIONS (user 'postgres', password 'postgres');

DROP SCHEMA IF EXISTS remote CASCADE;
CREATE SCHEMA remote;
IMPORT FOREIGN SCHEMA public LIMIT TO (orders_remote)
  FROM SERVER remote_pg INTO remote;

\echo '  ^ IMPORT FOREIGN SCHEMA 가 원격 테이블 정의를 읽어 외부 테이블을 자동 생성합니다.'

SELECT foreign_table_schema, foreign_table_name FROM information_schema.foreign_tables;

\echo ''
\echo '--- 조회 ---'
SELECT * FROM remote.orders_remote ORDER BY id LIMIT 3;

\echo ''
\echo '======== 푸시다운(pushdown) - postgres_fdw 의 핵심 ========'
\echo ''
\echo '--- WHERE 푸시다운: 필터를 원격에서 수행 ---'
EXPLAIN (VERBOSE, COSTS OFF)
SELECT id, amount FROM remote.orders_remote WHERE city = '부산' AND amount > 90000;

\echo ''
\echo '  ^ Remote SQL 줄을 보세요. WHERE 가 원격 쿼리에 포함되어 있습니다.'
\echo '    10만 행을 다 가져와서 거르는 게 아니라, 원격에서 걸러 결과만 받습니다.'

\echo ''
\echo '--- 집계 푸시다운 ---'
EXPLAIN (VERBOSE, COSTS OFF)
SELECT city, count(*), sum(amount) FROM remote.orders_remote GROUP BY city;

\echo ''
\echo '  ^ GROUP BY 까지 원격에서 수행하고 집계 결과만 가져옵니다.'

\echo ''
\echo '--- 푸시다운이 안 되는 경우 ---'
-- 주의: LANGUAGE sql 로 만들면 플래너가 본문을 인라인해버려서
--       upper(city) 로 펼쳐지고, 그건 원격도 아는 함수라 푸시다운됩니다.
--       인라인되지 않는 plpgsql 로 만들어야 "원격이 모르는 함수"가 됩니다.
CREATE OR REPLACE FUNCTION local_only(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN upper(t); END $$;

EXPLAIN (VERBOSE, COSTS OFF)
SELECT id FROM remote.orders_remote WHERE local_only(city) = '부산';

\echo ''
\echo '  ^ Remote SQL 에 WHERE 가 없습니다. 원격 서버가 모르는 함수이기 때문입니다.'
\echo '    → 10만 행을 전부 가져와서 로컬에서 거릅니다. 네트워크가 병목이 됩니다.'
\echo '    Filter 줄이 Foreign Scan "바깥"에 있는 것에 주목하세요.'

\echo ''
\echo '--- 비교: 원격이 아는 함수는 푸시다운됩니다 ---'
EXPLAIN (VERBOSE, COSTS OFF)
SELECT id FROM remote.orders_remote WHERE upper(city) = '부산';

\echo ''
\echo '  → 실행 계획의 "Remote SQL" 을 항상 확인하세요.'
\echo '    거기에 WHERE 가 없으면 전체를 끌어오고 있다는 뜻입니다.'

\echo ''
\echo '--- 쓰기도 됩니다 (file_fdw 와 다른 점) ---'
INSERT INTO remote.orders_remote VALUES (999999, '제주', 5000, now());
SELECT * FROM remote.orders_remote WHERE id = 999999;
DELETE FROM remote.orders_remote WHERE id = 999999;

\echo ''
\echo '  ⚠ 단, 원격 트랜잭션은 2PC 가 아니면 원자성이 보장되지 않습니다.'
\echo '     로컬 커밋은 성공했는데 원격이 실패하는 상황이 가능합니다.'
