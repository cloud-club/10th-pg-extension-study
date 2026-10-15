-- 01에서 만든 proper_ivfflat/early_hnsw를 재사용해 질의 시점 파라미터를 직접 바꿔본다.
-- 엄밀한 recall 측정(ground truth 대조)은 실험 01에서 한다 - 여기서는 EXPLAIN 버퍼가
-- 파라미터에 따라 바뀌는 것만 눈으로 확인한다.
LOAD 'vector';

\echo '--- IVFFlat probes=1 (기본값) ---'
SET ivfflat.probes = 1;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM proper_ivfflat ORDER BY embedding <-> (SELECT embedding FROM proper_ivfflat WHERE id = 1) LIMIT 10;

\echo '--- IVFFlat probes=10 (전체 lists) ---'
SET ivfflat.probes = 10;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM proper_ivfflat ORDER BY embedding <-> (SELECT embedding FROM proper_ivfflat WHERE id = 1) LIMIT 10;

\echo '--- HNSW ef_search=10 (기본값 미만) ---'
SET hnsw.ef_search = 10;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM early_hnsw ORDER BY embedding <-> (SELECT embedding FROM early_hnsw WHERE id = 1) LIMIT 10;

\echo '--- HNSW ef_search=200 ---'
SET hnsw.ef_search = 200;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM early_hnsw ORDER BY embedding <-> (SELECT embedding FROM early_hnsw WHERE id = 1) LIMIT 10;

RESET ivfflat.probes;
RESET hnsw.ef_search;
