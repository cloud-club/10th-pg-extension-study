# Lab 09 - (f) Background Worker 를 띄우는 Extension

```bash
./run.sh          # 약 20초 (스케줄이 실제로 도는 것을 5초 기다립니다)
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


**extension 이 프로세스를 갖는** 부류입니다. 내 세션과 무관하게 계속 돌고, 아무도 접속하지 않아도 일합니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-a-real-process.sql` | `pg_stat_activity` 에서 워커 프로세스 확인 |
| `02-scheduling.sql` | 잡 등록 → **실제로 실행되는 것을 확인** |
| `03-operations.sql` | 운영 체크리스트 · 다른 스케줄러와 비교 |

## 프로세스로 보입니다

```
 pid |         프로세스종류         | application_name
-----+------------------------------+-------------------
  70 | checkpointer                 |
  74 | autovacuum launcher          |
  75 | pg_cron launcher             | pg_cron scheduler   ← 이것
```

checkpointer, autovacuum launcher 와 **같은 지위**입니다. `_PG_init()` 에서 `RegisterBackgroundWorker()` 를 호출하는데, postmaster 는 시작할 때 워커 목록을 확정하고 fork 합니다. → `shared_preload_libraries` 필수.

## 실제로 도는 것을 확인합니다

```sql
SELECT cron.schedule('fast-tick', '1 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$);
SELECT pg_sleep(5);
SELECT count(*) FROM heartbeat;   -- 4
```

우리 세션은 `pg_sleep` 으로 자고 있었는데 행이 늘어났습니다. 백그라운드 워커가 독립적으로 실행한 것입니다.

## 운영 체크리스트 (`03-operations.sql`)

| 항목 | 주의사항 |
|---|---|
| 중복 실행 | 이전 실행이 안 끝났는데 다음이 시작될 수 있음. 잡 자체에 락을 |
| 실패 알림 | `cron.job_run_details` 의 `status='failed'` 를 모니터링해야 함 |
| 이력 정리 | `job_run_details` 는 계속 쌓임. 삭제하는 잡을 따로 |
| HA | 페일오버하면 스탠바이에서 잡이 돈다. 중복 실행 주의 |

**대안 비교**(OS cron / pg_cron / 앱 스케줄러 / Airflow)도 표로 정리되어 있습니다. "DB 안에서 끝나는 단순 주기 작업"에는 pg_cron 이 잘 맞지만, 복잡한 의존성·재시도가 필요하면 전용 스케줄러를 쓰세요.

## 같은 부류

pg_cron · TimescaleDB(압축/집계 정책) · pg_partman(BGW 모드) · pg_squeeze
