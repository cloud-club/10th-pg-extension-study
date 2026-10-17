# lab — `pg_cron` Docker 실습

로컬 Docker로 `pg_cron` preload + Job 등록·실행·이력을 확인한다.

## Extension 공부와의 연결

| 스크립트 | 하는 일 | 왜 |
| --- | --- | --- |
| `01-setup.sql` | preload 확인, `CREATE EXTENSION`, 테스트 테이블 | 엔진(preload) vs SQL 객체(`CREATE EXTENSION`) |
| `02-schedule.sql` | `cron.schedule` + 5초 Job + 대기 | 스케줄러 Worker가 SQL을 실행하는지 |
| `03-verify.sql` | `job_run_details` · `unschedule` | 이력·정리가 DB 데이터로 남는지 |

week02 `pg_stat_statements` lab과 같이 **preload가 compose에 박혀 있다.**  
차이는 cron 패키지(`postgresql-16-cron`)와 `cron.database_name`이다.

## 명령

```bash
cd yeeun/week03/lab
./run.sh
./run.sh psql
./run.sh down
```

접속: `localhost:15503` / `study` / `postgres` / `postgres`

손으로 따라가기: [HANDS-ON.md](../HANDS-ON.md)
