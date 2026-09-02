# Lab 01 - 직접 해보기

`CREATE EXTENSION` 이 내부에서 실제로 무엇을 하는지, 카탈로그를 직접 들여다보며 확인합니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 9.1 이전 방식을 그대로 재현해봅니다

옛날에는 contrib 를 이렇게 깔았습니다.

```
$ psql -d mydb -f /usr/share/postgresql/8.4/contrib/hstore.sql
```

지금도 똑같이 해볼 수 있습니다. 설치 스크립트에서 **안전장치 두 줄만 걷어내면** 그게 옛날 `hstore.sql` 입니다.

```sql
\! head -12 /usr/share/postgresql/16/extension/hstore--1.4.sql
```

맨 위의 `\echo Use "CREATE EXTENSION hstore" to load this file.` 가 그 안전장치입니다. `MODULE_PATHNAME` 도 `CREATE EXTENSION` 이 치환해주는 것이라 손으로 바꿔야 합니다.

```sql
\! sed -e '/^\\echo/d' -e 's|MODULE_PATHNAME|$libdir/hstore|g' /usr/share/postgresql/16/extension/hstore--1.4.sql > /tmp/oldway.sql
\! wc -l < /tmp/oldway.sql
\i /tmp/oldway.sql
```

동작은 완벽합니다.

```sql
SELECT 'a=>1, b=>2'::hstore -> 'a' AS 값, akeys('a=>1, b=>2'::hstore) AS 키목록;
```

**그런데 DB 는 이걸 패키지로 인식하지 않습니다.**

```sql
\dx
SELECT count(*) AS "hstore 가 만든 함수 수" FROM pg_proc WHERE probin LIKE '%hstore%';
SELECT count(*) AS "소속이 기록된 객체 수"
FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE d.deptype = 'e' AND e.extname = 'hstore';
```

함수는 수십 개인데 소속 기록은 **0 건**입니다. 백업을 떠보면 그 대가가 보입니다.

```sql
\! pg_dump -U postgres -d study | grep -c "^CREATE FUNCTION"
```
→ 이 개수만큼의 함수 정의가 백업에 통째로 박제됩니다. 지금이라면 `CREATE EXTENSION hstore;` 한 줄입니다.

### 이 상태에서 지우려고 하면

```sql expect-error
DROP TYPE hstore;
```
→ 딸린 객체가 너무 많아 거부됩니다. `CASCADE` 를 붙여야 하는데, 그러면 **무엇이 함께 지워지는지 알 수 없습니다.**

```sql expect-error
CREATE EXTENSION hstore;
```
→ 이미 같은 이름의 객체가 있어서 실패합니다. **옛날 방식으로 깔아둔 것은 나중에 extension 으로 승격시킬 수도 없습니다.**

### 손으로 정리하기

옛날엔 이런 코드를 직접 짜야 했습니다. **이 코드를 짜야 한다는 사실 자체가 요점입니다.**

```sql
SET client_min_messages = warning;
DROP TYPE IF EXISTS hstore CASCADE;
DROP TYPE IF EXISTS ghstore CASCADE;
DO $$
DECLARE r record;
BEGIN
    -- 인자가 internal 이라 타입에 딸려있지 않아 CASCADE 로도 안 지워지는 함수들
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             WHERE p.probin LIKE '%hstore%'
               AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
    LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END $$;
RESET client_min_messages;
```

이제 제대로 설치합니다. **한 줄입니다.**

```sql
CREATE EXTENSION hstore;
\dx hstore
```

---

## STEP 2 - Extension 은 결국 "파일 3종"

```sql
\! pg_config --sharedir
\! pg_config --pkglibdir
\! ls /usr/share/postgresql/16/extension/*.control | wc -l
```

`uuid-ossp` 를 예로 세 가지를 다 보세요.

```sql
\! ls -l /usr/share/postgresql/16/extension/ | grep uuid
\! ls -l /usr/lib/postgresql/16/lib/ | grep uuid
\! cat /usr/share/postgresql/16/extension/uuid-ossp.control
```

`.control` (이름표) + `--<버전>.sql` (설치 스크립트) + `.so` (C 코드). 이게 전부입니다. `.so` 가 없는 것도 있습니다 - SQL 만으로 된 extension 입니다.

```sql
\! cat /usr/share/postgresql/16/extension/intagg.control
```
→ `module_pathname` 이 **없습니다.** 치환할 `.so` 가 없다는 뜻입니다.

이름만 보고 짐작하면 안 됩니다. `unaccent` 는 "사전 파일을 읽는 extension" 같지만 그 사전을 읽는 코드가 C 로 짜여 있습니다.

```sql
\! grep module_pathname /usr/share/postgresql/16/extension/unaccent.control
\! ls -l /usr/lib/postgresql/16/lib/unaccent.so
```

---

## STEP 3 - `CREATE EXTENSION` 이 카탈로그에 남기는 흔적

설치 **전** 개수를 먼저 세두세요.

```sql
SELECT count(*) AS pg_extension_rows FROM pg_extension;
SELECT count(*) AS pg_proc_rows FROM pg_proc;
```

```sql
CREATE EXTENSION pgcrypto;
```

이제 다시 세보면 `pg_extension` 은 1 늘고 `pg_proc` 은 수십 개 늘었습니다.

```sql
SELECT count(*) FROM pg_extension;
SELECT count(*) FROM pg_proc;
SELECT oid, extname, extversion, extrelocatable FROM pg_extension WHERE extname = 'pgcrypto';
```

**pgcrypto 소속으로 등록된 함수가 몇 개인지** 세어보세요.

```sql
SELECT count(*) AS functions_owned_by_pgcrypto
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.classid='pg_proc'::regclass
  AND  d.deptype='e' AND e.extname='pgcrypto';
```

```sql
SELECT crypt('my_password', gen_salt('bf', 8)) AS bcrypt_hash;
```

설치된 것들의 상태를 한 번에 보는 쿼리 - **실무에서 그대로 쓸 수 있습니다.**

```sql
SELECT e.extname, e.extversion, av.default_version AS latest, n.nspname AS schema,
       CASE WHEN e.extversion <> av.default_version THEN '업그레이드 가능' ELSE '최신' END AS status
FROM   pg_extension e
JOIN   pg_available_extensions av ON av.name = e.extname
JOIN   pg_namespace n ON n.oid = e.extnamespace
ORDER  BY e.extname;
```

---

## STEP 4 - `pg_depend` 가 멤버십의 실체

`deptype` 한 글자가 관계의 종류를 정합니다.

```sql
SELECT deptype, count(*) FROM pg_depend GROUP BY deptype ORDER BY deptype;
```

| deptype | 뜻 |
|---|---|
| `e` | EXTENSION - extension 멤버, 단독 DROP 불가 |
| `n` | NORMAL - 일반 참조, DROP 시 CASCADE 필요 |
| `a` | AUTO - 부모 DROP 시 자동 삭제 |
| `i` | INTERNAL - 부모의 일부로 취급 |
| `p` | PIN - 시스템 객체, 삭제 불가 |
| `x` | AUTO_EXTENSION - extension 의 멤버는 아니지만, extension 없이는 동작할 수 없어 **함께 삭제되는** 객체 |

extension 별로 **어떤 종류의 객체를 몇 개** 갖고 있는지:

```sql
SELECT e.extname, d.classid::regclass AS object_catalog, count(*)
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
GROUP  BY e.extname, d.classid ORDER BY e.extname, count DESC;
```

이 `e` 한 글자 때문에 개별 삭제가 막힙니다. 직접 쳐서 에러를 보세요.

```sql expect-error
DROP FUNCTION gen_salt(text);
```
```
ERROR:  cannot drop function gen_salt(text) because extension pgcrypto requires it
```

---

## STEP 5 - 버전과 업그레이드 경로

```sql
SELECT name, version, installed FROM pg_available_extension_versions
WHERE name = 'hstore' ORDER BY version;
\! ls /usr/share/postgresql/16/extension/ | grep '^hstore--'
```

파일 이름이 곧 **그래프의 간선**입니다. `1.4--1.5.sql` 은 "1.4 에서 1.5 로 가는 길". PostgreSQL 은 이 그래프를 **BFS 로 탐색**해 최단 경로를 만듭니다.

```sql
SELECT source, target, path FROM pg_extension_update_paths('hstore')
WHERE source = '1.4' AND path IS NOT NULL ORDER BY target;
```
→ `path` 열에 `1.4--1.5--1.6--1.7--1.8` 처럼 **거쳐 갈 경로**가 나옵니다.

거꾸로(다운그레이드)는 대부분 경로가 없습니다.

```sql
SELECT source, target, coalesce(path, '(경로 없음)') AS path
FROM pg_extension_update_paths('hstore')
WHERE target = '1.4' AND source > '1.4' ORDER BY source LIMIT 5;
```

옛 버전으로 설치했다가 올려보세요.

```sql
DROP EXTENSION hstore CASCADE;
CREATE EXTENSION hstore VERSION '1.4';
SELECT extversion FROM pg_extension WHERE extname='hstore';
ALTER EXTENSION hstore UPDATE;
SELECT extversion FROM pg_extension WHERE extname='hstore';
```

---

## STEP 6 - requires · CASCADE · SCHEMA · trusted

### requires - 의존성

```sql
\! cat /usr/share/postgresql/16/extension/earthdistance.control
```
→ `requires = 'cube'` 가 보입니다. 의존 extension 이 없으면 거부됩니다.

```sql expect-error
CREATE EXTENSION earthdistance;
```
```
ERROR:  required extension "cube" is not installed
HINT:  Use CREATE EXTENSION ... CASCADE to install required extensions too.
```

```sql
CREATE EXTENSION earthdistance CASCADE;
SELECT extname, extversion FROM pg_extension WHERE extname IN ('cube','earthdistance');
```

extension 사이의 의존도 `pg_depend` 에 기록됩니다.

```sql
SELECT src.extname AS extension, tgt.extname AS depends_on, d.deptype
FROM   pg_depend d
JOIN   pg_extension src ON src.oid = d.objid    AND d.classid    = 'pg_extension'::regclass
JOIN   pg_extension tgt ON tgt.oid = d.refobjid AND d.refclassid = 'pg_extension'::regclass;
```

### SCHEMA - 어디에 설치할 것인가

```sql
CREATE SCHEMA ext;
CREATE EXTENSION citext SCHEMA ext;
SELECT e.extname, n.nspname AS schema, e.extrelocatable
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname='citext';
```

`extrelocatable = true` 면 나중에 옮길 수도 있습니다.

```sql
ALTER EXTENSION citext SET SCHEMA public;
SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='citext';
```

### trusted - 일반 유저도 설치할 수 있는가

```sql
\! grep -l "trusted = true" /usr/share/postgresql/16/extension/*.control | xargs -n1 basename | sed 's/.control//' | head -20
```

직접 확인해보세요. superuser 가 아닌 역할로 바꿔서 설치해봅니다.

```sql
DROP EXTENSION citext;
CREATE ROLE app_user LOGIN;
GRANT CREATE ON DATABASE study TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;
SET ROLE app_user;
```

```sql
CREATE EXTENSION citext;
```
→ `trusted = true` 라서 **성공합니다.**

```sql expect-error
CREATE EXTENSION pageinspect;
```
```
ERROR:  permission denied to create extension "pageinspect"
HINT:  Must be superuser to create this extension.
```
→ `superuser = true` 인 extension 은 거부됩니다. **클라우드 매니지드 DB 에서 막히는 이유가 이것입니다.**

```sql
RESET ROLE;
```

---

## 정리

이 lab 에서 확인한 것을 한 문장으로 줄이면: **`CREATE EXTENSION` 은 스크립트를 실행하면서, 그 안에서 만들어진 모든 객체에 `pg_depend.deptype='e'` 도장을 찍는 명령입니다.** 나머지는 전부 이 한 줄에서 파생됩니다.

전체 흐름을 한 번에 다시 보려면 `./run.sh`.
