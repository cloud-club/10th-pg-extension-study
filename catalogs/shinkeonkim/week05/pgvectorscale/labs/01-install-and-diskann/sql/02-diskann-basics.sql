DROP TABLE IF EXISTS items;
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');

-- 빌드 NOTICE에 기본 파라미터가 그대로 찍힌다.
CREATE INDEX items_diskann_idx ON items USING diskann (embedding vector_l2_ops);

SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'items';

LOAD 'vectorscale-0.9.1';
SELECT name, setting, short_desc FROM pg_settings WHERE name LIKE 'diskann.%' ORDER BY name;

-- diskann이 지원하는 연산자 클래스 - vector_l1_ops가 없고(HNSW에는 있다),
-- vector_smallint_label_ops가 있다(라벨 필터링 전용 - 03에서 실제로 써본다).
SELECT oc.opcname
FROM pg_opclass oc JOIN pg_am am ON am.oid = oc.opcmethod
WHERE am.amname = 'diskann' ORDER BY oc.opcname;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;

DROP TABLE items;
