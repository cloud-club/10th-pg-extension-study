# Lab 02 직접 해보기 - GIN vs GiST

```bash
./run.sh up
./run.sh psql
```

먼저 `./run.sh sql` 로 데이터(5만 행)를 만들어 두면 아래를 바로 이어서 칠 수 있다.

## STEP 1 - GIN

```sql
CREATE INDEX docs_gin ON docs USING gin (body gin_trgm_ops);
SELECT pg_size_pretty(pg_relation_size('docs_gin'));

SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
```

**볼 곳은 두 줄이다.**

```
->  Bitmap Index Scan on docs_gin (actual rows=1 loops=1)     <- 후보를 1행까지 좁혔다
      Buffers: shared hit=3                                    <- 3페이지만 읽었다
```

시간이 아니라 이 두 값을 보는 이유: 같은 데이터·같은 쿼리면 실행마다 거의 변하지 않기 때문이다.

## STEP 2 - GIN 은 KNN 을 못 한다

```sql
EXPLAIN (COSTS OFF)
SELECT body FROM docs ORDER BY body <-> '희귀한 제브라' LIMIT 3;
```

`Index Scan` 이 아니라 `Sort` 가 나온다 - GIN 에는 `<->` 를 위한 정렬 지원 함수가 없다.

```sql
DROP INDEX docs_gin;
```

## STEP 3 - GiST (기본 siglen 12 = 96비트)

```sql
CREATE INDEX docs_gist ON docs USING gist (body gist_trgm_ops);
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
```

같은 1행을 찾는데 `Buffers: shared hit=1254`. GIN 의 3 과 비교하라 - **400배**다.

GiST 는 트라이그램을 96비트 비트맵에 해싱해 OR 로 합친 "시그니처"를 저장한다(블룸 필터형 손실 압축). 비트가 다 차면 `ALLISTRUE` 로 접혀 필터 역할을 잃는다.

## STEP 4 - GiST 만 할 수 있는 것

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT body FROM docs ORDER BY body <-> '희귀한 제브라' LIMIT 3;
```

`Index Scan using docs_gist ... Order By: (body <-> ...)` - 인덱스가 정렬을 수행한다.

## STEP 5 - siglen 을 키우면 (PostgreSQL 13+)

```sql
DROP INDEX docs_gist;
CREATE INDEX docs_gist64 ON docs USING gist (body gist_trgm_ops(siglen=64));
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
```

**버퍼가 1,254 → 3 으로 떨어진다.** 인덱스 크기는 그대로(11 MB)인데 버퍼만 400배 줄었다 - "GiST 가 느리다"가 아니라 **"기본 96비트가 이 데이터에서 이미 포화돼 있었다"** 가 정확한 진단이다.

> **다만 이 lab 의 데이터는 문장 8개를 반복한 것이라 어휘가 매우 좁다.** 실제 말뭉치에서는 `siglen=64` 로 한참 부족했다(GIN 13 vs GiST 3,003~3,012, 약 231배). **"64면 충분"은 이 데이터에서만 참이다** — [`../../experiments/01-gin-vs-gist-build-and-probe/`](../../experiments/01-gin-vs-gist-build-and-probe).

---

## 정리

| | GIN | GiST |
|---|---|---|
| 구조 | 역색인 | 시그니처 비트맵 (손실 압축) |
| `LIKE`/정규식 | 훨씬 빠르다 | 느리다 (단, siglen 튜닝 여지 있음) |
| `ORDER BY <->` | **불가능** | **가능 - 유일한 이유** |
| 튜닝 손잡이 | `FASTUPDATE` | `siglen` (PG13+) |
| pg_bigm | 있다 | **없다** |

## 다음 단계

- 다음 lab: [`../03-similarity-and-knn/`](../03-similarity-and-knn)
