# pg_cron 반복 실험

실험 01과 02는 `./bench.sh`, 실험 03과 04는 `python3 bench.py`로 실행한다. 각 문서에는 질문, 측정 방법, 결과와 해석 범위를 함께 기록했다.

| 실험 | 측정 항목 | 결과 요약 |
| --- | --- | --- |
| [01 · 예약 간격 편차](01-scheduling-jitter/) | 1초 예약의 실제 실행 간격과 동시 잡의 영향 | pg_cron 1.6.7의 1회 측정에서 평균 약 1.005초. 현재 버전의 반복 측정값으로 사용하지 않음 |
| [02 · 실행 모드 이력 시간](02-connection-mode-overhead/) | libpq와 worker 모드의 이력상 실행 시간 | 기록 시작점이 달라 전체 기동 비용을 비교할 수 없음. 이전 성능 배수 결론 철회 |
| [03 · 직렬 실행과 동시 실행 한도](03-capacity-and-serialization/) | 같은 jobid의 겹침, 한도 2와 4의 진행 | 같은 jobid 겹침 0. 한도 2에서 정체와 startup timeout 관찰 |
| [04 · 큐와 롤백](04-queue-and-rollback/) | 소비자 두 개의 중복 처리와 오류 전 INSERT | 10회 모두 항목 40개를 한 번씩 커밋하고 오류 전 INSERT는 롤백 |

실험 03과 04의 환경은 PostgreSQL 16.15와 pg_cron 1.6.8이며 각 조건을 10회 실행했다. 실험 01과 02의 과거 1.6.7 결과와 구분한다.

회차별 JSON과 서버 로그는 각 실험의 `results/`에 생성되며 Git에서 제외된다. 검토용 반복 요약은 `web/src/data/cron-experiments.json`에 있다. 실험 03과 04는 [runtime](runtime/)의 Compose 프로젝트를 공유하므로 동시에 실행하지 않는다.

결과 설명과 차트는 웹의 `#/pg-cron/experiments`에서 확인한다.
