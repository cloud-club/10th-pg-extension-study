# Lab 00 - 직접 해보기

`./run.sh` 는 스크립트를 자동으로 흘려보냅니다. 여기서는 **직접 쳐보면서** 진행합니다. 자동 스크립트는 실패를 `DO ... EXCEPTION` 으로 감싸 NOTICE 로 바꿔놓는데, 직접 치면 **진짜 에러 메시지**를 보게 됩니다 - 그게 이 lab 의 핵심입니다.

```bash
./run.sh up      # 컨테이너만 기동 (스크립트는 실행하지 않음)
./run.sh psql    # psql 접속 -  study=#  프롬프트가 뜹니다
```

끝내려면 `\q`, 처음부터 다시 하려면 `./run.sh down && ./run.sh up`.

---

## STEP 1 - 옛날 방식으로 먼저 만들어봅니다

9.1 이전에는 extension 이라는 개념이 없었습니다. 그냥 함수를 만들었습니다.

```sql
CREATE FUNCTION old_hello(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT 'Hello, ' || name || '!' $$;

SELECT old_hello('세계');
```

잘 됩니다. **"그럼 extension 이 왜 필요하지?"** 라는 의문이 드는 게 정상입니다. 아래 셋을 확인해두고 넘어가세요.

```sql
\dx
```
→ 목록에 `old_hello` 가 **없습니다.** DB 는 이걸 패키지로 보지 않습니다.

```sql
SELECT count(*) FROM pg_depend d JOIN pg_proc p ON p.oid = d.objid
WHERE p.proname = 'old_hello' AND d.deptype = 'e';
```
→ **0 건.** 소속이 어디에도 기록되지 않았습니다. 함수가 100개라면 어느 게 이 패키지 소속인지 아무도 모릅니다.

버전이라는 개념도 없습니다. `old_hello` 가 몇 버전인가요? 답할 방법이 없습니다.

---

## STEP 2 - 같은 함수를 extension 으로

지금은 `hello` 라는 extension 이 존재하지 않습니다.

```sql
SELECT count(*) FROM pg_available_extensions WHERE name = 'hello';
```
→ `0`

### 파일 ① - `hello.control` (이름표)

psql 의 `\!` 는 **호스트가 아니라 컨테이너 안**에서 쉘 명령을 실행합니다.

```sql
\! printf "%s\n" "comment = '내가 만든 첫 extension'" "default_version = '1.0'" "relocatable = true" > /usr/share/postgresql/16/extension/hello.control
\! cat /usr/share/postgresql/16/extension/hello.control
```

세 줄이 전부입니다. `module_pathname` 이 없으므로 `.so` 파일도 필요 없습니다 (= SQL-only extension).

### 파일 ② - `hello--1.0.sql` (설치 스크립트)

파일명 규칙은 `<이름>--<버전>.sql` 입니다.

```sql
\! printf "%s\n" "CREATE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT 'Hello, ' || name || '!' \$\$;" > /usr/share/postgresql/16/extension/hello--1.0.sql
\! cat /usr/share/postgresql/16/extension/hello--1.0.sql
```

### 끝입니다

서버 재시작도, 등록 절차도 없습니다. PostgreSQL 은 이 디렉토리를 그때그때 읽습니다.

```sql
SELECT name, default_version, comment FROM pg_available_extensions WHERE name = 'hello';
```
→ 방금 만든 파일이 그대로 보입니다.

```sql
CREATE EXTENSION hello;
SELECT hello('세계'), hello('PG 스터디');
```

---

## STEP 3 - 방금 무슨 일이 일어났나

```sql
SELECT oid, extname, extversion, extrelocatable FROM pg_extension WHERE extname = 'hello';
```

`hello--1.0.sql` 안에는 그냥 `CREATE FUNCTION` 만 썼는데, **소속 도장이 자동으로 찍혔습니다.**

```sql
SELECT p.proname AS 함수, e.extname AS 소속, d.deptype
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
JOIN   pg_proc p      ON p.oid = d.objid
WHERE  d.refclassid = 'pg_extension'::regclass
  AND  d.classid    = 'pg_proc'::regclass
  AND  d.deptype    = 'e' AND e.extname = 'hello';
```
→ `deptype = e`. **이 한 글자가 extension 시스템의 전부입니다.**

그래서 이제 함수를 개별로 지울 수 없습니다. 직접 쳐서 에러를 보세요.

```sql expect-error
DROP FUNCTION hello(text);
```
```
ERROR:  cannot drop function hello(text) because extension hello requires it
HINT:  You can drop extension hello instead.
```

대신 extension 을 지우면 함께 사라집니다.

```sql
DROP EXTENSION hello;
```
```sql expect-error
SELECT hello('세계');
```
```
ERROR:  function hello(unknown) does not exist
```

다음 단계를 위해 다시 설치합니다.

```sql
CREATE EXTENSION hello;
```

---

## STEP 4 - 배포 후 기능을 추가하려면

이미 `1.0` 을 쓰고 있는 사람이 있습니다. 파일명 규칙은 `<이름>--<이전>--<이후>.sql`.

```sql
\! printf "%s\n" "CREATE FUNCTION bye(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT 'Bye, ' || name || '!' \$\$;" "CREATE OR REPLACE FUNCTION hello(name text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT '안녕하세요, ' || name || '님!' \$\$;" > /usr/share/postgresql/16/extension/hello--1.0--1.1.sql
```

> 기존 함수를 고칠 때는 반드시 `CREATE OR REPLACE` 입니다. `DROP` 후 `CREATE` 하면 `pg_depend` 의 소속 기록이 끊어집니다.

새로 설치하는 사람이 곧바로 1.1 을 받도록 `default_version` 도 올립니다.

```sql
\! printf "%s\n" "comment = '내가 만든 첫 extension'" "default_version = '1.1'" "relocatable = true" > /usr/share/postgresql/16/extension/hello.control
SELECT * FROM pg_extension_update_paths('hello');
```
→ `1.0 → 1.1` 경로가 인식됩니다.

```sql
ALTER EXTENSION hello UPDATE TO '1.1';
SELECT hello('세계') AS 바뀐_함수, bye('세계') AS 새_함수;
\dx hello
```

새로 추가한 `bye()` 도 자동으로 extension 소속이 되었습니다.

```sql
\dx+ hello
```

---

## STEP 5 - `old_hello` vs `hello`

같은 일을 하는 함수인데 포장했느냐만 다릅니다. 직접 비교해보세요.

```sql
SELECT 'old_hello' AS 방식, count(*) AS 소속기록
FROM pg_depend d JOIN pg_proc p ON p.oid=d.objid
WHERE p.proname='old_hello' AND d.deptype='e'
UNION ALL
SELECT 'hello', count(*)
FROM pg_depend d JOIN pg_proc p ON p.oid=d.objid
JOIN pg_extension e ON e.oid=d.refobjid
WHERE e.extname='hello' AND d.deptype='e';
```

가장 큰 차이는 **백업**에서 드러납니다. 새 터미널을 하나 더 여세요.

```bash
./run.sh shell
pg_dump -U postgres -d study | grep -A3 'old_hello'      # 함수 정의가 통째로 박제된다
pg_dump -U postgres -d study | grep 'CREATE EXTENSION'   # extension 은 한 줄
exit
```

함수가 하나일 땐 사소해 보이지만, hstore 처럼 **57개면 백업에 57개 정의가 박제**됩니다. 그 규모를 실제 contrib 로 재현한 것이 **lab01** 입니다.

---

## 더 해볼 것

`hello--1.0.sql` 에 함수를 하나 더 붙이고 다시 설치해보세요.

```sql
\! printf "%s\n" "CREATE FUNCTION shout(t text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT upper(t) || '!!!' \$\$;" >> /usr/share/postgresql/16/extension/hello--1.0.sql
DROP EXTENSION hello;
CREATE EXTENSION hello VERSION '1.0';
SELECT shout('pg study');
```

`ext/` 디렉토리에 완성본이 들어있으니 에디터로 열어 비교해보세요. 전체 흐름을 한 번에 다시 보고 싶으면 `./run.sh` 를 돌리면 됩니다.
