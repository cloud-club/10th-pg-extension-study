# Lab 02 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 초 간격과 매월 마지막 날 예약

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
DROP TABLE IF EXISTS heartbeat;
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());

SELECT cron.schedule('fast-tick', '2 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$);
SELECT cron.schedule('end-of-month', '0 12 $ * *', $$SELECT 'payroll'$$);  -- $ = 매월 마지막 날 (1.6+)
```

---

## 2. 이름 없는 예약과 함수 인자 확인

```sql
SELECT cron.schedule('SELECT pg_catalog.now()');  -- 1인자 함수가 없어 오류 발생
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

이름을 지정하지 않으면 `jobname`은 `NULL`이다.

---

## 3. 다른 데이터베이스의 SQL 예약

```sql
SELECT cron.schedule_in_database(
         'otherdb-heartbeat', '3 seconds', $$SELECT pg_catalog.now()$$, 'otherdb'
       );

SELECT pg_sleep(5);
SELECT count(*) FROM heartbeat;   -- fast-tick이 추가한 행 확인
```

```sql
SELECT jobid, database, status, left(command, 25) AS 명령
FROM   cron.job_run_details WHERE database IN ('study', 'otherdb') ORDER BY runid DESC LIMIT 8;
```

`cron.job`은 `study`에만 있지만 `otherdb`에서 실행한 회차도 이력에 남는다.

---

## 4. `cron.alter_job()`으로 예약 수정

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
| 함수 형식 | `(schedule, command)` 또는 `(job_name, schedule, command)`. 1인자 함수는 없음 |
| 다른 DB | `cron.schedule_in_database()`를 사용해도 예약은 관리 DB의 `cron.job`에 저장 |
| 수정 | `cron.alter_job()`을 사용하므로 삭제 후 재등록할 필요 없음 |

## 다음 단계

- [`../03-execution-model-and-concurrency/HANDS-ON.md`](../03-execution-model-and-concurrency/HANDS-ON.md)
- 카탈로그 문서: [`../../README.md`](../../README.md)

수동 절차를 처음부터 다시 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용한다.
