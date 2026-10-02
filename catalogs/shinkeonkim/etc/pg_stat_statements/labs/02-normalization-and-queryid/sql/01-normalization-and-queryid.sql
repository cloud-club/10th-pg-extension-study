-- ===========================================================================
-- 02. 쿼리 정규화(normalization) - 이 extension 의 핵심 아이디어
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT pg_stat_statements_reset() IS NOT NULL AS 통계_초기화;

DROP TABLE IF EXISTS t_demo;
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1, 50000) g;
CREATE INDEX ON t_demo (id);
ANALYZE t_demo;

\echo '--- 상수만 다른 쿼리를 여러 번 실행 ---'
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;
SELECT h FROM t_demo WHERE id = 42;
SELECT h FROM t_demo WHERE id = 4242;

\echo ''
\echo '--- 수집된 통계 ---'
SELECT left(query, 45) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 2) AS 총ms,
       round(mean_exec_time::numeric, 3)  AS 평균ms, rows AS 행수
FROM   pg_stat_statements
WHERE  query LIKE '%t_demo%' AND query NOT LIKE '%pg_stat%'
ORDER  BY total_exec_time DESC;

\echo ''
\echo '  ^ id < 100 / 200 / 300 이 "id < $1" 하나로 합쳐져 calls = 3 이 되었다.'
\echo '    파스 트리 단계에서 상수 리터럴을 지워 같은 "모양"의 쿼리를 하나로 묶는다.'
\echo '    이게 없으면 상수만 다른 쿼리가 수백만 개의 별개 항목이 되어'
\echo '    "무엇이 느린가"를 물어볼 수조차 없다.'

\echo ''
\echo '--- queryid: 쿼리 모양의 지문 ---'
SELECT queryid, left(query, 45) AS 쿼리, calls
FROM   pg_stat_statements WHERE query LIKE '%t_demo%' ORDER BY calls DESC LIMIT 5;

\echo ''
\echo '--- IN 리스트 길이가 다르면 어떻게 되나 (직접 확인해보는 함정) ---'
\echo '    상수 "값"만 다른 건 정규화되지만, 리스트의 "길이"까지 같은 취급을 받을까?'
SELECT pg_stat_statements_reset();
SELECT count(*) FROM t_demo WHERE id IN (1, 2, 3);
SELECT count(*) FROM t_demo WHERE id IN (10, 20, 30, 40, 50);
SELECT count(*) FROM t_demo WHERE id IN (100, 200, 300, 400, 500, 600, 700);

SELECT queryid, left(query, 45) AS 쿼리, calls
FROM   pg_stat_statements WHERE query LIKE '%IN (%' ORDER BY calls DESC;

\echo ''
\echo '  ^ 이 PostgreSQL 버전에서는 항목 3개짜리 / 5개짜리 / 7개짜리가 서로 다른 queryid'
\echo '    로 남는다 (calls 가 각각 1). 애플리케이션이 "IN (1,2,3)", "IN (1,2,3,4)" 처럼'
\echo '    가변 길이 IN 리스트를 계속 만들어내면, pg_stat_statements 가 그걸 전부'
\echo '    별개 항목으로 쌓아 사실상 정규화가 무력화될 수 있다는 뜻이다.'
\echo '    (더 최신 PostgreSQL 은 이런 상수 리스트를 개수와 무관하게 뭉치는 기능을 추가했다 -'
\echo '     정확한 도입 버전은 docs/03-version-history.md 에서 확인한다. "확인 안 됨"이면'
\echo '     아직 검증 전이라는 뜻이니 공식 문서로 다시 확인할 것.)'
\echo '    실무에서는 이 문제를 IN 대신 `= ANY($1::int[])` 로 바꿔 배열 파라미터 하나로'
\echo '    묶는 방식으로 우회하기도 한다.'

\echo ''
\echo '--- 실행 중인 쿼리에도 같은 queryid 가 붙는다 ---'
SHOW compute_query_id;
SELECT pid, query_id, left(query, 40) AS query
FROM   pg_stat_activity WHERE pid = pg_backend_pid();

\echo ''
\echo '  → pg_stat_activity(지금 뭐가 돌고 있나)와 pg_stat_statements(누적 통계)를'
\echo '    queryid 로 조인할 수 있다. "지금 느린 이 쿼리, 평소에도 느렸나?"'

\echo ''
\echo '--- track = all: 함수/트리거 안의 쿼리까지 잡는다 ---'
SHOW pg_stat_statements.track;
SELECT pg_stat_statements_reset();

CREATE OR REPLACE FUNCTION count_demo(threshold int) RETURNS bigint AS $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM t_demo WHERE id < threshold;  -- 최상위(top-level) 쿼리가 아니다
  RETURN n;
END;
$$ LANGUAGE plpgsql;

SELECT count_demo(1000);
SELECT count_demo(2000);

\echo ''
\echo '--- toplevel 컬럼으로 최상위 호출과 함수 내부 호출을 구분한다 (PostgreSQL 14+) ---'
SELECT toplevel, left(query, 55) AS 쿼리, calls
FROM   pg_stat_statements
WHERE  (query LIKE '%t_demo%' AND query LIKE '%threshold%') OR query LIKE '%count_demo%'
ORDER  BY toplevel DESC;

\echo ''
\echo '  ^ toplevel = false 인 행이 함수 내부에서 실행된 SELECT 다.'
\echo '    track=top(기본값)이었다면 이 행은 아예 잡히지 않았을 것이다.'
\echo '    함수/트리거 안에 숨은 느린 쿼리를 찾으려면 track=all 이 필요하지만,'
\echo '    항목 수가 크게 늘어나 오버헤드도 함께 커진다 - 상시 운영에서는 신중히 켠다.'
