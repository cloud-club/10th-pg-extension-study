-- ===========================================================================
-- 01. 인덱스: 어떤 방식이 어떤 연산자를 도와주나, 그리고 실제로 쓰이나
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;

\echo '--- 카탈로그가 말하는 지원 연산자 (pg_opclass · pg_amop) ---'
SELECT am.amname AS index_method, opc.opcname AS operator_class, amop.amopopr::regoperator AS operator
FROM   pg_opclass opc
JOIN   pg_am am ON am.oid = opc.opcmethod
JOIN   pg_amop amop ON amop.amopfamily = opc.opcfamily AND amop.amoplefttype = 'hstore'::regtype
WHERE  opc.opcintype = 'hstore'::regtype
ORDER  BY 1, 2, 3;

-- EXPLAIN 결과를 검증에서 쓰려고 JSON 으로 받아 오는 도우미
CREATE OR REPLACE FUNCTION plan_of(q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE j text;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF, FORMAT JSON) ' || q INTO j;
  RETURN j;
END $$;

DROP TABLE IF EXISTS item;
CREATE TABLE item (id int PRIMARY KEY, attrs hstore NOT NULL);
INSERT INTO item
SELECT id,
       hstore(ARRAY['color','size','brand','sku_grp'],
              ARRAY[(ARRAY['red','green','blue','black','white','gray','pink','navy'])[1 + id % 8],
                    (ARRAY['S','M','L','XL','XXL'])[1 + (id / 8) % 5],
                    'brand' || lpad((id % 40)::text, 2, '0'),
                    'g' || lpad((id % 1000)::text, 4, '0')])
       || CASE WHEN id % 1000 = 7 THEN hstore('promo', 'yes') ELSE ''::hstore END
FROM   generate_series(1, 100000) id;
-- 키 color 도 있고 값 red 도 있지만, red 가 color 의 값이 아닌 행 (GIN 이 헷갈리는 행)
INSERT INTO item
SELECT 100000 + i, 'shade=>red, color=>blue, sku_grp=>g0007'::hstore
FROM   generate_series(1, 500) i;
VACUUM (ANALYZE) item;

\echo ''
\echo '--- 인덱스가 없을 때 ---'
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';

CREATE INDEX item_gin ON item USING gin (attrs);

\echo ''
\echo '--- GIN(기본 gin_hstore_ops): @> ? ?& ?| 를 도와준다 ---'
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs ? 'promo';
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs ?& ARRAY['promo', 'color'];
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs ?| ARRAY['promo', 'nosuchkey'];

\echo ''
\echo '--- 도와주지 않는 것: -> 로 값을 꺼내 비교하는 식 ---'
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07';

\echo ''
\echo '--- Recheck: GIN 은 "키 color 가 있다" 와 "값 red 가 있다" 만 안다. 둘이 짝인지는 힙에서 다시 본다 ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';

DO $$
DECLARE p text := plan_of($q$SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007'$q$);
BEGIN
  ASSERT p LIKE '%item_gin%', 'GIN 을 써야 한다';
  ASSERT p LIKE '%"Rows Removed by Index Recheck": 500%', 'decoy 500행이 재검사에서 탈락해야 한다';
  RAISE NOTICE '✔ GIN recheck 검증 통과 (탈락 500행)';
END $$;

\echo ''
\echo '  ^ Rows Removed by Index Recheck 는 decoy 행(shade=>red, color=>blue)이다. GIN 후보에는 들어왔지만'
\echo '    color=>red 짝이 아니라서 탈락했다. gin_consistent_hstore 가 @> 에서 recheck = true 를 돌려주기 때문이다.'

\echo ''
\echo '--- 식 인덱스: 자주 쓰는 키 하나의 동등 비교는 btree 가 훨씬 작다 ---'
CREATE INDEX item_brand ON item ((attrs -> 'brand'));
ANALYZE item;          -- 식의 통계는 인덱스를 만든 뒤 ANALYZE 해야 생긴다
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07';

\echo ''
\echo '--- GiST: 서명(signature) 방식이라 작지만 손실이 있다. siglen 으로 정밀도를 조절한다 ---'
CREATE INDEX item_gist16  ON item USING gist (attrs gist_hstore_ops(siglen = 16));
CREATE INDEX item_gist128 ON item USING gist (attrs gist_hstore_ops(siglen = 128));

\echo ''
\echo '--- 크기 비교 ---'
SELECT c.relname AS index, am.amname AS method, pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM   pg_class c JOIN pg_am am ON am.oid = c.relam
WHERE  c.relname LIKE 'item\_%' ESCAPE '\' AND c.relkind = 'i'
ORDER  BY pg_relation_size(c.oid) DESC;
SELECT pg_size_pretty(pg_relation_size('item')) AS table_heap;
DO $$ BEGIN
  ASSERT pg_relation_size('item_gist128') > pg_relation_size('item_gist16'), 'siglen 이 크면 GiST 가 더 크다';
END $$;

\echo ''
\echo '--- GiST(siglen=16) 도 같은 조건에서 후보를 만들고 recheck 로 걸러낸다 (GIN 을 잠시 끈다) ---'
DROP INDEX item_gin;
DROP INDEX item_gist128;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';

\echo ''
\echo '--- 검증 ---'
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_am am JOIN pg_opclass opc ON opc.opcmethod = am.oid
          WHERE opc.opcintype = 'hstore'::regtype AND am.amname IN ('gin', 'gist', 'btree', 'hash')) = 4, '연산자 클래스 4개 (gin·gist·btree·hash)';
  ASSERT plan_of($q$SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07'$q$) LIKE '%item_brand%', '식 인덱스가 -> 비교에 쓰여야 한다';
  RAISE NOTICE '✔ 인덱스 검증 통과';
END $$;
