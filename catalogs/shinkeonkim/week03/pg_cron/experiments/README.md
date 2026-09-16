# pg_cron 실험 - 정량 벤치마크

`../labs/` 가 "이런 동작을 한다"를 psql/curl 로 보여주는 실습이라면, 여기는 **실제로 숫자를 재서** 비교하는 곳이다. 실험 01·02는 `./bench.sh`, 03·04는 `python3 bench.py`로 재현할 수 있고, 결과는 실제로 측정한 값 그대로 README.md 에 남겼다(가공/추정 없음).

| 실험 | 질문 | 헤드라인 결과 |
| --- | --- | --- |
| [01-scheduling-jitter](01-scheduling-jitter) | `'1 seconds'` 스케줄이 실제로 얼마나 정확한가? 잡이 많아지면 나빠지나? | 평균 1.005초, 표준편차 3ms - 동시에 도는 잡 10개를 더해도 거의 변화 없음(1.0054초) |
| [02-connection-mode-overhead](02-connection-mode-overhead) | libpq 연결 모드 vs `cron.use_background_workers=on`, 뭐가 더 빠른가? | 이력 시간은 전체 기동 비용이 아님. 기존 전체 성능 배수 결론 철회; 상세 정정 참고 |

각 실험 디렉터리의 README.md 에 질문/방법/결과(원본 수치)/분석/한계가 있다.


## 추가 실험 · 2026-09-15

| 실험 | 질문 | 실제 결과 |
| --- | --- | --- |
| [03-capacity-and-serialization](03-capacity-and-serialization/) | 같은 jobid 직렬화와 동시 한도 2/4의 처리량은? | 동일 잡 겹침 0. 한도 2에서 정체가 반복돼 추가 진단했고 startup timeout을 관찰 |
| [04-queue-and-rollback](04-queue-and-rollback/) | 두 consumer의 중복 처리, 오류 전 INSERT는? | 10회 모두 40개 항목이 한 번씩 커밋. 실패 전 INSERT 잔존 0행 |

새 실험은 **PostgreSQL 16.15 / pg_cron 1.6.8**이다. 기존 1.6.7 실험과 구분한다.
각 조건을 10회 실행했다. 회차별 결과·버전·실행 시각·cron 이력은 재현 시 각 `results/`에 생성되지만 Git에는 넣지 않는다. 검토할 반복별 요약은 웹의 `src/data/cron-experiments.json`에 게시한다.
03의 `diagnose.py`도 예상 밖 정체를 별도로 10회 재현한다.
두 실험은 [runtime](runtime/)의 전용 임시 Compose 프로젝트를 공유하므로 동시에 실행하지 않는다.
웹의 `#/pg-cron/experiments`에서 결과를 읽을 수 있다.
