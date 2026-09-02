# Lab 03 - 직접 해보기

C extension 은 "복잡할 것 같다"는 인상이 있지만, **파일 구성은 lab02 와 똑같습니다.** `.control` + `--<버전>.sql` 에 `.so` 하나가 추가될 뿐입니다.

```bash
./run.sh up      # 이미지 빌드 중에 myext.c 가 컴파일됩니다
./run.sh psql
```

---

## STEP 1 - 무엇이 만들어졌는지 먼저 보세요

```sql
\! ls -l /usr/lib/postgresql/16/lib/myext.so
\! ls -l /usr/share/postgresql/16/extension/ | grep myext
```

lab02 와 달리 **`$LIBDIR` 에 `.so` 가 하나 더 있습니다.** 그 안의 심볼을 보세요.

```sql
\! grep -E "myext|Pg_magic|_PG_init" /lab/myext.symbols
```

심볼이 12개 나옵니다 - C 함수 5개 + 각각의 `pg_finfo_*` 5개 + `_PG_init` + `Pg_magic_func`. `Pg_magic_func` 는 `.c` 파일에 쓴 `PG_MODULE_MAGIC;` 한 줄이 만든 것으로, **서버 버전이 다른 `.so` 를 로드하면 크래시 대신 명확한 에러를 내도록** 하는 장치입니다.

```sql
\! cat /usr/share/postgresql/16/extension/myext.control
\! cat /usr/share/postgresql/16/extension/myext--1.0.sql
```

<sub>이 lab 의 이미지는 멀티스테이지라 런타임 컨테이너에는 소스(`/build`)도 컴파일러도 없습니다. 설치된 사본을 봅니다. 소스를 직접 고치려면 아래 "더 해볼 것" 의 dev 컨테이너를 쓰세요.</sub>

`module_pathname = '$libdir/myext'` 가 있고, SQL 쪽은 `AS 'MODULE_PATHNAME', 'myext_add'` 형태입니다 - **"이 함수의 본체는 저 .so 안의 이 심볼"** 이라는 선언입니다.

---

## STEP 2 - `.so` 는 언제 로드되나

```sql
CREATE EXTENSION myext;
```

`CREATE EXTENSION` 은 대부분 카탈로그 작업입니다. 다만 **`CREATE FUNCTION ... LANGUAGE C` 는 심볼이 실제로 있는지 확인**하므로, **이 세션은 방금 `.so` 를 읽었습니다.** `_PG_init()` 이 등록하는 GUC 를 조회해보면 이미 있습니다.

```sql
SHOW myext.repeat_count;
```
→ `3`. 이 세션에서는 이미 `_PG_init()` 이 돌았습니다.

<sub>확인하고 싶으면 `.so` 를 치우고 `CREATE EXTENSION` 을 해보세요 - `ERROR: could not access file "$libdir/myext"` 로 **설치 자체가 실패**합니다.</sub>

**하지만 로딩은 세션(프로세스)마다입니다.** 새 세션은 아직 안 읽었습니다. **다른 터미널**을 하나 더 열어 확인해보세요.

```bash
./run.sh psql                          # 새 세션
study=# SHOW myext.repeat_count;
ERROR:  unrecognized configuration parameter "myext.repeat_count"

study=# SELECT myext_add(1, 1);        # 이 호출이 dlopen 을 일으킨다
study=# SHOW myext.repeat_count;       # 이제 3
```

첫 호출 때 `dlopen()` → `_PG_init()` 실행 → GUC 등록이 일어납니다. **이것이 "on-demand 로딩"입니다.** (`shared_preload_libraries` 는 이걸 서버 기동 시점으로 당겨 **모든** 백엔드에 적용하는 것 - lab07)

카탈로그에는 이렇게 기록되어 있습니다.

```sql
SELECT p.proname, l.lanname AS language, p.probin AS shared_library, p.prosrc AS c_symbol,
       p.proisstrict, p.provolatile
FROM   pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE  p.proname LIKE 'myext%' ORDER BY p.proname;
```

`lanname = c`, `probin` = `.so` 경로, `prosrc` = 심볼 이름. **이 세 개로 함수를 찾아갑니다.**

---

## STEP 3 - V1 호출 규약

SQL 값이 C 로 넘어가는 방식입니다. 그냥 써보면 평범한 함수처럼 보입니다.

```sql
SELECT myext_add(2, 3) AS simple, myext_add(-10, 4) AS negative;
```

C 로 짰으니 **오버플로도 C 답게** 동작합니다. 내장 `+` 와 비교해보세요.

```sql expect-error
SELECT 2147483647::int + 1;
```
```
ERROR:  integer out of range
```

```sql
SELECT myext_add(2147483647, 1) AS overflow;
```
```
  overflow
-------------
 -2147483648
```

내장 연산자는 막아주지만 **우리 C 함수는 조용히 wrap 됩니다.** `PG_RETURN_INT32(a + b)` 라고만 썼기 때문입니다. 실무 C extension 이라면 `pg_add_s32_overflow()` 같은 것으로 직접 검사해야 합니다. **서버 안에서 도는 코드의 안전은 작성자 책임이라는 것**을 보여주는 가장 짧은 예입니다.

문자열은 `text*` 로 넘어옵니다 - 길이가 앞에 붙은 varlena 구조라 널 종료 문자열이 아닙니다.

```sql
SELECT myext_hello('스터디'), myext_hello('') AS empty_string;
```

### STRICT 의 의미

```sql
SELECT myext_add(1, NULL) AS strict_result;
```
→ `NULL`. **C 코드는 아예 호출되지 않았습니다.** `STRICT` 로 선언했기 때문입니다.

`STRICT` 가 아닌 함수는 C 안에서 `PG_ARGISNULL()` 로 직접 검사해야 합니다.

```sql
SELECT myext_double_or_zero(21) AS with_value, myext_double_or_zero(NULL) AS with_null;
SELECT proname, proisstrict FROM pg_proc
WHERE proname IN ('myext_add','myext_double_or_zero') ORDER BY proname;
```

### volatility 는 플래너에게 주는 약속

```sql
SELECT proname, provolatile FROM pg_proc WHERE proname LIKE 'myext%' ORDER BY proname;
EXPLAIN (VERBOSE, COSTS OFF) SELECT myext_add(2, 3);
```
→ `IMMUTABLE` 이라 플래너가 **미리 계산해버립니다** (상수 폴딩). 잘못 선언하면 결과가 틀어집니다.

---

## STEP 4 - GUC: `_PG_init` 이 등록한 설정

새 psql 세션에서는 `.so` 가 아직 로드 전이므로 명시적으로 로드합니다.

```sql
LOAD 'myext';
SHOW myext.repeat_count;
```

```sql
SELECT myext_shout('pg') AS with_default;
SET myext.repeat_count = 5;
SELECT myext_shout('pg') AS with_5;
```

트랜잭션 안에서만 바꾸는 것도 됩니다 - **`SET LOCAL` 은 COMMIT 과 함께 되돌아갑니다.**

```sql
BEGIN;
SET LOCAL myext.repeat_count = 1;
SELECT myext_shout('pg') AS inside_txn;
COMMIT;
SELECT myext_shout('pg') AS after_txn;
```

범위를 벗어난 값은 `DefineCustomIntVariable` 에 준 `min_val`/`max_val` 로 막힙니다.

```sql
SELECT name, setting, min_val, max_val, context FROM pg_settings WHERE name LIKE 'myext%';
```
```sql expect-error
SET myext.repeat_count = 999;
```

---

## STEP 5 - SPI: C 함수 안에서 SQL 실행하기

```sql
CREATE TABLE sample_rows AS SELECT g AS id, 'row-' || g AS label FROM generate_series(1, 1234) g;
SELECT count(*) AS sql_count FROM sample_rows;
SELECT myext_count_rows('sample_rows') AS spi_count;
```

두 값이 같습니다. C 함수가 내부에서 `SELECT count(*)` 를 **직접 실행**한 결과입니다.

식별자 인용도 제대로 처리하는지 확인해보세요.

```sql
CREATE TABLE "weird name" (x int);
INSERT INTO "weird name" SELECT generate_series(1,7);
SELECT myext_count_rows('weird name') AS quoted_ok;
DROP TABLE "weird name";
```

없는 테이블을 주면 서버가 죽는 게 아니라 **평범한 SQL 에러**가 납니다.

```sql expect-error
SELECT myext_count_rows('no_such_table');
```

> C 함수는 서버 프로세스 **안에서** 돕니다. 잘못 짜면 백엔드를 통째로 죽일 수 있는데, `palloc`/`SPI`/`ereport` 같은 PostgreSQL 의 장치를 쓰면 이런 실수를 대부분 막아줍니다.

---

## STEP 6 - 왜 C 로 짜는가

같은 덧셈을 세 가지 언어로 만들어 100만 번씩 돌려보세요.

```sql
CREATE FUNCTION plpgsql_add(a int, b int) RETURNS int
LANGUAGE plpgsql IMMUTABLE STRICT AS $$ BEGIN RETURN a + b; END $$;
CREATE FUNCTION sql_add(a int, b int) RETURNS int
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT a + b $$;
```

```sql
\timing on
SELECT sum(myext_add(g, 1))   FROM generate_series(1, 1000000) g;
SELECT sum(sql_add(g, 1))     FROM generate_series(1, 1000000) g;
SELECT sum(plpgsql_add(g, 1)) FROM generate_series(1, 1000000) g;
\timing off
```

`sql_add` 는 플래너가 인라인해버려서 오히려 빠를 수 있습니다. **중요한 건 순위가 아니라 "왜 C 여야 하는가"** 입니다 - 새 타입, 새 인덱스 AM, 훅, 백그라운드 워커처럼 **SQL 로는 아예 표현할 수 없는 것**들이 C 의 영역입니다.

---

## 더 해볼 것

**호스트에서** `ext/myext.c` 를 고친 뒤, **빌드 도구가 든 dev 컨테이너**에서 다시 만듭니다. (서버 컨테이너에는 컴파일러도 소스도 없습니다 - 멀티스테이지 이미지라서 그렇습니다.)

```bash
docker compose --profile dev up -d
docker compose exec dev bash -c "cd /build/myext && make && make install"
```

`.so` 는 dev 컨테이너의 `$LIBDIR` 에 설치되므로, 서버 컨테이너에 반영하려면 이미지를 다시 빌드합니다.

```bash
./run.sh down && ./run.sh up
```

C extension 은 SQL-only 와 달리 **이미 `.so` 를 로드한 백엔드는 새 코드를 보지 못합니다.** 같은 이미지 안에서 바꿨더라도 psql 을 껐다 켜서(`\q` 후 `./run.sh psql`) 재접속해야 반영됩니다.

`ext/sql/` 과 `ext/expected/` 에 회귀 테스트가 있습니다 - `make installcheck` 로 돌려보세요.
