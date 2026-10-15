# pgvectorscale lab 01 — 설치와 DiskANN

Docker Engine과 Compose v2가 실행 중이어야 한다.
처음 빌드에는 네트워크가 필요하며 이후는 캐시를 사용한다(timescaledb-ha 이미지가 pgvector·pgvectorscale·timescaledb를 모두 담고 있어 pgvector lab보다 이미지가 크다).

1. `pg_available_extension_versions`로 vector·vectorscale의 trusted·superuser·requires를 확인한다. 둘 다 trusted가 아니다 - vectorscale은 vector를 요구하므로 `CASCADE`로 같이 설치한다.
2. DiskANN 인덱스를 만들고 NOTICE에 찍히는 기본 빌드 파라미터를 읽는다. `pg_opclass`로 diskann이 지원하는 연산자 클래스(`vector_l2/ip/cosine_ops` + `vector_smallint_label_ops`)를 확인한다 - HNSW에는 있는 `vector_l1_ops`가 diskann에는 없다.
3. 라벨(smallint 배열) 컬럼을 인덱스 두 번째 컬럼으로 넣어 "이 라벨들 중에서만 최근접 이웃 찾기"를 직접 실행한다. 먼저 생성한 2,000행이 **전부 서로 다른 벡터**인지 확인한다(행마다 스칼라 서브쿼리로 난수를 만들면 InitPlan으로 한 번만 평가돼 라벨마다 같은 벡터가 된다 - 실험 07 첫 판의 실수). 전역 최근접 이웃은 라벨 1 근처에 몰려 있는데, 라벨 5로 필터링한 질의가 **전부 라벨 5인 결과**만 돌려주고, 플랜에서 라벨 조건이 `Filter`가 아니라 `Index Cond`로 들어가는 것을 확인한다.

해석: pgvectorscale은 pgvector의 `vector` 타입·거리 연산자를 그대로 재사용하면서(`requires=vector`) 인덱스 액세스 메소드(`diskann`)만 새로 추가한다. 라벨 필터링은 그 인덱스 액세스 메소드가 추가 컬럼을 받을 수 있어서 가능한 것이지, `vector` 타입 자체의 기능이 아니다.

실습 설정: PostgreSQL 16.15, pgvector 0.8.6 / pgvectorscale 0.9.1(timescaledb-ha 이미지 번들).
명령: ./run.sh (자동 실행), ./run.sh explain (이 안내), ./run.sh psql (수동).
