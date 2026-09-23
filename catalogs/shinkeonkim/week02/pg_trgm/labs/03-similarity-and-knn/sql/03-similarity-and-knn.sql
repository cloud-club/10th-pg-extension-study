-- ===========================================================================
-- 03. 유사도 3형제와 KNN - pg_bigm 에 대응물이 없는 영역
--
-- pg_bigm 의 유사도는 =% 연산자 하나뿐이다. pg_trgm 은 세 가지 유사도와
-- 그에 딸린 연산자/임계값을 갖고 있는데, 셋의 "의미"가 실제로 다르다.
-- 무엇이 어떻게 다른지 숫자로 확인한다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\echo '=== STEP 1. 유사도 3형제의 의미 차이 ==='
\echo '  similarity(a,b)              : a 와 b 전체를 비교'
\echo '  word_similarity(a,b)         : a 가 b 의 "어떤 부분"과 얼마나 닮았나'
\echo '  strict_word_similarity(a,b)  : 위와 같되 그 부분이 단어 경계에 맞아야 한다'

SELECT similarity('word', 'two words')              AS similarity,
       word_similarity('word', 'two words')         AS word_sim,
       strict_word_similarity('word', 'two words')  AS strict_word_sim;
\echo '  ^ 0.36 / 0.8 / 0.57'
\echo '    similarity 는 "two words" 전체와 비교하니 낮다.'
\echo '    word_similarity 는 "word" 에 가장 잘 맞는 부분 구간만 보므로 높다.'
\echo '    strict_word_similarity 는 그 구간이 단어 경계여야 해서 중간이다.'
\echo ''
\echo '  실무 감각: 긴 본문에서 짧은 검색어를 찾을 때는 word_similarity 계열이 맞다.'
\echo '             similarity 를 쓰면 본문이 길다는 이유만으로 점수가 깎인다.'

\echo ''
\echo '--- 본문이 길어질수록 similarity 만 무너진다 ---'
SELECT len AS 본문길이,
       round(similarity('제브라', body)::numeric, 4)             AS similarity,
       round(word_similarity('제브라', body)::numeric, 4)        AS word_sim
FROM (VALUES
  (10,  '제브라 문서'),
  (40,  '제브라 문서 그리고 뒤에 붙는 다른 여러 가지 설명들이 이어진다'),
  (120, '제브라 문서 그리고 뒤에 붙는 다른 여러 가지 설명들이 이어지고 또 이어지며 계속해서 길어지는 아주 긴 본문의 경우를 가정한 문자열이다')
) AS t(len, body);
\echo '  ^ word_similarity 는 본문 길이에 거의 흔들리지 않는다.'

\echo ''
\echo '=== STEP 2. 임계값 GUC 3개 - 연산자마다 다른 값을 쓴다 ==='
SELECT name, setting, boot_val FROM pg_settings WHERE name LIKE 'pg_trgm%' ORDER BY 1;
\echo '  similarity_threshold             0.3  -> %   연산자'
\echo '  word_similarity_threshold        0.6  -> <%  연산자'
\echo '  strict_word_similarity_threshold 0.5  -> <<% 연산자'
\echo ''
\echo '  9.6 이전에는 set_limit()/show_limit() 함수를 썼다. 지금은 폐기됐다 -'
\echo '  오래된 블로그가 SELECT set_limit(0.5) 를 시키면 그건 9.6 이전 자료다.'
SELECT show_limit() AS 폐기된_함수도_아직_동작은_한다;

\echo ''
\echo '=== STEP 3. 오탈자 허용 검색 ==='
DROP TABLE IF EXISTS products;
CREATE TABLE products (id serial PRIMARY KEY, name text NOT NULL);
INSERT INTO products (name) VALUES
  ('mechanical keyboard'), ('wireless keyboard'), ('keyboard cover'),
  ('gaming mouse'), ('mouse pad'), ('monitor stand'),
  ('기계식 키보드'), ('무선 키보드'), ('키보드 덮개'), ('게이밍 마우스');

CREATE INDEX products_name_gin ON products USING gin (name gin_trgm_ops);
VACUUM ANALYZE products;

\echo '--- 오타가 있어도 찾는다: keyboad (r 이 빠짐) ---'
SELECT name, round(similarity(name, 'keyboad')::numeric, 4) AS sim
FROM products
WHERE name % 'keyboad'
ORDER BY sim DESC;
\echo '  ^ LIKE 로는 0건인 오타가 유사도 검색으로는 잡힌다.'

\echo ''
\echo '--- 한글 오탈자: 키보드 -> 키보두 ---'
SELECT name, round(similarity(name, '키보두')::numeric, 4) AS trgm_sim
FROM products
WHERE name % '키보두'
ORDER BY trgm_sim DESC;
\echo '  ^ 한글에서도 동작하기는 한다. 다만 pg_bigm 의 bigm_similarity() 가'
\echo '    같은 오탈자에 더 높은 점수를 준다 (조각이 짧아 덜 깨지고, 분모 공식도 다르다).'
\echo '    -> ../../bigm-vs-trgm/experiments/03 에서 두 확장의 점수를 나란히 잰다.'

\echo ''
\echo '--- 임계값을 낮추면 후보가 늘어난다 (운영에서 조심할 지점) ---'
SET pg_trgm.similarity_threshold = 0.15;
SELECT count(*) AS 임계값_0_15_매치수 FROM products WHERE name % '키보두';
SET pg_trgm.similarity_threshold = 0.3;
SELECT count(*) AS 임계값_0_30_매치수 FROM products WHERE name % '키보두';
RESET pg_trgm.similarity_threshold;
\echo '  ^ 검색 API 라면 임계값을 사용자 입력으로 그대로 받지 말고 서버에서 상한을 둘 것.'

\echo ''
\echo '=== STEP 4. KNN - "가장 비슷한 것 N건" (GiST 전용) ==='
\echo '  <-> 는 거리 연산자다: 거리 = 1 - similarity'
SELECT round((1 - similarity('keyboard', 'keyboad'))::numeric, 6) AS 계산한_거리,
       round(('keyboard' <-> 'keyboad')::numeric, 6)             AS 연산자_거리;

CREATE INDEX products_name_gist ON products USING gist (name gist_trgm_ops);
ANALYZE products;

SET enable_seqscan = off;
EXPLAIN (COSTS OFF)
SELECT name FROM products ORDER BY name <-> 'keyboad' LIMIT 3;
\echo '  ^ "Index Scan ... Order By" - 인덱스가 정렬을 수행한다.'
\echo '    전체를 정렬하고 자르는 게 아니라, 가까운 것부터 하나씩 꺼낸다.'

SELECT name, round((name <-> 'keyboad')::numeric, 4) AS 거리
FROM products ORDER BY name <-> 'keyboad' LIMIT 3;

\echo ''
\echo '--- 임계값과 무관하다는 게 KNN 의 장점이다 ---'
SELECT name, round((name <-> '전혀 상관없는 검색어')::numeric, 4) AS 거리
FROM products ORDER BY name <-> '전혀 상관없는 검색어' LIMIT 3;
\echo '  ^ % 연산자였다면 0건이었을 검색어에도 "그나마 가까운 3건"을 돌려준다.'
\echo '    "검색 결과 없음"을 피해야 하는 UI 에서 유용하다.'
\echo '    pg_bigm 에는 이 기능이 없다 - =% 는 임계값 필터일 뿐 정렬을 못 한다.'

RESET enable_seqscan;

\echo ''
\echo '=== 정리: 유사도/정렬 기능 대조 ==='
SELECT * FROM (VALUES
  ('전체 유사도',        'similarity() / %',                  'bigm_similarity() / =%'),
  ('단어 단위 유사도',   'word_similarity() / <%',            '없음'),
  ('엄격한 단어 유사도', 'strict_word_similarity() / <<%',    '없음'),
  ('거리순 정렬(KNN)',   '<-> (GiST 인덱스 필요)',            '없음'),
  ('대소문자',           '무시한다 (IGNORECASE)',             '구분한다'),
  ('공식',               '공통 / (len1+len2-공통)  자카드',   '공통 / max(len1,len2)')
) AS t(항목, pg_trgm, pg_bigm);
