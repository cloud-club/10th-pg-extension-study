# pg_cron

> PostgreSQL 안에 SQL 실행 일정을 저장하고, 별도의 연결이나 worker에서 주기적으로 실행한다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 자동화 · 스케줄러 |
| 버전 | 검증 환경: PostgreSQL 16.15 / pg_cron 1.6.8, SQL 확장 버전 1.6 |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [공식 저장소·README](https://github.com/citusdata/pg_cron/tree/v1.6.8) |
| 정리한 사람 | shinkeonkim |
| 회차 | week03 |

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

OS cron이나 별도 배치 서버가 접속 정보와 실행 일정을 관리한다. DB 이전 시 배치 설정도 옮겨야 하며, 여러 실행 주체가 있으면 중복 실행을 조정해야 한다.

```cron
# OS crontab 예시: DB·접속 사용자·테이블은 실제 환경에 맞게 지정
0 3 * * * psql -d study -c 'ANALYZE public.events'
```

**After**

```sql
-- pg_cron 설치와 public.events 테이블 준비 후 등록하는 예시
SELECT cron.schedule('daily-analyze', '0 3 * * *',
  'ANALYZE public.events');
```

예약은 `cron.job`, 실행 이력은 `cron.job_run_details`에서 조회한다. 등록을 커밋한 뒤 psql을 닫아도 예약은 유지된다. PostgreSQL 서버가 중단되면 pg_cron도 멈추며, 중단 중 지난 예약 회차는 재시작 뒤 자동 실행되지 않는다. 근거와 보충 설계는 웹의 `#/pg-cron/downtime`에서 설명한다.

## 2. 설치 & 데모

서버에 pg_cron 패키지를 설치하고 아래 설정을 반영한 뒤 재시작한다. study DB가 존재해야 하며 기존 preload 항목은 함께 유지한다.

```conf
shared_preload_libraries = 'pg_cron'
cron.database_name = 'study'
cron.timezone = 'Asia/Seoul'
```

기본 libpq 모드는 잡 사용자로 새로 접속하므로 pg_hba.conf와 인증 수단이 필요하다. 저장소의 Docker 실습은 로컬 소켓 인증에 맞춰 `cron.host=/var/run/postgresql`을 지정한다. 일반 운영 서버에서는 해당 서버의 인증 정책에 맞게 설정한다.

study DB에 설치 권한이 있는 사용자로 접속해 아래 SQL을 **자동 커밋 상태에서 순서대로** 실행한다. 한 트랜잭션으로 묶으면 등록이 커밋되지 않아 대기 중에도 잡이 실행되지 않는다.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE TABLE public.catalog_cron_heartbeat (
  tick timestamptz NOT NULL DEFAULT clock_timestamp()
);
SELECT cron.schedule('catalog-heartbeat', '2 seconds',
  'INSERT INTO public.catalog_cron_heartbeat DEFAULT VALUES');
```

```sql
SELECT pg_sleep(5);
SELECT count(*) AS ticks FROM public.catalog_cron_heartbeat;
-- 정상 실행되었다면 1 이상. 부하에 따라 달라지므로 고정 횟수를 기대하지 않는다.

SELECT r.runid, r.status, r.return_message
FROM cron.job_run_details r JOIN cron.job j USING (jobid)
WHERE j.jobname = 'catalog-heartbeat' AND j.username = current_user
ORDER BY r.runid DESC LIMIT 5;
-- 완료된 회차의 status가 succeeded인지 확인한다.

SELECT cron.unschedule('catalog-heartbeat');
-- 테이블은 결과 관찰용으로 남긴다. 실습 종료 후 필요하면 삭제한다.
```

실패하거나 행이 늘지 않으면 이력과 서버 로그에서 접속 인증·객체 권한·SQL 오류를 확인한다. 이름 있는 잡은 사용자별 이름 공간을 사용한다. 같은 사용자가 같은 이름으로 schedule하면 기존 예약이 갱신될 수 있다.

### 실패한 회차 확인

```sql
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY runid DESC
LIMIT 20;
```

등록 단계에서 시간식이나 CONNECT 권한 검사가 실패하면 `cron.schedule` 문 자체가 오류를 내고 예약 행이 생기지 않는다. 등록 뒤에는 인증·worker 부족·SQL 권한·제약 조건·timeout 등으로 한 회차가 실패할 수 있다. 이때 `cron.log_run=on`이면 `status='failed'`와 오류 이유가 `return_message`에 남는다. 서버 재시작 전에 `starting`·`running`이던 이력은 launcher 재기동 때 `failed`, `server restarted`로 정리된다.

active 잡은 다음 예약 시각에 새 runid로 다시 실행될 수 있다. 이는 실패한 회차를 백오프 정책으로 재시도한 것이 아니다. 같은 트랜잭션의 DB 변경은 오류 때 롤백되지만 이미 보낸 HTTP 요청은 롤백되지 않는다. 중요한 업무는 UNIQUE 실행 키·상태 테이블·실패 알림·재처리 절차를 별도로 둔다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 주기적 집계 뷰 갱신, 작은 배치 삭제, DB 내부 작업 큐, ANALYZE, 다른 DB의 운영 SQL 예약 |
| 이럴 때는 피한다 | 여러 시스템의 복잡한 의존성, 정교한 재시도·백오프·알림, 정확한 시각·exactly-once 실행 보장이 필요할 때 |
| 비용 | preload와 재시작, launcher 및 잡 실행 자원. 기본 모드는 연결 슬롯, worker 모드는 max_worker_processes 슬롯을 소비 |
| 대안 | OS cron + psql, 애플리케이션 작업 큐, 외부 오케스트레이터, 목적별 확장의 유지보수 기능 |

같은 jobid는 동시에 한 번만 실행되지만 다른 jobid는 겹칠 수 있다. 업무 중복 방지는 UNIQUE 제약·잠금·처리 내역 등으로 별도 설계한다. unschedule이나 비활성화는 실행 중 잡의 취소 경로에도 영향을 주며 이미 커밋한 결과를 되돌리지 않는다. 이력 테이블의 보존·정리 정책도 운영자가 정한다.

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | [공식 RDS 절차](https://docs.aws.amazon.com/ko_kr/AmazonRDS/latest/UserGuide/PostgreSQL_pg_cron.html): PostgreSQL 12.5 이상, 사용자 지정 파라미터 그룹과 재부팅 필요 |
| AWS Aurora | ○ | [Aurora 공식 설치·운영 절차](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/PostgreSQL_pg_cron.html) |
| Supabase | ○ | 서비스의 Cron 활성화·권한 정책 적용 |
| Neon | ○ | 서비스에서 허용하는 설치 DB·실행 조건 확인 |
| GCP Cloud SQL | ○ | cloudsql.enable_pg_cron 등 [서비스 설정](https://docs.cloud.google.com/sql/docs/postgres/extensions) 확인 |

지원 목록은 [pg_cron v1.6.8 README](https://github.com/citusdata/pg_cron/tree/v1.6.8#managed-services)와 서비스 문서를 기준으로 한다. 자체 호스팅의 preload 설정을 관리형 DB에서 그대로 편집할 수 있는 것은 아니며, 재시작·허용 목록·설치 DB는 서비스별 절차를 따른다.

RDS에서는 파라미터 그룹의 `shared_preload_libraries`에 `pg_cron`을 넣고, `rds.allowed_extensions`로 설치 목록을 제한했다면 그 목록에도 추가한다. 재부팅 뒤 기본 `postgres` DB에서 `rds_superuser` 사용자가 확장을 만든다. 일반 사용자에게는 `GRANT USAGE ON SCHEMA cron`과 대상 객체 권한을 따로 부여한다. AWS는 username 변경을 통한 권한 상승을 막기 위해 cron 테이블의 직접 INSERT·UPDATE 권한 대신 제공된 함수를 사용하도록 안내한다. worker 모드는 `max_worker_processes`, 이력은 `cron.log_run`과 보존 기간을 함께 확인한다.

---

## 5. (선택) 내부 동작 원리

`_PG_init()`이 launcher background worker를 등록한다. launcher는 복구가 끝난 서버에서 실행되며 cron.database_name의 예약을 읽는다. 예약 변경 트리거는 캐시를 무효화하고 등록 트랜잭션 커밋 이후 변경이 반영된다. 확장은 클러스터의 한 DB에 설치하고, 다른 DB 작업은 `cron.schedule_in_database()`로 예약할 수 있다.

기본 모드는 `PQconnectStartParams()`로 연결한 뒤 SQL을 보낸다. `cron.use_background_workers=on`이면 동적 worker의 `ExecuteSqlString()` 경로로 실행한다. 이 경로는 SPI 실행이 아니며 worker 모드가 항상 더 빠르다고 단정할 수 없다.

일반 cron 식은 분·시·일·월·요일의 다섯 필드다. 별도로 1~59초 간격과 마지막 날짜 `$`를 지원한다. 초 간격 잡의 대기는 메모리 상태이며 영속적인 재시도 큐가 아니다.

현재 main의 파일 역할도 구분해 읽는다. `entry.c`는 cron 표현식의 목록·범위·간격을 파싱하고, `misc.c`는 그 파서가 문자를 읽고 되돌리는 보조 함수를 제공한다. `job_metadata.c`는 예약과 실행 이력을 DB 테이블에 읽고 쓰며, `task_states.c`는 jobid별 현재 상태를 launcher 메모리에서 관리한다. `pg_cron.c`가 이들을 묶어 시간 판정, 실행 시작, 결과 수집을 진행한다. 현재 main 함수 지도와 v1.6.8 원문 분석은 웹의 `#/pg-cron/source-map`, `#/pg-cron/source`에서 구분해 제공한다.

## 6. (선택) 벤치마크 / 실습 결과

PostgreSQL 16.15·pg_cron 1.6.8, macOS arm64의 Docker 환경에서 수행한 검증이다.

| 조건 | 결과 |
| --- | --- |
| 1초 간격·2초 작업, 단일 jobid | 10회 완료 5~6건, 평균 5.6건. 최대 겹침은 매회 1 |
| 같은 작업 4개, 동시 한도 4 | 10회 완료 20~24건, 평균 21.4건. 최대 겹침은 매회 4 |
| 같은 작업 4개, 동시 한도 2 | 10회 완료 2~3건, 평균 2.3건. 정체가 반복돼 정상적인 큐 대기로 해석하지 않음 |
| SKIP LOCKED 소비자 2개·항목 40개 | 10회 모두 중복 효과 없이 40개 처리. INSERT 뒤 강제 예외의 잔존 행은 매회 0 |
| 실행 이력 시간으로 모드 비용 비교 | start_time이 연결/worker 기동 뒤 기록되므로 전체 기동 비용 비교 결론은 철회 |

회차별 상세 JSON은 재현할 때 로컬 `results/`에 생성되며 Git에서 제외한다. 반복별 게시 요약은 웹의 `src/data/cron-experiments.json`, 실행 방법은 [실험 목록](week03/pg_cron/experiments/README.md)에 있다. 짧은 sleep 부하 결과를 운영 처리량으로 일반화하지 않는다. 정체 원인에 대한 소스 가설은 있으며 패치 전후 검증으로 확정한 것은 아니다.

pg_net HTTP 호출·pg_partman 유지보수 연계는 활용 조사에 포함했지만 실제 연계 실행은 검증하지 않았다. SQL 성공과 외부 HTTP 성공도 구분해야 한다.

---

## 참고 링크

- [pg_cron v1.6.8 소스·사용법](https://github.com/citusdata/pg_cron/tree/v1.6.8)
- 웹 학습 자료: `#/pg-cron/about`, `#/pg-cron/recipes`, `#/pg-cron/source-map`, `#/pg-cron/source`, `#/pg-cron/experiments`
- [Docker 실습 5개](week03/pg_cron/labs/README.md)
- [동시성 정체 진단](week03/pg_cron/experiments/03-capacity-and-serialization/README.md)
