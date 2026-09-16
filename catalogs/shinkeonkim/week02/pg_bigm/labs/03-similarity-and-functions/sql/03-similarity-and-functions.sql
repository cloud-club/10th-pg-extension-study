-- ===========================================================================
-- 03. 유사도 검색 (=%) 과 제공 함수들
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- 이 lab 은 02-bigram-index-and-search 와 별도 컨테이너/DB 에서 독립적으로 돈다 -
-- 그래서 거기서 쓴 pg_tools 테이블을 여기서 다시 만든다.
DROP TABLE IF EXISTS pg_tools;
CREATE TABLE pg_tools (tool text, description text);
INSERT INTO pg_tools VALUES
  ('pg_hint_plan', 'Tool that allows a user to specify an optimizer HINT to PostgreSQL'),
  ('pg_bigm',      'Tool that provides 2-gram full text search capability in PostgreSQL'),
  ('pg_trgm',      'Tool that provides 3-gram full text search capability in PostgreSQL'),
  ('오타로_검색',   '한글 문서에서도 부분 문자열 검색이 빨라야 한다는 요구사항 예시');
CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);

\echo '--- 유사도 검색: =% 연산자 ---'
SET pg_bigm.similarity_limit = 0.2;
SHOW pg_bigm.similarity_limit;

SELECT tool FROM pg_tools WHERE tool =% 'bigm';
\echo '  ^ pg_bigm.similarity_limit(0.2) 이상인 것만 돌아온다. LIKE 처럼 패턴을 몰라도'
\echo '    "이 단어와 비슷한 것"을 찾을 수 있다 - 오탈자에 강하다.'

\echo ''
\echo '--- bigm_similarity(): 두 문자열이 2-gram 을 얼마나 공유하는지 ---'
SELECT bigm_similarity('full text search', 'text similarity search');
SELECT bigm_similarity('ABC', 'A');
SELECT bigm_similarity('ABC', 'B');
\echo '  ^ "ABC" 와 "A" 는 앞뒤 공백까지 고려한 2-gram(" A")을 하나 공유해서 유사도가 있지만'
\echo '    "ABC" 와 "B" 는 공유하는 2-gram 이 없어서 0 이다 - 단순 substring 포함 여부와는 다르다.'

\echo ''
\echo '--- pg_trgm 과의 결정적 차이: 대소문자 구분 ---'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SELECT similarity('ABC', 'abc')     AS "pg_trgm(대소문자 무시)";
SELECT bigm_similarity('ABC', 'abc') AS "pg_bigm(대소문자 구분)";
\echo '  ^ pg_trgm 의 similarity() 는 1 이 나오지만 bigm_similarity() 는 0 이다.'
\echo '    대소문자를 구분해야 하는 도메인(코드, 식별자)이면 이 차이가 중요하다.'

\echo ''
\echo '--- pg_gin_pending_stats(): FASTUPDATE 로 인한 pending list 크기 확인 ---'
\echo '    주의: CREATE INDEX 시점에 이미 있던 행은 pending list 를 거치지 않고'
\echo '    바로 통째로 빌드된다 - pending list 를 보려면 인덱스가 "있는 상태에서" INSERT 해야 한다.'
SELECT * FROM pg_gin_pending_stats('pg_tools_idx');
INSERT INTO pg_tools SELECT 'extra_' || g, 'additional description number ' || g FROM generate_series(1, 500) g;
SELECT * FROM pg_gin_pending_stats('pg_tools_idx');
\echo '  ^ GIN 은 기본적으로 FASTUPDATE=on 이라 INSERT 를 pending list 에 먼저 쌓아두고'
\echo '    나중에 한꺼번에 정리(VACUUM/자동 정리)한다 - 쓰기는 빨라지지만 pending list 가'
\echo '    커지면 그 리스트를 먼저 훑어야 하는 첫 조회가 느려질 수 있다.'

\echo ''
\echo '--- FASTUPDATE 를 끈 인덱스와 비교 ---'
DROP INDEX IF EXISTS pg_tools_idx_nofu;
CREATE INDEX pg_tools_idx_nofu ON pg_tools USING gin (description gin_bigm_ops) WITH (FASTUPDATE = off);
INSERT INTO pg_tools SELECT 'extra2_' || g, 'yet another description number ' || g FROM generate_series(1, 500) g;
SELECT * FROM pg_gin_pending_stats('pg_tools_idx_nofu');
\echo '  ^ pending list 자체가 없다(0/0) - 쓰기 즉시 인덱스에 반영되지만, 매 INSERT 마다'
\echo '    인덱스를 갱신해야 하니 쓰기가 상대적으로 느려질 수 있다. 읽기 위주 테이블에 적합.'
