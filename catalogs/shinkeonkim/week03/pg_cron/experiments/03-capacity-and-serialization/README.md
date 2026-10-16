# 실험 03 — 잡 직렬화와 동시 한도: 선형 확장을 기대했다가 정체를 발견

2026-09-15, PostgreSQL **16.15 / pg_cron 패키지 1.6.8-1.pgdg13+1** (SQL 확장 버전은 1.6), Docker aarch64, 컨테이너 CPU 3개, 기본 libpq·유닉스 소켓. 이미지 ID와 정확한 버전은 각 결과 파일의 `environment`에 기록한다. 기존 실험 01·02의 1.6.7과 구분한다.

## 질문과 방법

- 1초마다 2초 걸리는 잡을 예약하면 같은 jobid가 겹치는가?
- 잡을 네 개로 늘리면 병렬 실행되는가? 동시 한도 2와 4에서 처리량은 어떻게 달라지는가?
- 작업 자체는 `pg_sleep(2)`와 결과 한 행 INSERT다. **CPU/디스크 성능 벤치마크가 아니라 스케줄러의 대기·동시성 실험**이다.

`bench.py`는 세 조건을 각각 새 DB에서 10회 실행한다. DB 시계로 12초의 신규 작업 접수 구간을 만들고 순차적으로 잡을 등록한다. 함수 진입 시각이 구간 밖이면 작업 없이 반환한다. 등록 뒤 17초 관찰하고 예약을 제거한 뒤, 커밋된 실행의 시작·종료 시각과 cron 이력을 저장한다. 등록 비용과 첫 실행 대기가 접수 구간에 포함되므로 정상 상태의 장기 처리량으로 해석하지 않는다.

실행 구간을 `[started, finished)`로 취급해 끝 이벤트를 시작 이벤트보다 먼저 정렬한다. 전체 최대 겹침과 동일 jobid의 구간 겹침을 검사한다. 이 구간은 SQL 함수 내부의 시각으로, 연결 생성 및 결과 수집 시간은 포함하지 않는다. `completed_admitted_runs / 12`는 **접수 구간에 들어와 최종 커밋된 작업 수 / 접수 시간**이며 전체 실험 경과시간으로 나눈 값이 아니다.

## 원본 결과

| 조건 | 10회 완료 수 | 평균 | 표준편차 | 최대 겹침 10회 |
| --- | --- | ---: | ---: | --- |
| 잡 1개 / 한도 4 | 5, 6, 6, 6, 6, 6, 6, 5, 5, 5 | 5.6 | 0.52 | 모두 1 |
| 잡 4개 / 한도 2 | 2, 3, 3, 2, 3, 2, 2, 2, 2, 2 | 2.3 | 0.48 | 모두 2 |
| 잡 4개 / 한도 4 | 24, 22, 20, 20, 20, 20, 24, 24, 20, 20 | 21.4 | 1.90 | 모두 4 |

모든 조건에서 **동일 jobid의 실행 겹침은 0**이었다. 다른 jobid는 실제로 겹쳤고 전체 실행은 설정 한도를 넘지 않았다. 하지만 한도 2는 한도 4의 절반 정도 처리할 것이라는 예상과 달랐다. 이 행을 정상적인 용량 축소 곡선으로 읽으면 안 된다.

재현하면 `results/`에 `1-*.json`부터 `10-*.json`까지 30개 상세 파일이 생성된다. 이 디렉터리는 Git에서 제외하며, 저장소에는 위 반복별 수치와 웹의 요약 데이터만 남긴다. 상세 파일의 `runs`는 커밋된 실작업, `cron_history`에는 접수 구간 종료 후 아무 작업 없이 반환한 호출도 포함된다. 커밋된 작업인데 cron 이력은 running에 머무는 사례도 있으므로 이력의 상태만으로 업무 처리 여부를 계산하지 않았다.

## 추가 진단: 등록 중 캐시 변경 때문인가?

순차 등록 영향을 분리하기 위해 `diagnose.py`는 **네 잡을 한 트랜잭션에서 등록**한다. 시간 제한을 함수에 넣지 않고 계속 2초 작업을 수행하며, 약 6초 간격으로 세 번 `pg_stat_activity`, cron 이력, 커밋 결과를 관찰했다. SQL 조회 비용이 있어 정확한 6·12·18초가 아니며 원본에 실제 관찰 시각을 남겼다.

10회 반복 결과:

- 세 관찰 시점의 커밋 결과는 각각 **2~3건, 2~3건, 4~5건**이었다. 각 시점의 평균은 2.5건, 2.5건, 4.5건이고 표본 표준편차는 모두 약 0.53건이다.
- 첫 조회와 두 번째 조회 사이에 완료 수가 늘어난 반복은 없었다. 10회 모두 중간 정체를 관찰했다.
- 마지막 스냅샷에는 매회 두 건의 **`job startup timeout`**이 기록됐다.
- 10회 × 3시점의 activity 조회 30번 중 실행용 client backend가 보인 시점은 1번이었다. 나머지 29번에는 launcher만 보였지만 이력에는 connecting 상태가 남았다. 서버 과부하나 쿼리 실행 시간이 길다는 설명만으로는 충분하지 않다.

재현하면 `results/`에 `diagnostic-1.json`부터 `diagnostic-10.json`과 같은 번호의 서버 로그가 생성된다. 이 파일들도 Git에는 넣지 않는다. 로그의 초기 `database study does not exist`는 Docker 최초 initdb 중 메타데이터 DB 생성 이전 launcher 시도이며, 이후 정상 기동된 서버에서 위 현상을 관찰했다.

## 원인 확인: WAITING 작업이 폴링 자리를 차지한다

[v1.6.8 PollForTasks](https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L1116-L1214)는 `activeTaskCount >= MaxRunningTasks`이면 순회를 중단한다. WAITING이면서 pendingRunCount가 0인 작업은 건너뛰지만, pending이 있는 WAITING 작업은 시작 슬롯이 없을 때 fd=-1로 폴링 목록에 들어가고 activeTaskCount도 늘어난다.

이는 같은 jobid의 대기 회차가 다른 jobid를 의도적으로 막는 정책이 아니다. 각 jobid는 별도 `CronTask`와 `pendingRunCount`를 갖는다. 문제는 실행 한도 2를 모두 쓴 순간에 pending이 있는 WAITING 작업 두 개가 폴링 목록의 두 자리를 차지할 수 있다는 점이다. 두 항목의 fd는 -1이므로 실제 연결 중인 작업의 소켓을 확인하지 못한다. 완료된 작업도 launcher가 완료로 전환하지 못해 `RunningTaskCount`가 줄지 않고, 약 10초 뒤 `job startup timeout` 처리로 자리가 풀릴 때까지 정체된다.

원인을 분리하기 위해 v1.6.8 원본과 아래 조건 하나만 바꾼 빌드를 같은 환경에서 각각 10회 비교했다. 수정은 시작 가능한 WAITING 작업을 앞의 `CanStartTask()`에서 이미 처리한다는 점을 이용해, 나머지 WAITING 작업을 pending 수와 관계없이 폴링 목록에서 제외한다.

```diff
- if (task->state == CRON_TASK_WAITING && task->pendingRunCount == 0)
+ if (task->state == CRON_TASK_WAITING)
```

| 빌드 | 6초 누적 완료 | 12초 누적 완료 | 18초 누적 완료 | startup timeout |
| --- | --- | --- | --- | --- |
| v1.6.8 원본 | 2~3 | 2~3 | 4~5 | 매회 2건 |
| 조건 변경 | 4 | 10 | 16 | 매회 0건 |

원본은 10회 모두 6초와 12초 사이 완료 수가 늘지 않았다. 조건 변경 빌드는 10회 모두 4→10→16건으로 계속 진행했다. 다른 코드는 같았으므로 **이번 환경의 정체와 timeout은 pending이 있는 WAITING 작업을 폴링 대상으로 센 경로 때문에 발생했다고 판단할 수 있다.** 2018년에 등록되어 현재도 열려 있는 [upstream issue #63](https://github.com/citusdata/pg_cron/issues/63)에도 한도 초과 시 `poll([{fd=-1}], ...)`로 멈추는 같은 증상이 기록되어 있다.

이 비교는 PostgreSQL 16.15, pg_cron v1.6.8, 기본 libpq·유닉스 소켓 모드에서 원인을 확인한 것이다. 첨부 패치는 인과관계 확인용 최소 변경이며 검토된 운영 패치가 아니다. worker 모드와 다른 버전은 별도로 확인해야 한다. 운영에서는 사용하는 버전에서 활성 잡 수가 한도를 초과하는 조건을 반드시 검증한다.

## 재현

저장소 루트에서, Docker와 Python 3만 있으면 된다.

```sh
python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/bench.py
python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/diagnose.py
python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/confirm_cause.py
```

공유 [runtime](../runtime/)의 **전용 Compose 프로젝트**를 사용하므로 실험 04와 동시에 실행하지 않는다. 케이스마다 임시 DB를 만들고 finally에서 컨테이너·볼륨을 정리한다. 로컬 결과 JSON은 다시 실행하면 덮어쓰므로 비교할 실행은 저장소 밖으로 먼저 복사한다. 베이스 이미지 digest와 pg_cron 패키지 버전을 Dockerfile에 고정했지만 apt 저장소에서 해당 패키지가 사라지면 재빌드가 실패할 수 있다.

`confirm_cause.py`는 소스 빌드 때문에 처음 실행할 때 시간이 더 걸린다. v1.6.8 원본과 [인과 확인용 패치](waiting-tasks-not-polled.patch)를 적용한 이미지를 만들고 두 조건을 나란히 10회 실행한다. 검사 통과는 동일 jobid 직렬화·동시 상한 또는 위 원인 분리 조건이 통과했다는 뜻이다. 정상 처리량이나 운영 패치의 안전성까지 보장하지 않는다. 짧은 구간·10회 반복·sleep 워크로드·시작 비용을 포함한 수치이므로 운영 용량 산정에는 더 긴 부하 실험이 필요하다. 반복 수는 `REPETITIONS` 환경 변수로 늘릴 수 있으며 웹에 게시할 결과는 조건별 최소 10회를 요구한다.
