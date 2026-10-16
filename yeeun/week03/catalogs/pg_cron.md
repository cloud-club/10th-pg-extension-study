# pg_cron

> PostgreSQL 안에서 SQL·Function·Procedure를 **정해진 시간 또는 주기마다 자동 실행**할 수 있게 해주는 Job Scheduler Extension

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 자동화 · Job Scheduling |
| 버전 | PostgreSQL 18 기준 조사 / upstream `pg_cron` 최신 릴리스 `1.6.7` |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | `citusdata/pg_cron` 공식 GitHub Repository |
| 정리한 사람 | 김예은 |
| 회차 | `week03` |

`pg_cron`은 PostgreSQL 내부에서 동작하는 cron 기반 Job Scheduler Extension이다. 공식 프로젝트는 PostgreSQL 10 이상을 지원하며, 현재 upstream 최신 릴리스는 `1.6.7`이다. PostgreSQL 18 지원은 `1.6.6`에서 추가됐다.

lab 재현: `yeeun/week03/lab` · [`HANDS-ON.md`](../../week03/HANDS-ON.md)

---

## 1. Before / After - 없으면 뭐가 불편한가

### Before

애플리케이션을 운영하다 보면 특정 SQL을 **한 번 실행하는 것**이 아니라 일정한 주기로 계속 실행해야 하는 경우가 생긴다. 예를 들어 다음과 같은 작업이다.

```sql
DELETE FROM access_logs
WHERE created_at < now() - interval '90 days';
```

SQL 자체는 단순하지만 요구사항이 다음과 같다면 이야기가 달라진다.

```
매일 새벽 03:00 실행
매시간 집계 테이블 갱신
매주 오래된 데이터 삭제
매월 마지막 날 정산 Procedure 실행
5분마다 Queue 성격의 테이블 처리
```

PostgreSQL에 접속해서 사람이 매번 SQL을 실행할 수는 없다. 그래서 보통 PostgreSQL 밖에 Scheduler를 둔다. 대표적인 방법은 Linux의 `cron`이다.

```bash
0 3 * * * psql -d app_db -c \
"DELETE FROM access_logs WHERE created_at < now() - interval '90 days';"
```

구조를 단순화하면 다음과 같다.

```
Linux cron
    ↓
psql 실행
    ↓
PostgreSQL 연결
    ↓
SQL 실행
```

이 방식도 충분히 사용할 수 있다. 다만 DB Maintenance 작업 하나를 자동화하려고 해도 PostgreSQL 외부에서 다음 요소를 함께 관리해야 한다.

```
cron 설정
psql 실행 환경
DB Host / Port / Database
인증 정보
Shell Script
실행 로그
```

애플리케이션 Scheduler를 사용할 수도 있다. 예를 들어 Spring에서는

```java
@Scheduled(cron = "0 0 3 * * *")
public void cleanupLogs() {
    ...
}
```

와 같이 구현할 수 있다. 그러면 구조는 다음과 같이 된다.

```
Application → Scheduler → Connection Pool → PostgreSQL → SQL
```

그러나 작업의 내용이 오래된 Row 삭제, Materialized View 갱신, DB 통계 집계, Partition Maintenance, VACUUM / ANALYZE, Stored Procedure 호출처럼 **PostgreSQL 내부에서 시작해서 PostgreSQL 내부에서 끝나는 작업**이라면 애플리케이션이 단순히 SQL 실행 시간을 관리하기 위해 개입하는 구조가 과할 수도 있다.

### After

`pg_cron`을 사용하면 PostgreSQL에 직접 Job을 등록할 수 있다.

```sql
SELECT cron.schedule(
    'cleanup-old-logs',
    '0 3 * * *',
    $$
    DELETE FROM access_logs
    WHERE created_at < now() - interval '90 days'
    $$
);
```

이 Job의 의미:

```
Job 이름: cleanup-old-logs
Schedule: 매일 03:00
Command: 90일 이전 access_logs 삭제
```

등록된 Job은 PostgreSQL 내부의 `cron.job`에 저장되고 `pg_cron`의 Scheduler Background Worker가 실행 시점을 관리한다.

```
PostgreSQL
│
├─ pg_cron Scheduler
├─ cron.job
└─ SQL / Procedure
```

즉 **"누가 SQL을 실행할 것인가?"** 라는 문제를 PostgreSQL 외부 Scheduler 대신 PostgreSQL Extension으로 해결한다.

### `pg_cron`이 해결하는 문제

한 문장으로 정리하면:

```
DB 내부에서 끝나는 반복 작업을
DB 내부에서 스케줄링한다.
```

예를 들면 다음과 같은 요구가 있을 때 `pg_cron`을 후보로 떠올릴 수 있다.

```
"매일 오래된 데이터를 지워야 하는데?"
"Materialized View를 매시간 갱신해야 하는데?"
"파티션 유지보수 Procedure를 정기 실행해야 하는데?"
"정산 집계 SQL을 매일 새벽 실행해야 하는데?"
"별도 Batch Application까지 만들 정도는 아닌데?"
```

이것이 이번 스터디의 목표인 **"어? 이거 Extension으로 풀 수 있지 않을까?"** 와 직접 연결되는 부분이다.

---

## 2. 먼저 cron이 무엇인가

`pg_cron`이라는 이름에서 `cron`은 PostgreSQL 고유 개념이 아니다. Unix/Linux 환경에서 오랫동안 사용되어 온 **시간 기반 Job Scheduler**이다.

일반적인 cron 표현식은 다음 5개의 필드를 사용한다.

```
┌───────────── minute
│ ┌───────────── hour
│ │ ┌───────────── day of month
│ │ │ ┌───────────── month
│ │ │ │ ┌───────────── day of week
│ │ │ │ │
* * * * *
```

`pg_cron`의 cron parser 역시 Paul Vixie의 cron 코드를 기반으로 한다.

| 필드 | 범위 | 의미 |
| --- | --- | --- |
| minute | `0~59` | 분 |
| hour | `0~23` | 시 |
| day of month | `1~31` | 일 |
| month | `1~12` | 월 |
| day of week | `0~6` | 요일, `0`은 일요일 |

예를 들어 `0 3 * * *` 는 분=0, 시=3, 나머지=모든 값이므로 **매일 03:00** 을 의미한다.

### 자주 사용하는 표현

| 표현 | 의미 |
| --- | --- |
| `* * * * *` | 매분 실행 |
| `*/5 * * * *` | 5분마다 실행 |
| `0 * * * *` | 매시간 정각 실행 |
| `0 3 * * *` | 매일 03:00 실행 |
| `0 0 * * 1-5` | 월~금 00:00 실행 |
| `0 1 * * 0` | 매주 일요일 01:00 실행 |

공식 `pg_cron`은 월의 마지막 날을 의미하는 `$`를 지원한다. `0 12 $ * *` → **매월 마지막 날 12:00**. 2월·윤년·30/31일을 애플리케이션에서 따로 계산하지 않아도 된다.

### 초 단위 실행

일반적인 5-field cron 외에 `1~59 seconds` 형식도 지원한다.

```sql
SELECT cron.schedule(
    'process-queue',
    '10 seconds',
    'CALL process_queue()'
);
```

`10 seconds` 방식과 `* * * * *` 방식은 서로 다른 Schedule 표현이며, 초 단위 표현을 일반 cron 필드와 섞어서 쓰지 않는다.

---

## 3. 설치 & 데모

### 3-1. `CREATE EXTENSION`만 하면 되는가?

다음 명령만 실행하면 된다고 생각하기 쉽다.

```sql
CREATE EXTENSION pg_cron;
```

하지만 일반 PostgreSQL 환경에서는 이것만으로 충분하지 않다. 서버가 시작될 때 `pg_cron` Library를 로드해야 한다.

```
shared_preload_libraries = 'pg_cron'
```

그 다음 PostgreSQL을 재시작하고 `CREATE EXTENSION pg_cron`을 실행한다. 공식 문서에서도 Scheduler Background Worker를 시작하기 위해 `shared_preload_libraries` 등록이 필요하다고 설명한다.

```
pg_cron Binary / Extension 파일 설치
        ↓
shared_preload_libraries 등록
        ↓
PostgreSQL Restart
        ↓
CREATE EXTENSION pg_cron
```

### 3-2. 왜 preload가 필요한가

모든 Extension이 `shared_preload_libraries`를 필요로 하는 것은 아니다. Function·Data Type·Operator 정도만 추가한다면 `CREATE EXTENSION`만으로 충분한 경우도 많다.

그러나 서버 시작 시점에 Shared Memory 확보, Lightweight Lock 예약, Background Worker 등록이 필요한 Library는 preload로 로드되어야 한다. `pg_cron`은 여기에 해당한다. PostgreSQL이 실행되는 동안 계속 살아 있으면서 **"지금 실행해야 할 Job이 있는가?"** 를 감시할 Scheduler Process가 필요하기 때문이다.

### 3-3. `pg_cron` 소스에서도 preload를 요구한다

C 소스 `_PG_init()`에서 자신이 `shared_preload_libraries`를 통해 로드되는 중인지 확인하고, 아니면 `pg_cron can only be loaded via shared_preload_libraries` 형태의 오류를 낸다. 즉 preload는 권장 설정이 아니라 **실행 구조 자체에 필요한 설정**이다.

### 3-4. Background Worker란?

PostgreSQL은 Extension이 별도 Process를 실행할 수 있도록 **Background Worker API**를 제공한다. Background Worker는 Shared Memory에 접근하거나 Database에 내부적으로 연결하여 Transaction과 Query를 실행할 수 있다.

```
postgres
│
├─ client backend
├─ checkpointer / background writer / autovacuum launcher
└─ pg_cron scheduler
```

`background writer`(코어 Process)와 `Background Worker`(Extension이 Process를 등록하는 API)는 다른 개념이다.

### 3-5. 실제 설치

Debian/Ubuntu (PG18 예시):

```bash
sudo apt-get install postgresql-18-cron
```

Red Hat:

```bash
sudo yum install pg_cron_18
```

Source Build:

```bash
git clone https://github.com/citusdata/pg_cron.git
cd pg_cron
export PATH=/usr/pgsql-18/bin:$PATH
make
sudo PATH=$PATH make install
```

`CREATE EXTENSION`은 인터넷에서 프로그램을 받는 명령이 아니다. 서버에 `pg_cron.control` · SQL Script · Shared Library가 있어야 하고, 그다음 현재 Database 안에 객체를 만든다.

### 3-6. PostgreSQL 설정

```
shared_preload_libraries = 'pg_cron'
```

다른 모듈과 함께:

```
shared_preload_libraries = 'pg_stat_statements,pg_cron'
```

week02 `pg_stat_statements`와 같이 **Restart가 필요**하다.

### 3-7. 설정 확인

```sql
SHOW shared_preload_libraries;
```

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'pg_cron';
```

### 3-8. Extension 생성

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_cron';
```

조사 시점 upstream 최신: `1.6.7` (PG18 지원은 `1.6.6`부터). Managed는 Provider 버전이 다를 수 있으므로 `extversion`을 반드시 확인한다.

---

## 4. `CREATE EXTENSION`을 하면 무엇이 생기는가

`cron` Schema와 관련 함수·Table이 생긴다.

```
cron
│
├─ job
├─ job_run_details
├─ schedule()
├─ schedule_in_database()
├─ unschedule()
└─ alter_job()
```

### `cron.job`

| 항목 | 의미 |
| --- | --- |
| `jobid` | Job 식별자 |
| `schedule` | 실행 Schedule |
| `command` | 실행할 SQL |
| `database` | 대상 Database |
| `username` | 실행 User |
| `active` | Job 활성 여부 |
| `jobname` | Job 이름 |

"어떤 Job을 언제 무엇으로 실행할지"가 PostgreSQL 내부 Table에 저장된다.

---

## 5. 가장 기본적인 실습

```sql
CREATE TABLE cron_demo_log (
    id BIGSERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

SELECT cron.schedule(
    'cron-demo-insert',
    '* * * * *',
    $$
    INSERT INTO cron_demo_log(message)
    VALUES ('pg_cron executed')
    $$
);
```

`cron.schedule()`은 생성된 `jobid`를 반환한다.

```sql
SELECT jobid, jobname, schedule, command, database, username, active
FROM cron.job;
```

1~2분 후:

```sql
SELECT * FROM cron_demo_log ORDER BY created_at DESC;
```

별도 애플리케이션 요청 없이 PostgreSQL Scheduler가 SQL을 실행한다.

lab(`yeeun/week03/lab`)에서는 5초 Job + `cron_test` 테이블로 같은 흐름을 빠르게 확인한다.

---

## 6. 실행 결과 확인

```sql
SELECT jobid, runid, database, username, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC;
```

정상: `status = succeeded` / 실패: `status = failed`.

### 일부러 실패시켜 보기

```sql
SELECT cron.schedule(
    'cron-demo-error',
    '* * * * *',
    'SELECT * FROM table_that_does_not_exist'
);
```

Job 등록 → Scheduler 실행 → SQL Error → failed → `return_message` 기록 흐름을 확인한다.

---

## 7. Job 수정 · 일시정지 · 삭제

```sql
SELECT cron.alter_job(1, active := false);
SELECT cron.alter_job(1, active := true);
SELECT cron.alter_job(1, schedule := '*/5 * * * *');
SELECT cron.unschedule(1);
SELECT cron.unschedule('cron-demo-insert');
```

`alter_job()`으로 Schedule, Command, Database, Username, Active를 바꿀 수 있다.

---

## 8. 이름 있는 Job을 사용하는 이유

운영에서는 `jobid = 42`보다 `cleanup-old-orders` 같은 이름이 이해하기 쉽다.

```sql
SELECT cron.schedule(
    'cleanup-old-orders',
    '0 3 * * *',
    'CALL cleanup_old_orders()'
);
```

이름 있는 Job은 `(jobname, username)` Unique 기준 `ON CONFLICT ... DO UPDATE`를 쓴다. 같은 사용자가 같은 이름으로 다시 `schedule()`하면 새 Job을 계속 만들기보다 schedule/command/database를 갱신한다. Migration Script에서 Job 정의를 관리할 때 유용하다.

---

## 9. 긴 SQL은 Procedure로 분리

긴 SQL 전체를 `command`에 넣을 수도 있지만, 업무 로직이 길면 Procedure로 분리한다.

```sql
CREATE OR REPLACE PROCEDURE run_daily_settlement()
LANGUAGE plpgsql
AS $$
BEGIN
    -- settlement logic
END;
$$;

SELECT cron.schedule(
    'daily-settlement',
    '0 3 * * *',
    'CALL run_daily_settlement()'
);
```

역할 분리: `pg_cron` = 언제 / Procedure = 무엇을.

---

## 10. Timezone

기본 `cron.timezone`은 `GMT`다.

```sql
SHOW cron.timezone;
SELECT name, setting FROM pg_settings WHERE name LIKE 'cron.%';
```

운영 예: `cron.timezone = 'Asia/Seoul'` → `0 3 * * *`를 KST 새벽 3시로 해석. 문서에는 `03:00 KST`처럼 Timezone을 명시한다.

OS Timezone · PostgreSQL Session TimeZone · pg_cron Scheduler Timezone을 동일하다고 가정하지 않는다.

---

## 11. 하나의 Cluster에는 Metadata DB가 하나

`pg_cron`은 **Cluster에서 한 Database에만 설치**하도록 설계되어 있다. 기본 Metadata DB는 `postgres` (`cron.database_name`).

다른 DB에서 Job을 돌리려면:

```sql
SELECT cron.schedule_in_database(
    'service-a-cleanup',
    '0 3 * * *',
    'CALL cleanup_old_data()',
    'service_a'
);
```

lab에서는 `cron.database_name = 'study'`.

---

## 12. 실제 Job은 누가 실행하는가

구분: **Scheduler Process** vs **실제 Job 실행 Process**.

### 기본 — libpq Connection

`cron.use_background_workers = off` (기본). Scheduler가 시각이 된 Job을 발견하면 **새 Connection(libpq)** 으로 SQL을 실행한다. `pg_hba.conf` · Authentication · `.pgpass` · `cron.host` 영향을 받을 수 있다.

### Background Worker 방식

`cron.use_background_workers = on` 이면 Job을 Dynamic Background Worker로 실행. `max_worker_processes`(PG18 기본 8) Pool을 Parallel Query · Logical Replication · 기타 Extension과 공유한다.

---

## 13. 같은 Job이 겹치면

서로 다른 Job은 병렬 가능. **같은 Job의 여러 Instance는 동시에 실행하지 않는다.** 이전 실행이 끝나지 않으면 다음 실행은 Queue에 대기한다.

주기 1분 · 평균 실행 10분이면 대기가 쌓일 수 있다. 실행 주기 · 평균 · 최대 실행시간을 함께 본다.

---

## 14. 동시 실행 제한

`cron.max_running_jobs` — upstream 기본(일반 Connection 방식) 최대 `32` 근처. Managed는 Provider 값을 확인한다.

```sql
SHOW cron.max_running_jobs;
SELECT name, setting, context FROM pg_settings WHERE name LIKE 'cron.%';
```

---

## 15. 권한

Job은 기본적으로 **생성한 사용자와 동일한 권한**으로 실행된다. Superuser로 무조건 도는 것이 아니다.

```sql
GRANT USAGE ON SCHEMA cron TO app_user;
```

은 강한 기능이다. 운영에서는 아무 Application User보다 Maintenance Role을 고려한다.

---

## 16. 다른 사용자의 Job은 볼 수 있는가

`cron.job` / `cron.job_run_details`에 RLS. 일반 사용자는 기본적으로 자신의 Job만. Superuser 또는 `BYPASSRLS` 제외.

---

## 17. Job 실행 기록은 자동 삭제되지 않는다

`job_run_details`는 자동 정리되지 않는다. 10초 Job이면 하루 8,640회. `pg_cron`으로 이력을 지울 수 있다.

```sql
SELECT cron.schedule(
    'cleanup-cron-history',
    '0 12 * * *',
    $$
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days'
    $$
);
```

---

## 18. Restart · HA

PostgreSQL이 내려가 있으면 Job도 실행되지 않는다. **Hot Standby에서는 Job을 실행하지 않고**, Primary로 Promotion되면 Scheduler가 시작된다. Worker 시작 시점: `BgWorkerStart_RecoveryFinished`.

---

## 19. Workflow Engine인가?

아니다. 기본적으로 "시간이 됐는지 확인 → SQL 실행"이다. Retry DAG · Slack Alert · Compensation 등은 Airflow / Dagster / Temporal / Celery / Spring Batch / Cloud Scheduler 등을 검토한다. **스케줄 기능**과 **Workflow Engine**을 구분한다.

---

## 20. 트레이드오프

| 내용 | 설명 |
| --- | --- |
| 이럴 때 쓴다 | DB 내부 SQL 주기 실행, Cleanup, MV Refresh, Summary 갱신, Procedure, `pg_partman` maintenance |
| 장점 | 별도 App 불필요, SQL로 정의·이력 조회, DB 권한 활용, 동일 Job 중복 동시 실행 방지 |
| 비용 | preload+Restart, DB 자원 소비, 고빈도 시 Connection/Worker, `job_run_details` 누적, Retry/DAG 부족 |
| 이럴 때 피한다 | 외부 API·File·장시간·정교한 Retry/Alert 중심 |
| 대안 | Linux cron, K8s CronJob, Airflow, App Scheduler, Cloud Scheduler |

---

## 21. OS cron 비교

| 항목 | OS cron | `pg_cron` |
| --- | --- | --- |
| Scheduler 위치 | OS | PostgreSQL |
| SQL 실행 | `psql` 등 | SQL 직접 등록 |
| Job 정의 | crontab | `cron.job` |
| 실행 기록 | OS Log 등 | `job_run_details` |
| Shell / File / 외부 Program | 적합 | 기본 목적 아님 |
| DB Procedure | 가능 | 매우 편리 |

Shell 자동화 → OS cron / PostgreSQL SQL 자동화 → `pg_cron`이 자연스러울 수 있다.

---

## 22. Application Scheduler와 비교

App이 더 자연스러운 작업: DB 조회 → 외부 API · Email · S3 · Slack → DB 상태 변경.

`pg_cron`이 더 단순한 작업: DELETE / REFRESH MV / CALL procedure / INSERT summary / ANALYZE.

```
작업 경계가 PostgreSQL 안에서 끝나는가?
YES → pg_cron 후보
NO  → Application / External Scheduler 후보
```

---

## 23. DB에서 Batch를 돌릴 때

Job도 같은 PostgreSQL의 CPU · Memory · Disk I/O · Shared Buffer · Connection · Lock · WAL을 쓴다. 대량 DELETE는 API 트래픽·VACUUM·WAL·Replica 부담과 겹칠 수 있다. **자동 실행 ≠ 자동으로 안전.**

---

## 24. Lock도 그대로

`0 3 * * *`에 `ALTER TABLE large_table`을 넣어도 Lock이 사라지지 않는다. Schedule 설계 + SQL의 Lock/I/O/WAL 분석을 함께 한다.

---

## 25. Idempotency

같은 작업을 여러 번 실행해도 결과가 안정적이면 Idempotent. `DELETE ... WHERE created_at < ...` 는 대체로 안전하고, `UPDATE ... SET point = point + 1000` 은 위험하다. 동일 Job 동시 실행은 막아주지만 **Exactly Once를 보장하지는 않는다.**

---

## 26. Timeout

```sql
SET statement_timeout = '5min';
```

고빈도 · 대량 UPDATE/DELETE · Aggregation · 외부 Extension 결합 Job에서 특히 중요하다.

---

## 27. Schema 이름을 명시

별도 Session에서 실행되므로 `DELETE FROM orders`보다 `DELETE FROM public.orders`, `CALL maintenance.cleanup_old_orders()`처럼 Schema를 명시해 `search_path` 차이를 줄인다.

---

## 28. Monitoring

```sql
-- 최근 실패
SELECT jobid, database, command, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 20;

-- 오래 실행
SELECT jobid, command, start_time, end_time, end_time - start_time AS duration
FROM cron.job_run_details
WHERE end_time IS NOT NULL
ORDER BY duration DESC
LIMIT 20;
```

---

## 29. 주요 설정

| Parameter | 기본값 | 의미 |
| --- | --- | --- |
| `cron.database_name` | `postgres` | Metadata Database |
| `cron.enable_superuser_jobs` | `on` | Superuser Job 허용 |
| `cron.host` | `localhost` | Job Connection Host |
| `cron.launch_active_jobs` | `on` | Active Job 실행 |
| `cron.log_min_messages` | `WARNING` | Scheduler Log Level |
| `cron.log_run` | `on` | `job_run_details` 기록 |
| `cron.log_statement` | `on` | Statement Log |
| `cron.max_running_jobs` | `32` | 동시 실행 Job 수 |
| `cron.timezone` | `GMT` | Schedule Timezone |
| `cron.use_background_workers` | `off` | BG Worker로 Job 실행 |

`cron.launch_active_jobs`, `cron.log_min_messages`는 Reload 가능. 다수는 Restart 필요한 `postmaster` Context.

---

## 30. 내부 동작 원리

```
PostgreSQL Start
  → shared_preload_libraries
  → pg_cron Library Load
  → _PG_init()
  → Scheduler Background Worker 등록
  → Read/Write 정상 상태
  → Scheduler 실행
  → cron.job 조회 · Schedule 비교
  → libpq Connection 또는 DB Background Worker
  → SQL / Function / Procedure 실행
  → cron.job_run_details 기록
```

`_PG_init()`에서 Custom GUC · Background Worker · Scheduler 등록. Worker는 `BGWORKER_SHMEM_ACCESS`, `BGWORKER_BACKEND_DATABASE_CONNECTION`, 시작 시점 `BgWorkerStart_RecoveryFinished`.

---

## 31. `cron.job` 변경 감지

`cron.job`에 INSERT/UPDATE/DELETE/TRUNCATE 시 `cron_job_cache_invalidate` Trigger로 Scheduler Cache를 무효화한다. 매초 전체 SELECT만 하는 구조가 아니다.

---

## 32. `pg_stat_statements`와 비교

| | `pg_stat_statements` | `pg_cron` |
| --- | --- | --- |
| 주 역할 | 관찰 · 진단 | 자동화 · 실행 |
| 흐름 | Application SQL → Query ID → 통계 | cron.job → Scheduler → SQL 실행 |

연결: 진단으로 부담을 파악 → 운영 정책 → 새벽에 maintenance를 `pg_cron`으로. 느린 Query를 무조건 cron으로 옮기라는 뜻은 아니다. week02 = 관찰, week03 = DB 안 능동 실행.

---

## 33. preload가 필요한 이유 비교

`pg_stat_statements`: 전역 Shared Memory로 Query 통계 → preload.

`pg_cron`: Scheduler Process가 계속 실행 → Background Worker 등록 → preload.

같은 설정명이지만 이유는 다르다.

---

## 34. `pg_partman`과 연결

```
pg_partman = 파티션을 어떻게 관리할 것인가
pg_cron    = 그 Maintenance를 언제 실행할 것인가
```

```sql
SELECT cron.schedule(
    '@hourly',
    $$CALL partman.run_maintenance_proc()$$
);
```

AWS RDS 문서도 이 조합 예제를 제공한다.

---

## 35. 매니지드 DB 지원

| 서비스 | 지원 | 특징 |
| --- | --- | --- |
| AWS RDS PostgreSQL | ○ | 12.5+, Parameter Group, 최근 1.6.7 포함 |
| AWS Aurora PostgreSQL | ○ | 12.6+, Parameter Group |
| Supabase | ○ | Cron이 내부적으로 `pg_cron` (동시 8개·10분 이하 권장) |
| Neon | ○ | 2025-01-31부터 전체 사용자 |
| GCP Cloud SQL | ○ | `cloudsql.enable_pg_cron`, **BG Worker만** (libpq 미지원), 문서상 1.6.4 |

지원 여부뿐 아니라 Version · preload 방법 · libpq vs BG Worker · 동시 실행 제한을 Provider 문서로 확인한다.

---

## 36. 운영 예시

```sql
-- Cleanup
SELECT cron.schedule('delete-old-events', '0 4 * * *',
  $$DELETE FROM event_log WHERE created_at < now() - interval '90 days'$$);

-- MV
SELECT cron.schedule('refresh-daily-sales', '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary$$);

-- Procedure
SELECT cron.schedule('daily-settlement', '0 3 * * *', 'CALL settlement.run_daily()');

-- ANALYZE (autovacuum과 역할 겹침 검토)
SELECT cron.schedule('nightly-analyze-orders', '0 2 * * *', 'ANALYZE public.orders');

-- pg_partman
SELECT cron.schedule('partition-maintenance', '@hourly', 'CALL partman.run_maintenance_proc()');
```

---

## 37. 추가 실습 — 같은 Job이 겹치는지

```sql
SELECT cron.schedule('long-running-demo', '* * * * *', 'SELECT pg_sleep(90)');
-- 주기 60초 · 실행 ~90초 → 중첩 시 Queue 대기 확인 후
SELECT cron.unschedule('long-running-demo');
```

---

## 38. 추가 실습 — named Job Upsert

```sql
SELECT cron.schedule('named-demo', '*/5 * * * *', 'SELECT 1');
SELECT cron.schedule('named-demo', '*/10 * * * *', 'SELECT 2');
-- 동일 username+jobname이면 갱신되는지 확인
```

---

## 39. 벤치마크 / 실습 결과

구조 조사 후 Docker lab에서 확인. 수치·체크리스트는 `./run.sh` 후 기록.

| 조건 | 결과 |
| --- | --- |
| lab 환경 | `yeeun/week03/lab` · Postgres 16 · 포트 15503 |
| Extension · 5초 Job · cron_test · job_run_details · unschedule | lab으로 확인 |
| 상세 수치 (version, extversion, timezone, 중첩, Upsert) | `./run.sh` 후 채움 |

```sql
SELECT version();
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
SELECT name, setting, context FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;
```

---

## 40. FAQ

**Q. PostgreSQL에는 원래 Scheduler가 없나?**  
Core에는 범용 SQL Cron이 없다. OS cron / App / Cloud / Extension을 쓴다.

**Q. `CREATE EXTENSION`만 하면 되나?**  
일반 환경에서는 `shared_preload_libraries` + Restart가 먼저다.

**Q. Scheduler와 Job 실행 Process가 같나?**  
아니다. Scheduler는 BG Worker, 기본 Job은 libpq 새 Connection. `cron.use_background_workers=on`이면 Job도 BG Worker.

**Q. 같은 Job이 끝나기 전 다음 시각?**  
동시 실행하지 않고 Queue 대기.

**Q. 여러 Job은 동시 가능?**  
가능. `cron.max_running_jobs` 등 제한.

**Q. 다른 Database?**  
Metadata DB 하나 + `cron.schedule_in_database()`.

**Q. Standby?**  
Hot Standby에서는 미실행, Promotion 후 Scheduler 시작.

**Q. App Batch를 전부 옮기나?**  
DB 안에서 끝나는 단순 작업에 적합. 외부 I/O·복잡한 Workflow는 외부 Scheduler.

**Q. `pg_partman`과?**  
partman=무엇 / cron=언제. AWS도 조합 안내.

---

## 참고 자료

### pg_cron
- citusdata/pg_cron 공식 Repository — 개요, 설치, Schedule API, 설정, Monitoring
- CHANGELOG — `1.6.6` PG18 지원, 현재 `1.6.7`
- Source `pg_cron.c` — `_PG_init()`, BG Worker, GUC
- SQL Source — `cron.job`, RLS, Schedule, Cache Invalidation Trigger
- Named Job `ON CONFLICT` Update

### PostgreSQL
- PG18 `shared_preload_libraries`
- Background Worker · `max_worker_processes`

### Managed
- AWS RDS `pg_cron` (12.5+)
- AWS Aurora `pg_cron` (12.6+)
- AWS `pg_partman + pg_cron` Maintenance 예제
- Supabase Cron
- Neon Changelog (전체 사용자)
- GCP Cloud SQL Extension (`cloudsql.enable_pg_cron`, BG Worker)
