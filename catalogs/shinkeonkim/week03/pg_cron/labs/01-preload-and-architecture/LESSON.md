# pg_cron lab 01 — preload·단일 메타데이터 DB

Docker Engine과 Compose v2가 실행 중이어야 한다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. SHOW로 preload와 cron.database_name 확인 → study에서 확장 생성.
2. otherdb에서는 CREATE EXTENSION이 실패하는지 확인한다. 예상 오류만 잡으며 성공하면 실습 실패다.
3. pg_stat_activity의 launcher, cron.job의 RLS 정책, extconfig의 덤프 대상을 읽는다.

해석: 예약 정의는 DB에 저장되지만 실행 중 상태는 별도다. standby의 worker 시작과 등록을 구분한다.

실습 설정: pg_cron 1.6.8 고정, cron.host=/var/run/postgresql.
예약 SQL은 컨테이너 내부 소켓을 쓰며, API의 DB 연결은 별도 비밀번호 인증을 쓴다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
