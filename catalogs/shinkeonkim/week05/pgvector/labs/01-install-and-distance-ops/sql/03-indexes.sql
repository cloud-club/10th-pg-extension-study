-- HNSW: 기본값 m=16, ef_construction=64. 점진적 삽입이 가능하고 쿼리 시점에 ef_search로 recall을 조절한다.
CREATE INDEX items_hnsw_idx ON items USING hnsw (embedding vector_l2_ops);

-- IVFFlat: k-means로 lists개 군집을 미리 만든다. 데이터가 거의 다 들어간 뒤에 만드는 것이 좋다
-- (이 lab은 3행뿐이라 실제로는 무의미하지만, 문법과 WITH 옵션을 확인하는 용도다).
CREATE INDEX items_ivfflat_idx ON items USING ivfflat (embedding vector_l2_ops) WITH (lists = 1);

SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'items' ORDER BY indexname;

-- 질의 시점 튜닝 파라미터. 서버가 시작할 때부터 있는 GUC가 아니라, 확장 라이브러리가
-- 로드된 뒤에야 pg_settings에 나타난다 (LOAD로 명시하거나, 확장 함수를 한 번 호출하면 로드된다).
LOAD 'vector';
SELECT name, setting, short_desc FROM pg_settings
WHERE name IN ('hnsw.ef_search', 'hnsw.iterative_scan', 'ivfflat.probes', 'ivfflat.iterative_scan')
ORDER BY name;

-- 3행짜리 테이블은 플래너가 인덱스보다 순차 스캔을 더 싸게 본다 - 인덱스가 "있다"는 것과
-- "쓰인다"는 것은 다른 이야기다. 데이터가 충분히 많아야 Index Scan이 선택된다.
EXPLAIN (COSTS OFF)
SELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;

DROP TABLE items;
