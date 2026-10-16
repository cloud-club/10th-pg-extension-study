# pg_stat_statements — 내부 동작과 코드베이스

> 아래 내용은 PostgreSQL 공식 저장소(`postgres/postgres`, `contrib/pg_stat_statements/`)의 실제 소스를 직접 확인해 정리했다. 인용된 코드는 REL_16_STABLE 브랜치 기준이다 (이 lab 이 쓰는 버전).

## 파일 구성

`contrib/pg_stat_statements/` 디렉터리는 실제로 이렇게 생겼다 (REL_16_STABLE 기준):

```
pg_stat_statements.c              # 전체 로직 - 훅, 공유메모리, SQL 함수 구현
pg_stat_statements.control         # extension 메타데이터 (default_version 등)
pg_stat_statements.conf            # 테스트용 설정 예시
pg_stat_statements--1.4.sql        # 1.4 를 베이스로 하는 설치 스크립트 (그 이전 버전은 통합됨)
pg_stat_statements--1.4--1.5.sql   # 이후 각 버전 간 업그레이드 스크립트
pg_stat_statements--1.5--1.6.sql
... (1.6--1.7, 1.7--1.8, 1.8--1.9, 1.9--1.10 로 계속)
Makefile / meson.build              # PGXS / Meson 빌드 정의
sql/, expected/                     # 회귀 테스트와 그 기대 결과
```

`.control` 파일의 `default_version` 이 그 PostgreSQL 버전에서 기본으로 설치되는 SQL 버전이다. 오래된 버전(1.0~1.3)의 업그레이드 스크립트는 저장소에서 정리되고 `pg_stat_statements--1.4.sql` 하나로 합쳐져 있다 - 이미 옛날 버전을 쓰던 서버는 계속 체인을 타고 올라오지만, 새로 설치하는 서버는 1.4 를 베이스로 시작한다. 버전별 흐름은 [03-version-history.md](03-version-history.md) 에서 다룬다.

**핵심**: SQL 파일들은 뷰와 함수의 "선언"만 담고 있다. `CREATE FUNCTION pg_stat_statements_reset() ... AS 'MODULE_PATHNAME', 'pg_stat_statements_reset_1_7'` 처럼 실제 구현은 `pg_stat_statements.c` 안의 C 함수를 가리킬 뿐이다. 그래서 [01](01-what-and-why.md)에서 본 것처럼 카탈로그의 함수·뷰 정의와 C 구현을 함께 봐야 수집 동작을 이해할 수 있다. 통계 수집은 C 코드와 PostgreSQL 코어의 훅을 통해 이루어진다.

## `_PG_init()` - 서버가 이 라이브러리를 불러올 때 하는 일

REL_16_STABLE 기준, `_PG_init()` 이 실행하는 것을 요약하면:

```c
/* 공유 메모리 요청은 shmem_request_hook 을 통해 이루어진다 (PostgreSQL 15 부터 이 방식으로 정리됨) */
prev_shmem_request_hook = shmem_request_hook;
shmem_request_hook = pgss_shmem_request;   /* 이 안에서 RequestAddinShmemSpace(), RequestNamedLWLockTranche() 호출 */

prev_shmem_startup_hook = shmem_startup_hook;
shmem_startup_hook = pgss_shmem_startup;   /* 실제 공유메모리 초기화 */

prev_post_parse_analyze_hook = post_parse_analyze_hook;
post_parse_analyze_hook = pgss_post_parse_analyze;   /* 파싱 직후 queryId 확정 시점 */

prev_planner_hook = planner_hook;
planner_hook = pgss_planner;               /* 계획 시간(track_planning) 측정 */

prev_ExecutorStart = ExecutorStart_hook;
ExecutorStart_hook = pgss_ExecutorStart;   /* 실행 시작 - 인스트루먼트 켜기 */

prev_ProcessUtility = ProcessUtility_hook;
ProcessUtility_hook = pgss_ProcessUtility; /* DDL 등 유틸리티 문 처리 (track_utility) */
```

**체인 방식**이라는 점이 중요하다. 기존 훅 함수 포인터를 `prev_*`에 저장하고 자기 처리 전·후 또는 계측 구간 안에서 호출한다. 마지막으로 등록한 훅이 진입점이 되어 이전 훅으로 연결되므로 등록 순서와 처리 순서를 동일시하면 안 된다. `auto_explain` 등과 공존하려면 각 모듈이 이전 훅 호출을 보존해야 한다.

`RequestAddinShmemSpace()` 와 `RequestNamedLWLockTranche()` 는 **서버가 공유 메모리 세그먼트 크기를 확정하기 전에만** 호출할 수 있는 함수다. 이게 `shared_preload_libraries` 가 강제되는 첫 번째 이유다 - 세션 하나가 나중에 `LOAD` 로 불러오면 이 시점은 이미 지나 있다.

## "preload 안 하면 에러가 난다"의 발생 위치

`_PG_init()` 자체는 조용히 끝난다. 사용자가 실제로 마주치는 에러는 **뷰를 뒷받침하는 SQL-호출 가능 함수들** 안에 있다. `pg_stat_statements_internal()`(뷰의 실제 구현), `pg_stat_statements_info()`, 리셋 함수들 모두 이런 방어 코드로 시작한다:

```c
/* hash table must exist already */
if (!pgss || !pgss_hash)
    ereport(ERROR,
            (errcode(ERRCODE_OBJECT_NOT_IN_PREREQUISITE_STATE),
             errmsg("pg_stat_statements must be loaded via shared_preload_libraries")));
```

`pgss`(공유 상태 포인터)와 `pgss_hash`(해시테이블 핸들)는 `pgss_shmem_startup()` 이 실행되어야 채워진다 - 그런데 그 훅은 `shared_preload_libraries` 로 불러왔을 때만 등록된다. 그래서 preload 없이 `CREATE EXTENSION` 만 하면 **뷰와 함수는 카탈로그에 정상적으로 생기지만(선언만 있으므로), 실제로 조회하는 순간 이 에러가 난다.** `intro/labs/07-hooks` 와 이 카탈로그의 [`labs/01-preload-and-footprint/`](../labs/01-preload-and-footprint) 이 다루는 게 바로 이 지점이다.

## 자료구조 개요

| 구조체 | 역할 |
| --- | --- |
| `pgssSharedState` | 공유 메모리에 딱 하나 존재하는 전역 상태. `LWLock *lock`, 파일 쓰기 동기화용 `mutex`, gc 카운터, 통계(`pgssGlobalStats stats` - `dealloc`, `stats_reset` 등)를 담는다 |
| `pgssHashKey` | 해시테이블의 키. `(userid, dbid, queryid, toplevel)` 조합 - 그래서 같은 모양의 쿼리도 실행한 사용자/데이터베이스/최상위 여부가 다르면 별개 항목이다 |
| `pgssEntry` | 해시테이블의 값. 키, 누적 카운터(`Counters counters`), 쿼리 텍스트가 저장된 외부 파일에서의 오프셋(`query_offset`)과 길이를 담는다. 항목별 동시성 보호를 위한 `mutex` 도 개별로 갖는다 |

쿼리 **텍스트 자체**는 해시테이블(공유 메모리) 안에 두지 않는다 - 크기가 가변적이라 고정 크기 공유 메모리에 안 맞기 때문에, 서버 데이터 디렉터리 아래 별도 파일(`pg_stat_tmp/pgss_query_texts.stat` 계열, 버전에 따라 경로가 다르다)에 저장하고 `pgssEntry` 는 그 파일 안에서의 오프셋만 가리킨다. 파일이 너무 커지면 주기적으로 가비지 컬렉션(`gc_qtexts()`)이 정리한다.

## 쿼리 정규화(query jumbling) - 어디서 계산하나

PostgreSQL 13까지는 정규화 로직(“jumbling”)이 pg_stat_statements 자체 코드 안에 있었다. **PostgreSQL 14부터는 이 계산이 코어 서버로 옮겨졌다** - `compute_query_id` 라는 서버 파라미터가 생겼고 기본값 `auto` 는 pg_stat_statements 같은 모듈이 로드되어 있으면 자동으로 계산을 켠다. pg_stat_statements 는 이제 계산된 `queryId` 를 코어로부터 넘겨받아 사용할 뿐이다.

핵심 아이디어(jumbling)는 파스 트리를 순회하면서 리터럴 상수(Const 노드)의 **값은 무시하고 위치만 기록**해, 상수만 다른 두 쿼리가 같은 해시값을 갖도록 만드는 것이다. 그 위치 정보를 이용해 사람이 읽는 `query` 텍스트에서 실제 리터럴 부분을 `$1`, `$2` ... 로 치환해 보여준다.

> 실습으로 확인한 함정: 이 jumbling 은 상수 "값"은 지워도 상수 "개수"(예: `IN (...)` 리스트의 길이)는 PostgreSQL 버전에 따라 다르게 취급한다. [`labs/02-normalization-and-queryid/`](../labs/02-normalization-and-queryid) 에서 직접 재현한다.

## 왜 굳이 코드 자동 생성까지 갔나 (PostgreSQL 16 이후)

PostgreSQL 16 에서는 유틸리티 문(예: `VACUUM`, `CREATE TABLE AS`)의 정규화 방식이 크게 바뀌었다. 이전에는 파스 트리가 아니라 **원본 문자열의 포맷 차이**로도 다른 항목이 됐다 (`VACUUM t;` 와 `vacuum   t;` 가 별개 항목). 16부터는 노드 구조 자체로 그룹화하도록 바뀌었고, 이 jumbling 코드를 각 노드 정의에 붙는 `pg_node_attr` 애너테이션으로부터 **자동 생성**하는 방식으로 리팩터링되었다 (`src/backend/nodes/queryjumblefuncs.c` 등). 덕분에 이후 버전에서 새로운 노드 타입에 대한 정규화를 추가하기가 훨씬 쉬워졌다 - PostgreSQL 18 의 "상수 리스트를 처음/끝만 남기고 뭉치기" 같은 개선도 이 기반 위에서 나왔다.

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [버전별 변천사](03-version-history.md)
- [실무 활용 가이드](04-production-playbook.md)

## 참고 링크

- [contrib/pg_stat_statements 소스 (postgres/postgres, GitHub)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_stat_statements)
- [PostgreSQL 16 하이라이트 - Normalization of utilities in pg_stat_statements (Michael Paquier)](https://paquier.xyz/postgresql-2/postgres-16-pgstatstatements-norm/)
- [PostgreSQL 공식 문서 - F.32. pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
