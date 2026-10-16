# Lab 01 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 설치와 trusted 여부

```sql
SELECT name, version, superuser, trusted, relocatable, requires
FROM pg_available_extension_versions WHERE name = 'vector';
CREATE EXTENSION vector;
```

`trusted`가 `f`인 것을 확인한다. hstore(`t`)·pg_trgm(`t`)과 달리 pgvector는 일반 사용자가 설치할 수 없다.

---

## 2. 타입과 차원 불일치

```sql
SELECT '[1,2,3]'::vector(3);
SELECT '[1,2,3]'::vector(4);   -- 에러: 조용히 자르거나 채우지 않는다
```

두 번째 문장은 의도적으로 에러를 낸다. `./run.sh sql`(자동 실행)에는 넣지 않은 이유이기도 하다 - `ON_ERROR_STOP=1`이라 스크립트 전체가 멈춘다.

---

## 3. 거리 연산자

```sql
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');

SELECT embedding, embedding <-> '[1,2,3]' AS l2 FROM items ORDER BY l2;
SELECT embedding <#> '[1,2,3]' FROM items WHERE id = 1;  -- 음의 내적 - 정규화된 벡터면 <->보다 저렴
```

`<#>`가 "음의" 내적인 이유를 생각해 본다 - `ORDER BY`는 항상 오름차순이 "가깝다"를 뜻해야 하는데, 내적은 클수록 가깝다.

---

## 4. HNSW 질의 튜닝

```sql
CREATE INDEX items_hnsw_idx ON items USING hnsw (embedding vector_l2_ops);
LOAD 'vector';
SET hnsw.ef_search = 10;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;
SET hnsw.ef_search = 200;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;
```

3행짜리 테이블이라 둘 다 Seq Scan일 것이다 - 인덱스 효과를 보려면 [실험 01](../../../experiments/01-recall-vs-tuning/)처럼 수만 행 이상이 필요하다. 여기서는 `hnsw.ef_search`를 바꿔도 에러 없이 받아들여지는지만 확인한다.

---

- 종합 문서: [`../../../../pgvector.md`](../../../../pgvector.md)
- 다음 실습: [`../02-hnsw-vs-ivfflat/`](../02-hnsw-vs-ivfflat)
