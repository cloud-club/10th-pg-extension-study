# Lab 02 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

## IVFFlat 빌드 순서

```sql
CREATE TABLE t (id bigserial PRIMARY KEY, embedding vector(8));
CREATE INDEX t_idx ON t USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);  -- 데이터가 없는 채로
INSERT INTO t (id, embedding)
SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1,5000) v, generate_series(1,8) d GROUP BY v;
```

이렇게 만든 인덱스는 pgvector 공식 문서가 경고하는 "중심이 없는" 상태다. `REINDEX INDEX t_idx;`로 다시 학습시킬 수 있다 - 직접 돌려서 전후 크기·계획이 바뀌는지 비교해 본다.

## 튜닝 손잡이

위에서 만든 `t`(5,000행, `t_idx`)를 그대로 쓴다 - 중심이 부실한 인덱스라도 `probes`가 버퍼에 주는 영향을 보는 데는 문제없다. 더 정확한 비교가 필요하면 `./run.sh sql`로 자동 스크립트를 먼저 돌려 중심이 제대로 학습된 `proper_ivfflat`/`proper_idx`를 만들어두고 그걸 대신 써도 된다.

```sql
LOAD 'vector';
SET ivfflat.probes = 1;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM t ORDER BY embedding <-> (SELECT embedding FROM t WHERE id=1) LIMIT 10;
SET ivfflat.probes = 10;
-- 같은 질의를 다시 돌려 버퍼가 얼마나 늘었는지 비교
```

- 종합 문서: [`../../../../pgvector.md`](../../../../pgvector.md)
- 이전 실습: [`../01-install-and-distance-ops/`](../01-install-and-distance-ops)
