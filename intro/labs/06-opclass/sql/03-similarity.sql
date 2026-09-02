-- ===========================================================================
-- 03. pg_trgm 의 진짜 강점 - 유사도 검색 (오타 허용)
-- ===========================================================================
\echo '--- similarity: 0(전혀 다름) ~ 1(동일) ---'
SELECT similarity('김철수', '김철수')  AS 동일,
       similarity('김철수', '김철순')  AS 한글자_다름,
       similarity('postgres', 'postgre') AS 영문_오타,
       similarity('김철수', '박민수')  AS 다른_이름;

\echo ''
\echo '--- % 연산자: 유사도가 임계값 이상인가 ---'
SHOW pg_trgm.similarity_threshold;

SELECT name, round(similarity(name, '김철수1')::numeric, 3) AS 유사도
FROM   users WHERE name % '김철수1'
ORDER  BY 유사도 DESC LIMIT 5;

\echo ''
\echo '--- 임계값을 낮추면 더 관대해집니다 ---'
SET pg_trgm.similarity_threshold = 0.15;
SELECT count(*) AS "임계값 0.15 일 때 후보 수" FROM users WHERE name % '김철수1';
RESET pg_trgm.similarity_threshold;

\echo ''
\echo '--- <-> : 거리 순 정렬 (KNN). GiST 인덱스가 필요합니다 ---'
CREATE INDEX IF NOT EXISTS idx_users_name_trgm_gist ON users USING gist (name gist_trgm_ops);
ANALYZE users;

EXPLAIN (COSTS OFF)
SELECT name FROM users ORDER BY name <-> '김철수1' LIMIT 5;

SELECT name, round((name <-> '김철수1')::numeric, 3) AS 거리
FROM   users ORDER BY name <-> '김철수1' LIMIT 5;

\echo ''
\echo '--- GIN vs GiST: 트라이그램 인덱스 고르기 ---'
SELECT * FROM (VALUES
  ('LIKE ''%x%'' 검색',  '빠름',            '느림'),
  ('유사도 % 검색',      '가능',            '가능'),
  ('<-> KNN 정렬',       '불가',            '가능'),
  ('인덱스 크기',        '큼',              '작음'),
  ('빌드 속도',          '느림',            '빠름')
) AS t(용도, GIN, GiST);

\echo ''
\echo '  → 검색만 하면 GIN, "가장 비슷한 N개"가 필요하면 GiST.'
\echo '    둘 다 필요하면 둘 다 만들 수도 있습니다 (쓰기 비용은 두 배).'
