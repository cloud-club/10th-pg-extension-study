# pg_cron lab 04 — 직렬화·권한·운영

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 3초 잡의 완료·다음 시작 시각으로 동일 jobid의 겹침이 없는지 확인한다.
2. 제한 역할로 예약을 등록하고 username과 이름의 사용자별 범위를 확인한다.
3. 관리자의 이름 삭제 실패와 jobid 삭제 권한을 구분한다.
4. 이력 정리 예약, 시간대·설정·실패 관찰 항목을 읽고 실습 역할과 잡을 정리한다.

해석: unschedule/비활성화는 실행 중 작업의 취소 경로에도 영향을 준다. 이미 커밋된 업무 효과를 되돌리는 기능은 아니다.

실습 설정: pg_cron 1.6.8 고정, cron.host=/var/run/postgresql.
예약 SQL은 컨테이너 내부 소켓을 쓰며, API의 DB 연결은 별도 비밀번호 인증을 쓴다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
