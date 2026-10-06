# pgvector lab 01 — 설치와 거리 연산자

Docker Engine과 Compose v2가 실행 중이어야 한다.
처음 빌드에는 네트워크가 필요하며 이후는 캐시를 사용한다.

1. `pg_available_extension_versions`로 설치 전 trusted·superuser·requires 값을 확인하고 `CREATE EXTENSION`으로 설치한다. pgvector는 trusted가 아니므로 슈퍼유저 권한이 필요하다.
2. `vector`·`halfvec`·`sparsevec`·`bit` 네 타입의 리터럴을 확인한다. 차원이 다르면 캐스팅이 거절된다(자르거나 채우지 않는다).
3. 거리 연산자 4종(`<->` `<#>` `<=>` `<+>`)과 bit 전용 2종(`<~>` `<%>`)을 실행하고, `pg_opclass`로 HNSW·IVFFlat이 지원하는 연산자 클래스를 확인한다.
4. HNSW·IVFFlat 인덱스를 만들고, 질의 시점 튜닝 GUC(`hnsw.ef_search`, `ivfflat.probes`)가 확장 라이브러리 로드 후에만 `pg_settings`에 나타나는 것을 확인한다. 3행짜리 테이블에서는 플래너가 인덱스 대신 Seq Scan을 고른다 - "인덱스가 있다"와 "쓰인다"는 다른 이야기다.

해석: pgvector는 코어 확장점(타입·연산자 클래스)만 쓰고 별도 SQL 훅이나 백그라운드 워커가 없다. GiST/GIN과 같은 확장 방식이다 - HNSW/IVFFlat도 인덱스 액세스 메소드로 등록되어 있을 뿐이다.

실습 설정: PostgreSQL 16.15, pgvector 0.8.7(공식 이미지 기준).
명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
