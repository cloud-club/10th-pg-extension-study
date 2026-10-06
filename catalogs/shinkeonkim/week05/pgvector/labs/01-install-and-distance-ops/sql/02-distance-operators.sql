DROP TABLE IF EXISTS items;
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');

-- 네 가지 거리 연산자
SELECT embedding,
       embedding <-> '[1,2,3]' AS l2_distance,          -- vector_l2_ops
       embedding <#> '[1,2,3]' AS neg_inner_product,    -- vector_ip_ops (내적의 음수 - 작을수록 가깝다)
       embedding <=> '[1,2,3]' AS cosine_distance,       -- vector_cosine_ops
       embedding <+> '[1,2,3]' AS l1_distance            -- vector_l1_ops (택시 거리, 0.7.0+)
FROM items ORDER BY l2_distance;

-- halfvec: 16비트 절반 정밀도. 메모리를 절반으로 줄이되 약간의 정밀도를 희생한다.
SELECT '[1,2,3]'::halfvec(3);
SELECT ('[1,2,3]'::vector(3))::halfvec(3) <-> ('[1,2,4]'::vector(3))::halfvec(3);

-- sparsevec: 희소 벡터. {인덱스:값}/차원수 형식.
SELECT '{1:1,3:2}/5'::sparsevec;

-- bit: 이진 벡터. 해밍 거리와 자카드 거리가 있다.
SELECT '101'::bit(3) <~> '100'::bit(3) AS hamming_distance;
SELECT '101'::bit(3) <%> '100'::bit(3) AS jaccard_distance;

-- 거리 연산자별로 어떤 액세스 메소드가 어떤 연산자 클래스를 지원하는지는
-- pg_opclass 로 직접 확인할 수 있다 (hnsw/ivfflat 비교, diskann은 pgvectorscale lab 참고).
SELECT am.amname, oc.opcname
FROM pg_opclass oc JOIN pg_am am ON am.oid = oc.opcmethod
WHERE am.amname IN ('hnsw', 'ivfflat')
ORDER BY am.amname, oc.opcname;
