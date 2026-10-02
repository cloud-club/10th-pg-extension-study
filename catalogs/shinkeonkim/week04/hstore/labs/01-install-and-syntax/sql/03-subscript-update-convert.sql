-- ===========================================================================
-- 03. 첨자 · 갱신 · json/jsonb 변환
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;
DROP TABLE IF EXISTS product;
CREATE TABLE product (id serial PRIMARY KEY, name text, attrs hstore NOT NULL DEFAULT '');
INSERT INTO product (name, attrs) VALUES ('티셔츠', 'color=>red, size=>M'), ('후드', 'color=>red, size=>L');

\echo '--- 첨자(subscript) 읽기: hstore 1.8(PostgreSQL 14+) ---'
SELECT extversion FROM pg_extension WHERE extname = 'hstore';
SELECT name, attrs['color'] AS color FROM product ORDER BY id;

\echo ''
\echo '--- 첨자로 쓰기: 키가 있으면 바꾸고 없으면 추가한다 ---'
UPDATE product SET attrs['color'] = 'blue', attrs['stock'] = '7' WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;

\echo ''
\echo '--- 여러 키를 한 번에 바꿀 때는 || 가 문서상 더 효율적이다 ---'
UPDATE product SET attrs = attrs || 'color=>green, size=>XL, stock=>3' WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;

\echo ''
\echo '--- 키 삭제 ---'
UPDATE product SET attrs = attrs - 'stock'::text WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;

\echo ''
\echo '--- 값이 숫자인 카운터: 캐스팅이 필요하다 (원자성은 04 실습) ---'
UPDATE product SET attrs = attrs || hstore('views', (coalesce((attrs -> 'views')::int, 0) + 1)::text) WHERE id = 2;
UPDATE product SET attrs = attrs || hstore('views', (coalesce((attrs -> 'views')::int, 0) + 1)::text) WHERE id = 2;
SELECT name, attrs -> 'views' AS views FROM product WHERE id = 2;

\echo ''
\echo '--- NULL 키 첨자는 읽기는 NULL, 쓰기는 오류 ---'
SELECT attrs[NULL] IS NULL AS read_null_key FROM product WHERE id = 1;
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    UPDATE product SET attrs[NULL] = 'x' WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    failed := true;
    RAISE NOTICE '예상한 오류: %', SQLERRM;
  END;
  IF NOT failed THEN RAISE EXCEPTION '오류가 나야 하는데 성공했다'; END IF;
END $$;

\echo ''
\echo '--- json / jsonb 로 변환: 값은 문자열이다 (strict) ---'
SELECT hstore_to_json('n=>42, t=>true, s=>hello, z=>NULL')  AS json_strict;
SELECT hstore_to_jsonb('n=>42, t=>true, s=>hello, z=>NULL') AS jsonb_strict;

\echo ''
\echo '--- loose 변환: 숫자로 읽히는 값은 숫자, 't'/'f' 는 불리언 (모양으로 추측한다) ---'
SELECT hstore_to_jsonb_loose('n=>42, flag=>t, off=>f, word=>true, s=>hello, z=>NULL, ver=>1.10, zip=>007') AS jsonb_loose;

\echo ''
\echo '--- jsonb -> hstore: 내장 캐스트는 없다. 중첩·배열은 문자열이 된다 ---'
WITH src AS (
  SELECT '{"a": 1, "b": true, "c": [1, 2], "d": {"x": 1}}'::jsonb AS j
)
SELECT hstore(array_agg(key), array_agg(value)) AS as_hstore
FROM   src, LATERAL jsonb_each_text(src.j);

\echo ''
\echo '--- 배열/행렬 형태: %% (평평한 배열), %# (2차원) ---'
SELECT %% 'a=>1, b=>2'::hstore AS flat_array;
SELECT %# 'a=>1, b=>2'::hstore AS matrix;

\echo ''
\echo '--- 검증 ---'
DO $$
BEGIN
  ASSERT (SELECT attrs FROM product WHERE id = 1) = 'color=>green, size=>XL', '첨자·|| · - 를 거친 최종 값';
  ASSERT (SELECT attrs -> 'views' FROM product WHERE id = 2) = '2', '카운터를 두 번 올렸다';
  ASSERT hstore_to_jsonb('n=>42') = '{"n": "42"}'::jsonb, 'strict 변환은 문자열';
  ASSERT hstore_to_jsonb_loose('n=>42, flag=>t, word=>true, zip=>007') = '{"n": 42, "flag": true, "word": "true", "zip": "007"}'::jsonb, 'loose 변환은 모양으로 추측한다';
  RAISE NOTICE '✔ 첨자·갱신·변환 검증 통과';
END $$;
