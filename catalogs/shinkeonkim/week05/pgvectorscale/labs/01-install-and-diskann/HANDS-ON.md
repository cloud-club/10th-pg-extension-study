# Lab 01 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 비슈퍼유저는 설치할 수 없다

```sql
CREATE ROLE demo_nosuper LOGIN NOSUPERUSER;
GRANT CREATE ON DATABASE study TO demo_nosuper;
\c study demo_nosuper
CREATE EXTENSION vector;
```

`ERROR: permission denied to create extension "vector" / HINT: Must be superuser to create this extension.`이 나와야 한다. `vectorscale CASCADE`도 내부적으로 `vector`부터 설치를 시도하므로 같은 에러로 막힌다.

```sql
\c study postgres
DROP ROLE demo_nosuper;
```

---

## 2. SBQ 압축을 꺼보기

```sql
CREATE TABLE big (id bigserial PRIMARY KEY, embedding vector(128));
INSERT INTO big (id, embedding)
SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1,50000) v, generate_series(1,128) d GROUP BY v;

LOAD 'vectorscale-0.9.1';
CREATE INDEX big_diskann_mo ON big USING diskann (embedding vector_l2_ops);  -- 기본값(memory_optimized), 약 50초
CREATE INDEX big_diskann_plain ON big USING diskann (embedding vector_l2_ops) WITH (storage_layout = plain);  -- 압축 끔, 약 50초
```

실험 03에서는 이 `plain` 빌드 중에 서버 프로세스가 한 번 죽었다(FATAL). 하지만 [실험 04](../../../experiments/04-plain-build-memory-threshold/)가 같은 조건을 9번 재현해도 다시 죽지 않았고 피크 메모리도 400MB 안쪽이었다 - 직접 돌려보면 (9번 중 9번이 그랬듯) 정상 완료될 가능성이 높다. 혹시 여기서도 죽는다면, 그 자체로 흥미로운 추가 데이터 포인트이니 당시 `docker stats`·호스트 상태를 기록해 둔다.

---

- 종합 문서: [`../../../../pgvectorscale.md`](../../../../pgvectorscale.md)
- 실험: [실험 02 · 빌드 비용·크기](../../../experiments/02-build-cost-and-size/), [실험 03 · SBQ 압축](../../../experiments/03-sbq-compression/), [실험 04 · 재현성](../../../experiments/04-plain-build-memory-threshold/)
