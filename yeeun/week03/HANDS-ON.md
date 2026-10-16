# 같이 해보기 — `pg_cron`

| | |
| --- | --- |
| 시간 | 15~20분 |
| 필요 | Docker Desktop |
| 목표 | preload → Extension → schedule → 실행 → 이력 확인 |

```bash
cd yeeun/week03/lab
./run.sh up
./run.sh psql
```

> SQL 문법 연습이 아니라,  
> **`pg_cron` Extension이 서버 안에 스케줄러를 띄운 뒤 SQL Job을 돌린다**는 흐름을 보는 실습이다.

자동 실행: 호스트에서 `./run.sh` (01→02→03, 02에서 약 12초 대기 포함).

---

## STEP 0 — preload가 먼저인 이유

`pg_cron`은 계속 “지금 돌릴 Job 있나?”를 보는 **Background Worker**가 필요하다.  
그래서 week02 `pg_stat_statements`처럼 `shared_preload_libraries` + 재시작이 필요하다.

```sql
SHOW shared_preload_libraries;
-- 기대: pg_cron

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';

SELECT name, setting FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;
```

- **preload** = 스케줄러 엔진을 서버에 올림  
- **`CREATE EXTENSION`** = `cron` 스키마·함수·테이블을 DB에 만듦  

둘은 다른 층이다. (자세한 설명: [notes/pg_cron-guide.md](notes/pg_cron-guide.md))

---

## STEP 1 — Job 등록

```sql
DROP TABLE IF EXISTS cron_test;
CREATE TABLE cron_test (
    id bigserial PRIMARY KEY,
    note text NOT NULL DEFAULT 'tick',
    created_at timestamptz NOT NULL DEFAULT now()
);

SELECT cron.schedule(
    'insert-cron-test',
    '5 seconds',
    $$INSERT INTO cron_test(note) VALUES ('from pg_cron')$$
);

SELECT jobid, jobname, schedule, command, active
FROM cron.job;
```

`5 seconds`는 pg_cron이 지원하는 **초 단위** 표현이다.  
일반 `* * * * *`(매분)과 섞어 쓰지 않는다.

약 10~15초 기다린 뒤:

```sql
SELECT * FROM cron_test ORDER BY id;
```

행이 늘어나면 스케줄러가 SQL을 실행한 것이다.

---

## STEP 2 — 실행 이력 · 제거

```sql
SELECT
    j.jobname,
    d.status,
    d.return_message,
    d.start_time,
    d.end_time
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname = 'insert-cron-test'
ORDER BY d.start_time DESC;

SELECT cron.unschedule('insert-cron-test');
```

OS cron과 달리 **스케줄·이력이 DB 테이블**에 남는다.

---

## 실습이 끝나면

1. [catalogs/pg_cron.md](catalogs/pg_cron.md) 와 맞춰 보기  
2. 전체 개념은 [notes/pg_cron-guide.md](notes/pg_cron-guide.md)  
3. week02와의 연결: 진단(`pg_stat_statements`) → 자동화(`pg_cron`)

```text
schedule 등록
    → Background Worker 감지
    → SQL 실행
    → job_run_details 기록
```
