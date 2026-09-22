# pg_stat_statements lab 04 — 운영 지표·eviction·권한

Docker Engine + Compose v2가 실행 중이어야 한다. API lab은 호스트 Python 3도 필요하다.
처음 빌드에는 네트워크와 수 분이 필요하며 이후는 캐시를 사용한다.

1. 총 시간, 호출 수, 편차와 통계 구간을 읽는다.
2. 선택적 reset의 0 와일드카드 의미를 확인한다.
3. 모양이 다른 1,200개 쿼리로 max=1,000의 eviction을 관찰한다.
4. 본인/일반 타인/pg_read_all_stats 역할의 텍스트·queryid 가시성을 비교하고 역할을 정리한다.

해석: dealloc은 제거된 항목 수가 아니라 제거가 일어난 횟수다. usage 기반 eviction을 엄밀한 LRU로 설명하지 않는다.

명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
