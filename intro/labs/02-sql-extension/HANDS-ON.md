# Lab 02 - 직접 해보기

lab00 에서는 파일을 손으로 놓았습니다. 여기서는 **PGXS 로 제대로 빌드**하고, 업그레이드 스크립트와 `pg_dump` 연동까지 갑니다.

```bash
./run.sh up
./run.sh psql
```

`ext/` 디렉토리가 컨테이너의 `/build/greetkor` 로 마운트되어 있습니다. 호스트에서 에디터로 고치면 컨테이너에 곧바로 반영됩니다.

---

## STEP 1 - 소스를 먼저 읽어보세요

```sql
\! ls /build/greetkor
\! cat /build/greetkor/greetkor.control
```

`module_pathname` 이 주석 처리되어 있습니다 → **SQL-only extension** (`.so` 없음). `trusted = true` 라서 superuser 없이도 설치할 수 있습니다.

```sql
\! cat /build/greetkor/Makefile
```

`EXTENSION` 과 `DATA` 두 줄이 핵심입니다. `PGXS := $(shell pg_config --pgxs)` 가 **PostgreSQL 이 어디에 설치되어 있는지 pg_config 에게 물어봐서** 알아서 경로를 잡아줍니다. OS·버전·설치 방식이 달라도 `make install` 하나로 끝나는 이유입니다.

```sql
\! cat /build/greetkor/greetkor--1.0.sql
```

맨 위 한 줄을 눈여겨보세요.

```
\echo Use "CREATE EXTENSION greetkor" to load this file. \quit
```

이 파일을 `psql -f` 로 실행하면 `\quit` 때문에 아무 일도 일어나지 않습니다. **`CREATE EXTENSION` 은 이 파일을 `\echo` 를 무시하는 방식으로 읽기 때문에** 통과합니다. lab01 에서 옛날 방식을 재현할 때 `sed` 로 걷어냈던 바로 그 안전장치입니다.

---

## STEP 2 - 빌드해서 설치

```sql
\! cd /build/greetkor && make install 2>&1 | tail -5
\! ls -l /usr/share/postgresql/16/extension/ | grep greetkor
```

`make install` 이 한 일은 **파일 복사뿐**입니다. 컴파일할 C 코드가 없으니까요.

이제 PostgreSQL 이 인식합니다.

```sql
SELECT name, default_version, comment FROM pg_available_extensions WHERE name='greetkor';
SELECT name, version, installed, trusted, relocatable
FROM pg_available_extension_versions WHERE name='greetkor' ORDER BY version;
```

아직 설치는 안 했으니 함수는 없습니다.

```sql expect-error
SELECT greet('세계');
```

`default_version` 은 1.1 이지만, **일부러 1.0 으로 설치**해서 업그레이드를 해보겠습니다.

```sql
CREATE EXTENSION greetkor VERSION '1.0';
SELECT extname, extversion FROM pg_extension WHERE extname='greetkor';
SELECT greet('세계'), farewell('세계');
```

---

## STEP 3 - 스크립트가 만든 객체는 어떻게 소속이 되었나

`greetkor--1.0.sql` 안에는 그냥 `CREATE FUNCTION` 두 개뿐입니다. 소속을 지정하는 코드는 한 줄도 없습니다. 그런데:

```sql
SELECT d.classid::regclass AS catalog,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT p.proname FROM pg_proc  p WHERE p.oid=d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT c.relname FROM pg_class c WHERE c.oid=d.objid)
         ELSE d.objid::text END AS object_name,
       d.deptype
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='greetkor';
```

`CREATE EXTENSION` 이 스크립트를 실행하는 동안 서버 안에서 `creating_extension = true` 가 켜지고, 그 사이에 만들어진 모든 객체에 도장이 찍힙니다.

```sql expect-error
DROP FUNCTION greet(text);
```

```sql
\dx+ greetkor
```

---

## STEP 4 - 업그레이드

```sql
SELECT source, target, path FROM pg_extension_update_paths('greetkor') WHERE path IS NOT NULL;
SELECT greet('세계') AS before_upgrade;
```

```sql
\! cat /build/greetkor/greetkor--1.0--1.1.sql
```

업그레이드 스크립트가 하는 일 세 가지를 확인하세요 - **새 함수 추가**, **기존 함수를 `CREATE OR REPLACE` 로 교체**(`DROP` 하면 `pg_depend` 가 끊어집니다), **설정 테이블 생성**.

```sql
ALTER EXTENSION greetkor UPDATE TO '1.1';
SELECT extversion FROM pg_extension WHERE extname='greetkor';
SELECT greet('세계') AS after_upgrade;
```

새로 생긴 함수도 써보세요. `greet_time` 은 `extract(hour FROM ...)` 을 쓰므로 **세션 `TimeZone` 을 탑니다.** 컨테이너 기본값이 `Etc/UTC` 라, 그대로 두면 `09:00+09` 가 0시로 읽혀 셋 다 "아침"이 나옵니다.

```sql
SET TimeZone = 'Asia/Seoul';
SELECT greet_time('세계', '2026-08-30 09:00+09') AS morning,
       greet_time('세계', '2026-08-30 14:00+09') AS afternoon,
       greet_time('세계', '2026-08-30 21:00+09') AS evening;
RESET TimeZone;
```

> 시각을 다루는 함수를 extension 에 넣을 때 흔히 밟는 지뢰입니다. `TimeZone` 은 **세션 설정**이라 같은 함수가 접속마다 다르게 답할 수 있습니다. 절대 기준이 필요하면 `at AT TIME ZONE 'Asia/Seoul'` 처럼 함수 안에서 못 박으세요.

새로 생긴 테이블과, 그 테이블이 `pg_extension` 에 등록된 모습:

```sql
SELECT * FROM greetkor_config;
SELECT extname, extconfig::regclass[] AS tables, extcondition FROM pg_extension WHERE extname='greetkor';
\dx+ greetkor
```

`extconfig` 에 들어간 이유는 업그레이드 스크립트 마지막 줄 때문입니다.

```sql
-- greetkor--1.0--1.1.sql 안에 있던 한 줄
-- SELECT pg_extension_config_dump('greetkor_config', '');
SELECT 1;
```

---

## STEP 5 - `pg_dump` 는 extension 을 어떻게 덤프하나

사용자가 설정을 하나 추가했다고 해봅시다.

```sql
INSERT INTO greetkor_config VALUES ('timezone', 'Asia/Seoul') ON CONFLICT (key) DO NOTHING;
```

이제 백업을 떠서 `greetkor` 가 어떻게 나오는지 보세요.

```sql
\! pg_dump -U postgres -d study | grep -i greetkor
```

확인할 것 두 가지입니다.

1. **함수 정의가 없습니다.** `CREATE EXTENSION IF NOT EXISTS greetkor` 한 줄뿐입니다. → 복원할 때 그쪽 서버의 `greetkor--1.1.sql` 을 다시 실행하는 방식이라, 백업이 가볍습니다.
2. **`greetkor_config` 의 데이터는 `COPY` 로 들어 있습니다.** → `pg_extension_config_dump()` 로 등록했기 때문입니다. 사용자가 넣은 설정은 살려야 하니까요.

일반 테이블과 비교해보세요.

```sql
CREATE TABLE plain_table (id int primary key, memo text);
INSERT INTO plain_table VALUES (1, 'hello');
\! pg_dump -U postgres -d study | grep -A6 "CREATE TABLE public.plain_table"
```
→ 일반 테이블은 **구조와 데이터가 모두** 덤프됩니다.

---

## STEP 6 - 개발 루프: 고치고 다시 설치

**호스트에서** `ext/greetkor--1.0--1.1.sql` 을 열어 `greet()` 문구를 바꿔보세요. 그리고 psql 로 돌아와서:

```sql
\! cd /build/greetkor && make install 2>&1 | tail -3
DROP EXTENSION greetkor;
CREATE EXTENSION greetkor;
SELECT greet('스터디');
```

SQL-only extension 의 개발 루프는 이게 전부입니다 - **서버 재시작 없음.** C extension 은 이야기가 다릅니다 (`.so` 를 이미 로드한 백엔드는 재접속이 필요합니다). → **lab03**

---

## 더 해볼 것

- `greetkor--1.1--1.2.sql` 을 새로 만들고 `Makefile` 의 `DATA` 에 추가한 뒤 `make install` → `pg_extension_update_paths('greetkor')` 에 경로가 생기는지 확인
- `.control` 의 `trusted = true` 를 지우고 `make install` 후, 일반 유저로 설치가 막히는지 확인
