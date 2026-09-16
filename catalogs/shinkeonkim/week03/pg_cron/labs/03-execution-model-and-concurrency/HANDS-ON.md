# Lab 03 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 기본 실행 모드의 프로세스 확인

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SHOW cron.use_background_workers;   -- off (기본값)
```

값이 `off`이면 launcher가 libpq로 로컬 서버에 연결한다. 실행 중인 잡은 `pg_stat_activity`에서 `client backend`로 표시된다.

```sql
SELECT cron.schedule('sleeper', '1 seconds', $$SELECT pg_sleep(3)$$);
SELECT pg_sleep(2.5);  -- 다음 틱 + 접속 시간 여유

SELECT pid, backend_type, application_name
FROM   pg_stat_activity WHERE application_name = 'pg_cron';
```

`backend_type = client backend`는 psql이나 애플리케이션 연결을 처리하는 프로세스와 같은 유형이다. `application_name = pg_cron`으로 pg_cron 연결을 구분한다.

```sql
SELECT cron.unschedule('sleeper');
```

worker 모드를 확인하려면 `docker-compose.yml`의 `command`에 `-c cron.use_background_workers=on`을 추가하고 `./run.sh down && ./run.sh up`을 실행한다. 같은 조회에서 실행 worker의 `backend_type`을 확인한다. 필요한 동시 실행 수만큼 `max_worker_processes` 여유가 있어야 한다.

---

## 2. `cron.max_running_jobs` 동시 실행 한도

```sql
SHOW cron.max_running_jobs;   -- 이 실습은 5, 기본값은 32

DO $$
BEGIN
  FOR i IN 1..8 LOOP
    PERFORM cron.schedule('load-' || i, '1 seconds', 'SELECT pg_sleep(3)');
  END LOOP;
END $$;

SELECT pg_sleep(2);
SELECT count(*) AS 동시_실행중인_pg_cron_백엔드
FROM   pg_stat_activity WHERE application_name = 'pg_cron';
```

잡 여덟 개를 등록해도 동시 실행 수는 `cron.max_running_jobs`의 값 5를 넘지 않는다. 한도를 지켰다는 사실만으로 모든 잡의 정상 진행을 보장할 수 없으므로 실행 이력도 확인한다.

---

등록한 부하 잡은 `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'load-%';`로 제거한다. worker 모드를 시험했다면 Compose 옵션도 원래 값으로 되돌린다.

## 정리

| | |
|---|---|
| 기본 실행 모드 | launcher가 libpq로 접속하고 client backend에서 실행 |
| worker 모드 | `cron.use_background_workers=on`. 동적 background worker를 사용하며 재시작 필요 |
| 동시 실행 한도 | `cron.max_running_jobs`. 실행 실패 여부는 이력에서 별도로 확인 |

## 다음 단계

- [`../04-monitoring-and-ops/HANDS-ON.md`](../04-monitoring-and-ops/HANDS-ON.md)
- 카탈로그 문서: [`../../README.md`](../../README.md)

수동 절차를 처음부터 다시 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용한다.
