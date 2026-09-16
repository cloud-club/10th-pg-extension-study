# Lab 01 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml`에서 `shared_preload_libraries=pg_cron`과 `cron.database_name=study`가 서버 기동 옵션에 포함됐는지 확인한다. 두 설정이 있어야 이 실습을 실행할 수 있다.

---

## 1. preload와 설치 DB 제약

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SHOW shared_preload_libraries;
SHOW cron.database_name;
```

pg_cron은 클러스터에서 `cron.database_name`이 가리키는 DB에 설치한다. 다른 DB에서 설치를 시도해 오류를 확인한다.

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

launcher는 checkpointer, autovacuum launcher와 마찬가지로 별도 프로세스다.

```sql
SELECT pid, backend_type, application_name
FROM   pg_stat_activity WHERE backend_type <> 'client backend';
```

---

## 2. `cron.job`의 RLS 정책

```sql
\d cron.job
SELECT polname, pg_get_expr(polqual, polrelid) AS 조건
FROM   pg_policy WHERE polrelid = 'cron.job'::regclass;
```

정책 조건은 `username = CURRENT_USER`다. 슈퍼유저나 `BYPASSRLS` 권한이 없으면 다른 사용자의 잡은 보이지 않는다.

```sql
SELECT extname, extconfig::regclass[] AS "pg_dump 대상 테이블"
FROM   pg_extension WHERE extname = 'pg_cron';
```

`pg_extension_config_dump()`에 등록된 예약 테이블은 `pg_dump`에 포함된다.

---

## 정리

| | |
|---|---|
| preload | `_PG_init()` 의 `RegisterBackgroundWorker()` 는 postmaster 시작 시점에만 가능 |
| 설치 제약 | 클러스터의 **한 DB**에 설치. 다른 DB 작업은 `cron.schedule_in_database()` 사용 |
| `cron.job` | RLS로 사용자의 예약만 표시하며 `pg_dump`에 포함 |

## 다음 단계

- [`../02-scheduling-and-syntax/HANDS-ON.md`](../02-scheduling-and-syntax/HANDS-ON.md)
- 카탈로그 문서: [`../../README.md`](../../README.md)

수동 절차를 처음부터 다시 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용한다.
