# Lab 04 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 같은 잡의 직렬 실행 확인

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('overlap-test', '1 seconds', $$SELECT pg_sleep(3)$$);
SELECT pg_sleep(8);

SELECT runid, status, start_time, end_time,
       start_time - lag(end_time) OVER (ORDER BY runid) AS 이전실행_끝난뒤_간격
FROM   cron.job_run_details
WHERE  jobid = (SELECT jobid FROM cron.job WHERE jobname = 'overlap-test')
ORDER  BY runid;
```

`start_time` 간격은 예약 주기 1초가 아니라 실행 시간인 약 3초로 나타난다. 이전 회차가 끝날 때까지 다음 회차가 기다리기 때문이다.

```sql
SELECT cron.unschedule('overlap-test');
```

---

## 2. 실행 사용자와 잡 이름의 범위 확인

```sql
CREATE ROLE demo_limited_user LOGIN;
GRANT USAGE ON SCHEMA cron TO demo_limited_user;

SET SESSION AUTHORIZATION demo_limited_user;
SELECT cron.schedule('limited-job', '1 seconds', $$SELECT current_user$$);
SELECT username FROM cron.job WHERE jobname = 'limited-job';
```

잡 이름은 사용자별로 구분된다. 현재 세션은 `demo_limited_user`이므로 이 사용자가 등록한 잡을 이름으로 삭제할 수 있다.

```sql
SELECT cron.unschedule('limited-job');   -- 성공 (본인 것)
RESET SESSION AUTHORIZATION;
```

같은 이름의 잡을 제한된 사용자로 다시 등록한 뒤 슈퍼유저 세션에서 이름으로 삭제하면 실패한다.

```sql
SET SESSION AUTHORIZATION demo_limited_user;
SELECT cron.schedule('limited-job-2', '1 seconds', $$SELECT current_user$$);
RESET SESSION AUTHORIZATION;

SELECT cron.unschedule('limited-job-2');   -- postgres 사용자에게 같은 이름의 잡이 없어 실패
```
```
ERROR:  could not find valid entry for job "limited-job-2"
```

```sql
SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname='limited-job-2' AND username='demo_limited_user';
DROP OWNED BY demo_limited_user;
DROP ROLE demo_limited_user;
```

---

## 3. `job_run_details` 정리와 운영 설정 확인

```sql
SELECT cron.schedule('cleanup-old-runs', '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);
```

`job_run_details`는 자동으로 정리되지 않는다. 필요한 보존 기간에 맞춰 정리 예약을 구성한다.

```sql
SELECT name, setting, short_desc FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;
```

---

실습을 마치면 `SELECT cron.unschedule('cleanup-old-runs');`로 정리 예약을 제거한다.

## 정리

| | |
|---|---|
| 겹치는 실행 | 동시 실행이 아니라 직렬화 |
| 권한 | 등록한 사용자 권한으로 실행 |
| 잡 이름 | `(jobname, username)` UNIQUE. 이름으로 다른 사용자의 잡을 삭제할 수 없음 |
| 운영 | `job_run_details` 는 직접 청소, `status='failed'` 모니터링 필수 |

## 다음 단계

- 카탈로그 문서: [`../../README.md`](../../README.md)
- 상세 설명: 웹 `#/pg-cron/failures`, `#/pg-cron/operations`, `#/pg-cron/source`
- 실무 백엔드 연동 예시: [`../05-fastapi-job-scheduler-api/`](../05-fastapi-job-scheduler-api)

수동 절차를 처음부터 다시 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용한다.
