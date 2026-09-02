-- ===========================================================================
-- 02. hstore - key→value 한 컬럼에 담기
-- ===========================================================================
\echo '--- 기본 사용 ---'
SELECT 'name=>John, age=>30'::hstore                      AS h,
       ('name=>John, age=>30'::hstore) -> 'name'          AS 값_꺼내기,
       akeys('a=>1, b=>2'::hstore)                        AS 키목록,
       'a=>1'::hstore || 'b=>2'::hstore                   AS 병합;

\echo ''
\echo '--- 테이블에서 쓰기 ---'
DROP TABLE IF EXISTS products;
CREATE TABLE products (id serial PRIMARY KEY, name text, attrs hstore);
INSERT INTO products (name, attrs) VALUES
  ('노트북',  'cpu=>M3, ram=>16GB, color=>silver'),
  ('키보드',  'layout=>ANSI, switch=>brown'),
  ('모니터',  'size=>27, panel=>IPS, hz=>144');

SELECT name, attrs->'color' AS 색상, attrs ? 'hz' AS hz_있음 FROM products;

\echo ''
\echo '--- 조건 검색 ---'
SELECT name FROM products WHERE attrs @> 'panel=>IPS';       -- 포함
SELECT name FROM products WHERE attrs ? 'ram';               -- 키 존재

\echo ''
\echo '--- GiST/GIN 인덱스를 쓸 수 있습니다 ---'
CREATE INDEX idx_products_attrs ON products USING gin (attrs);
\echo '  (@> 연산자가 인덱스를 탑니다)'

\echo ''
\echo '--- 그런데 요즘은 jsonb 가 있습니다 ---'
SELECT * FROM (VALUES
  ('값 타입',      'text 만',                  '문자/숫자/불리언/배열/객체'),
  ('중첩',         '불가 (평면 1단계)',        '가능'),
  ('인덱스',       'GiST / GIN',               'GIN (jsonb_path_ops 등)'),
  ('표준',         'PostgreSQL 전용',          'JSON 표준'),
  ('언제 쓰나',    '단순 태그/속성 + 가벼움',  '대부분의 경우 이쪽')
) AS t(항목, hstore, jsonb);

\echo ''
\echo '  → 신규 프로젝트라면 jsonb 를 쓰세요. hstore 는 레거시에서 만나거나,'
\echo '    "문자열 태그만 있으면 충분"할 때 더 가벼워서 씁니다.'
\echo '    상호 변환도 됩니다:'
SELECT 'a=>1, b=>2'::hstore::jsonb AS hstore에서_jsonb로;
