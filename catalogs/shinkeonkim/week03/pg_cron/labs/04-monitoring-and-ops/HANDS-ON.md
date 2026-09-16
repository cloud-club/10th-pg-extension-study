# pg_cron lab 04 - 직접 해보기

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 같은 잡이 겹치면? 직렬화된다

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

`start_time` 간격이 "1초"가 아니라 실행 시간(3초)만큼 벌어집니다 - 한 잡의 이전 실행이 안 끝났으면 다음 트리거는 대기했다가 그 직후 시작합니다.

```sql
SELECT cron.unschedule('overlap-test');
```

---

## STEP 2 - 잡은 등록한 사용자의 권한으로 실행된다

```sql
CREATE ROLE demo_limited_user LOGIN;
GRANT USAGE ON SCHEMA cron TO demo_limited_user;

SET SESSION AUTHORIZATION demo_limited_user;
SELECT cron.schedule('limited-job', '1 seconds', $$SELECT current_user$$);
SELECT username FROM cron.job WHERE jobname = 'limited-job';
```

**잡 이름은 사용자별로 유효범위가 나뉩니다** - 아직 `demo_limited_user` 세션이니 자기 것은 지울 수 있습니다.

```sql
SELECT cron.unschedule('limited-job');   -- 성공 (본인 것)
RESET SESSION AUTHORIZATION;
```

슈퍼유저로 같은 이름을 지우려 하면 실패합니다 (이미 지워졌으니 다시 등록해서 시도해보세요):

```sql
SET SESSION AUTHORIZATION demo_limited_user;
SELECT cron.schedule('limited-job-2', '1 seconds', $$SELECT current_user$$);
RESET SESSION AUTHORIZATION;

SELECT cron.unschedule('limited-job-2');   -- postgres 로 실행 - 실패한다
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

## STEP 3 - `job_run_details` 청소와 운영 체크리스트

```sql
SELECT cron.schedule('cleanup-old-runs', '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);
```

`job_run_details` 는 자동으로 정리되지 않으므로, 스스로를 청소하는 잡을 등록하는 것이 일반적입니다.

```sql
SELECT name, setting, short_desc FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;
```

---

실습 종료 시 `SELECT cron.unschedule('cleanup-old-runs');`로 정리 예약도 제거합니다.

## 정리

| | |
|---|---|
| 겹치는 실행 | 동시 실행이 아니라 직렬화 |
| 권한 | 등록한 사용자 권한으로 실행 |
| 잡 이름 | `(jobname, username)` UNIQUE - 이름으로는 남의 잡을 못 지운다 |
| 운영 | `job_run_details` 는 직접 청소, `status='failed'` 모니터링 필수 |

## 다음 단계

- 이 5개 lab 을 종합한 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 설명: 웹 `#/pg-cron/failures`, `#/pg-cron/operations`, `#/pg-cron/source`
- 실무 백엔드 연동 예시: [`../05-fastapi-job-scheduler-api/`](../05-fastapi-job-scheduler-api)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.
