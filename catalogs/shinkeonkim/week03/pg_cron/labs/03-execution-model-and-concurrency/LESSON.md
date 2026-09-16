# pg_cron lab 03 — 실행 모드·동시성 상한

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 3초 sleep 잡을 예약해 client backend / application_name=pg_cron을 확인한다.
2. 예약을 제거한 뒤 8개의 부하 잡을 등록하고 동시 실행 수를 관찰한다.
3. 0개는 실행 성공의 증거가 아니다. 실제 실행 존재와 한도 이하를 함께 검사한다.
4. 마지막에 등록 잡을 제거한다. worker 모드는 HANDS-ON.md의 별도 전환 절차로 실행한다.

해석: 이 실습의 한도는 5다. 한도 초과가 언제나 오류 없는 대기로 끝나는 것은 아니다. 실험 03의 1.6.8 한도 2 정체도 함께 읽는다.

실습 설정: pg_cron 1.6.8 고정, cron.host=/var/run/postgresql.
예약 SQL은 컨테이너 내부 소켓을 쓰며, API의 DB 연결은 별도 비밀번호 인증을 쓴다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
