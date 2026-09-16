# pg_cron lab 02 - 직접 해보기

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - cron 문법: 초 단위, 매월 마지막 날

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
DROP TABLE IF EXISTS heartbeat;
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());

SELECT cron.schedule('fast-tick', '2 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$);
SELECT cron.schedule('end-of-month', '0 12 $ * *', $$SELECT 'payroll'$$);  -- $ = 매월 마지막 날 (1.6+)
```

---

## STEP 2 - 이름 없이 등록하기 (그리고 없는 오버로드 확인)

```sql
SELECT cron.schedule('SELECT pg_catalog.now()');  -- 1개 인자 - 에러가 난다
```
```
ERROR:  function cron.schedule(unknown) does not exist
```

```sql
SELECT cron.schedule('* * * * *', $$SELECT pg_catalog.now()$$);  -- 2개 인자가 맞는 시그니처
```

```sql
SELECT jobid, jobname AS 이름, schedule, database AS DB, active
FROM   cron.job ORDER BY jobid;
```

이름을 안 주면 `jobname` 이 `NULL` 입니다.

---

## STEP 3 - 다른 데이터베이스에 스케줄링

```sql
SELECT cron.schedule_in_database(
         'otherdb-heartbeat', '3 seconds', $$SELECT pg_catalog.now()$$, 'otherdb'
       );

SELECT pg_sleep(5);
SELECT count(*) FROM heartbeat;   -- fast-tick 이 백그라운드에서 실제로 늘려놨다
```

```sql
SELECT jobid, database, status, left(command, 25) AS 명령
FROM   cron.job_run_details WHERE database IN ('study', 'otherdb') ORDER BY runid DESC LIMIT 8;
```

`cron.job` 자체는 `study` 에만 있지만, 실행 기록에는 `otherdb` 잡도 함께 남습니다.

---

## STEP 4 - 잡 수정: `cron.alter_job()`

```sql
SELECT jobid FROM cron.job WHERE jobname = 'fast-tick' \gset target_
SELECT cron.alter_job(:target_jobid, schedule := '*/2 * * * *');
SELECT cron.alter_job(:target_jobid, active := false);   -- 지우지 않고 잠시 꺼두기

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobid = :target_jobid;
```

---

## 정리

| | |
|---|---|
| 문법 | 표준 5필드 + `[1-59] seconds`(1.5+) + `$`(매월 마지막 날, 1.6+) |
| 시그니처 | `(schedule, command)` 또는 `(job_name, schedule, command)` - 1인자 오버로드는 없다 |
| 다른 DB | `cron.schedule_in_database()` - `cron.job` 은 여전히 한 곳에만 있다 |
| 수정 | `cron.alter_job()` - unschedule 후 재등록할 필요 없음 |

## 다음 단계

- [`../03-execution-model-and-concurrency/HANDS-ON.md`](../03-execution-model-and-concurrency/HANDS-ON.md)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
