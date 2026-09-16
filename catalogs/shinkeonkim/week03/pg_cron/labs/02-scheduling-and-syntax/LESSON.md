# pg_cron lab 02 — 예약 문법과 실제 실행

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 5필드·초 간격·월말($) 예약과 이름 없는 2인자 오버로드를 등록한다.
2. 존재하지 않는 1인자 오버로드의 에러를 확인한다.
3. heartbeat 증가와 otherdb 작업의 succeeded 이력을 확인한다.
4. alter_job으로 주기/활성을 바꾼 후 모든 실습 잡을 제거한다.

해석: 등록 성공만으로 실행 성공을 판단하지 않는다. 샘플 개수는 부하에 따라 달라지며 실제 성공 이력이 필요하다.

실습 설정: pg_cron 1.6.8 고정, cron.host=/var/run/postgresql.
예약 SQL은 컨테이너 내부 소켓을 쓰며, API의 DB 연결은 별도 비밀번호 인증을 쓴다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
