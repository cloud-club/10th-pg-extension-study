# pg_cron lab 03 - 직접 해보기

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 잡은 실제로 "어떻게" 실행되나

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SHOW cron.use_background_workers;   -- off (기본값)
```

off 면, launcher 는 libpq 로 로컬 서버에 "별도 연결"해서 잡을 돌립니다. 그래서 실행 중인 잡은 `pg_stat_activity` 에 평범한 client backend 로 보입니다.

```sql
SELECT cron.schedule('sleeper', '1 seconds', $$SELECT pg_sleep(3)$$);
SELECT pg_sleep(2.5);  -- 다음 틱 + 접속 시간 여유

SELECT pid, backend_type, application_name
FROM   pg_stat_activity WHERE application_name = 'pg_cron';
```

`backend_type = client backend` - pg_cron 이 만든 별도 프로세스 종류가 아니라, 우리가 psql 로 접속한 것과 똑같은 방식의 연결입니다. `application_name = pg_cron` 으로만 구분됩니다.

```sql
SELECT cron.unschedule('sleeper');
```

**직접 실험해볼 것**: `docker-compose.yml` 의 `command` 에 `-c cron.use_background_workers=on` 을 추가하고 `./run.sh down && ./run.sh up`. 위 실험을 다시 해보면 `backend_type` 이 더 이상 평범한 `client backend` 가 아닙니다 (`max_worker_processes` 를 늘려야 할 수도 있습니다).

---

## STEP 2 - 동시 실행 개수 제한: `cron.max_running_jobs`

```sql
SHOW cron.max_running_jobs;   -- 5 (이 lab 이 낮춰둠, 기본값 32)

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

8개를 걸었지만 동시에 도는 건 `cron.max_running_jobs`(5)를 넘지 않습니다. 동시 실행 상한과 정상 진행은 별개입니다. 1.6.8의 일부 포화 조건에서는 startup timeout도 관찰했으므로 이력까지 확인합니다.

---

등록한 부하 잡은 `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'load-%';`로 제거합니다. worker 모드를 시험했다면 Compose 옵션도 원복합니다.

## 정리

| | |
|---|---|
| 기본 실행 모드 | launcher 가 libpq 로 접속(client backend) |
| 대안 모드 | `cron.use_background_workers=on` - 동적 background worker (재시작 필요) |
| 동시성 상한 | `cron.max_running_jobs` - 상한과 실행 실패 여부를 별도로 관찰 |

## 다음 단계

- [`../04-monitoring-and-ops/HANDS-ON.md`](../04-monitoring-and-ops/HANDS-ON.md)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
