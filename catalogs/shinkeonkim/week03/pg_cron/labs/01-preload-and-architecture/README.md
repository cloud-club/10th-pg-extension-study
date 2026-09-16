# Lab 01 · preload와 pg_cron 구조

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- `_PG_init()`이 서버 시작 시 launcher를 등록하므로 `shared_preload_libraries=pg_cron`이 필요하다.
- 확장은 `cron.database_name`이 가리키는 DB에 설치한다. 다른 DB의 작업은 `cron.schedule_in_database()`로 예약한다.
- `pg_stat_activity`에서 `pg_cron launcher` 프로세스를 확인한다.
- `cron.job`의 RLS 정책과 `pg_dump` 포함 여부를 확인한다.

## 실습 설정

```conf
shared_preload_libraries = pg_cron
cron.database_name = study
cron.host = /var/run/postgresql
cron.max_running_jobs = 32
```

`initdb/01-create-otherdb.sql`은 설치 DB 제약을 확인할 `otherdb`를 만든다. 자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

다음 실습: [Lab 02 · 예약 문법](../02-scheduling-and-syntax/)
