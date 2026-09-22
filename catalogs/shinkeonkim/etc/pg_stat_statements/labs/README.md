# pg_stat_statements 실습

`intro/labs/07-hooks` 가 "Hook + 공유메모리를 쓰는 extension 부류"의 대표 사례로 `pg_stat_statements` 를 살짝 다뤘다면, 이 5개 lab 은 **그 익스텐션 자체가 주제**입니다.

각 lab 은 `intro/labs` 와 같은 방식으로 **완전히 독립적**입니다 - 자기만의 `Dockerfile`, `docker-compose.yml`, `run.sh` 를 갖고 있고 포트도 달라서, 관심 있는 것만 골라 실행해도 됩니다.

조사 문서는 [`../docs/`](../docs)에, 이 실습 결과와 조사 내용을 종합한 카탈로그 문서는 [`../README.md`](../README.md)에 있습니다.

## 목록

| Lab | 주제 | 포트 |
|---|---|---|
| [01-preload-and-footprint](01-preload-and-footprint) | preload 가 왜 필수인가 · 카탈로그에 남는 흔적 · 공유 메모리 증거 | 15920 |
| [02-normalization-and-queryid](02-normalization-and-queryid) | 쿼리 정규화 · queryid · `track=all` · **IN 리스트 길이가 정규화되지 않는 함정** | 15921 |
| [03-metrics-deep-dive](03-metrics-deep-dive) | I/O 히트율 · WAL · 계획(Plan) 시간 · temp 파일 · JIT 컴파일 비용 | 15922 |
| [04-dba-playbook-and-pitfalls](04-dba-playbook-and-pitfalls) | 실무 진단 쿼리 4가지 · 선택적 리셋 · eviction/dealloc의 의미 · 쿼리 텍스트 접근 권한 | 15923 |
| [05-fastapi-slow-query-monitor](05-fastapi-slow-query-monitor) | **실전 통합** - FastAPI 백엔드에 admin 엔드포인트로 붙여 N+1 버그를 실제로 잡아본다 | 15924 (DB) / 18924 (API) |

## 두 가지 방법 (01~04)

각 SQL 기반 lab 은 **자동 실행**과 **직접 실습** 두 가지로 볼 수 있습니다.

### ① 자동 - 전체 흐름을 빠르게 훑기

```bash
cd 01-preload-and-footprint
./run.sh
```

`./run.sh` 하나가 **이미지 빌드 → 컨테이너 기동 → sql/ 순차 실행**까지 전부 합니다.

### ② 직접 - psql 에 접속해 한 줄씩 쳐보기

각 lab의 `HANDS-ON.md`를 따라 SQL을 직접 실행하고 결과를 확인합니다.

```bash
cd 01-preload-and-footprint
./run.sh up      # 컨테이너만 기동
./run.sh psql    # psql 접속
```

05번 lab 은 SQL 이 아니라 FastAPI 앱이라 방식이 다릅니다 - [`05-fastapi-slow-query-monitor/README.md`](05-fastapi-slow-query-monitor/README.md) 참고.

### psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` | 설치된 extension 목록 |
| `\d <테이블>` | 테이블 구조 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 |
| `\q` | 나가기 |

## 이 lab 들에서 서버에 준 공통 설정

```
shared_preload_libraries         = pg_stat_statements
pg_stat_statements.track         = all   # 함수/트리거 내부 쿼리까지
pg_stat_statements.track_utility = on
pg_stat_statements.track_planning = on   # 계획 시간까지 (기본은 off - 오버헤드 때문)
pg_stat_statements.max           = 1000
track_io_timing                  = on    # 블록 I/O 시간(ms) 측정 - PostgreSQL 코어 GUC
```

기본값이 아닌 것을 일부러 켰습니다 (01~04 lab). 운영에서 그대로 켜기 전에 각 옵션이 무슨 오버헤드를 더하는지 [`../docs/04-production-playbook.md`](../docs/04-production-playbook.md) 를 먼저 보세요.

## 직접 겪은 함정들 (이 lab 들을 만들며 실제로 확인한 것)

- **컬럼 별칭은 정규화 대상이 아니다.** `SELECT 1 AS a` 와 `SELECT 1 AS b` 는 같은 queryid 로 묶인다 (04).
- **`pg_stat_statements_info.dealloc` 은 "쫓겨난 항목 개수"가 아니라 "GC 가 실행된 횟수"다** (04).
- **권한이 없을 때 쿼리 텍스트는 `NULL` 이 아니라 문자열 `<insufficient privilege>` 로 채워진다** (04).
- **작은 LIMIT에서는 top-N 정렬로 temp 사용을 피할 수 있다.** 모든 LIMIT 쿼리에서 보장되는 것은 아니다 (03).
- 이 PostgreSQL 16 환경에서는 **IN 리스트 길이가 다르면 정규화되지 않고 별개 항목으로 남는다** (02).
- **호출 수 급증은 N+1의 단서다.** 요청당 쿼리 수와 코드를 함께 확인해야 원인을 확정할 수 있다 (05).
