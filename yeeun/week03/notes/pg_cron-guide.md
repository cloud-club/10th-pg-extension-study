# PostgreSQL 자동화 — `cron`과 `pg_cron` 완전 정리

> **주제:** PostgreSQL에서 반복 작업을 자동화하는 방법과 `pg_cron` Extension의 동작 구조
>
> **카테고리:** PostgreSQL Extension / Automation / Background Worker
>
> **핵심 키워드:** `cron`, `pg_cron`, `shared_preload_libraries`, Background Worker, `cron.schedule`, Job Scheduler
>
> **라이선스:** PostgreSQL License

---

# 1. 이번 주제에서 알아야 할 핵심

이번 주제의 핵심 질문은 다음과 같다.

> **“PostgreSQL에서 매일 또는 매시간 반복해서 실행해야 하는 SQL은 누가 실행해야 하는가?”**

예를 들어 다음과 같은 요구가 있다고 가정한다.

```sql
DELETE FROM access_logs
WHERE created_at < now() - interval '90 days';
```

한 번 실행하는 것은 어렵지 않다. 문제는 이것을 매일 새벽 3시, 10분마다, 매주 일요일, 매월 마지막 날처럼 **반복**하고 싶을 때이다.

PostgreSQL 자체에는 사용자가 임의의 SQL을 등록해서 특정 시각마다 실행하는 범용 스케줄러가 기본 제공되지 않는다. 선택지는 대략 다음과 같다.

| 방법 | 실행 주체 | 예시 |
| --- | --- | --- |
| Linux `cron` | 운영체제 | `psql` 명령 실행 |
| 애플리케이션 Scheduler | 애플리케이션 | Spring Scheduler, Celery Beat 등 |
| Cloud Scheduler | 인프라 | EventBridge, Cloud Scheduler |
| PostgreSQL Extension | PostgreSQL | **`pg_cron`** |

`pg_cron`은 이 중 마지막 방식이다. 즉 **PostgreSQL 내부에 cron 기반 Job Scheduler 기능을 추가하는 Extension**이다.

---

# 2. 먼저 cron이란 무엇인가?

cron은 Unix/Linux에서 쓰는 **시간 기반 작업 스케줄러**다. “몇 시에 어떤 명령을 실행할지 등록해 두는 시스템”이다.

```bash
0 3 * * * /home/app/backup.sh
```

DB 작업이라면:

```bash
0 3 * * * psql -d mydb -c "DELETE FROM logs WHERE created_at < now() - interval '90 days';"
```

구조는 OS cron → psql → PostgreSQL이다. **스케줄러가 PostgreSQL 외부에 존재한다.**

---

# 3. cron 표현식

```
┌───────────── 분
│ ┌───────────── 시
│ │ ┌───────────── 일
│ │ │ ┌───────────── 월
│ │ │ │ ┌───────────── 요일
* * * * *
```

`pg_cron`도 Vixie cron 계열 문법을 쓴다.

| 위치 | 의미 | 값 |
| --- | --- | --- |
| 1 | 분 | `0~59` |
| 2 | 시 | `0~23` |
| 3 | 일 | `1~31` |
| 4 | 월 | `1~12` |
| 5 | 요일 | `0~6` (일=0) |

예시:

| 표현 | 의미 |
| --- | --- |
| `0 3 * * *` | 매일 03:00 |
| `*/5 * * * *` | 5분마다 (0,5,10… 분) |
| `0 9 * * 1-5` | 평일 09:00 |
| `0 9,18 * * *` | 매일 09:00, 18:00 |

**일과 요일을 둘 다 제한하면** (예: `30 4 1 * 5`) Vixie cron에서는 둘 중 하나만 맞아도 실행되는 쪽에 가깝다. “1일이면서 금요일”이 아니다.

---

# 4–5. `pg_cron`은 무엇인가 / 왜 Extension인가

일반 cron:

```text
OS cron → psql → PostgreSQL
```

`pg_cron`:

```text
PostgreSQL
├─ pg_cron scheduler
├─ cron.job
├─ cron.job_run_details
└─ 실행할 SQL
```

Extension 설치 시 대략 다음이 생긴다.

```text
cron schema
├─ cron.job / cron.job_run_details
├─ cron.schedule() / cron.schedule_in_database()
├─ cron.unschedule() / cron.alter_job()
```

---

# 6–9. `CREATE EXTENSION`만으로 끝나지 않는 이유

```text
shared_preload_libraries = 'pg_cron'
```

이 설정에 넣은 라이브러리는 **서버 시작 시** 로드된다. Shared Memory / Background Worker 등록이 시작 시점에 필요하면 preload가 필요하다.

`pg_cron`은 “지금 실행할 Job이 있나?”를 계속 보는 **scheduler Background Worker**가 있다.

설치를 네 단계로 보면:

```text
① 서버에 pg_cron 프로그램(패키지) 설치
② shared_preload_libraries 등록
③ PostgreSQL 재시작
④ CREATE EXTENSION pg_cron
```

`CREATE EXTENSION`은 다운로드가 아니라 **이미 서버에 있는 Extension을 현재 DB에 활성화**하는 것이다.

이미 다른 모듈이 있으면 예:

```text
shared_preload_libraries = 'pg_stat_statements,pg_cron'
```

---

# 10. 전체 동작 흐름

```text
PostgreSQL 시작
  → shared_preload_libraries
  → pg_cron library load
  → scheduler Background Worker
  → cron.job 확인
  → 시각이 되면 Job 실행 (연결 또는 BG Worker)
  → SQL 실행
  → cron.job_run_details 기록
```

---

# 11–18. Job API 요약

```sql
SELECT * FROM cron.job;
```

| 컬럼 | 의미 |
| --- | --- |
| `jobid` | Job ID |
| `schedule` | cron 스케줄 |
| `command` | 실행 SQL |
| `database` / `username` | 실행 DB·사용자 |
| `active` | 활성화 |

기본 등록:

```sql
SELECT cron.schedule(
    'delete-old-logs',
    '0 3 * * *',
    $$DELETE FROM access_logs
      WHERE created_at < now() - interval '90 days'$$
);
```

이름 없는 Job / VACUUM 예, Procedure 호출 (`CALL cleanup_old_orders()`),  
초 단위(`'10 seconds'`), 월말(`$` → `'0 0 $ * *'`),  
`cron.alter_job`, `cron.unschedule(id|name)` 도 지원한다.

운영에서는 Job 이름을 명확히 두는 편이 낫다.

---

# 19. 여러 Database

`pg_cron` Extension은 **클러스터에서 보통 한 DB에만** 설치한다.  
기본 `cron.database_name`은 `postgres`인 경우가 많다.  
다른 DB 작업은 `cron.schedule_in_database(...)`로 지정한다.

---

# 20–22. Job은 어떻게 실행되나 / 동시성

기본: scheduler가 **새 로컬 연결(libpq)** 로 SQL 실행.  
`cron.use_background_workers = on`이면 Job도 Background Worker로 돌릴 수 있고, 이때 `max_worker_processes` 여유가 필요하다.

- 서로 다른 Job → 병렬 가능  
- **같은 Job** → 동시에 두 개 안 돌림. 이전 실행이 끝날 때까지 다음 실행 대기  
→ **실행 시간 < 주기**인지 확인

---

# 23–24. 실행 결과 · 이력 정리

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
```

`job_run_details`는 자동으로 永久 삭제되지 않으므로 주기적으로 지우는 Job을 두는 경우가 많다.

---

# 25–26. 주요 설정 · Timezone

| 설정 | 기본(대략) | 의미 |
| --- | --- | --- |
| `cron.database_name` | `postgres` | 메타데이터 DB |
| `cron.max_running_jobs` | `32` | 동시 실행 상한 |
| `cron.timezone` | `GMT` | 스케줄러 TZ |
| `cron.use_background_workers` | `off` | BG Worker 실행 |

```sql
SELECT name, setting FROM pg_settings WHERE name LIKE 'cron.%';
```

`0 3 * * *`이 한국 03:00이라고 단정하면 안 된다.  
OS TZ / 세션 TimeZone / `cron.timezone`을 구분해서 문서화한다.  
이 lab은 `cron.timezone=Asia/Seoul`로 맞춰 두었다.

---

# 27–29. 권한

Job은 보통 **등록한 사용자 권한**으로 실행된다.  
`cron.job`에는 RLS가 있어 일반 사용자는 자기 Job 위주로 본다.  
`GRANT USAGE ON SCHEMA cron`은 강력하므로 최소 권한으로 준다.

---

# 30. RDS 등 Managed

OS에 `apt install` 하는 식이 아니라:

```text
Parameter Group에 shared_preload_libraries = pg_cron
→ 인스턴스 재시작
→ CREATE EXTENSION pg_cron
```

Provider 지원 목록·버전을 먼저 확인한다.

---

# 31. preload vs CREATE EXTENSION

> **preload는 pg_cron 엔진을 서버에 띄우는 작업이고, `CREATE EXTENSION`은 그 엔진을 SQL에서 쓰도록 DB 객체를 만드는 작업이다.**

---

# 32–33. week02 · `pg_partman` 연결

```text
pg_stat_statements → 무거운 SQL / 진단
pg_cron            → 새벽 maintenance SQL
pg_partman         → 파티션 정책
pg_cron            → run_maintenance_proc() 주기 호출
```

```text
pg_partman = 무엇을 관리할지
pg_cron    = 언제 실행할지
```

---

# 34–37. OS cron과 비교 · 어디에 쓰나

| | OS cron | `pg_cron` |
| --- | --- | --- |
| 위치 | OS | PostgreSQL |
| SQL | psql 필요 | SQL로 등록 |
| 기록 | OS 로그 | `job_run_details` |
| Shell / 외부 API | 가능 | 부적합 |

잘 맞는 것: 오래된 데이터 삭제, MV refresh, 집계, partition maintenance, DB 내부 정리.  
앱/외부 쪽이 나은 것: 메일, 외부 API, S3, 복잡한 워크플로.

모든 배치를 DB에 몰면 CPU/IO/커넥션/락을 API와 싸우게 된다.  
**DB 안에서 끝나는 짧고 명확한 작업**에 특히 맞다.

---

# 38. 운영 주의

- Lock: 자동 실행 ≠ 안전한 SQL  
- 실행 시간 > 주기 → 대기 적체  
- Idempotency: 여러 번 돌아도 안전한지  
- 실패 시 트랜잭션 경계  
- `cron.job` / `job_run_details` 모니터링  

---

# 39. 간단 실습 (요약)

이 저장소 lab이 같은 흐름이다. (`yeeun/week03/lab`, `HANDS-ON.md`)

```text
설치·preload 확인
→ cron_test 테이블
→ cron.schedule (초 단위)
→ cron.job / cron_test / job_run_details
→ unschedule
```

---

# 40–41. 한 문장 · 네 가지 구분

**쉬운 설명:** PostgreSQL 안에서 SQL/Procedure를 정해진 시간마다 자동 실행하는 Job Scheduler Extension.

**구분:**

1. cron — 시간 표현 / 스케줄러 개념  
2. pg_cron — PostgreSQL용 Extension  
3. shared_preload_libraries — 서버 기동 시 라이브러리 로드  
4. Background Worker — 서버 안에서 계속 도는 프로세스  

---

# 42–44. 정리 · week 연결 · 기억할 것

```text
범용 SQL Scheduler 없음
  → pg_cron
  → preload + 재시작
  → CREATE EXTENSION
  → cron.job / schedule
  → Worker가 실행
  → job_run_details
```

학습 흐름:

```text
Week02 진단 (pg_stat_statements)
  → Week03 자동화 (pg_cron)
  → pg_partman + pg_cron
  → (필요 시) pg_repack
```

기억할 것:

1. cron = 시간 기반 스케줄러  
2. pg_cron = DB 안 Scheduler Extension  
3. Background Worker → preload 중요  
4. preload ≠ CREATE EXTENSION  
5. 메타는 `cron.job`, 이력은 `job_run_details`  
6. 같은 Job은 동시 실행되지 않음  
7. 다른 Extension maintenance 자동화에도 쓸 수 있음  

---

## 공식 참고

- https://github.com/citusdata/pg_cron  
- PostgreSQL CREATE EXTENSION / Background Worker 문서  
- AWS RDS `pg_cron` 문서  
- AWS `pg_partman` + `pg_cron` 예제  
