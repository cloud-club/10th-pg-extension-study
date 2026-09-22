# hstore lab 03 — 인덱스

Docker Engine과 Compose v2가 실행 중이어야 한다.

1. `pg_opclass`·`pg_amop`에서 hstore를 대상으로 하는 연산자 클래스와 연산자를 조회한다 (GIN·GiST는 `@>` `?` `?&` `?|`, btree·hash는 `=`).
2. 10만 5백 행(속성 4개, 0.1%의 행에만 promo, decoy 500행)에서 인덱스 없이 `@>`를 실행하고, GIN 생성 후 같은 쿼리와 `?` `?&` `?|`가 인덱스를 쓰는지 본다.
3. `-> 'brand' = ...`는 GIN이 있어도 순차 스캔임을 확인하고, 식 인덱스를 만들어 쓰이는지 본다.
4. `EXPLAIN (ANALYZE)`의 `Rows Removed by Index Recheck`가 decoy 500행과 같은지 확인해 GIN이 `@>`에서 재검사한다는 것을 본다.
5. GiST(siglen 16·128)를 만들어 크기를 비교하고 GIN을 지운 뒤 GiST도 후보를 재검사로 걸러내는지 본다.

해석: 인덱스는 후보를 줄이는 도구이고 정확성은 힙 재검사가 보장한다. 식 인덱스는 쿼리의 식이 같아야 쓰인다.

실습 설정: PostgreSQL 16.15, hstore 1.8.
명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
