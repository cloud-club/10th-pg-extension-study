# pg_cron lab 01 - 직접 해보기

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 을 먼저 열어보세요. `shared_preload_libraries=pg_cron` 과 `cron.database_name=study` 가 서버 기동 옵션으로 들어가 있습니다. **이게 없으면 이 lab 전체가 성립하지 않습니다.**

---

## STEP 1 - preload 필수 · "한 DB 에만 설치" 제약

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SHOW shared_preload_libraries;
SHOW cron.database_name;
```

**pg_cron 은 클러스터 전체에서 `cron.database_name` 이 가리키는 DB 에만 설치할 수 있습니다.** 다른 DB 에서 시도하면 어떻게 되는지 직접 보세요.

```sql
\c otherdb
CREATE EXTENSION pg_cron;
```
```
ERROR:  can only create extension in database study
```

```sql
\c study
```

launcher 는 checkpointer, autovacuum launcher 와 같은 지위의 **별도 프로세스**입니다.

```sql
SELECT pid, backend_type, application_name
FROM   pg_stat_activity WHERE backend_type <> 'client backend';
```

---

## STEP 2 - `cron.job` 은 RLS 가 걸린 평범한 테이블

```sql
\d cron.job
SELECT polname, pg_get_expr(polqual, polrelid) AS 조건
FROM   pg_policy WHERE polrelid = 'cron.job'::regclass;
```

`username = CURRENT_USER` 조건입니다 - 슈퍼유저나 `BYPASSRLS` 가 없으면 남의 잡은 안 보입니다.

```sql
SELECT extname, extconfig::regclass[] AS "pg_dump 대상 테이블"
FROM   pg_extension WHERE extname = 'pg_cron';
```

`pg_extension_config_dump()` 로 등록된 테이블 - 스케줄은 "사용자 데이터"라서 `pg_dump` 로 함께 백업됩니다.

---

## 정리

| | |
|---|---|
| preload | `_PG_init()` 의 `RegisterBackgroundWorker()` 는 postmaster 시작 시점에만 가능 |
| 설치 제약 | 클러스터에 **한 DB** 에만 설치 - 다른 DB 는 `cron.schedule_in_database()` (다음 lab) |
| `cron.job` | RLS 로 "내 잡만" 보이는 평범한 테이블, `pg_dump` 대상 |

## 다음 단계

- [`../02-scheduling-and-syntax/HANDS-ON.md`](../02-scheduling-and-syntax/HANDS-ON.md)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
