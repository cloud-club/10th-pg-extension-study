-- ===========================================================================
-- 02. 연산자와 함수 — 상품 속성 예제
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;
DROP TABLE IF EXISTS product;
CREATE TABLE product (
  id    serial PRIMARY KEY,
  name  text NOT NULL,
  attrs hstore NOT NULL DEFAULT ''
);
INSERT INTO product (name, attrs) VALUES
  ('티셔츠', 'color=>red,   size=>M, material=>cotton'),
  ('머그컵', 'color=>white, capacity=>350ml, material=>ceramic'),
  ('노트북', 'brand=>acme,  ram=>16GB, ssd=>512GB, color=>silver'),
  ('후드',   'color=>red,   size=>L, material=>cotton, promo=>yes');

SELECT id, name, attrs FROM product ORDER BY id;

\echo ''
\echo '--- 값 꺼내기: -> (키 하나 / 키 배열) ---'
SELECT name, attrs -> 'color' AS color FROM product ORDER BY id;
SELECT name, attrs -> ARRAY['color', 'size'] AS color_and_size FROM product ORDER BY id;

\echo ''
\echo '--- 키가 있는가: ? (하나) ?& (전부) ?| (하나라도) ---'
SELECT name FROM product WHERE attrs ? 'promo';
SELECT name FROM product WHERE attrs ?& ARRAY['color', 'size'] ORDER BY id;
SELECT name FROM product WHERE attrs ?| ARRAY['ram', 'capacity'] ORDER BY id;

\echo ''
\echo '--- 포함: @> (왼쪽이 오른쪽의 키·값 쌍을 전부 갖는가), <@ (반대 방향) ---'
SELECT name FROM product WHERE attrs @> 'color=>red' ORDER BY id;
SELECT name FROM product WHERE attrs @> 'color=>red, material=>cotton' ORDER BY id;
SELECT 'color=>red'::hstore <@ (SELECT attrs FROM product WHERE id = 1) AS contained;

\echo ''
\echo '--- 합치기 ||: 오른쪽이 이긴다 (같은 키는 덮어쓰기, 없는 키는 추가) ---'
SELECT attrs || 'color=>blue, stock=>10' AS merged FROM product WHERE id = 1;

\echo ''
\echo '--- 지우기 -: 키 하나 / 키 배열 / hstore 와 같은 쌍 ---'
SELECT attrs - 'material'::text               AS del_key   FROM product WHERE id = 1;   -- ::text 필수 (아래 참고)
SELECT attrs - ARRAY['material', 'size']      AS del_keys  FROM product WHERE id = 1;
SELECT attrs - 'color=>red, size=>XL'::hstore AS del_pairs FROM product WHERE id = 1;

\echo ''
\echo '--- 함정: 따옴표만 있는 리터럴은 hstore 로 해석되어 오류가 난다 (- 는 text · text[] · hstore 가 모두 후보) ---'
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    PERFORM attrs - 'material' FROM product WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    failed := true;
    RAISE NOTICE '예상한 오류: %', SQLERRM;
  END;
  IF NOT failed THEN RAISE EXCEPTION '오류가 나야 하는데 성공했다'; END IF;
END $$;

\echo ''
\echo '--- 키·값 목록: akeys / avals (배열), skeys / svals / each (행으로 펼침) ---'
SELECT akeys(attrs) AS keys, avals(attrs) AS vals FROM product WHERE id = 1;
SELECT (each(attrs)).key, (each(attrs)).value FROM product WHERE id = 1;

\echo ''
\echo '--- 일부만 남기기: slice ---'
SELECT slice(attrs, ARRAY['color', 'size']) FROM product WHERE id = 1;

\echo ''
\echo '--- 만들기: 두 배열 / 키·값 한 쌍 / 행 전체 ---'
SELECT hstore(ARRAY['a', 'b'], ARRAY['1', '2']) AS from_arrays;
SELECT hstore('k', 'v')                        AS one_pair;
SELECT hstore(p)                               AS from_record FROM product p WHERE id = 1;

\echo ''
\echo '--- 집계로 만들기: 여러 행을 하나의 hstore 로 ---'
SELECT hstore(array_agg(name), array_agg(attrs -> 'color')) AS name_to_color FROM product;

\echo ''
\echo '--- 행 타입으로 되돌리기: populate_record ---'
DROP TYPE IF EXISTS spec;
CREATE TYPE spec AS (color text, size text, ram text);
SELECT * FROM populate_record(NULL::spec, (SELECT attrs FROM product WHERE id = 3));

\echo ''
\echo '--- 키 목록 집계: 어떤 속성이 몇 개 행에 있나 ---'
SELECT k AS attr, count(*) AS rows
FROM   product, LATERAL skeys(attrs) AS k
GROUP  BY k ORDER BY rows DESC, attr;

\echo ''
\echo '--- 검증 ---'
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM product WHERE attrs @> 'color=>red') = 2, 'red 는 2개';
  ASSERT (SELECT count(*) FROM product WHERE attrs @> 'color=>red, material=>cotton') = 2;
  ASSERT (SELECT name FROM product WHERE attrs ? 'promo') = '후드', 'promo 는 후드만';
  ASSERT ((SELECT attrs || 'color=>blue, stock=>10' FROM product WHERE id = 1) -> 'color') = 'blue', '|| 는 오른쪽이 이긴다';
  ASSERT NOT ((SELECT attrs - 'material'::text FROM product WHERE id = 1) ? 'material'), '- 는 키를 지운다';
  ASSERT (SELECT ram FROM populate_record(NULL::spec, (SELECT attrs FROM product WHERE id = 3))) = '16GB';
  RAISE NOTICE '✔ 연산자·함수 검증 통과';
END $$;
