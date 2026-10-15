# pgvector

> 벡터 타입과 거리 연산자, 근사 최근접 이웃(ANN) 인덱스(HNSW·IVFFlat)를 PostgreSQL에 추가해 임베딩을 테이블 안에서 바로 검색하게 한다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 벡터 검색 |
| 버전 | `pgvector/pgvector:pg16` 공식 이미지 0.8.7 / `timescale/timescaledb-ha:pg16` 번들 0.8.6 (둘 다 Docker로 직접 실행해 확인) |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [GitHub](https://github.com/pgvector/pgvector) · [README(공식 문서 겸용)](https://github.com/pgvector/pgvector#readme) |
| 정리한 사람 | shinkeonkim |
| 회차 | week05 |

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

벡터 타입이 없으면 임베딩을 `float4[]`나 `bytea`로 욱여넣고, 거리 계산은 애플리케이션 코드나 PL/pgSQL 함수로 직접 짜야 한다. 가장 가까운 벡터를 찾으려면 전체 행을 읽어 계산하는 것 외에는 가속할 방법이 없다.

```sql
-- 배열로 흉내만 낸 상태 - 인덱스로 가속할 수 없다
CREATE TABLE items_before (id bigserial PRIMARY KEY, embedding float4[]);
-- 거리 계산을 직접 짜야 하고, ORDER BY는 매번 전체 스캔이다
```

**After**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');

SELECT embedding, embedding <-> '[1,2,3]' AS l2 FROM items ORDER BY l2;
--  embedding |        l2
-- -----------+-------------------
--  [1,2,3]   |                 0
--  [1,2,4]   |                 1
--  [4,5,6]   | 5.196152422706632
```

타입·거리 연산자·인덱스가 코어 수준 확장으로 들어와서 `ORDER BY embedding <-> :query LIMIT k` 를 그대로 쓸 수 있고, HNSW/IVFFlat 인덱스로 가속할 수 있다.

## 2. 설치 & 데모

`pgvector/pgvector:pg16` 공식 Docker 이미지로 직접 실행해 확인했다. contrib 확장이 아니라 별도 설치가 필요하고, `shared_preload_libraries`는 필요 없다. control 파일(`vector.control`)에 `trusted` 선언이 없어 **기본값은 trusted가 아니다** — `superuser`도 선언이 없어 기본값 true가 적용되므로, 일반 사용자는 `CREATE EXTENSION vector;`를 실행할 수 없다(직접 비슈퍼유저 role로 재현: `ERROR: permission denied to create extension "vector"`).

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');
```

```sql
-- 세 가지 거리 연산자 (실제 실행 결과)
SELECT embedding,
       embedding <-> '[1,2,3]' AS l2_distance,
       embedding <#> '[1,2,3]' AS neg_inner_product,
       embedding <=> '[1,2,3]' AS cosine_distance
FROM items ORDER BY l2_distance;
--  embedding |        l2         | neg_inner_product |     cosine_dist
-- -----------+-------------------+--------------------+----------------------
--  [1,2,3]   |                 0 |               -14 |                    0
--  [1,2,4]   |                 1 |               -17 |  0.00853986601633272
--  [4,5,6]   | 5.196152422706632 |               -32 | 0.025368153802923787

-- L1(택시) 거리는 <+> (0.7.0부터)
SELECT '[1,2,3]'::vector <+> '[4,5,6]'::vector; -- 9

CREATE INDEX items_hnsw_idx ON items USING hnsw (embedding vector_l2_ops);

EXPLAIN (COSTS OFF)
SELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;
--  Limit
--    ->  Sort
--          Sort Key: ((embedding <-> '[1,2,3]'::vector))
--          ->  Seq Scan on items
```

3행짜리 데모는 플래너가 인덱스보다 순차 스캔을 더 싸게 보므로 실제로는 Seq Scan이 나온다. 인덱스가 선택되는지는 행 수와 `SET enable_seqscan`으로 직접 확인해야 한다.

타입은 `vector` 외에 `halfvec`(16비트 절반 정밀도), `sparsevec`(희소 벡터), `bit`(이진 벡터)가 있고, 연산자 클래스도 타입별로 나뉜다(`vector_l2_ops`/`_ip_ops`/`_cosine_ops`/`_l1_ops`, `bit_hamming_ops`/`_jaccard_ops` 등 - `pg_opclass`로 직접 조회해 확인).

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 임베딩을 이미 PostgreSQL에 저장 중이거나, 메타데이터와 벡터를 같은 트랜잭션·같은 JOIN으로 다뤄야 할 때. 수십만~수백만 행 규모의 근사 검색 |
| 이럴 때는 피한다 | 수천만 행 이상에서 지연시간·재현율을 엄격히 맞춰야 할 때(→ [pgvectorscale](pgvectorscale.md)나 전용 벡터 DB 검토), 정확한(exact) 최근접 이웃이 반드시 필요할 때(ANN은 근사치) |
| 비용 | HNSW는 빌드 시간·메모리가 IVFFlat보다 크다. 흔히 "HNSW가 같은 비용에서 재현율이 높다"고 하지만 [실험 01](week05/experiments/01-recall-vs-tuning/)의 합성 데이터(51,000행)에서는 IVFFlat `probes=10`이 recall 0.95를 질의당 버퍼 730·1.37ms에, HNSW `ef_search=200`이 0.94를 버퍼 5,059·1.21ms에 냈다 - 재현되지 않았다(버퍼는 두 구조 사이에서 완전히 같은 잣대가 아니고, 질의 주변에 근접점을 몰아 넣은 데이터라 IVFFlat에 유리했을 수 있다). IVFFlat은 `lists` 중심을 데이터 삽입 뒤에 학습해야 하고 분포가 바뀌면 재빌드가 필요하다 - HNSW를 기본으로 권하는 실제 이유는 이 운영 차이다. 인덱스는 기본적으로 **슈퍼유저 권한**이 있어야 설치 가능 |
| 대안 | 벡터 전용 DB(Pinecone, Qdrant, Milvus 등), [pgvectorscale](pgvectorscale.md)(DiskANN, 대규모), 애플리케이션 레벨 근사 검색 라이브러리(FAISS 등)와의 하이브리드 |

HNSW와 IVFFlat 모두 **근사** 인덱스다. `ORDER BY ... LIMIT k`가 정확한 top-k를 보장하지 않으며, 재현율은 `ef_search`/`probes` 같은 런타임 파라미터로 조절한다 - 직접 스윕한 결과는 6절과 [실험 01](week05/experiments/01-recall-vs-tuning/)에 있다.

필터(`WHERE` 조건)가 섞인 검색은 주의가 필요하다. AWS의 프로덕션 가이드(공식 블로그)에 따르면 `hnsw.iterative_scan`(0.8.0+)이 꺼져 있으면(기본값) 필터를 통과하는 후보가 부족할 때 결과가 k개보다 적게 나올 수 있고, `relaxed_order`로 켜는 것을 프로덕션 기본값으로 권장한다. [week05 실험 07](week05/experiments/07-filtered-search-cost/)에서 이 경고와 처방을 둘 다 재현했다 - 질의 근처 군집이 아닌 다른 군집의 라벨로 거르면 기본값(`off`)에서는 **0행**, `relaxed_order`로 켜면 10행을 채운다. 대신 그래프를 넓게 훑느라 비싸진다(질의당 약 27,800 버퍼·11.9ms, 같은 일을 DiskANN 라벨 인덱스는 5,650 버퍼·1.3ms).

> 이 문단의 첫 판은 "`iterative_scan`을 어떻게 켜도 0행이 나온다"고 적었다. 그 실험 데이터가 **5만 행 중 서로 다른 벡터 10개**였던 탓이다(생성 SQL 의 InitPlan 버그) - 바로잡은 경위는 실험 07 맨 위에 있다. 덤으로 확인한 것: 완전히 같은 벡터가 군집마다 수천 개씩 있으면 HNSW 그래프가 끊어져, 필터 없이도 인덱스 스캔이 5만 행 중 약 480행에만 닿았다.

필터링과는 별개로, IVFFlat은 빈 테이블에 먼저 인덱스를 만들면 k-means 중심이 학습되지 않는다(만들 때 `NOTICE: ivfflat index created with little data / DETAIL: This will cause low recall.`). 인덱스 **크기로는 드러나지 않는다**([pgvector lab 02](week05/pgvector/labs/02-hnsw-vs-ivfflat/)에서 두 경우 크기가 같았다). recall 은 5,000행·8차원·`lists=10`·`probes=1`에서 질의 100개 기준 0.655 vs 0.712로 **방향은 경고대로 낮았지만 차이는 작았다** - 더 큰 데이터에서 얼마나 벌어지는지는 재지 않았다.

## 4. 매니지드 DB 지원 여부

웹 검색(2026-10 기준)으로 확인했고, 각 서비스 콘솔에서 직접 설치해보지는 않았다.

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | PostgreSQL 15.2+에서 지원, 최신 버전 0.8.2대 제공(릴리스 노트 기준) |
| AWS Aurora | ○ | PostgreSQL 16.1/15.4/14.9/13.12+ 이상에서 0.5.0+(HNSW 포함) 지원 |
| Supabase | ○ | 모든 플랜에 기본 포함, HNSW 인덱스까지 기본 제공 |
| Neon | ○ | 모든 플랜에서 추가 비용 없이 지원 |
| GCP Cloud SQL | ○ | 확장 허용 목록에 포함 |

`shared_preload_libraries`가 필요 없는 확장이라 매니지드 서비스에서 막히는 경우는 드물다. 정확한 지원 버전은 사용 중인 서비스·엔진 버전에서 직접 `SELECT * FROM pg_available_extension_versions WHERE name='vector';`로 재확인해야 한다.

---

## 5. (선택) 내부 동작 원리

`vector`는 고정 차원의 `float4` 배열을 varlena로 저장하는 타입이고, 거리 연산자(`<->`/`<#>`/`<=>`/`<+>`)는 C로 구현된 함수다. HNSW는 레이어드 그래프를 메모리에 구성해 가까운 지점을 따라가며 탐색하는 방식으로, 삽입마다 그래프가 갱신되어 IVFFlat과 달리 사전 학습(`CREATE INDEX` 전 데이터 축적) 없이도 점증적으로 품질이 나온다. IVFFlat은 k-means로 `lists`개 군집을 미리 만들고 질의 벡터와 가까운 `probes`개 군집만 훑는다. 두 방식 모두 거리 함수가 연산자 클래스로 등록되어 있어, 인덱스 AM이 타입 내부를 몰라도 동작한다(GiST/GIN과 같은 확장점 구조).

## 6. 벤치마크 / 실습 결과

week05 실험 결과 요약이다. 행 수 50,000~51,000(128차원, 배경 균등분포 + 질의당 근접점 20개 주입)이 기본이고, 규모를 바꾼 조건은 행마다 표시했다.

| 조건 | 결과 |
| --- | --- |
| HNSW `ef_search` 10→200 | recall@10 0.63→0.93, 버퍼/질의 495→5,060(약 10배) |
| IVFFlat `probes` 1→50(전체) | recall@10 0.54→1.00, 버퍼/질의 81→3,438(약 42배) |
| 행 수 20,000→300,000에서 HNSW 빌드 시간 | 1.3초→33.5초, 인덱스는 테이블 대비 항상 약 1.37배 |
| 행 수 20,000→300,000에서 IVFFlat 빌드 시간 | 0.13초→1.4초, 인덱스는 테이블 대비 항상 약 0.91배 |
| `halfvec`(16비트 절반 정밀도) HNSW vs 원본 `vector` HNSW, 50,000행 | 인덱스 31% 작음(27.8MB vs 40.5MB), 빌드는 오히려 84% 더 느림(6.6초 vs 3.6초) - recall 비교는 HNSW 빌드 비결정성에 가려져 결론 내지 못함 |
| HNSW `ef_search=10`(가장 싼 설정), 51,000행 vs 300,000행 | recall@10 0.63 → **0.22**로 떨어짐 - 가장 싼 설정의 품질은 규모에 크게 민감하다(IVFFlat `probes=1`도 0.54→0.29) |

원본·재현 조건: [실험 01 · recall vs 튜닝](week05/experiments/01-recall-vs-tuning/), [실험 02 · 빌드 비용·크기](week05/experiments/02-build-cost-and-size/), [실험 05 · halfvec vs SBQ](week05/experiments/05-halfvec-vs-sbq/), [실험 06 · 300,000행에서 recall](week05/experiments/06-recall-at-scale/), [실험 07 · 라벨 필터링](week05/experiments/07-filtered-search-cost/). 환경은 Docker(공유 CPU 3개, RAM 3.8GiB)로 제한적이다 - 절대 시간보다 상대적 경향으로 읽는다. DiskANN(pgvectorscale)과의 비교는 [pgvectorscale.md](pgvectorscale.md)와 [week05 개요](week05/README.md)에서 다룬다.

---

## 참고 링크

- [pgvector GitHub README](https://github.com/pgvector/pgvector)
- [pgvectorscale 비교 자료](pgvectorscale.md) - 같은 벡터 타입 위에서 DiskANN으로 확장한 버전
- [AWS Aurora PostgreSQL 벡터 DB 가이드](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.VectorDB.html)
- [AWS 공식 블로그 - Running pgvector in production on Amazon Aurora PostgreSQL](https://aws.amazon.com/blogs/database/running-pgvector-in-production-on-amazon-aurora-postgresql/)
- [week05 개요 - 왜 필요한가, 장단점, 실무 기준](week05/README.md)
- [week05 실험](week05/experiments/) · [Docker 실습 2개](week05/pgvector/labs/)
