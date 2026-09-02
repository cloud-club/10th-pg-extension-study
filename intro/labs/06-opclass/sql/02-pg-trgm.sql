-- ===========================================================================
-- 02. pg_trgm - LIKE '%...%' 에 인덱스를 태우기
-- ===========================================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users AS
SELECT g AS id,
       (ARRAY['김철수','이영희','박민수','최지훈','정수진','강민지','조현우','윤서연'])[1+(g%8)]
         || g::text AS name,
       'user' || g || '@example.com' AS email
FROM   generate_series(1, 200000) g;
CREATE INDEX idx_users_name_btree ON users (name);
ANALYZE users;

SET max_parallel_workers_per_gather = 0;   -- 계획을 단순하게 보기 위해

\echo '--- [문제] B-tree 인덱스가 있어도 %...% 는 못 씁니다 ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM users WHERE name LIKE '%김철수%';

\echo ''
\echo '  ^ Seq Scan. B-tree 는 "앞에서부터 일치"만 처리할 수 있습니다.'
\echo '    LIKE ''김철수%'' 면 인덱스를 타지만, ''%김철수%'' 는 시작점을 모릅니다.'

\echo ''
\echo '--- 확인: 앞이 고정된 패턴은 B-tree 를 씁니다 ---'
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '김철수1%';

\echo ''
\echo '--- [해결] pg_trgm 연산자 클래스로 GIN 인덱스 ---'
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);
ANALYZE users;

EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM users WHERE name LIKE '%김철수%';

\echo ''
\echo '  ^ Bitmap Index Scan on idx_users_name_trgm - 인덱스를 탔습니다.'

\echo ''
\echo '============================================================'
\echo ' ⚠ 함정: 패턴이 3글자보다 짧으면 인덱스를 못 씁니다'
\echo '============================================================'
\echo ''
\echo '--- 원리: 문자열을 3글자 조각(trigram)으로 쪼갠다 ---'
SELECT show_trgm('hello')  AS 영문;
SELECT show_trgm('김')     AS "1글자",
       show_trgm('김철')   AS "2글자",
       show_trgm('김철수') AS "3글자";

\echo ''
\echo '  ^ 단어 하나를 색인할 때는 앞뒤에 공백을 덧붙여 짧아도 조각을 만듭니다.'
\echo '    하지만 LIKE ''%...%'' 패턴에서는 양쪽이 와일드카드라 덧붙일 게 없습니다.'
\echo '    → 패턴에서 뽑을 수 있는 온전한 3글자 조각이 없으면 인덱스가 무용지물입니다.'

\echo ''
\echo '--- 패턴 길이별로 확인해봅시다 ---'
\echo ''
\echo '  [1글자] LIKE ''%김%'''
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김%';
\echo '  [2글자] LIKE ''%김철%'''
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김철%';
\echo '  [3글자] LIKE ''%김철수%'''
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김철수%';

\echo ''
\echo '  → 1~2글자는 Seq Scan, 3글자부터 Bitmap Index Scan.'
\echo '    "인덱스를 만들었는데 왜 안 타죠?" 의 아주 흔한 원인입니다.'
\echo ''
\echo '    실무 대응:'
\echo '      · 검색창에 최소 글자 수를 강제한다 (많은 서비스가 2~3자 이상을 요구하는 이유)'
\echo '      · 짧은 검색어는 다른 방식으로 처리한다 (전문검색, 접두어 인덱스 등)'
\echo '      · 한중일 텍스트라면 2글자 기반인 pg_bigm 을 검토한다'

RESET max_parallel_workers_per_gather;

\echo ''
\echo '--- 인덱스 크기 대가 ---'
SELECT i.relname AS 인덱스, am.amname AS 종류,
       pg_size_pretty(pg_relation_size(i.oid)) AS 크기
FROM   pg_class i JOIN pg_index x ON x.indexrelid=i.oid JOIN pg_am am ON am.oid=i.relam
WHERE  x.indrelid='users'::regclass ORDER BY pg_relation_size(i.oid) DESC;

\echo ''
\echo '  → 트라이그램 인덱스는 원본 컬럼만큼 커질 수 있고 쓰기 비용도 늘어납니다.'
\echo '    "부분 문자열 검색이 정말 필요한가"를 먼저 따져보세요.'
