# PG Extension 실습 환경

발표 자료([`../slides/slides.md`](../slides/slides.md))의 내용을 **직접 눈으로 확인**하기 위한 실습 모음입니다.

각 lab 은 **완전히 독립적**입니다. 자기만의 `Dockerfile`, `docker-compose.yml`, `run.sh` 를 갖고 있고 포트도 달라서, 관심 있는 것만 골라 동시에 띄워도 됩니다.

## 필요한 것

- Docker (Docker Desktop 또는 Docker Engine) - `docker compose` v2
- 그게 전부입니다. PostgreSQL 을 로컬에 설치할 필요 없습니다.

## 두 가지 방법

각 lab 은 **자동 실행**과 **직접 실습** 두 가지로 볼 수 있습니다.

### ① 자동 - 전체 흐름을 빠르게 훑기

```bash
cd 00-hello-extension
./run.sh
```

`./run.sh` 하나가 **이미지 빌드 → 컨테이너 기동 → 스크립트 순차 실행**까지 전부 합니다. 출력은 터미널에 그대로 나오므로 위에서부터 읽어 내려가면 됩니다.

### ② 직접 - psql 에 접속해 한 줄씩 쳐보기

**이쪽이 실제로 손에 남습니다.** 각 lab 의 [`HANDS-ON.md`](00-hello-extension/HANDS-ON.md) 를 따라갑니다.

```bash
cd 00-hello-extension
./run.sh up      # 컨테이너만 기동 (스크립트는 실행하지 않음)
./run.sh psql    # psql 접속 -  study=#  프롬프트
```

에디터로 `HANDS-ON.md` 를 열어두고, psql 에 한 블록씩 붙여넣으며 진행하세요.

- 각 단계마다 **무엇을 볼 것인지**가 먼저 나옵니다. 결과를 보기 전에 예상해보세요
- ```` ```sql ```` 블록은 그대로 실행되고, ```` ```sql expect-error ```` 블록은 **일부러 실패하는** 예시입니다
  - 자동 스크립트는 이런 실패를 `DO ... EXCEPTION` 으로 감싸 NOTICE 로 바꿔놓지만, 직접 치면 **진짜 에러 메시지**를 보게 됩니다
- 꼬였으면 `./run.sh down && ./run.sh up` 으로 깨끗한 상태에서 다시 시작하면 됩니다

처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

### psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` | 설치된 extension 목록 |
| `\dx+ <이름>` | 그 extension 이 만든 객체 전부 |
| `\df <패턴>` | 함수 목록 |
| `\d <테이블>` | 테이블 구조 |
| `\l` / `\dn` | 데이터베이스 / 스키마 목록 |
| `\timing on` | 쿼리 실행 시간 표시 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 (호스트가 아닙니다) |
| `\i <파일>` | SQL 파일 실행 |
| `\x` | 결과를 세로로 (컬럼이 많을 때) |
| `\q` | 나가기 |

> `\!` 가 컨테이너 안에서 도는 덕분에 `pg_config`, `ls $SHAREDIR/extension/`, `pg_dump` 를 psql 을 벗어나지 않고 그대로 쓸 수 있습니다. lab 마다 자주 씁니다.

## 1부 - Extension 시스템 이해하기

먼저 이 넷을 순서대로 보세요. **extension 이 무엇이고 어떻게 동작하는지**를 다룹니다.

| Lab | 주제 | 포트 |
|---|---|---|
| [00-hello-extension](00-hello-extension) | **가장 간단한 extension 직접 만들기** - 텍스트 파일 2개 | 15400 |
| [01-create-extension](01-create-extension) | `CREATE EXTENSION` 내부 동작 - 카탈로그 · `pg_depend` · 버전 · trusted | 15401 |
| [02-sql-extension](02-sql-extension) | PGXS 로 제대로 빌드 · 업그레이드 스크립트 · `pg_dump` 연동 | 15402 |
| [03-c-extension](03-c-extension) | **C extension 직접 컴파일** - 호출 규약 · `_PG_init` · GUC · SPI | 15403 |

## 2부 - Extension 의 10가지 원리

extension 이 PostgreSQL 을 확장하는 **방식**을 하나씩 실행해봅니다. Week 2 이후 각자 확장을 고를 때의 지도입니다.

| Lab | 분류 | 대표 extension | 로딩 | 포트 |
|---|---|---|---|---|
| [04-functions](04-functions) | (a) 함수 추가 | pgcrypto, tablefunc, fuzzystrmatch | 자동 | 15404 |
| [05-types](05-types) | (b) 타입 추가 | hstore, citext, ltree, cube | 자동 | 15405 |
| [06-opclass](06-opclass) | (c) 연산자 클래스 | pg_trgm, btree_gin, btree_gist | 자동 | 15406 |
| [07-hooks](07-hooks) | (d) Hook + 공유메모리 | pg_stat_statements | **SPL** | 15407 |
| [08-modules](08-modules) | (e) 모듈 (extension 아님) | auto_explain | **SPL** | 15408 |
| [09-bgworker](09-bgworker) | (f) Background Worker | pg_cron | **SPL** | 15409 |
| [10-fdw](10-fdw) | (g) FDW | postgres_fdw, file_fdw | 자동 | 15410 |
| [11-diagnostics](11-diagnostics) | (h) 내부 노출 | pageinspect, pgstattuple | 자동 | 15411 |
| [12-index-am](12-index-am) | (i) 인덱스 액세스 메서드 | bloom | 자동 | 15412 |
| [13-pl-languages](13-pl-languages) | (j) 절차적 언어 | **PL/Python**, PL/Perl | 자동 | 15413 |

<sub>**SPL** = `shared_preload_libraries` 필요 - `CREATE EXTENSION` 만으로는 동작하지 않습니다.
각 lab 의 `docker-compose.yml` 에 설정이 있으니 함께 보세요.</sub>

### 어떤 부류인지 판별하는 법

lab04 · lab05 · lab06 · lab10 · lab13 의 `01-*.sql` 이 이 쿼리로 시작합니다. (나머지 lab 은 그 부류에 맞게 변형해 씁니다 - lab12 는 `pg_am`, lab11 은 카탈로그별 객체 목록.)

```sql
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)    AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)    AS 타입,
       count(*) FILTER (WHERE d.classid='pg_opclass'::regclass) AS 연산자클래스,
       count(*) FILTER (WHERE d.classid='pg_am'::regclass)      AS 인덱스AM
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
GROUP  BY e.extname;
```

처음 보는 extension 을 만났을 때 이 쿼리 하나로 성격을 파악할 수 있습니다. 단, **lab07·lab08·lab09 는 이 방법이 아예 통하지 않습니다** - 진짜 일이 카탈로그가 아니라 C 코드 안에서 일어나기 때문입니다. 그래서 그 셋은 이 쿼리를 쓰지 않습니다. 그것 자체가 lab07 의 관전 포인트입니다.

## 이어지는 자료 - pgvector · PostGIS

실제로 많이 쓰는 두 extension(pgvector · PostGIS)의 심층 lab 은 해당 회차에 별도 자료로 공개됩니다.

## run.sh 사용법 (모든 lab 동일)

| 명령 | 하는 일 |
|---|---|
| `./run.sh` | 빌드 → 기동 → `sql/` 전부 실행 |
| `./run.sh up` | 빌드 & 기동만 |
| `./run.sh sql` | `sql/` 만 다시 실행 (컨테이너가 없으면 알아서 띄웁니다) |
| `./run.sh 03` | `03` 으로 시작하는 스크립트 하나만 실행 |
| `./run.sh psql` | psql 셸 접속 (직접 만져보기) |
| `./run.sh shell` | 컨테이너 bash 접속 (파일 시스템 탐색) |
| `./run.sh logs` | 서버 로그 follow |
| `./run.sh down` | 컨테이너 + 볼륨 삭제 (처음부터 다시) |

## 디렉토리 구조 (모든 lab 공통)

```
NN-이름/
├── Dockerfile           # 이 lab 에 필요한 extension 이 설치된 이미지
├── docker-compose.yml   # 포트, 볼륨, shared_preload_libraries 등
├── run.sh               # 실행 스크립트 (모든 lab 동일)
├── README.md            # 이 lab 에서 확인할 것 / 예상 결과
├── HANDS-ON.md          # 직접 쳐보며 따라가는 가이드
├── sql/                 # 자동 실행용 스크립트 - 번호순 실행
└── ext/                 # (00, 02, 03 lab) 직접 만드는 extension 소스
```

`sql/` 과 `HANDS-ON.md` 는 **같은 내용을 두 가지 방식으로** 담고 있습니다. `sql/` 은 처음부터 끝까지 오류 없이 흐르도록 만들어졌고, `HANDS-ON.md` 는 사람이 한 줄씩 치면서 **에러까지 직접 보도록** 만들어졌습니다.

## 전부 정리하기

```bash
for d in [0-9][0-9]-*/; do (cd "$d" && ./run.sh down); done
docker image prune -f
```

## 자주 겪는 문제

| 증상 | 원인 / 해결 |
|---|---|
| `port is already allocated` | 다른 프로세스가 해당 포트 사용 중. `docker-compose.yml` 의 포트를 바꾸세요 |
| 이미지 빌드가 매우 느림 | 첫 실행은 베이스 이미지 다운로드 + apt 설치가 있습니다. 두 번째부터는 캐시됩니다 |
| 스크립트 재실행 시 에러 | 모든 스크립트를 재실행 가능하게 작성했지만, 꼬였다면 `./run.sh down && ./run.sh` |
| `FATAL: terminating connection due to administrator command` | 공식 이미지의 첫 기동 시 initdb 용 임시 서버에 붙어서 생기는 문제. `run.sh` 가 TCP 로 확인하도록 해두어 방지했습니다 |
