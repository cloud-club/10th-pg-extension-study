# Week 05 · pgvector · pgvectorscale — 개요

벡터 검색을 PostgreSQL 안에서 할 것인가, 왜 할 것인가, 어디까지 할 수 있는가를 정리한다. 카탈로그 요약 문서는 [`../pgvector.md`](../pgvector.md)·[`../pgvectorscale.md`](../pgvectorscale.md)에 있고, 이 문서는 그 위의 큰 그림과 실측 근거를 모은다.

## 1. 왜 필요한가 — Before/After

임베딩(텍스트·이미지를 고정 차원 실수 벡터로 바꾼 것)을 "의미가 비슷한 것 찾기"에 쓰려면 **벡터 간 거리**를 빠르게 계산해야 한다. pgvector 이전에는:

- 임베딩을 `float4[]`나 `bytea`에 욱여넣고, 거리 계산을 애플리케이션 코드나 PL/pgSQL로 직접 짜야 했다.
- 가장 가까운 벡터를 찾으려면 **인덱스로 가속할 방법이 없어 매번 전체 행을 읽어야** 했다(정확하지만 행 수에 비례해 느려진다 - "브루트포스").
- 결국 많은 팀이 PostgreSQL과는 별도로 전용 벡터 DB(Pinecone, Qdrant, Milvus 등)를 또 하나 운영하게 됐다 - 메타데이터는 Postgres에, 벡터는 다른 곳에 두고 애플리케이션에서 둘을 이어 붙여야 한다.

pgvector는 `vector` 타입과 거리 연산자(`<->` `<#>` `<=>` `<+>`)를 코어 수준 확장으로 추가하고, **근사 최근접 이웃(ANN) 인덱스**(HNSW·IVFFlat)로 "정확하지만 느린" 브루트포스를 "거의 정확하고 훨씬 빠른" 검색으로 바꾼다. 메타데이터(권한, 테넌트, 필터 조건)와 벡터가 **같은 테이블, 같은 트랜잭션, 같은 JOIN** 안에 있을 수 있다는 것이 가장 큰 차이다.

## 2. pgvector vs pgvectorscale — 무엇이 다른가

pgvectorscale은 pgvector를 **대체하지 않는다.** `vector` 타입과 거리 연산자를 그대로 재사용하면서(`vectorscale.control`의 `requires = 'vector'`, 직접 확인) **DiskANN 계열의 새 인덱스 액세스 메소드(`diskann`)** 하나만 추가한다.

| | pgvector (HNSW/IVFFlat) | pgvectorscale (DiskANN) |
| --- | --- | --- |
| 만든 곳 | pgvector 프로젝트 | Timescale(현 TigerData) |
| 추가하는 것 | 타입 + 거리 연산자 + 인덱스 2종 | 인덱스 1종(`diskann`)만 추가, 타입은 pgvector 것을 그대로 씀 |
| 설치 | 슈퍼유저 필요(trusted 아님, 직접 재현 확인) | 슈퍼유저 필요 + **Rust/pgrx 빌드**(프리빌트 이미지나 Timescale Cloud 권장) |
| 메모리 전략 | 원본 float4 그대로(halfvec로 압축 가능) | 기본값이 SBQ(통계적 이진 양자화) 압축 |
| 라벨 필터링 | 없음(질의 단계에서 `WHERE` + `hnsw.iterative_scan`으로 보완) | 인덱스 자체에 라벨 컬럼을 넣어 그래프 탐색 단계에서 거른다([lab](pgvectorscale/labs/01-install-and-diskann/)에서 직접 실행) |
| 매니지드 지원 | RDS·Aurora·Supabase·Neon·Cloud SQL 전부 | **Timescale Cloud 외 전부 미지원**(2026-10 웹 검색 기준) |

## 3. 장단점 — 실측과 1차 출처로 본 것

### pgvector

- **장점**: 이미 Postgres를 쓰고 있다면 운영 복잡도가 그대로다. 매니지드 DB 대부분이 지원한다. HNSW는 점진적 삽입이 가능해 "빈 테이블에 먼저 만들면 안 된다"는 제약이 없다(IVFFlat에는 있다 - [pgvector lab 02](pgvector/labs/02-hnsw-vs-ivfflat/)에서 직접 재현).
- **단점**: ANN이므로 근사치다 - `ORDER BY ... LIMIT k`가 정확한 top-k를 보장하지 않는다. 필터링이 섞인 검색(라벨·테넌트별)은 `hnsw.iterative_scan` 같은 질의 단계 보완이 필요하다([AWS 공식 블로그](https://aws.amazon.com/blogs/database/running-pgvector-in-production-on-amazon-aurora-postgresql/)가 프로덕션 체크리스트로 제시) - [실험 07](experiments/07-filtered-search-cost/)에서 경고와 처방을 둘 다 재현했다: 질의 근처가 아닌 군집의 라벨로 거르면 기본값(`off`)은 **0행**, `relaxed_order`는 10행을 채우지만 질의당 약 27,800 버퍼·11.9ms가 든다.
- **실측(이 문서의 실험)**: [실험 01](experiments/01-recall-vs-tuning/)에서 `ef_search`를 10→200으로 올리면 recall@10이 0.63→0.93으로, 버퍼가 495→5,060(약 10배)으로 같이 올랐다 - 전형적인 recall/비용 트레이드오프를 직접 확인했다. 그런데 [실험 06](experiments/06-recall-at-scale/)에서 행 수를 300,000으로 올리자 `ef_search=10`의 recall이 **0.22까지 떨어졌다** - 싼 설정의 품질은 규모에 민감하다.

### pgvectorscale

- **장점**: SBQ 압축으로 인덱스가 원본 테이블보다도 작다 - [실험 02](experiments/02-build-cost-and-size/)에서 20,000~300,000행 전 구간에 걸쳐 테이블 대비 **0.79~0.80배**로 일정했다(HNSW는 1.37배, IVFFlat은 0.91배). 라벨 필터링을 인덱스 레벨에서 지원한다 - [실험 07](experiments/07-filtered-search-cost/)에서 같은 10행을 HNSW+`iterative_scan`보다 **약 9배 싸게**(1.3ms vs 11.9ms) 찾았다. 대신 결과의 평균 거리가 정답에서 조금 더 멀었다(13.88 vs HNSW 13.78, 정답 13.72). 규모가 커질수록 저렴한 설정에서의 recall 우위도 커진다 - [실험 06](experiments/06-recall-at-scale/)에서 300,000행 기준 DiskANN의 가장 싼 설정은 여전히 recall@10=1.000인데 HNSW·IVFFlat의 가장 싼 설정은 0.22·0.29까지 떨어졌다.
- **단점**: **빌드가 압도적으로 느리다.** 같은 실험에서 300,000행 기준 HNSW 대비 17배, IVFFlat 대비 411배 느렸다(583초 vs 33초 vs 1.4초). [실험 03](experiments/03-sbq-compression/)에서는 압축을 끈(`storage_layout=plain`) 빌드가 한 번 서버 프로세스를 죽였지만, [실험 04](experiments/04-plain-build-memory-threshold/)가 같은 조건을 9번 재현해 9번 다 성공했다 - **"압축이 없으면 메모리를 못 버틴다"는 해석은 철회**했다. 확실히 남는 단점은 빌드 시간뿐이다.
- Timescale 자사가 공개한 Qdrant 비교 벤치마크(5천만 행·768차원, r6id.4xlarge)에서도 **"인덱스 빌드가 현재 단일 스레드 구현이라 Qdrant보다 3배 느리다"**고 자인했다 - 방향이 이 실험과 같다. 반대로 처리량(동시 질의)은 Postgres 쪽이 11.4배 높았다고 보고했다(병렬 쿼리 활용) - 이 수치는 벤더 자체 벤치마크이므로 그대로 인용하되, Qdrant의 수평 확장성은 평가 범위 밖이었다는 점도 같이 적는다.

## 4. 실무에서는 언제 뭘 쓰나 — 결정 기준

1차 출처(AWS 공식 블로그, Timescale 자사 블로그·벤치마크)와 이 문서의 실측을 종합한 가이드다. 추측이 섞인 부분은 명시한다.

- **이미 Postgres를 쓰고, 코퍼스가 수백만 행 이하**라면 pgvector HNSW가 기본 선택이다. 매니지드 DB 지원이 가장 넓고, 메타데이터·벡터를 한 트랜잭션에 둘 수 있다.
- **대소문자·테넌트·카테고리 필터가 섞인 검색**이 많다면 `hnsw.iterative_scan`(pgvector 0.8.0+) 튜닝부터 검토한다 - AWS 가이드가 `relaxed_order`를 기본 권장값으로 제시한다. 기본값 그대로면 필터 검색이 **빈 결과**를 낼 수 있다는 것부터 알아야 한다([실험 07](experiments/07-filtered-search-cost/)에서 재현). 켜면 결과는 채워지지만, 필터를 통과하는 후보가 질의 근처에 드물수록 비싸진다 - 그런 필터가 많고 지연시간이 중요하면 DiskANN의 네이티브 라벨 필터링(같은 일을 약 9배 싸게, 결과 품질은 조금 낮게)이나 라벨별 파티셔닝을 검토한다.
- **메모리를 줄이고 싶다면 halfvec부터** - 추가 확장 설치 없이 pgvector 하나로 인덱스 크기를 31% 줄였다([실험 05](experiments/05-halfvec-vs-sbq/)). DiskANN(SBQ)이 더 작게 만들지만(42%) halfvec과의 격차는 크지 않고, 그 대신 빌드가 7.6배 느리다.
- **수천만 행 이상, 메모리가 빠듯하고, Timescale Cloud를 쓸 수 있는 조건**이라면 pgvectorscale(DiskANN)이 설계 의도에 맞는다. 다만 **빌드 시간이 운영에 허용되는지**(배치 재빌드 주기, 다운타임)를 먼저 확인해야 한다 - 이 실험에서는 작은 규모에서도 빌드가 수백 배 더 걸렸다.
- **RDS·Aurora·Supabase·Neon·Cloud SQL 중 하나를 쓰고 있다면 pgvectorscale은 선택지가 아니다**(2026-10 기준 전부 미지원) - pgvector HNSW + halfvec 압축 + 파티셔닝으로 규모를 버티는 쪽이 현실적이다.
- **수평 확장, 테넌트별 완전 격리, 운영을 아예 넘기고 싶다**면 전용 벡터 DB(Pinecone/Qdrant)를 검토한다 - Postgres 안에 머무는 이점(트랜잭션, JOIN, 운영 단순화)과 맞바꾸는 선택이다.

## 5. 실험

일곱 실험 모두 "왜 이 실험이 필요했는가"를 각 README 맨 위에 적어뒀다 - 17회차 카탈로그 문서가 1차 출처나 제작사 주장을 그대로 인용만 하고 직접 재지 않았던 부분(01·02·05)이거나, 앞선 실험이 스스로 남긴 한계·공백(03→04, 01→06, lab→07)을 메우는 것이다. 가설은 각 README에 **H1·H2** 형식으로 명시하고, 결과 다음에 "가설 검증" 절에서 채택/기각/부분채택/판단불가를 명시적으로 밝힌다.

| 실험 | 왜 필요했나 | 가설 | 가설 검증 |
| --- | --- | --- | --- |
| [01 · recall vs 튜닝](experiments/01-recall-vs-tuning/) | 카탈로그의 "recall은 파라미터로 조절한다"는 서술이 미실측이었다 | 파라미터를 올리면 recall·비용이 같이 오른다 | HNSW·IVFFlat **채택**. DiskANN **기각**(천장 효과 - 가장 싼 설정부터 recall@10=1.0) |
| [02 · 빌드 비용·크기](experiments/02-build-cost-and-size/) | "SBQ가 큰 규모에서 메모리를 아낀다"는 제작사 설계 의도가 미확인이었고, 실험 01은 규모를 못 다뤘다 | DiskANN 인덱스가 규모가 커져도 테이블 대비 작게 유지된다(H1) / DiskANN 빌드가 느리고 병렬 빌드 전환점에서 격차가 줄어든다(H2) | H1 **채택**(0.79배로 전 구간 일정, "더 벌어진다"는 강한 버전은 판단불가). H2 절반만 채택 - 느린 것은 맞았지만 **병렬 빌드가 격차를 줄인다는 기대는 기각**(오히려 더 벌어짐) |
| [03 · SBQ 압축](experiments/03-sbq-compression/) | 실험 02가 압축 켠 상태만 쟀다 - 켬/끔 직접 대조가 없었다 | 압축을 끄면 인덱스가 커지고 recall·버퍼에서 유리할 것이다 | **검증 불가** - 압축을 끈 빌드가 이 환경에서 서버를 죽여 측정 자체가 안 됐다(**이후 실험 04에서 이 크래시가 재현 불가능한 단발성 사건임이 밝혀졌다**) |
| [04 · plain 빌드 재현성](experiments/04-plain-build-memory-threshold/) | 실험 03의 크래시가 "메모리 부족"이라는 추정에 그쳤다 - 경계·원인을 좁혀야 했다 | 40,000~51,000행 사이에 실패 경계가 있고(H1), `maintenance_work_mem`을 올리면 완주한다(H2) | **둘 다 평가 불가** - 30,000~51,000행 전부, `maintenance_work_mem` 1~3GB 전부, 심지어 실험 03과 같은 빌드 순서까지 9번 재현해 **9번 다 성공**. 실험 03의 크래시는 이 조건의 결정적 결과가 아니었다는 뜻 - **이전 결론을 철회**했다 |
| [05 · halfvec vs SBQ](experiments/05-halfvec-vs-sbq/) | pgvectorscale.md가 halfvec을 "대안"으로 언급만 하고 SBQ와 직접 비교한 적이 없었다 | SBQ가 halfvec보다 작다(H1) / halfvec이 SBQ보다 recall 손실이 적다(H2) / halfvec 빌드가 float4만큼 빠르다(H3) | H1 **채택**(SBQ 23.5MB < halfvec 27.8MB < float4 40.5MB, 다만 halfvec이 이미 격차의 2/3을 커버). H2 **기각**(recall은 오히려 DiskANN이 가장 높았다 - HNSW 빌드 비결정성과 뒤섞여 설계가 깨졌다). H3 **기각**(halfvec 빌드가 84% 더 느렸다) |
| [06 · 300,000행에서 recall](experiments/06-recall-at-scale/) | 실험 01(51,000행)이 "이 규모가 DiskANN에게 너무 쉬웠을 뿐일 수 있다"는 한계를 스스로 적어뒀다 | 300,000행에서는 DiskANN도 가장 싼 설정에서 recall<1.0으로 떨어질 것(H1) / 그래도 HNSW·IVFFlat의 가장 싼 설정보다는 나을 것(H2) | H1 **기각**(여전히 1.000) / H2 **채택, 격차가 두 배 더 벌어짐**(0.37 → 0.784) - DiskANN의 우위는 작은 규모의 착시가 아니라 규모가 커질수록 더 뚜렷해지는 패턴이었다 |
| [07 · 라벨 필터링 비용·정확성](experiments/07-filtered-search-cost/) | DiskANN 라벨 필터링이 지정 라벨만 돌려주는 것은 확인했지만 HNSW+`iterative_scan`과 정확도·비용을 비교한 적이 없었다 | HNSW 기본값은 k개를 못 채운다(H1) / `iterative_scan`을 켜면 채운다(H2) / 둘 다 채우면 DiskANN이 더 싸다(H3) | **H1·H2·H3 채택** - 기본값 0행, `relaxed_order` 10행(27,753 버퍼·11.9ms), DiskANN 10행(5,652 버퍼·1.3ms). 대신 결과 거리는 HNSW가 정답에 더 가까웠다. **첫 판의 "HNSW는 어떤 설정으로도 0행"은 서로 다른 벡터가 10개뿐인 데이터 탓이었다 - 정정** |

세 번째 줄과 네 번째 줄의 관계가 이 문서의 핵심 교훈이다 - **극적인 결과(서버가 죽었다) 하나를 바로 "이 확장의 특성"으로 일반화하지 않고, 반복 재현을 시도해서 실제로 되돌렸다.** pg_trgm 실험의 "siglen 48→64 반등 철회"와 같은 종류의 정정이다. 일곱 번째 줄도 같은 종류의 정정이다 - 첫 판의 극적인 결과("HNSW는 어떤 설정으로도 0행")는 실험 01에서 기록해 둔 InitPlan 버그를 다시 만든 데이터 탓이었고, 웹 자료로 옮기며 출력을 다시 확인하다가 발견했다. 반대로 여섯 번째 줄은 **DiskANN이 설계 의도대로 동작한 가장 분명한 증거**다 - 규모가 커질수록 HNSW·IVFFlat의 저렴한 설정은 무너졌지만 DiskANN의 가장 싼 설정은 그대로였다.

측정 원칙(결정적 지표 우선, 2회 반복, 함정 기록)은 week02~04에서 정립한 것을 그대로 따른다 - [실험 01](experiments/01-recall-vs-tuning/)의 "측정 중 겪은 함정"에 재현 과정의 실수(균등분포 난수의 차원의 저주, 스칼라 서브쿼리 InitPlan 캐싱, bigserial 시퀀스 미전진)를 그대로 남겼고, 이후 실험들도 "한계" 절에 각자의 미해결·추정 부분을 숨기지 않고 적었다.

## 6. 실습(Lab)

| Lab | 내용 |
| --- | --- |
| [pgvector 01 · 설치와 거리 연산자](pgvector/labs/01-install-and-distance-ops/) | trusted 여부, 4가지 타입, 4+2가지 거리 연산자, HNSW/IVFFlat 인덱스 |
| [pgvector 02 · HNSW vs IVFFlat](pgvector/labs/02-hnsw-vs-ivfflat/) | IVFFlat 빌드 순서 함정, 질의 시점 튜닝 손잡이 |
| [pgvectorscale 01 · 설치와 DiskANN](pgvectorscale/labs/01-install-and-diskann/) | trusted·superuser 재현, DiskANN 빌드 파라미터, 라벨 필터링 실제 실행 |

Docker 실습은 각 디렉터리에서 `./run.sh`로 실행한다.

## 7. 한계와 다음 과제

- 환경이 RAM 3.8GiB·CPU 3개로 제한적이다. 실험 06이 300,000행까지는 DiskANN의 recall 우위가 규모와 함께 커진다는 것을 보였지만, 설계 의도가 가리키는 "수천만 행" 규모는 이 환경에서 시도조차 못 했다.
- `plain` storage_layout의 recall·버퍼 비교는 여전히 없다 - 실험 03에서 크래시로 중단됐고, 실험 04는 "완주하는가"만 재확인했을 뿐 recall·버퍼까지 측정하지는 않았다. 다음 과제로 남는다.
- 실제 임베딩(의미 있는 클러스터 구조)이 아니라 합성 데이터를 썼다 - 절대 수치보다 상대적 경향으로 읽어야 한다.
- 웹 자료는 `web/`의 `#/pgvector/about`에 있다. 수치는 이 디렉터리의 실험 결과에서 `web/scripts/sync-pgvector-results.py`가 옮긴다.
