-- pgvectorscale 의 라벨 필터링: 라벨(smallint[])을 인덱스 두 번째 컬럼으로 넣어서, "이 라벨들 중에서만
-- 최근접 이웃 찾기"를 인덱스 탐색 단계에서 바로 한다. pgvector 의 HNSW/IVFFlat 은 이런 2차 컬럼을
-- 받지 않는다 - 질의 단계에서 WHERE 로 거르고, 후보가 부족하면 `hnsw.iterative_scan` 으로 더 넓게
-- 찾는다(AWS 프로덕션 가이드의 권장). 두 방법의 정확도·비용 비교는 실험 07 에 있다.
DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id bigserial PRIMARY KEY, embedding vector(8), labels smallint[]);

-- 라벨 1~5, 라벨마다 "주제 중심"(8차원 중 한 축만 10.0) 주변에 400개씩.
-- 주의: (SELECT ... random() ... FROM generate_series(1,8) g) 를 행마다 쓰면 서브쿼리가 바깥 행을
-- 참조하지 않아 InitPlan 으로 한 번만 평가된다 - 400행이 전부 같은 벡터가 된다(실험 07 첫 판의 실수).
-- 그래서 (행 × 차원) cross join + GROUP BY 로 random() 이 칸마다 다시 평가되게 만든다.
SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.1);
INSERT INTO docs (embedding, labels)
SELECT array_agg((CASE WHEN d = l THEN 10.0 ELSE 0.0 END + (random() - 0.5) * 0.4)::float4 ORDER BY d)::vector,
       ARRAY[l]::smallint[]
FROM generate_series(1, 5) l, generate_series(1, 400) i, generate_series(1, 8) d
GROUP BY l, i
ORDER BY l, i;

-- 생성 검증: 2000행이 전부 서로 다른 벡터여야 한다.
SELECT count(*) AS rows, count(DISTINCT embedding) AS distinct_vectors FROM docs;

-- 두 번째 인덱스 컬럼으로 labels 를 넣는다 - opclass 는 자동으로 vector_smallint_label_ops 가 잡힌다.
LOAD 'vectorscale-0.9.1';
CREATE INDEX docs_diskann_idx ON docs USING diskann (embedding vector_l2_ops, labels);

-- 질의 벡터는 "주제 1"에 가깝지만, 라벨 5 로만 걸러서 찾는다.
-- 전역 최근접 이웃은 전부 라벨 1 일 텐데, 결과가 전부 라벨 5 인지 확인한다.
SELECT id, labels FROM docs
WHERE labels && ARRAY[5]::smallint[]
ORDER BY embedding <-> '[10,0,0,0,0,0,0,0]'
LIMIT 10;

-- 플랜: 라벨 조건이 Filter 가 아니라 Index Cond 로 들어간다 - 인덱스가 직접 거른다는 뜻이다.
EXPLAIN (COSTS OFF)
SELECT id FROM docs
WHERE labels && ARRAY[5]::smallint[]
ORDER BY embedding <-> '[10,0,0,0,0,0,0,0]'
LIMIT 10;

-- 라벨을 두 개 걸면 "OR" 로 동작한다(배열 겹침 연산자 &&).
-- 라벨 3·5 의 중심은 질의에서 같은 거리라, 어느 쪽 점이 더 가까운지는 노이즈가 정한다.
SELECT labels, count(*) FROM (
  SELECT labels FROM docs
  WHERE labels && ARRAY[3, 5]::smallint[]
  ORDER BY embedding <-> '[10,0,0,0,0,0,0,0]'
  LIMIT 10
) s GROUP BY labels ORDER BY labels;
