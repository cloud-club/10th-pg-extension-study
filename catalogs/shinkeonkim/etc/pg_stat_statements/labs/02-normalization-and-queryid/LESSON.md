# pg_stat_statements lab 02 — 정규화와 queryid

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 상수만 다른 비교 쿼리가 calls=3/2로 합쳐지는지 확인한다.
2. PG16에서 IN 리스트 길이 3/5/7은 서로 다른 항목인지 관찰한다.
3. track=all에서 함수 안의 쿼리와 최상위 호출이 분리되는지 확인한다.

해석: queryid는 모든 버전·DB에서 영구 불변인 ID가 아니다. 통계 키는 userid/dbid/queryid/toplevel 조합이다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
