-- ===========================================================================
-- 04. fuzzystrmatch - 비슷한 문자열 찾기
-- ===========================================================================
\echo '--- levenshtein: 몇 글자를 고쳐야 같아지는가 (편집 거리) ---'
SELECT levenshtein('김철수', '김철순')  AS 한글_1글자차이,
       levenshtein('kitten', 'sitting') AS 영문_3글자차이,
       levenshtein('same', 'same')      AS 동일;

\echo ''
\echo '--- 오타 교정에 쓰기 ---'
DROP TABLE IF EXISTS cities;
CREATE TABLE cities (name text);
INSERT INTO cities VALUES ('서울'),('부산'),('인천'),('대구'),('대전'),('광주'),('울산');

SELECT name AS 후보, levenshtein('대젼', name) AS 편집거리
FROM   cities ORDER BY 편집거리 LIMIT 3;

\echo ''
\echo '--- soundex / metaphone: 발음이 비슷한 영어 단어 ---'
SELECT soundex('Smith')   AS smith,
       soundex('Smyth')   AS smyth,
       soundex('Smith') = soundex('Smyth') AS 같은_발음;

SELECT metaphone('Thompson', 10) AS thompson,
       metaphone('Tomson',   10) AS tomson,
       dmetaphone('Schmidt')     AS schmidt;

\echo ''
\echo '  ⚠ soundex / metaphone 은 영어 발음 규칙 기반입니다. 한글에는 쓸 수 없습니다.'
\echo '    한글 오타 검색은 levenshtein 이나 pg_trgm(lab06) 을 쓰세요.'

\echo ''
\echo '--- ⚠ 성능 주의: 이 함수들은 인덱스를 못 씁니다 ---'
EXPLAIN (COSTS OFF)
SELECT name FROM cities WHERE levenshtein('대젼', name) <= 1;
\echo '  ^ Seq Scan. 모든 행에 대해 함수를 호출합니다.'
\echo '    행이 많으면 pg_trgm 으로 후보를 좁힌 뒤 levenshtein 으로 재정렬하는 식으로 씁니다.'
