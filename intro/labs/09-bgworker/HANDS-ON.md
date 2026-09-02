# Lab 09 - 직접 해보기 · (f) Background Worker

지금까지의 extension 은 전부 **사용자가 쿼리를 던져야** 움직였습니다. 이 부류는 다릅니다 - **extension 이 자기 프로세스를 띄우고, 아무도 안 물어봐도 알아서 일합니다.**

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 에 `shared_preload_libraries=pg_cron` 과 `cron.database_name=study` 가 있습니다. **Background Worker 등록은 서버 시작 시점에만 가능합니다.**

---

## STEP 1 - 진짜 프로세스가 하나 더 있습니다

```sql
CREATE EXTENSION pg_cron;
```

```sql
SELECT pid, backend_type AS 프로세스종류, application_name, now() - backend_start AS 가동시간
FROM   pg_stat_activity WHERE backend_type <> 'client backend' ORDER BY backend_type;
```

`pg_cron launcher` 가 보입니다. **checkpointer, autovacuum launcher 같은 PostgreSQL 자체 프로세스들과 같은 목록에 있습니다.** extension 이 만든 프로세스인데도요.

컨테이너 밖에서도 확인해보세요. 새 터미널에서:

```bash
./run.sh shell
ps aux | grep -E 'postgres|cron' | head
exit
```

```sql
SHOW shared_preload_libraries;
```

> **왜 preload 가 필요한가**: Background Worker 는 postmaster 가 `fork()` 해서 만듭니다. 등록은 `_PG_init()` 에서 `RegisterBackgroundWorker()` 를 부르는 방식이라, **postmaster 가 자식을 만들기 시작하기 전**에 라이브러리가 올라와 있어야 합니다.

pg_cron 이 만든 스키마도 보세요.

```sql
SELECT c.relname AS 테이블, c.relkind AS 종류
FROM   pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE  n.nspname='cron' AND c.relkind IN ('r','v') ORDER BY c.relname;
```

```sql
SELECT extname, extconfig::regclass[] AS "데이터까지 덤프되는 테이블"
FROM pg_extension WHERE extname='pg_cron';
```
→ lab02 에서 본 `pg_extension_config_dump()` 입니다. **등록한 스케줄은 백업에 포함됩니다.**

---

## STEP 2 - 스케줄을 등록하고 실제로 도는지 봅니다

```sql
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());
```

```sql
SELECT cron.schedule('heartbeat',      '* * * * *',   $$INSERT INTO heartbeat DEFAULT VALUES$$) AS jobid;
SELECT cron.schedule('nightly-vacuum', '0 3 * * *',   'VACUUM ANALYZE heartbeat') AS jobid;
SELECT cron.schedule('weekly-report',  '0 9 * * MON', 'SELECT 1') AS jobid;
```

```sql
SELECT jobid, jobname AS 잡이름, schedule AS 스케줄, left(command, 40) AS 명령,
       database AS DB, active AS 활성
FROM   cron.job ORDER BY jobid;
```

1분을 기다릴 수는 없으니 **초 단위 스케줄**로 눈앞에서 확인합니다.

```sql
SELECT cron.schedule('fast-tick', '1 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$) AS jobid;
SELECT pg_sleep(5);
SELECT count(*) AS 기록된_행수 FROM heartbeat;
```

**내가 아무 쿼리도 던지지 않는 동안 행이 늘었습니다.** 다른 프로세스가 INSERT 한 것입니다.

```sql
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```

정리해둡시다.

```sql
SELECT cron.unschedule('fast-tick');
```

---

## STEP 3 - 운영에서 알아야 할 것

```sql
SELECT name AS 설정, setting AS 값 FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;
SHOW cron.database_name;
```

| 항목 | 주의사항 |
|---|---|
| **중복 실행** | 이전 실행이 안 끝났는데 다음이 시작될 수 있습니다. 잡 자체에 락을 거세요 |
| **실패 알림** | `cron.job_run_details` 의 `status='failed'` 를 모니터링해야 합니다 |
| **이력 정리** | `job_run_details` 는 계속 쌓입니다. 지우는 잡을 따로 등록하세요 |
| **타임존** | cron 표현식은 **서버 타임존 기준**입니다. `TimeZone` 을 확인하세요 |
| **HA 환경** | 스탠바이로 페일오버하면 잡이 그쪽에서 돕니다. 중복 실행 주의 |
| **권한** | 잡은 **등록한 유저 권한**으로 실행됩니다. 최소 권한 유저로 등록하세요 |

실패 이력만 뽑는 쿼리는 그대로 모니터링에 쓸 수 있습니다.

```sql
SELECT jobid, status, return_message, start_time
FROM   cron.job_run_details WHERE status <> 'succeeded' ORDER BY start_time DESC LIMIT 10;
```

### 다른 선택지와 비교

| 방식 | 위치 | 장점 | 단점 |
|---|---|---|---|
| OS cron + psql | DB 밖 | 표준적, DB 재시작과 무관 | 서버가 여러 대면 중복 실행 관리 필요 |
| **pg_cron** | DB 안 | 스케줄이 DB 에 있어 **백업됨** | extension 설치 필요, HA 시 주의 |
| 애플리케이션 스케줄러 | 앱 | 앱 로직과 통합 쉬움 | 앱이 죽으면 안 돌음 |
| Airflow 등 | 외부 | 의존성/재시도/모니터링 강력 | 인프라 하나 더 |

### 같은 원리를 쓰는 다른 extension

| extension | 백그라운드로 하는 일 |
|---|---|
| `pg_cron` | 스케줄러 워커 |
| `TimescaleDB` | 압축 · 집계 · 보존 정책 수행 |
| `pg_partman` | 파티션 자동 생성 (`NO_BGW` 로 끌 수도 있음) |
| `pg_squeeze` | 테이블 bloat 을 백그라운드로 정리 |

**"이 extension 은 프로세스를 띄우나?"** 는 도입 검토 시 반드시 물어야 할 질문입니다. 프로세스가 하나 늘면 `max_worker_processes` 를 먹고, 커넥션·메모리·모니터링 대상이 하나 늘어납니다.

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | 스키마 + 테이블 + 함수 - 하지만 **핵심은 프로세스** |
| 진짜 동작 | `_PG_init()` → `RegisterBackgroundWorker()` → postmaster 가 `fork()` |
| 서버 설정 | **`shared_preload_libraries` + 재시작 필수** |
| 확인 방법 | `pg_stat_activity` 의 `backend_type` |
