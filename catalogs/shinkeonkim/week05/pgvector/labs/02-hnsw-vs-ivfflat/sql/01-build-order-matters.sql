CREATE EXTENSION IF NOT EXISTS vector;

-- IVFFlat은 k-means로 군집 중심을 "빌드 시점에 있는 데이터"로부터 학습한다.
-- 빈 테이블에 인덱스를 만들고 나중에 데이터를 채우면, 중심이 실제 분포를 반영하지 못한다.
DROP TABLE IF EXISTS early_ivfflat;
CREATE TABLE early_ivfflat (id bigserial PRIMARY KEY, embedding vector(8));
-- 테이블이 비어 있는 상태에서 인덱스부터 만든다 (실무에서 흔한 실수 패턴)
CREATE INDEX early_idx ON early_ivfflat USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);

SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.42);
INSERT INTO early_ivfflat (id, embedding)
SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1, 5000) v, generate_series(1, 8) d GROUP BY v;

-- pgvector 문서가 직접 경고하는 부분이다: "빈 테이블에 만든 IVFFlat 인덱스는 중심이 없어서
-- 사실상 동작하지 않는다". 아래에서 VACUUM/ANALYZE 없이 바로 질의하면 계획이 어떻게 나오는지 본다.
EXPLAIN (COSTS OFF) SELECT id FROM early_ivfflat ORDER BY embedding <-> (SELECT embedding FROM early_ivfflat LIMIT 1) LIMIT 5;

-- HNSW는 그래프 구조라 "빌드 시점에 데이터가 있어야 한다"는 제약이 없다 - 점진적으로 쌓아도 된다.
DROP TABLE IF EXISTS early_hnsw;
CREATE TABLE early_hnsw (id bigserial PRIMARY KEY, embedding vector(8));
CREATE INDEX early_hnsw_idx ON early_hnsw USING hnsw (embedding vector_l2_ops);

SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.42);
INSERT INTO early_hnsw (id, embedding)
SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1, 5000) v, generate_series(1, 8) d GROUP BY v;

EXPLAIN (COSTS OFF) SELECT id FROM early_hnsw ORDER BY embedding <-> (SELECT embedding FROM early_hnsw LIMIT 1) LIMIT 5;

-- 올바른 순서: IVFFlat은 데이터를 먼저 채우고 나서 인덱스를 만든다.
DROP TABLE IF EXISTS proper_ivfflat;
CREATE TABLE proper_ivfflat (id bigserial PRIMARY KEY, embedding vector(8));
SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.42);
INSERT INTO proper_ivfflat (id, embedding)
SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1, 5000) v, generate_series(1, 8) d GROUP BY v;
CREATE INDEX proper_idx ON proper_ivfflat USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);

-- 주의: 인덱스 크기는 lists 개수로 정해지므로 중심이 부실해도 "크기"는 똑같다 - 아래 두 값이
-- 똑같이 나온다. 그래서 이 lab은 "크기로는 안 드러난다"는 것 자체를 보여준다.
-- recall 은 ground truth 대조가 필요하다: 같은 조건(5,000행·8차원·lists=10·probes=1), 질의 100개에서
-- 0.655(빈 테이블에 먼저) vs 0.712(데이터 먼저) - 방향은 공식 경고대로지만 차이는 작았다
-- (web/scripts/capture-pgvector-demo.py 의 ivf_recall).
SELECT 'early_ivfflat(빈 테이블에 먼저 인덱스)' AS case, pg_relation_size('early_idx') AS index_bytes
UNION ALL
SELECT 'proper_ivfflat(데이터 먼저, 인덱스 나중)', pg_relation_size('proper_idx');
