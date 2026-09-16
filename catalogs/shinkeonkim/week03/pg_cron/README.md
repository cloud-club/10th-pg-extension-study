# pg_cron

> PostgreSQL 안에서 cron 문법으로 주기적인 SQL 을 예약해 실행하는 서드파티 background-worker 익스텐션 - 스케줄이 DB 안의 테이블 행이라서 pg_dump 로 함께 백업되고, 앱 서버와 무관하게 계속 돈다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 자동화 (스케줄러) |
| 버전 | 현재 실행 환경: PostgreSQL 16.15 / pg_cron 1.6.8 (SQL 1.6). 과거 1.6.7 측정 기록은 별도 표기 |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [citusdata/pg_cron (GitHub)](https://github.com/citusdata/pg_cron) |
| 정리한 사람 | shinkeonkim |
| 회차 | week03 |

설명은 웹의 Week 03에 모아 둔다. `#/pg-cron/about`에서 시작해 사이드바 순서로 읽는다. 실행 가능한 자료는 [`labs/`](labs)의 Docker 실습 5개와 [`experiments/`](experiments)의 반복 측정이다.

---

웹 해설: `web/#/pg-cron/about` → 예약에서 실행까지, `#/pg-cron/shared-preload-libraries` → preload 설정, `#/pg-cron/max-worker-processes` → worker 한도, `#/pg-cron/dollar-quoting` → 문자열 문법, `#/pg-cron/downtime` → 서버 중단과 놓친 예약. 사이드바에서 Week 03을 선택하면 기초부터 순서대로 읽을 수 있다.

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

```bash
# OS 크론탭 - DB 를 새 서버로 옮기면 크론탭도 옮겨야 하고,
# 서버가 여러 대(HA)면 어디서 돌릴지/중복 실행을 별도로 관리해야 한다.
0 3 * * * psql -h dbhost -U app -d prod -c "VACUUM ANALYZE big_table"
```

**After**

```sql
CREATE EXTENSION pg_cron;  -- 서버의 shared_preload_libraries 설정과 재시작이 먼저 필요

SELECT cron.schedule('nightly-vacuum', '0 3 * * *', 'VACUUM ANALYZE big_table');
```

스케줄이 `cron.job` 테이블의 행이라서 `pg_dump` 로 함께 백업되고, 실행 이력은 `cron.job_run_details` 로 SQL 한 줄에 조회된다.

## 2. 설치 & 데모

```sql
-- 1) 서버 기동 옵션에 preload 필요
--    shared_preload_libraries = 'pg_cron'
--    cron.database_name       = 'study'   -- 이 DB 에서만 CREATE EXTENSION 가능
--    → 재시작 필수.

CREATE EXTENSION pg_cron;
```

```sql
-- 실제 쿼리와 결과
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());
SELECT cron.schedule('fast-tick', '2 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$);

SELECT pg_sleep(5);
SELECT count(*) FROM heartbeat;   -- 우리 세션과 무관하게 백그라운드에서 늘어나 있다
```

전체 실습은 [`labs/`](labs) 에서 Docker 로 직접 돌려볼 수 있다 (각 lab 디렉터리에서 `./run.sh`).

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | "DB 안에서 끝나는 단순 주기 작업" - 정리, 리프레시, 파티션 유지보수, 헬스체크. 스케줄을 DB 와 함께 버전관리/백업하고 싶을 때 |
| 이럴 때는 피한다 | 여러 시스템에 걸친 의존성 있는 파이프라인, 정교한 재시도/알림이 필요한 배치(전용 오케스트레이터가 낫다). 밀리초 단위 정밀도가 필요한 경우(최소 단위는 초) |
| 비용 | `shared_preload_libraries` 변경 시 **재시작 필요**. 클러스터에 **한 DB** 에만 설치 가능(다른 DB 는 `schedule_in_database()`). 기본 모드는 잡마다 새 연결을 맺는다 |
| 대안 | OS 크론탭 + psql, `pg_partman`(BGW 모드), TimescaleDB 정책, Airflow 등 외부 오케스트레이터 |

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | |
| Azure Database for PostgreSQL | ○ | |
| GCP Cloud SQL | ○ | |
| Supabase | ○ | |
| Neon | ○ | |
| DigitalOcean / Aiven / Crunchy Bridge | ○ | |
| Heroku Postgres | ✕ | 미지원 |

<sub>출처와 세부 사항은 웹의 `#/pg-cron/rds`와 [pg_cron 공식 README의 Managed services 표](https://github.com/citusdata/pg_cron#managed-services) 참고. `shared_preload_libraries`가 필요한 확장이라 서비스별로 활성화 방식이 다르다.</sub>

---

## 5. 내부 동작 원리

- **훅이 아니라 background worker**: `_PG_init()` 이 `RegisterBackgroundWorker()` 로 "pg_cron launcher" 워커 하나를 등록한다. `BgWorkerStart_RecoveryFinished` 라서 **핫 스탠바이에서는 뜨지 않는다.**
- **잡 실행은 기본적으로 "별도 연결"이다**: launcher 가 `PQconnectStartParams()` 로 로컬 서버에 libpq 연결을 새로 열어 잡을 실행한다 - 그래서 실행 중인 잡은 `pg_stat_activity` 에 평범한 `client backend` 로 보인다(`application_name='pg_cron'`). `cron.use_background_workers=on` 으로 바꾸면 동적 background worker 를 쓰는 모드로 전환된다.
- **`cron.job` 은 RLS 가 걸린 평범한 테이블**이고, 트리거(`cron_job_cache_invalidate`)로 launcher 의 인메모리 캐시를 무효화해 재시작 없이 변경 사항을 반영한다.
- **한 DB 제약**: `CREATE EXTENSION` 시점에 `current_database() = cron.database_name` 인지 SQL 레벨에서 검사한다 - 다른 DB 는 반드시 `cron.schedule_in_database()` 를 거쳐야 한다.
- 자세한 함수 지도와 코드 인용: 웹의 `#/pg-cron/source-map`, `#/pg-cron/source`

## 6. 벤치마크 / 실습 결과

기존 lab (PostgreSQL 16 / pg_cron 1.6.7)에서 기록한 동작이며, 현재 실행 점검은 1.6.8에서 수행했다. 주요 확인 항목 - **몇 가지는 처음 가정이 틀려서 소스/실측으로 바로잡았다**:

| 조건 | 결과 |
| --- | --- |
| `cron.schedule('SELECT ...')` 처럼 1개 인자로 "이름 없는 잡"을 등록 시도 | **에러.** 1인자 오버로드는 존재하지 않는다 - 실제로는 `(schedule, command)` 2인자와 `(job_name, schedule, command)` 3인자 두 시그니처만 있다 |
| 슈퍼유저(`postgres`)로 다른 사용자가 등록한 이름 있는 잡을 `cron.unschedule('이름')` | **실패** (`could not find valid entry for job`) - `cron.job` 의 `(jobname, username)` UNIQUE 제약 때문에 이름의 유효범위가 사용자별이다. `jobid` 로는 지울 수 있다 |
| 1초마다 도는데 실행에 3초 걸리는 잡을 8초 관찰 | 두 번째·세 번째 실행의 `start_time` 간격이 "1초"가 아니라 약 "3초"(실행 시간) - 동시 실행이 아니라 직렬화된다는 걸 실측으로 확인 |
| `cron.max_running_jobs=5` 로 낮춘 상태에서 3초짜리 잡 8개를 동시에 스케줄 | `pg_stat_activity` 에서 `application_name='pg_cron'` 인 연결이 **5개를 넘지 않음** - 초과분은 대기·실패 여부는 이력으로 따로 확인해야 한다 |
| 기본 모드에서 실행 중인 잡을 `pg_stat_activity` 로 관찰 | `backend_type = client backend` - pg_cron 전용 프로세스 종류가 아니라 일반 접속과 구분이 안 되고, `application_name` 만으로 식별해야 했다 |

각 항목의 재현 스크립트: [`labs/01-preload-and-architecture/`](labs/01-preload-and-architecture) ~ [`labs/04-monitoring-and-ops/`](labs/04-monitoring-and-ops).

## 7. 실제 백엔드에서 이렇게 쓴다

[`labs/05-fastapi-job-scheduler-api/`](labs/05-fastapi-job-scheduler-api) 는 매번 SQL 을 직접 짜는 대신, FastAPI 로 `cron.schedule`/`unschedule`/`alter_job`/`job_run_details` 를 감싼 작은 REST API 를 만들어본 예제다. 핵심은 **DB 레이어의 검증(cron 문법)을 API 레이어가 다시 구현하지 않고 그대로 클라이언트에 전달**한다는 것 - 잘못된 스케줄을 등록하면 pg_cron 자신의 에러 메시지가 HTTP 400 응답에 그대로 실린다.

## 8. 정량 실험 (벤치마크)

[`experiments/`](experiments)는 지터, 실행 이력 시간, 동시성·정체, 큐·롤백을 다룬다. **실험 02의 이력 시간은 전체 연결/worker 기동 비용이 아니므로 기존 "libpq가 4~14배 빠르다" 결론은 철회했다.** 과거 수치와 해석 정정은 해당 README에 보존했다. 새 실험 03·04는 1.6.8에서 실행했으며, 회차별 원본은 로컬 생성물로 제외하고 검토할 요약만 웹에 게시한다.

---

## 참고 링크

- [pg_cron 공식 저장소 (citusdata/pg_cron)](https://github.com/citusdata/pg_cron)
- [pg_cron README](https://github.com/citusdata/pg_cron#readme)
- [pg_cron CHANGELOG.md](https://github.com/citusdata/pg_cron/blob/main/CHANGELOG.md)
- 세부 출처는 웹의 각 페이지 하단 링크 참고


## 추가 조사와 실험 (2026-09-15)

- 웹 `#/pg-cron/recipes`: 집계 뷰, 배치 삭제, 파티션 유지보수, 작업 큐, HTTP 연계, 다른 DB 작업.
- [실험 03](experiments/03-capacity-and-serialization/): 동시성·처리량 비교 및 한도 2에서 관찰된 startup timeout 추가 진단.
- [실험 04](experiments/04-queue-and-rollback/): SKIP LOCKED 큐와 실패 시 트랜잭션 롤백 검증.
- 웹의 Week 03 → **활용 레시피**, **처리량·큐·롤백 실험**에 해설과 실측 차트를 추가했다.

새 실험은 pg_cron 1.6.8이며 기존 1.6.7 결과와 별도 표기한다. 문헌 조사와 실제 실행 결과도 구분한다.
