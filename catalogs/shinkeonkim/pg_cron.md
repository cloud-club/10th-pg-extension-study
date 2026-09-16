# pg_cron

> PostgreSQL 서버에서 정해진 시각에 SQL을 실행하는 작업 스케줄러다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 자동화 · 스케줄러 |
| 검증 환경 | PostgreSQL 16.15 · pg_cron 1.6.8 |
| 라이선스 | PostgreSQL License |
| 저장소 | [citusdata/pg_cron](https://github.com/citusdata/pg_cron) |
| 정리한 사람 | shinkeonkim |
| 회차 | week03 |

---

## 1. 용도

OS cron이나 애플리케이션 타이머를 두지 않고 다음과 같은 SQL을 반복 실행할 때 사용한다.

- 구체화 뷰 갱신
- 만료 데이터의 소량 삭제
- 집계 테이블 갱신
- `ANALYZE`와 파티션 유지보수
- DB 테이블에 저장된 작업의 배치 처리

예약은 `cron.job`, 실행 이력은 `cron.job_run_details`에 저장된다. 앱이나 psql이 종료되어도 PostgreSQL 서버가 실행 중이면 예약은 계속 동작한다.

```sql
SELECT cron.schedule(
  'daily-analyze',
  '0 3 * * *',
  'ANALYZE public.events'
);
```

복잡한 작업 순서, 자동 재시도와 백오프, 사람의 승인, DB 중단 중 실행이 필요하면 작업 큐나 외부 스케줄러를 사용한다.

## 2. 설치와 실행 확인

서버에 pg_cron 패키지를 설치하고 다음 설정을 적용한 뒤 PostgreSQL을 재시작한다. 기존 `shared_preload_libraries` 항목이 있으면 쉼표로 함께 적는다.

```conf
shared_preload_libraries = 'pg_cron'
cron.database_name = 'study'
cron.timezone = 'Asia/Seoul'
```

`study` DB에서 다음 SQL을 자동 커밋 상태로 순서대로 실행한다.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE public.catalog_cron_heartbeat (
  tick timestamptz NOT NULL DEFAULT clock_timestamp()
);

SELECT cron.schedule(
  'catalog-heartbeat',
  '2 seconds',
  'INSERT INTO public.catalog_cron_heartbeat DEFAULT VALUES'
);

SELECT pg_sleep(5);
SELECT count(*) AS ticks FROM public.catalog_cron_heartbeat;

SELECT r.runid, r.status, r.return_message
FROM cron.job_run_details AS r
JOIN cron.job AS j USING (jobid)
WHERE j.jobname = 'catalog-heartbeat'
ORDER BY r.runid DESC
LIMIT 5;

SELECT cron.unschedule('catalog-heartbeat');
DROP TABLE public.catalog_cron_heartbeat;
```

기본 실행 모드는 잡마다 로컬 DB 연결을 새로 만든다. 서버의 `pg_hba.conf`와 인증 수단이 이 연결을 허용해야 한다. `cron.use_background_workers=on`을 사용하면 연결 대신 background worker를 시작하며, 이때는 `max_worker_processes`의 여유가 필요하다.

## 3. 제약

| 항목 | 내용 |
| --- | --- |
| 실패 처리 | 실패 이력은 남지만 자동 재시도 정책은 없다. 다음 정규 실행은 실패 회차의 재시도가 아니다. |
| 서버 중단 | PostgreSQL이 중단된 동안의 예약은 실행되지 않으며 재시작 후 보충하지 않는다. |
| 동시 실행 | 같은 jobid는 직렬로 실행한다. 서로 다른 jobid는 동시에 실행될 수 있다. |
| 자원 사용 | 업무 쿼리와 CPU, I/O, 잠금, 연결 또는 worker 슬롯을 공유한다. |
| 분산 환경 | 독립된 primary 사이의 리더 선출이나 전역 단일 실행을 제공하지 않는다. |
| 이력 보존 | `cron.job_run_details`의 보존 기간과 실패 알림을 운영자가 구성한다. |

업무 SQL은 중복 실행에 안전하게 작성한다. 필요하면 UNIQUE 제약, 처리 상태, advisory lock과 업무 ID를 사용한다.

## 4. 관리형 PostgreSQL 지원

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS / Aurora PostgreSQL | ○ | 파라미터 그룹 설정과 재부팅 필요 |
| Azure Database for PostgreSQL | ○ | 서비스의 허용 확장과 서버 파라미터 확인 |
| Google Cloud SQL | ○ · 제약 있음 | background worker 모드만 지원 |
| Supabase / Neon | ○ | 서비스가 제공하는 확장 활성화 절차 사용 |
| Heroku Postgres | ✕ | pg_cron 공식 지원 표에서 미지원 |
| Lakebase | ✕ | pg_cron 공식 지원 표에서 미지원 |

지원 현황은 2026-09-16에 확인했다. 최신 정보는 [pg_cron Managed services 표](https://github.com/citusdata/pg_cron#managed-services)와 각 서비스 문서를 확인한다. 관리형 서비스에서는 `postgresql.conf`를 직접 수정하지 않고 서비스의 파라미터나 대시보드를 사용한다.

## 5. 동작 방식

서버 시작 시 `_PG_init()`이 pg_cron launcher를 background worker로 등록한다. launcher는 `cron.database_name`의 예약을 읽고 실행 시각을 계산한다.

- 기본 모드: launcher가 libpq로 로컬 DB에 접속하고 client backend가 SQL을 실행한다.
- worker 모드: launcher가 동적 background worker를 요청하고 해당 worker가 SQL을 실행한다.

두 모드 모두 한 회차를 별도 PostgreSQL 프로세스에서 실행한다. 실행 경로, 인증 방식과 자원 한도가 다르다.

## 6. 실험 결과

PostgreSQL 16.15와 pg_cron 1.6.8 환경에서 각 조건을 10회 반복했다.

| 조건 | 결과 |
| --- | --- |
| 1초 간격, 실행 시간 2초, jobid 1개 | 같은 jobid의 실행은 겹치지 않음 |
| jobid 4개, 동시 실행 한도 4 | 최대 4개가 동시에 실행됨 |
| jobid 4개, 동시 실행 한도 2 | 실행 정체와 `job startup timeout`을 관찰했으며 원인은 확정하지 않음 |
| `SKIP LOCKED` 소비자 2개, 항목 40개 | 10회 모두 각 항목을 한 번씩 커밋 |
| INSERT 후 강제 오류 | 10회 모두 오류 전 INSERT가 롤백됨 |

실행 이력의 `end_time - start_time`은 연결이나 worker 시작 전 구간을 포함하지 않으므로 두 모드의 전체 비용 비교에 사용할 수 없다.

## 자료

- 웹 학습 자료: `web/#/pg-cron/about`
- [Docker 실습](week03/pg_cron/labs/README.md)
- [반복 실험](week03/pg_cron/experiments/README.md)
- [pg_cron v1.6.8 소스](https://github.com/citusdata/pg_cron/tree/v1.6.8)
