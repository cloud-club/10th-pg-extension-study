# pg_stat_statements lab 03 — 버퍼·WAL·계획·temp·JIT

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 20만 행으로 버퍼 hit/read, 5만 행 UPDATE의 WAL을 관찰한다.
2. track_planning=on에서 계획과 실행 시간을 따로 읽는다.
3. 작은 work_mem으로 전체 정렬의 temp 블록을 관찰한다.
4. JIT 가용 여부와 컴파일 카운터를 확인한다.

해석: shared_blks_read는 공유 버퍼 미스이며 OS 캐시에서 읽을 수도 있다. 첫/두 번째 조회의 hit 비율이나 밀리초 값을 고정 정답으로 삼지 않는다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
