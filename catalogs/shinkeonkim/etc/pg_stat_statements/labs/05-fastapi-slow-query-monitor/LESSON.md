# pg_stat_statements lab 05 — FastAPI와 N+1 관찰

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 통계를 초기화한 뒤 user 1의 주문 25개를 N+1 방식으로 조회한다.
2. LIKE 검색 두 번 후 총 시간 순위와 calls>20 후보를 조회한다.
3. 같은 주문 상세 SELECT의 calls=25를 응답에서 검증한다.
4. limit 범위 밖 입력이 422인지 확인한다.

해석: 누적 calls만으로 N+1을 확정할 수 없다. 이 실습은 요청 1개와 알려진 seed로 원인을 통제한다. 인증 없는 로컬 진단 API다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
API 시나리오는 ./run.sh demo로 다시 실행한다. HTTP 오류와 예상 결과 불일치는 실패로 종료한다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
