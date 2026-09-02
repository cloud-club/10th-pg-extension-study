-- ===========================================================================
-- 06. intarray - 정수 배열 전용 연산자
--     (새 타입을 만들지 않고 "기존 타입"에 연산자를 더하는 변형)
-- ===========================================================================
\echo '--- 집합 연산자 ---'
SELECT ARRAY[1,2,3,4] & ARRAY[3,4,5] AS 교집합,
       ARRAY[1,2,3]   | ARRAY[3,4]   AS 합집합,
       ARRAY[1,2,3]   - ARRAY[2]     AS 차집합,
       icount(ARRAY[1,2,3,4])        AS 개수;

\echo ''
\echo '--- 정렬 / 중복 제거 ---'
SELECT sort(ARRAY[3,1,2])           AS 정렬,
       sort_desc(ARRAY[3,1,2])      AS 역정렬,
       uniq(sort(ARRAY[3,1,2,1,3])) AS 중복제거,
       idx(ARRAY[10,20,30], 20)     AS "20의_위치";

\echo ''
\echo '--- 태그 검색에 쓰기 ---'
DROP TABLE IF EXISTS articles;
CREATE TABLE articles (id serial PRIMARY KEY, title text, tag_ids int[]);
INSERT INTO articles (title, tag_ids) VALUES
  ('PostgreSQL 입문',  ARRAY[1,2,5]),
  ('인덱스 튜닝',      ARRAY[1,3]),
  ('벡터 검색',        ARRAY[1,4,5]),
  ('도커 기초',        ARRAY[6]);

CREATE INDEX idx_articles_tags ON articles USING gin (tag_ids gin__int_ops);

\echo '  태그 1 과 5 를 모두 가진 글 (@> = 포함)'
SELECT title FROM articles WHERE tag_ids @> ARRAY[1,5];

\echo '  태그 3 또는 4 를 가진 글 (&& = 겹침)'
SELECT title FROM articles WHERE tag_ids && ARRAY[3,4];

\echo ''
\echo '--- query_int: 불리언 태그 질의 ---'
SELECT title FROM articles WHERE tag_ids @@ '1 & (4 | 3)'::query_int;
\echo '  ^ "태그 1 이 있고, 4 나 3 중 하나가 있는" 글'

\echo ''
\echo '  ⚠ 참고: intarray 의 라이브러리 이름은 intarray.so 가 아니라 _int.so 입니다.'
\echo '  [컨테이너 셸] $ grep module_pathname /usr/share/postgresql/16/extension/intarray.control'
\! grep module_pathname /usr/share/postgresql/16/extension/intarray.control
\echo '    extension 이름과 .so 이름은 일치할 필요가 없습니다.'
\echo '    control 파일의 module_pathname 이 유일한 연결고리입니다.'
