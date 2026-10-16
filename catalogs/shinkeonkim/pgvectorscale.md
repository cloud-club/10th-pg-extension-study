# pgvectorscale

> pgvector 위에 StreamingDiskANN 인덱스(DiskANN 계열)와 통계적 이진 양자화(SBQ) 압축을 더해, 더 큰 규모의 벡터 검색에서 메모리·지연시간을 줄인다. Timescale(현 TigerData)이 만들었다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 벡터 검색 |
| 버전 | `timescale/timescaledb-ha:pg16` 번들 0.9.1 (Docker로 직접 실행해 확인) |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [GitHub](https://github.com/timescale/pgvectorscale) · [TigerData 문서](https://www.tigerdata.com/docs/reference/pgvectorscale) |
| 정리한 사람 | shinkeonkim |
| 회차 | week05 |

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

pgvector의 HNSW/IVFFlat은 전체 벡터를 `float4` 그대로 들고 있어서, 수천만 행 규모로 가면 인덱스가 메모리에 다 올라가지 않거나 빌드가 느려진다. 필터링이 섞인 검색(예: 특정 라벨을 가진 벡터 중 최근접 이웃)도 ANN 인덱스 바깥에서 후처리해야 한다.

**After**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');

CREATE INDEX items_diskann_idx ON items USING diskann (embedding vector_l2_ops);
-- NOTICE:  Starting index build with num_neighbors=-1, search_list_size=100,
--          max_alpha=1.2, storage_layout=SbqCompression.
-- NOTICE:  Indexed 3 tuples
```

같은 `vector` 타입·같은 거리 연산자 위에서 인덱스 종류만 `diskann`으로 바꾸면 된다. 애플리케이션 쿼리(`ORDER BY embedding <-> :q LIMIT k`)는 그대로다.

## 2. 설치 & 데모

`timescale/timescaledb-ha:pg16` 이미지로 직접 실행해 확인했다(이 확장은 contrib가 아니라 Rust/pgrx로 빌드된 외부 확장이라, 프리빌트 이미지나 Timescale Cloud, 또는 `cargo pgrx`로 직접 빌드해야 한다).

**trusted 여부를 직접 재현했다.** `vectorscale.control`에 `requires = 'vector'`, `superuser = true`가 명시되어 있고 `trusted` 선언이 없다(기본값 false). 비슈퍼유저 role로 별도 DB에서 재현한 결과:

```
ERROR:  permission denied to create extension "vector"
HINT:  Must be superuser to create this extension.
```

`CASCADE`로 `vectorscale`을 먼저 설치하려 해도 내부적으로 `vector`부터 설치를 시도하며 같은 에러로 막힌다 - **pgvector도 pgvectorscale도 기본적으로 슈퍼유저 전용**이다.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector','vectorscale');
--    extname   | extversion
-- -------------+------------
--  vector      | 0.8.6
--  vectorscale | 0.9.1

CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');
CREATE INDEX items_diskann_idx ON items USING diskann (embedding vector_l2_ops);
```

`diskann` 액세스 메소드가 지원하는 연산자 클래스는 `pg_opclass`로 직접 확인했다 - `vector_l2_ops`/`vector_ip_ops`/`vector_cosine_ops` 세 가지이며, pgvector의 `vector_l1_ops`(L1 거리)는 diskann에는 없다. 그 외에 `vector_smallint_label_ops`라는 연산자 클래스가 하나 더 있는데, 이는 **라벨 기반 필터링**(각 벡터에 작은 정수 라벨을 붙여 "이 라벨들 중에서만 최근접 이웃을 찾기"를 인덱스 레벨에서 지원하는 기능)용이다. [week05 lab](week05/pgvectorscale/labs/01-install-and-diskann/)에서 실제로 실행해 확인했다 - 전역 최근접 이웃이 다른 라벨에 몰려 있어도 지정한 라벨만 정확히 반환했다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | pgvector의 HNSW/IVFFlat으로는 메모리·지연시간이 벅찬 대규모(수천만 행대) 벡터 검색, **필터를 통과하는 후보가 질의 근처에 드문 라벨 기반 필터링**(실측: 같은 10행을 HNSW+`iterative_scan`보다 약 9배 싸게 찾았다. 대신 결과가 정답에서 조금 더 멀었다) |
| 이럴 때는 피한다 | 작은 데이터셋(수십만 행 이하 - pgvector HNSW로 충분), 매니지드 DB를 쓰면서 자체 빌드·슈퍼유저 권한을 확보하기 어려운 환경 |
| 비용 | **슈퍼유저 권한 필수**(trusted 아님). Rust/pgrx 기반이라 소스 빌드 시 pgvector보다 빌드 체인이 무겁다(프리빌트 이미지나 Timescale Cloud를 쓰지 않는다면) |
| 대안 | [pgvector](pgvector.md) 단독(HNSW) + `halfvec`, 전용 벡터 DB(Pinecone, Qdrant, Milvus) |

DiskANN 계열 인덱스는 그래프 기반 ANN이라는 점에서 HNSW와 같은 계열이지만, StreamingDiskANN은 인덱스를 디스크 기반으로 설계해 전체 그래프가 메모리에 다 올라가지 않아도 동작하도록 만들어졌다는 것이 설계 의도다. 직접 실측해보니(6절) **빌드 시간이 느린 것은 확실히 재현됐다**(HNSW 대비 최대 17배, IVFFlat 대비 최대 411배). 압축을 끈(`storage_layout=plain`) 빌드가 한 번 서버를 죽인 적이 있었지만, 같은 조건을 9번 재현해도 다시 죽지 않아 **그 크래시가 구조적인 메모리 문제였다는 설명은 철회했다** - 자세한 내용은 6절.

## 4. 매니지드 DB 지원 여부

웹 검색(2026-10 기준)으로 확인했다. **pgvector와 달리 주요 매니지드 서비스에서 거의 지원하지 않는다** - Rust/pgrx 빌드와 슈퍼유저 권한이 필요하다는 점이 관리형 서비스의 확장 허용 정책과 충돌하기 때문으로 보인다(추정, 공식 근거는 못 찾음).

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | × | 확장 목록에 없음 |
| AWS Aurora | × | 확장 목록에 없음 |
| Supabase | × | 커뮤니티 요청(GitHub Discussions)은 있으나 공식 지원 아님. SQL Editor로 수동 설치를 시도할 수는 있으나 미검증 |
| Neon | × | 미지원 확인 |
| GCP Cloud SQL | × | 확장 목록에 없음 |
| Timescale Cloud (TigerData) | ○ | 제작사 자체 매니지드 서비스. 신규 서비스는 기본 포함, 기존 서비스는 유지보수 창에서 활성화 |

이 표는 웹 검색 결과를 바탕으로 한 것이고, 각 서비스 콘솔에서 직접 설치를 시도해 재현하지는 않았다. 매니지드 환경에서 쓰려면 Timescale Cloud를 쓰거나, 직접 EC2/VM에 PostgreSQL을 올려 빌드해야 한다.

---

## 5. (선택) 내부 동작 원리

인덱스 빌드 시 `NOTICE`로 직접 확인한 파라미터는 `num_neighbors`(그래프 노드당 이웃 수, `-1`은 자동 결정), `search_list_size`(빌드 중 탐색 후보 목록 크기), `max_alpha`(그래프 가지치기 파라미터), `storage_layout=SbqCompression`이다. SBQ(Statistical Binary Quantization)는 원본 `float4` 벡터를 이진 표현으로 압축해 저장하면서, 질의 시점에는 압축된 표현으로 1차 거리 계산을 하고 필요할 때만 원본을 다시 읽는 방식으로 메모리·I/O를 줄인다(알고리즘 설계 의도는 공식 문서·논문 기준이며, 이번 문서에서 압축률이나 recall 저하를 직접 측정하지는 않았다).

내부적으로 `vector`(pgvector) 타입과 거리 함수를 그대로 재사용한다(`requires = 'vector'`) - 별도의 벡터 타입을 새로 정의하지 않고, pgvector가 만든 타입·연산자 위에 인덱스 액세스 메소드(`diskann`)만 추가하는 구조다.

## 6. 벤치마크 / 실습 결과

자체 실측(20,000~300,000행, 128차원, Docker 공유 CPU 3개·RAM 3.8GiB)과 제작사 공개 벤치마크를 구분해서 적는다.

**자체 실측**

| 조건 | 결과 |
| --- | --- |
| 행 수 20,000→300,000, DiskANN 빌드 시간 | 14.8초→583.2초(9.7분) - 같은 구간 HNSW 대비 11~17배, IVFFlat 대비 110~411배 느리고 격차가 행 수와 함께 벌어졌다 |
| 같은 구간, 인덱스 크기(테이블 대비) | **0.79~0.80배로 일정** - HNSW(1.37배)·IVFFlat(0.91배)보다 항상 작다 |
| `storage_layout=plain`(SBQ 압축 끄기), 51,000행 | 한 번 서버 프로세스가 죽었다(FATAL) - 그러나 **같은 조건을 9번 재현해도 다시 죽지 않았다**(완주, 피크 메모리도 402MB로 여유 있었다). "메모리 부족으로 구조적으로 실패한다"는 당초 해석은 철회하고 단발성 사건으로 본다 |
| 51,000행, `query_search_list_size` 10→200 | recall@10이 **10에서 이미 1.000**(2회 반복 일치) - 이 규모·데이터에서는 가장 저렴한 설정부터 포화했다. 같은 조건 HNSW `ef_search=10`은 0.63~0.65에 그쳤다 |
| 같은 비교를 300,000행에서 재현 | DiskANN은 가장 싼 설정에서도 **여전히 1.000** - HNSW `ef_search=10`은 **0.216**까지 떨어져 격차가 51,000행 때(0.37)보다 두 배 넘게(0.784) 벌어졌다. "작은 규모의 착시"가 아니라 규모가 커질수록 더 뚜렷해지는 패턴이다 |
| 라벨 필터링(`vector_smallint_label_ops`), 50,000행·10개 라벨 | 질의 근처가 아닌 군집의 라벨로 거를 때: HNSW 기본값은 **0행**, HNSW+`iterative_scan=relaxed_order`는 10행을 질의당 27,753 버퍼·11.9ms에, DiskANN 라벨 인덱스는 10행을 **5,652 버퍼·1.3ms**에 찾았다. 결과의 평균 거리는 HNSW 13.78, DiskANN 13.88(정답 13.72) - 싸지만 조금 덜 가깝다. (첫 판의 "HNSW는 어떤 설정으로도 0행"은 서로 다른 벡터가 10개뿐인 데이터 탓이었다 - 실험 07 정정 참고) |
| vs `halfvec`(pgvector 단독) 크기 비교, 50,000행 | SBQ 23.5MB < halfvec 27.8MB < float4 40.5MB - **halfvec 하나만으로도 압축 격차의 약 2/3을 커버**한다. 대신 질의 비용(버퍼·지연시간)은 DiskANN이 halfvec보다 2.4~2.6배 더 들었다 |

**제작사(Timescale) 공개 벤치마크 - 재현하지 않음, 출처를 명시해 인용**

5천만 행·768차원(Cohere 임베딩), AWS r6id.4xlarge에서 Qdrant와 비교([TigerData 블로그](https://www.tigerdata.com/blog/pgvector-vs-qdrant)): 99% recall 기준 p50 지연시간은 Qdrant와 비슷(31ms 대), p95·p99는 Qdrant가 39~48% 빠름, 처리량(QPS)은 pgvectorscale이 11.4배 높음(병렬 쿼리), **인덱스 빌드는 Qdrant가 3배 빠름**(약 3.3시간 vs 11.1시간) - "현재 단일 스레드 구현"이라고 자사가 인정했다. 단일 노드만 비교했고 Qdrant의 수평 확장성은 평가 범위 밖이다.

원본·재현 조건: [실험 01](week05/experiments/01-recall-vs-tuning/), [실험 02](week05/experiments/02-build-cost-and-size/), [실험 03](week05/experiments/03-sbq-compression/), [실험 04 · plain 빌드 재현성](week05/experiments/04-plain-build-memory-threshold/), [실험 05 · halfvec 비교](week05/experiments/05-halfvec-vs-sbq/), [실험 06](week05/experiments/06-recall-at-scale/), [실험 07](week05/experiments/07-filtered-search-cost/), [pgvectorscale lab 01](week05/pgvectorscale/labs/01-install-and-diskann/).

---

## 참고 링크

- [pgvectorscale GitHub](https://github.com/timescale/pgvectorscale)
- [TigerData(Timescale) pgvectorscale 문서](https://www.tigerdata.com/docs/reference/pgvectorscale)
- [TigerData 블로그 - pgvector vs Qdrant 벤치마크](https://www.tigerdata.com/blog/pgvector-vs-qdrant)(벤더 자체 벤치마크, 6절에 한계와 함께 인용)
- [pgvector 비교 자료](pgvector.md) - 이 확장이 의존하는 기반 확장
- [week05 개요 - 왜 필요한가, 장단점, 실무 기준](week05/README.md)
- [week05 실험](week05/experiments/) · [Docker 실습](week05/pgvectorscale/labs/01-install-and-diskann/)
