# Lab 03 - C Extension 직접 컴파일하기

```bash
./run.sh
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


`ext/myext.c` 한 파일이 `myext.so` 가 되어 PostgreSQL 서버 프로세스 안에서 실행됩니다.

## 먼저 - `myext` 는 왜 이렇게 시시한가

**기능으로는 아무 가치가 없습니다.** 더하기 · 인사 · 반복 뿐입니다. 그게 의도한 것입니다.
이 lab 의 산출물은 "쓸모 있는 기능"이 아니라 **C extension 이 지켜야 하는 계약을 하나씩 눈으로 확인하는 장치**입니다. 함수 하나가 확인 항목 하나에 대응합니다.

| 함수 | 구현한 것 | 이걸로 보는 것 | 어떻게 확인하나 |
|---|---|---|---|
| `myext_add(int,int)` | 더하기 | **V1 호출 규약**의 최소형 - `PG_GETARG_INT32` → `PG_RETURN_INT32` | `SELECT myext_add(2147483647, 1);` → 에러 없이 **`-2147483648`**. 내장 `+` 는 `integer out of range` 로 막아줍니다 |
| `myext_hello(text)` | 인사말 + `pid` | **가변길이(varlena)** 다루기 · `palloc` 은 쿼리 끝에 자동 해제 | `SELECT myext_hello('스터디');` → 붙은 `pid` 가 **세션마다 다름** |
| `myext_double_or_zero(int)` | ×2, NULL 이면 0 | **`STRICT` 를 안 붙이면** NULL 이 C 함수까지 넘어온다 | `SELECT myext_double_or_zero(NULL);` → `0` (`myext_add(1,NULL)` 은 C 호출조차 안 되고 `NULL`) |
| `myext_shout(text)` | 설정값만큼 반복 | **GUC** - `_PG_init()` 의 `DefineCustomIntVariable` | `SET myext.repeat_count = 5;` 후 다시 호출 · `= 999` 는 min/max 로 거부 |
| `myext_count_rows(text)` | 테이블 행 수 | **SPI** - C 안에서 SQL 실행 | `SELECT myext_count_rows('sample_rows');` · 없는 테이블은 크래시가 아니라 평범한 ERROR |

여기에 함수 바깥의 것들이 더해집니다 - PGXS 빌드(`.c` → `.so`), `.so` 안의 심볼 12개, **로딩 시점**, `pg_regress` 회귀 테스트, C vs SQL vs PL/pgSQL 성능 비교.

> **"이걸 왜 C 로 짜지?"가 정답입니다.** 이 정도 연산은 `LANGUAGE sql` 이 C 만큼 빠릅니다(`05-cost.sql` 에서 직접 잽니다). C 가 필요한 건 **SQL 로는 표현 자체가 안 되는 것** - 새 타입, 새 인덱스 AM, 훅, 백그라운드 워커입니다. 여기서 익힌 뼈대가 그때 그대로 쓰입니다.

## 이 lab 에서 확인할 것

| 스크립트 | 확인 내용 |
|---|---|
| `01-load.sql` | **`.so` 로딩은 세션마다** - 설치를 실행한 세션은 그때, 새 세션은 함수 첫 호출 때 |
| `02-call-convention.sql` | V1 호출 규약, `STRICT` 의 의미, volatility 와 상수 폴딩 |
| `03-guc.sql` | `_PG_init()` 이 등록한 커스텀 설정 파라미터, min/max 검증 |
| `04-spi.sql` | C 함수 안에서 SQL 실행하기 |
| `05-cost.sql` | C vs SQL vs PL/pgSQL 성능 비교 - **C 가 정말 필요한 순간은 언제인가** |

## 이런 출력이 나오면 성공입니다

`.so` 안의 심볼 (빌드 단계에서 `nm` 으로 뽑아둔 것, 12개 중 발췌):
```
T myext_add
T pg_finfo_myext_add     ← PG_FUNCTION_INFO_V1 이 생성한 메타데이터 함수
T _PG_init               ← 라이브러리 로드 시 호출됨
T Pg_magic_func          ← PG_MODULE_MAGIC. ABI 검사용
```
→ C 함수 5개를 썼는데 심볼은 12개입니다. 함수마다 `pg_finfo_*` 가 하나씩 붙고, `_PG_init` 과 `Pg_magic_func` 가 더해진 결과입니다.

**on-demand 로딩의 증명:**
```
  [증명] 새 세션에서 곧바로 GUC 를 조회하면 아직 없다
ERROR:  unrecognized configuration parameter "myext.repeat_count"

  [증명] 같은 세션에서 함수를 먼저 호출하면 GUC 가 생긴다
 myext.repeat_count
--------------------
 3
```
→ `.so` 로딩은 **세션(프로세스)마다** 일어납니다. `CREATE EXTENSION` 을 실행한 세션은 `CREATE FUNCTION ... LANGUAGE C` 가 심볼을 확인하느라 이미 읽었지만, **새 세션은 그 함수를 처음 부를 때** `dlopen()` 합니다. 그래서 `pg_stat_statements` 처럼 서버 시작 시 훅을 걸어야 하는 extension 은 `shared_preload_libraries` 가 필요합니다 (→ lab07).

## Dockerfile 구조

멀티스테이지 빌드입니다.
- `build` 스테이지: `postgresql-server-dev-16` + `build-essential` 로 컴파일
- 최종 스테이지: 산출물(`.so`, `.control`, `.sql`)만 복사 - 빌드 도구 없는 슬림 이미지

실무에서 extension 이미지를 만드는 방식과 같습니다.

## 직접 해볼 것

빌드 도구가 다 들어있는 개발용 컨테이너가 따로 있습니다.

```bash
docker compose --profile dev up -d
docker compose exec dev bash
# /build/myext 에서 자유롭게 수정하고
make && make install
```

`ext/` 가 마운트되어 있으므로 호스트에서 편집한 내용이 바로 반영됩니다.

### 회귀 테스트 돌려보기

`ext/sql/myext_basic.sql` 이 입력, `ext/expected/myext_basic.out` 이 기대 출력입니다. `pg_regress` 가 둘을 실행/비교합니다.

```bash
docker compose --profile dev up -d
docker compose exec dev bash -c \
  "cd /build/myext && make installcheck \
     PGHOST=pg-study-lab03 PGUSER=postgres PGPASSWORD=postgres"
```
```
# +++ regress install-check in  +++
ok 1         - myext_basic                                38 ms
1..1
# All 1 tests passed.
```

실패하면 `ext/regression.diffs` 에 차이가 남습니다. 기대 출력을 새로 만들려면 `ext/results/myext_basic.out` 을 `ext/expected/` 로 복사하세요. (실제 extension 프로젝트들이 CI 에서 쓰는 방식과 같습니다.)

## ⚠️ 기억할 것

C extension 코드는 **서버 프로세스 안에서 직접 실행**됩니다. 세그폴트가 나면 해당 백엔드가 죽고, 최악의 경우 서버 전체가 재시작됩니다. 그래서 `myext.control` 에 `superuser = true`, `trusted = false` 를 두었습니다.
