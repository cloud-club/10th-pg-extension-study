-- ===========================================================================
-- 02. 2-gram 인덱스로 LIKE 검색 가속하기 - 그리고 Recheck 이 왜 필요한가
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_bigm;

\echo '--- 2-gram 이 실제로 어떻게 쪼개지는지 ---'
SELECT show_bigm('full text search');
\echo '  ^ 앞뒤에 공백 하나씩 붙이고, 두 글자씩 겹쳐가며 잘라낸다.'

\echo ''
\echo '--- 한글도 그대로 된다 (pg_trgm 은 알파벳이 아니면 기본 설정에서 다 걸러낸다) ---'
SELECT show_bigm('가나다라');
SELECT show_bigm('풀텍스트검색');

\echo ''
\echo '--- 인덱스 생성: GIN + gin_bigm_ops (GiST 는 지원 안 한다) ---'
DROP TABLE IF EXISTS pg_tools;
CREATE TABLE pg_tools (tool text, description text);
INSERT INTO pg_tools VALUES
  ('pg_hint_plan', 'Tool that allows a user to specify an optimizer HINT to PostgreSQL'),
  ('pg_bigm',      'Tool that provides 2-gram full text search capability in PostgreSQL'),
  ('pg_trgm',      'Tool that provides 3-gram full text search capability in PostgreSQL'),
  ('오타로_검색',   '한글 문서에서도 부분 문자열 검색이 빨라야 한다는 요구사항 예시');

CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);

\echo ''
\echo '--- LIKE 로 검색한다 - 별도 문법 없이 그냥 LIKE 다 ---'
SET enable_seqscan = off;  -- 이 lab 의 작은 테이블에서도 인덱스를 타는지 보려고 강제
EXPLAIN SELECT * FROM pg_tools WHERE description LIKE '%search%';
SELECT tool FROM pg_tools WHERE description LIKE '%search%';

\echo ''
\echo '--- 한글 부분 문자열도 인덱스로 검색된다 ---'
SELECT tool FROM pg_tools WHERE description LIKE '%검색%';

\echo ''
\echo '--- 왜 Recheck 이 필요한가: false positive 후보를 걸러내는 과정 ---'
DROP TABLE IF EXISTS tbl;
CREATE TABLE tbl (doc text);
INSERT INTO tbl VALUES ('He is awaiting trial'), ('It was a trivial mistake');
CREATE INDEX tbl_idx ON tbl USING gin (doc gin_bigm_ops);

\echo '  "trial" 의 2-gram 은 (tr, ri, ia, al) 이고, "trivial" 도 이 4개를 전부 포함한다.'
\echo '  그래서 인덱스 단계에서는 둘 다 "후보"로 걸린다.'
EXPLAIN ANALYZE SELECT * FROM tbl WHERE doc LIKE likequery('trial');
\echo ''
\echo '--- Recheck Cond 가 후보 중 진짜만 걸러낸다 ---'
SELECT * FROM tbl WHERE doc LIKE likequery('trial');

\echo ''
\echo '--- pg_bigm.enable_recheck 를 꺼보면 걸러지지 않은 오답이 그대로 나온다 ---'
SET pg_bigm.enable_recheck = off;
SELECT * FROM tbl WHERE doc LIKE likequery('trial');
\echo '  ^ "It was a trivial mistake" 가 잘못 섞여 나온다. 반드시 켜둬야 정확한 결과를 얻는다.'
\echo '    (평가/디버깅 용도가 아니면 끄지 말 것 - 기본값이 on 인 이유)'
RESET pg_bigm.enable_recheck;

\echo ''
\echo '--- likequery(): 검색어를 LIKE 패턴으로 안전하게 변환해준다 ---'
SELECT likequery('100% 확신하는_검색어\단어');
\echo '  ^ %, _, \ 를 이스케이프하고 앞뒤에 %를 붙인다 - 이 함수 없이 애플리케이션이'
\echo '    직접 하려면 이스케이프 로직을 매번 구현해야 한다.'

RESET enable_seqscan;
