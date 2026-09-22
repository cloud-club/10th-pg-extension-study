# pg_stat_statements lab 01 — preload와 수집 범위

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. preload와 확장 SQL 버전, 실제 컬럼 목록을 확인한다.
2. 카탈로그 객체와 pg_shmem_allocations에서 공유 메모리 흔적을 읽는다.
3. preload가 없는 별도 서버의 조회 오류는 HANDS-ON.md의 추가 실습으로 구분한다.

해석: 수집은 서버 전역, CREATE EXTENSION의 뷰/함수는 접속 DB에 설치된다. LOAD만으로 수집을 활성화할 수 없다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
