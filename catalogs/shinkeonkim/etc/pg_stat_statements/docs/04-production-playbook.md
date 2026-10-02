# pg_stat_statements — 실무 활용 가이드

> 실제 운영에서 이 뷰로 무엇을 하는지, 켜둘 때 감안할 오버헤드, 매니지드 DB별 지원 현황, 그리고 보안상 주의할 점을 정리한다. 구체적인 진단 SQL 은 [`../labs/04-dba-playbook-and-pitfalls/`](../labs/04-dba-playbook-and-pitfalls) 에서 직접 실행하며 검증했다. 실제 백엔드에 적용한 예시는 [`../labs/05-fastapi-slow-query-monitor/`](../labs/05-fastapi-slow-query-monitor) 참고.

## 실무에서 실제로 하는 일

| 상황 | 보는 컬럼 | 방법 |
| --- | --- | --- |
| 튜닝 우선순위 정하기 | `total_exec_time` | 평균이 아니라 **총합**으로 정렬 - 1초짜리 1번보다 1ms짜리 10만 번이 서버를 더 힘들게 한다 |
| N+1 쿼리 패턴 의심 | `calls` | 화면 하나 그리는 데 같은 모양의 쿼리가 비정상적으로 많이 반복되는지 확인 |
| 가끔 튀는 쿼리 찾기 | `stddev_exec_time`, `max_exec_time` | 평균은 정상인데 편차가 큰 쿼리 - 락 대기, 플랜 변경 의심 |
| 캐시 미스 큰 쿼리 찾기 | `shared_blks_hit` / `shared_blks_read` | 히트율이 낮으면 `shared_buffers` 부족이나 인덱스 부재 의심 |
| 복제 지연 원인 추적 | `wal_bytes` (13+) | WAL 을 많이 만드는 쿼리가 스트리밍 복제/아카이브 비용의 원인일 수 있다 |
| `work_mem` 부족 탐지 | `temp_blks_written` | 0 보다 크면 디스크에 정렬/해시를 쓰고 있다는 뜻 |
| 배포 전후 성능 비교 | 전체 | 배포 전 동일 길이 구간의 스냅샷을 먼저 보관하고, 배포 후 같은 부하 구간과 차분 비교한다. reset은 수집 구간을 명시할 때만 선택적으로 사용한다. `pg_stat_statements_info.stats_reset` 로 "이 통계가 언제부터인지" 항상 확인 |
| 실행계획 변경 감지 | `mean_exec_time` 급증 | 같은 queryid 인데 평균이 갑자기 뛰면 통계 갱신/인덱스 변경/데이터 분포 변화 의심 - `auto_explain` 과 함께 쓰면 실제 계획까지 남길 수 있다 |

이 표의 "N+1 쿼리 패턴 의심"과 "튜닝 우선순위 정하기"를 실제 FastAPI 백엔드에 붙여서 재현한 것이 [`../labs/05-fastapi-slow-query-monitor/`](../labs/05-fastapi-slow-query-monitor) 다 - psql 이 아니라 서비스 자신의 admin API 로 pg_stat_statements 를 노출하는 예시다.

## 오버헤드

오버헤드는 쿼리 길이·동시성·수집 설정에 따라 달라진다. 출처와 부하 조건 없는 "항상 1~5%" 수치나 상시 활성화를 보편적 표준으로 단정하지 않는다. [실험 01](../experiments/01-overhead-under-load/)은 이 저장소의 특정 pgbench 부하에서 측정한 결과이며 다음 옵션을 구분한다:

- `pg_stat_statements.track = all` - 함수/트리거 내부 쿼리까지 잡아 항목 수와 오버헤드가 함께 늘어난다. 기본값은 `top` 이다.
- `pg_stat_statements.track_planning = on` - 계획 시간까지 측정한다. 기본값은 `off` 다 - 짧고 자주 도는 쿼리에서는 계획 자체를 측정하는 비용이 무시 못할 비율을 차지할 수 있다.
- `track_io_timing = on` - 블록 I/O 시간을 재기 위해 매 I/O 마다 시스템 콜로 시각을 조회한다. 플랫폼에 따라 `clock_gettime` 비용이 눈에 띌 수 있다 (`pg_test_timing` 으로 사전 확인 권장).

## 매니지드 DB 지원 현황

기본값은 서비스·버전·파라미터 그룹에 따라 달라지므로 다음 공식 안내와 실제 `SHOW shared_preload_libraries`를 함께 확인한다. 지원 여부와 기본 활성화를 같은 뜻으로 쓰지 않는다.

| 서비스 | 확인할 공식 안내 |
| --- | --- |
| RDS / Aurora | [AWS SQL 통계 설정](https://docs.aws.amazon.com/en_en/AmazonRDS/latest/AuroraUserGuide/USER_PerfInsights.UsingDashboard.AnalyzeDBLoad.AdditionalMetrics.PostgreSQL.html): 라이브러리 미로드 시 파라미터 그룹에서 활성화 |
| Azure Flexible Server | [shared_preload_libraries 설정](https://learn.microsoft.com/en-us/azure/postgresql/parameters/parameters-client-connection-defaults-shared-library-preloading): 허용 라이브러리·기본값·재시작 요구 확인 |
| Cloud SQL | [지원 확장](https://docs.cloud.google.com/sql/docs/postgres/extensions): 지원 PG 버전과 생성 요건 확인 |
| Supabase | [확장 안내](https://supabase.com/docs/guides/database/extensions/pg_stat_statements) |
| Neon | [확장 목록](https://neon.com/docs/changelog/2023-04-11) |

## 보안 고려사항

- **비superuser 는 다른 사용자의 쿼리를 "행 자체는" 볼 수 있지만 텍스트는 못 본다.** 공식 문서: "only superusers and roles with privileges of the pg_read_all_stats role are allowed to see the SQL text and queryid of queries executed by other users." 실습으로 확인한 바로는, 가려질 때 `queryid` 는 `NULL`, `query` 컬럼은 `NULL` 이 아니라 **문자열 `<insufficient privilege>`** 로 채워진다 - `WHERE query = ...` 로 검색하면 당연히 안 걸린다는 뜻이다 ([`labs/04-dba-playbook-and-pitfalls/`](../labs/04-dba-playbook-and-pitfalls) (G) 섹션에서 재현).
- **`pg_read_all_stats` 를 넓게 뿌리지 말 것.** 이 역할을 가지면 다른 모든 사용자의 쿼리 텍스트를 볼 수 있다 - 모니터링 계정 하나에만 좁게 부여하는 것이 정석이다.
- **`SET` 문의 리터럴은 PostgreSQL 18 이전까지 파라미터화되지 않는다.** 공식 릴리스 노트(18): "Allow the parameterization of SET values in pg_stat_statements ... reduces the bloat caused by SET statements with differing constants." 즉 17 이하에서는 `SET myapp.tenant_id = '12345'` 같은 문이 리터럴 그대로 쌓인다 - 애플리케이션이 세션 변수에 민감한 값을 넣는 패턴을 쓴다면 유의해야 한다.
- **쿼리 텍스트는 서버 디스크의 별도 파일에 평문으로 저장된다** ([02](02-internals-and-source.md)의 "쿼리 텍스트는 어디에" 참고). 파일시스템 접근 권한이 곧 그 텍스트에 대한 접근 권한이라는 뜻이다.

## 비교: 관련 도구와의 역할 분담

| 도구 | 역할 | pg_stat_statements 와의 관계 |
| --- | --- | --- |
| `auto_explain` | 느린 쿼리의 **실제 실행계획**을 로그에 남긴다 | pg_stat_statements 로 "무엇이 느린지" 찾고, auto_explain 으로 "왜 느린지" 판다 - threshold 를 맞춰 함께 쓰는 경우가 많다 |
| `pg_stat_activity` | **지금 이 순간** 실행 중인 쿼리 스냅샷 | `query_id` 컬럼으로 pg_stat_statements 와 조인 가능 - "지금 느린 이 쿼리, 평소에도 느렸나?" |
| `pg_stat_monitor` (Percona) | pg_stat_statements 와 유사하지만 **시계열 버킷팅과 히스토그램/백분위수**(P95/P99)를 추가 제공 | pg_stat_statements 는 실행 이후 하나의 누적값(평균/표준편차)만 주지만, pg_stat_monitor 는 시간 구간별 분포를 볼 수 있다 - 더 세밀한 관측이 필요하면 대안으로 검토 |

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [내부 동작과 코드베이스](02-internals-and-source.md)
- [버전별 변천사](03-version-history.md)

## 참고 링크

- [PostgreSQL 공식 문서 - F.32. pg_stat_statements (보안 섹션 포함)](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [Amazon RDS: Resolving the "pg_stat_statements must be loaded via shared_preload_libraries" error (pganalyze)](https://pganalyze.com/docs/install/troubleshooting/rds_pg_stat_statements_shared_preload_libraries)
- [Supabase 문서 - pg_stat_statements](https://supabase.com/docs/guides/database/extensions/pg_stat_statements)
- [Find and fix slow Postgres queries on Supabase and Neon with pganalyze](https://pganalyze.com/blog/postgres-monitoring-for-neon-and-supabase)
- [Considerations when Using Extensions and Modules in Azure Database for PostgreSQL Flexible Server (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-considerations)
- [PostgreSQL 18 릴리스 노트 (SET 파라미터화 항목)](https://www.postgresql.org/docs/current/release-18.html)
