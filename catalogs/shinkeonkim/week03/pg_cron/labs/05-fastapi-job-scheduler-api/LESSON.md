# pg_cron lab 05 — FastAPI 잡 관리

Docker Engine과 Compose v2, 호스트의 Python 3이 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. API가 실제 DB에 접속 가능한지 health로 확인한다.
2. heartbeat 예약 → 목록 → 성공 이력 조회를 실행하고 응답 상태·내용을 검사한다.
3. 비활성화, 잘못된 cron 문법(400), 잘못된 limit(422), 없는 잡(404)을 구분한다.
4. 생성한 잡을 삭제하고 재삭제의 404까지 확인한다.

해석: 인증 없는 로컬 교육용 API이며 DB postgres 권한으로 임의 SQL을 예약한다. 운영용 권한 분리/인증을 구현한 예제는 아니다.

실습 설정: pg_cron 1.6.8 고정, cron.host=/var/run/postgresql.
예약 SQL은 컨테이너 내부 소켓을 쓰며, API의 DB 연결은 별도 비밀번호 인증을 쓴다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
API 시나리오는 ./run.sh demo로 다시 실행한다. HTTP 오류와 예상 결과 불일치는 실패로 종료한다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
