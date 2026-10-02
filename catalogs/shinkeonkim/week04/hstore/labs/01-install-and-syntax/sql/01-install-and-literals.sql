-- ===========================================================================
-- 01. 설치 · hstore 리터럴 · 값은 전부 text
-- ===========================================================================
\echo '--- 설치 전: 서버가 hstore 패키지를 갖고 있는가 ---'
SELECT name, default_version, installed_version IS NOT NULL AS installed, comment
FROM   pg_available_extensions WHERE name = 'hstore';

\echo ''
\echo '--- 설치. trusted 확장이라 CREATE 권한만 있으면 슈퍼유저가 아니어도 된다 ---'
CREATE EXTENSION IF NOT EXISTS hstore;

SELECT name, version, trusted, relocatable
FROM   pg_available_extension_versions WHERE name = 'hstore' AND installed;

\echo ''
\echo '--- 설치가 만든 객체 종류와 개수 ---'
SELECT classid::regclass AS 종류, count(*) AS 개수
FROM   pg_depend
WHERE  refclassid = 'pg_extension'::regclass
  AND  refobjid = (SELECT oid FROM pg_extension WHERE extname = 'hstore')
  AND  deptype = 'e'
GROUP  BY 1 ORDER BY 2 DESC;

\echo ''
\echo '--- 리터럴: 공백은 무시되고, 쉼표·공백이 든 값은 큰따옴표로 감싼다 ---'
SELECT 'a=>1, b=>2'::hstore                         AS basic;
SELECT '  a  =>  1 ,   b=>2 '::hstore               AS whitespace_ignored;
SELECT '"key with space"=>"value, with comma"'::hstore AS quoted;
SELECT 'say=>"he said \"hi\""'::hstore              AS escaped_quote;

\echo ''
\echo '--- 출력 순서는 입력 순서가 아니다: 키 길이 먼저, 같으면 바이트 순 ---'
SELECT 'ccc=>1, b=>2, aa=>3, ab=>4'::hstore AS sorted_by_length_then_bytes;

\echo ''
\echo '--- 중복 키: 하나만 남는다 (문서는 어느 쪽인지 보장하지 않는다) ---'
SELECT 'a=>1, a=>2'::hstore AS duplicate_key;

\echo ''
\echo '--- NULL 값과 문자열 "NULL" 은 다르다. 값은 NULL 일 수 있지만 키는 안 된다 ---'
SELECT 'a=>NULL, b=>"NULL", c=>""'::hstore AS nulls;
SELECT h -> 'a' IS NULL AS a_is_null, h -> 'b' IS NULL AS b_is_null, h -> 'c' IS NULL AS c_is_null,
       exist(h, 'a') AS a_exists, defined(h, 'a') AS a_defined
FROM   (SELECT 'a=>NULL, b=>"NULL", c=>""'::hstore AS h) s;

\echo ''
\echo '--- 값은 전부 text 다: 숫자로 쓰려면 직접 캐스팅해야 한다 ---'
SELECT pg_typeof('n=>42'::hstore -> 'n') AS 값의_타입,
       ('n=>42'::hstore -> 'n')::int + 1 AS 캐스팅_후;

\echo ''
\echo '--- 빈 hstore ---'
SELECT ''::hstore AS empty, akeys(''::hstore) AS keys, ''::hstore = ''::hstore AS eq;

\echo ''
\echo '--- 검증 ---'
DO $$
BEGIN
  ASSERT (SELECT installed_version FROM pg_available_extensions WHERE name = 'hstore') = '1.8', 'hstore 1.8 이 설치돼야 한다';
  ASSERT 'ccc=>1, b=>2, aa=>3, ab=>4'::hstore::text = '"b"=>"2", "aa"=>"3", "ab"=>"4", "ccc"=>"1"', '키는 길이 → 바이트 순으로 정렬된다';
  ASSERT (SELECT count(*) FROM each('a=>1, a=>2'::hstore)) = 1, '중복 키는 하나만 남는다';
  ASSERT pg_typeof('n=>42'::hstore -> 'n') = 'text'::regtype, '값은 text 다';
  ASSERT exist('a=>NULL'::hstore, 'a') AND NOT defined('a=>NULL'::hstore, 'a'), 'NULL 값: 키는 있고 defined 는 false';
  ASSERT ('a=>"NULL"'::hstore -> 'a') = 'NULL', '따옴표로 감싼 NULL 은 문자열이다';
  RAISE NOTICE '✔ 설치와 리터럴 규칙 검증 통과';
END $$;
