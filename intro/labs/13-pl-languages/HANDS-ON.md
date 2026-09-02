# Lab 13 - 직접 해보기 · (j) 절차적 언어

**extension 이 "PostgreSQL 안에서 쓸 수 있는 언어" 자체를 추가하는** 부류입니다. 다른 어떤 부류와도 다른 카탈로그를 건드립니다 - **`pg_language`**.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - `pg_language` 에 행이 늘어납니다

설치 **전** 목록을 먼저 보세요.

```sql
SELECT lanname AS 언어, lanpltrusted AS trusted, lanplcallfoid::regproc AS handler
FROM   pg_language ORDER BY oid;
```
→ `internal`, `c`, `sql`, `plpgsql` 넷뿐입니다.

`plpgsql` 도 사실 **extension** 입니다. 기본으로 설치되어 있을 뿐입니다.

```sql
SELECT extname, extversion FROM pg_extension WHERE extname='plpgsql';
```

```sql
CREATE EXTENSION plpython3u;
CREATE EXTENSION plperl;
SELECT lanname AS 언어, lanpltrusted AS trusted, lanplcallfoid::regproc AS handler
FROM   pg_language ORDER BY oid;
```

**Python 과 Perl 이 늘었습니다.**

```sql
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_language'::regclass) AS 언어,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)     AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)     AS 타입
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND  e.extname IN ('plpgsql','plpython3u','plperl')
GROUP  BY e.extname ORDER BY e.extname;
```

언어 하나에 **함수 세 개**가 딸려옵니다.

```sql
SELECT l.lanname AS 언어,
       l.lanplcallfoid::regproc AS "handler (함수 실행)",
       l.laninline::regproc     AS "inline (DO 블록)",
       l.lanvalidator::regproc  AS "validator (문법 검사)"
FROM   pg_language l WHERE l.lanispl ORDER BY l.lanname;
```

그리고 **그 handler 들은 전부 C 로 구현되어 있습니다.**

```sql
SELECT p.proname AS handler, l.lanname AS "구현 언어", p.probin AS "공유 라이브러리"
FROM   pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE  p.proname IN ('plpgsql_call_handler','plpython3_call_handler','plperl_call_handler');
```

> **결국 lab03 의 C extension 입니다.** handler 가 하는 일은 "함수 본문 텍스트를 받아 → 해당 언어 인터프리터를 띄워 → 인자를 그 언어의 값으로 바꿔 → 실행하고 → 결과를 다시 PostgreSQL 값으로 바꾸는" 것입니다.

---

## STEP 2 - Python 으로 함수 짜기

```sql
CREATE FUNCTION py_add(a int, b int) RETURNS int
LANGUAGE plpython3u AS $$
    return a + b
$$;
SELECT py_add(2, 3) AS 결과;
```

### 타입이 어떻게 넘어오는지 반드시 확인하세요

**여기가 이 lab 에서 가장 실수하기 쉬운 부분입니다.**

```sql
CREATE FUNCTION py_typecheck(
    i int, b bigint, n numeric, t text, bl boolean,
    arr int[], j jsonb, d date, ts timestamptz
) RETURNS text
LANGUAGE plpython3u AS $$
    return "\n".join([
        f"int         -> {type(i).__name__}  ({i})",
        f"bigint      -> {type(b).__name__}  ({b})",
        f"numeric     -> {type(n).__name__}  ({n})",
        f"text        -> {type(t).__name__}  ({t})",
        f"boolean     -> {type(bl).__name__}  ({bl})",
        f"int[]       -> {type(arr).__name__}  ({arr})",
        f"jsonb       -> {type(j).__name__}  ({j})",
        f"date        -> {type(d).__name__}  ({d})",
        f"timestamptz -> {type(ts).__name__}  ({ts})",
    ])
$$;
SELECT py_typecheck(1, 2, 3.5, 'hi', true, ARRAY[1,2,3], '{"k":"v"}'::jsonb,
                    DATE '2026-08-31', TIMESTAMPTZ '2026-08-31 09:00+09');
```

출력을 자세히 보세요. **예상과 다른 것이 셋 있습니다.**

| SQL 타입 | 예상 | 실제 |
|---|---|---|
| `numeric` | `float` | **`Decimal`** - 정밀도 유지를 위해서입니다 |
| `jsonb` | `dict` | **`str`** - 직접 `json.loads()` 해야 합니다 |
| `date` / `timestamptz` | `datetime.date` | **`str`** - 직접 파싱해야 합니다 |

`jsonb` 를 dict 로 착각하고 `j["k"]` 를 쓰면 런타임 에러가 납니다. 제대로 쓰면 이렇습니다.

```sql
CREATE FUNCTION py_json_keys(j jsonb) RETURNS text[]
LANGUAGE plpython3u AS $$
    import json
    return sorted(json.loads(j).keys())
$$;
SELECT py_json_keys('{"b":2, "a":1, "c":3}'::jsonb) AS 키목록;
```

NULL 은 `None` 으로 옵니다.

```sql
CREATE FUNCTION py_nullable(t text) RETURNS text
LANGUAGE plpython3u AS $$
    if t is None:
        return "받은 값이 NULL 입니다"
    return f"받은 값: {t}"
$$;
SELECT py_nullable('hello') AS 값이_있을_때, py_nullable(NULL) AS NULL_일_때;
```

`yield` 로 여러 행을 돌려줄 수 있고, 복합 타입은 dict 로 돌려줍니다.

```sql
CREATE FUNCTION py_split(s text, sep text) RETURNS SETOF text
LANGUAGE plpython3u AS $$
    for part in s.split(sep):
        yield part.strip()
$$;
SELECT * FROM py_split('사과, 배, 감, 귤', ',');
```

```sql
CREATE TYPE parsed_url AS (scheme text, host text, path text, port int);
CREATE FUNCTION py_parse_url(u text) RETURNS parsed_url
LANGUAGE plpython3u AS $$
    from urllib.parse import urlparse
    p = urlparse(u)
    return {"scheme": p.scheme, "host": p.hostname, "path": p.path, "port": p.port}
$$;
SELECT * FROM py_parse_url('https://www.postgresql.org:443/docs/16/plpython.html');
```

---

## STEP 3 - Python 을 쓰는 진짜 이유

**표준 라이브러리**입니다. SQL 로 짜면 괴로운 것들이 몇 줄로 끝납니다.

```sql
CREATE FUNCTION py_parse_log(line text) RETURNS TABLE(ts text, level text, msg text)
LANGUAGE plpython3u AS $$
    import re
    m = re.match(r'^\[(?P<ts>[^\]]+)\]\s+(?P<level>[A-Z]+)\s+(?P<msg>.*)$', line)
    if m:
        yield (m.group('ts'), m.group('level'), m.group('msg'))
$$;
SELECT * FROM py_parse_log('[2026-08-31 09:12:03] ERROR connection timeout after 30s');
```

```sql
CREATE FUNCTION py_business_days(a date, b date) RETURNS int
LANGUAGE plpython3u AS $$
    from datetime import date, timedelta
    d   = date.fromisoformat(a)     # ⚠ date 도 str 로 넘어옵니다
    end = date.fromisoformat(b)
    n = 0
    while d < end:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n
$$;
SELECT py_business_days('2026-08-31', '2026-09-14') AS "2주간 영업일";
```

```sql
CREATE FUNCTION py_slug(t text) RETURNS text
LANGUAGE plpython3u AS $$
    import unicodedata, re
    s = unicodedata.normalize('NFKD', t)
    s = re.sub(r'[^\w\s-]', '', s).strip().lower()
    return re.sub(r'[-\s]+', '-', s)
$$;
SELECT py_slug('Hello, World!  PostgreSQL Extension 스터디') AS slug;
```

### SPI - 함수 안에서 SQL 실행하기

```sql
CREATE TABLE orders (id serial PRIMARY KEY, customer text, amount numeric, created date);
INSERT INTO orders (customer, amount, created)
SELECT (ARRAY['김철수','이영희','박민수'])[1+(g%3)], (g % 50 + 1) * 1000, DATE '2026-08-01' + (g % 30)
FROM generate_series(1, 300) g;
```

```sql
CREATE FUNCTION py_customer_report(name text) RETURNS text
LANGUAGE plpython3u AS $$
    plan = plpy.prepare(
        "SELECT count(*) AS n, sum(amount) AS total, max(created) AS last "
        "FROM orders WHERE customer = $1", ["text"])
    row = plpy.execute(plan, [name])[0]
    if row["n"] == 0:
        return f"{name}: 주문 없음"
    return (f"{name}: {row['n']}건, 총 {int(row['total']):,}원, 마지막 주문 {row['last']}")
$$;
SELECT py_customer_report('김철수') AS 리포트;
SELECT py_customer_report('없는사람') AS 리포트;
```

> ⚠️ `plpy.execute("... " + name)` 처럼 문자열을 이어붙이면 **SQL 인젝션**입니다. 반드시 `plpy.prepare` 로 파라미터를 바인딩하세요 (`plpy.quote_literal` / `quote_ident` 도 있습니다).

`plpy.notice` / `plpy.error` 로 PostgreSQL 의 로그·예외 체계에 참여합니다.

```sql
CREATE FUNCTION py_with_log(n int) RETURNS int
LANGUAGE plpython3u AS $$
    plpy.notice(f"입력값은 {n} 입니다")
    if n < 0:
        plpy.error("음수는 처리할 수 없습니다")
    return n * 2
$$;
SELECT py_with_log(21);
```
```sql expect-error
SELECT py_with_log(-1);
```

---

## STEP 4 - `plpython3u` 의 `u` - 여기가 가장 중요합니다

```sql
SELECT lanname AS 언어, lanpltrusted AS trusted,
       CASE WHEN lanpltrusted THEN '일반 유저도 함수 작성 가능'
            ELSE 'superuser 만 함수 작성 가능' END AS 의미
FROM   pg_language WHERE lanispl ORDER BY lanname;
```

`plpython3u` 는 **untrusted** 입니다. 무슨 뜻인지 직접 확인하세요.

```sql
CREATE FUNCTION py_read_server_file(path text) RETURNS text
LANGUAGE plpython3u AS $$
    with open(path) as f:
        return f.read()[:120]
$$;
SELECT py_read_server_file('/etc/hostname') AS "서버 파일을 읽었다";
```

```sql
CREATE FUNCTION py_run_shell() RETURNS text
LANGUAGE plpython3u AS $$
    import subprocess
    return subprocess.run(['whoami'], capture_output=True, text=True).stdout.strip()
$$;
SELECT py_run_shell() AS "쉘 명령을 실행했다";
```

**DB 함수가 서버의 파일을 읽고 쉘 명령을 실행했습니다.** Python 은 샌드박싱이 불가능해서 **trusted 버전이 아예 없습니다.**

그래서 일반 유저에게는 막혀 있습니다.

```sql
CREATE ROLE app_user LOGIN;
GRANT CREATE ON SCHEMA public TO app_user;
SET ROLE app_user;
```
```sql expect-error
CREATE FUNCTION bad() RETURNS text LANGUAGE plpython3u AS 'return open("/etc/passwd").read()';
```
```
ERROR:  permission denied for language plpython3u
```

Perl 은 다릅니다 - **trusted 버전이 있습니다.**

```sql
CREATE FUNCTION ok_perl(t text) RETURNS text LANGUAGE plperl AS 'return uc($_[0]);';
RESET ROLE;
SELECT ok_perl('hello') AS "trusted 언어로 만든 함수";
```

trusted 라는 것은 **샌드박스 안에서만 돈다**는 뜻입니다.

```sql expect-error
CREATE FUNCTION perl_read() RETURNS text LANGUAGE plperl AS 'open(F, "/etc/hostname"); return <F>;';
SELECT perl_read();
```
```
ERROR:  'open' trapped by operation mask
```

| 언어 | 종류 | 비고 |
|---|---|---|
| `plpgsql` | trusted | 기본 제공. SQL 중심 로직 |
| `plperl` | trusted | 샌드박스. 파일/네트워크 차단 |
| `plperlu` | untrusted | 제한 없음. superuser 전용 |
| **`plpython3u`** | **untrusted** | 제한 없음. **trusted 버전이 없음** |
| `pltcl` | trusted | `pltclu` 가 untrusted 버전 |
| `plv8` | trusted | JavaScript. V8 샌드박스 |

> **그래서 클라우드 매니지드 DB 는 대개 `plpython3u` 를 제공하지 않습니다.** 하나의 DB 를 여러 고객이 쓰는 환경에서 임의 코드 실행을 허용할 수 없기 때문입니다.

정리해둡시다.

```sql
DROP FUNCTION py_read_server_file(text);
DROP FUNCTION py_run_shell();
```

---

## STEP 5 - 성능: 공짜가 아닙니다

```sql
CREATE TABLE bench AS SELECT g AS id, 'text-' || g AS t FROM generate_series(1, 200000) g;
CREATE FUNCTION sql_upper(t text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT upper(t) $$;
CREATE FUNCTION plpgsql_upper(t text) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$ BEGIN RETURN upper(t); END $$;
CREATE FUNCTION py_upper(t text) RETURNS text LANGUAGE plpython3u IMMUTABLE STRICT AS $$ return t.upper() $$;
CREATE FUNCTION perl_upper(t text) RETURNS text LANGUAGE plperl IMMUTABLE STRICT AS $$ return uc($_[0]); $$;
```

```sql
\timing on
SELECT count(upper(t))         FROM bench;
SELECT count(sql_upper(t))     FROM bench;
SELECT count(plpgsql_upper(t)) FROM bench;
SELECT count(perl_upper(t))    FROM bench;
SELECT count(py_upper(t))      FROM bench;
\timing off
```

**내장 `upper()` 가 압도적입니다.** 행마다 인터프리터를 오가는 비용이 붙기 때문입니다. **Python 은 "빠르게" 쓰는 도구가 아니라 "SQL 로 표현하기 어려운 것"을 쓰는 도구입니다.**

인터프리터는 **백엔드 프로세스마다 하나씩** 뜹니다.

```sql
CREATE FUNCTION py_interp_info() RETURNS text
LANGUAGE plpython3u AS $$
    import sys, os
    return f"pid={os.getpid()}  python={sys.version.split()[0]}"
$$;
SELECT py_interp_info() AS "이 세션의 인터프리터";
\! psql -U postgres -d study -tAc "SELECT py_interp_info();" | sed 's/^/  다른 세션: /'
```
→ **pid 가 다릅니다.** 연결이 100개면 인터프리터도 100개 - 메모리를 그만큼 씁니다. 전역 변수도 세션 간에 공유되지 않습니다 (`GD` / `SD` 딕셔너리는 세션 안에서만 유효합니다).

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | **`pg_language`** + handler/inline/validator 함수 |
| 진짜 구현 | handler 는 결국 **C extension** (lab03) |
| 판단 기준 | 표준 라이브러리·복잡한 알고리즘이 필요할 때만. 단순 연산은 SQL 이 훨씬 빠릅니다 |
| 보안 | **untrusted 는 서버에서 임의 코드 실행** - 매니지드 DB 에서 대개 불가 |
