# pg_stat_statements — 버전별 변천사

> 아래 표는 PostgreSQL 공식 릴리스 노트(postgresql.org/docs/current/release-X.html)와 `contrib/pg_stat_statements/pg_stat_statements.control` 의 `default_version` 을 각 릴리스 브랜치에서 직접 확인해 작성했다. "확인 필요"라고 적은 항목은 릴리스 노트에서 명시적으로 찾지 못한 부분이다.

## 모듈 SQL 버전 ↔ PostgreSQL 메이저 버전

`.control` 파일의 `default_version` 을 각 브랜치에서 직접 조회한 결과:

| PostgreSQL | pg_stat_statements 버전 |
| --- | --- |
| 10, 11 | 1.6 |
| 12 | 1.7 |
| 13 | 1.8 |
| 14 | 1.9 |
| 15 | 1.10 |
| 16 | 1.10 (15와 동일 - 아래 "유틸리티 정규화"는 SQL 스키마 변경 없이 C 코드만으로 구현됨) |
| 17 | 1.11 |
| 18 (릴리스 브랜치 기준) | 1.13 |

`pg_upgrade` 로 메이저 버전을 올린 뒤에는 `ALTER EXTENSION pg_stat_statements UPDATE;` 로 SQL 버전도 함께 올려야 새 컬럼/함수가 보인다 - `CREATE EXTENSION` 은 이미 설치된 익스텐션을 건드리지 않는다.

## 메이저 버전별 주요 변경 (릴리스 노트 원문 기준)

| 버전 | 변경 사항 |
| --- | --- |
| 8.4 | contrib 모듈로 최초 등장. 정규화 없이 실행 시간/호출 횟수만 집계 (상수가 다르면 별개 항목) |
| 9.2 | **쿼리 정규화(jumbling) 도입.** 파스 트리 기반으로 상수를 지워 같은 모양의 쿼리를 하나로 묶기 시작 (Peter Geoghegan, Heroku 후원) - 이전까지는 오직 준비된 실행계획(prepared statement)에서만 이런 묶음이 가능해 실용성이 낮았다 |
| 13 | `EXPLAIN`/`auto_explain`/`autovacuum`/pg_stat_statements 에 **WAL 사용량 통계** 추가. `SELECT ... FOR UPDATE` 를 그렇지 않은 것과 별개 항목으로 구분. **계획(Planning) 시간 선택적 추적**(`pg_stat_statements.track_planning`) 추가 |
| 14 | **쿼리 해시(queryid) 계산을 코어 서버로 이전** - 새 서버 파라미터 `compute_query_id`(기본 `auto`) 가 이 모듈이 로드되면 자동으로 계산을 켠다. **최상위/중첩 쿼리를 분리 추적**(`toplevel` 컬럼 계열) - 이전에는 `track=all` 일 때 같은 모양이면 최상위와 중첩 호출이 합쳐졌지만, 분리하는 게 더 유용하다고 판단. 유틸리티 명령에도 **행 수(rows) 집계** 추가. **`pg_stat_statements_info` 시스템 뷰** 신설 |
| 15 | **JIT 카운터** 추가 (`jit_functions` 등 8개 컬럼). **임시 파일 I/O 시간** `temp_blk_read_time`/`temp_blk_write_time` 추가. temp 블록 개수 카운터는 이전 버전에도 있었다. 공유 메모리 요청 방식이 `shmem_request_hook` 기반으로 정리됨 (내부 구현 변경 - [02](02-internals-and-source.md) 참고) |
| 16 | **유틸리티 명령(예: `VACUUM`, `CREATE TABLE AS`)의 상수도 정규화** - 이전에는 리터럴 값이 그대로 노출되고, 원본 문자열 포맷이 다르면(대소문자, 공백) 별개 항목이 되었다. 16부터는 파스 트리 구조로 그룹화하고 `$1` 같은 placeholder 를 쓴다 |
| 17 | 모듈 1.11. `blk_read_time`/`blk_write_time`을 `shared_blk_*`로 이름 변경, `local_blk_read_time`/`local_blk_write_time`, `stats_since`/`minmax_stats_since`, 선택적 `minmax_only` reset 추가 |
| 18 | **상수 리스트를 "처음과 마지막 값만" 고려하도록 queryid 계산 조정** (list squashing) - `IN (1,2,...,N)` 처럼 길이만 다른 리스트를 이제 하나의 queryid 로 묶는다. **관련 스키마/테이블이 다른 동일 이름 릴레이션을 같은 쿼리로 그룹화.** **병렬 워커 관련 컬럼**(`parallel_workers_to_launch`, `parallel_workers_launched`) 추가. **`wal_buffers_full`** 컬럼 추가. `CREATE TABLE AS`/`DECLARE` 도 추적 대상에 포함되고 queryid 부여. **`SET` 문의 값도 파라미터화** - 상수만 다른 `SET` 문이 쌓이는 문제 완화 |

> 이 lab 은 PostgreSQL 16(모듈 버전 1.10)을 기준으로 실습한다. [`labs/02-normalization-and-queryid/`](../labs/02-normalization-and-queryid) 에서 직접 확인하듯, **이 환경에서는 IN 리스트 길이가 정규화되지 않는다** - 18의 list squashing 이전 상태를 그대로 보여주는 셈이다. "최신 문서의 예제"와 "지금 내 서버의 실제 동작"이 다를 수 있다는 걸 몸으로 확인할 수 있는 지점이다.

## 컬럼이 늘어나며 생기는 실무 이슈

- **모니터링 쿼리를 여러 버전에 걸쳐 재사용할 때** `SELECT *` 대신 필요한 컬럼만 명시하고, 없는 컬럼을 참조하면 바로 에러가 난다는 점을 감안해야 한다 (예: `wal_bytes` 는 13 이전에는 없다, `jit_functions` 는 15 이전에는 없다).
- **`pg_upgrade` 직후** 이전 메이저 버전의 SQL 정의가 그대로 남아있어 새 컬럼이 안 보일 수 있다 - `ALTER EXTENSION pg_stat_statements UPDATE;` 를 잊기 쉽다.
- **매니지드 DB 는 자체 일정으로 마이너/모듈 버전을 올린다** - 자체 호스팅 서버와 컬럼 목록이 다를 수 있으므로, 대시보드 쿼리는 항상 `information_schema.columns` 로 방어적으로 짜는 것이 안전하다 ([04](04-production-playbook.md) 참고).

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [내부 동작과 코드베이스](02-internals-and-source.md)
- [실무 활용 가이드](04-production-playbook.md)

## 참고 링크

- [PostgreSQL 13 릴리스 노트](https://www.postgresql.org/docs/current/release-13.html)
- [PostgreSQL 14 릴리스 노트](https://www.postgresql.org/docs/current/release-14.html)
- [PostgreSQL 15 릴리스 노트](https://www.postgresql.org/docs/current/release-15.html)
- [PostgreSQL 16 릴리스 노트](https://www.postgresql.org/docs/current/release-16.html)
- [PostgreSQL 18 릴리스 노트](https://www.postgresql.org/docs/current/release-18.html)
- [Normalizing queries for pg_stat_statements < 9.2 (ioguix)](https://blog.ioguix.net/postgresql/2012/08/06/Normalizing-queries-for-pg_stat_statements.html)
- [contrib/pg_stat_statements 각 브랜치의 `.control` 파일 (postgres/postgres, GitHub)](https://github.com/postgres/postgres/tree/master/contrib/pg_stat_statements)
