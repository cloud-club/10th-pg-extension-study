# Lab 00 - 가장 간단한 Extension 만들기

```bash
./run.sh          # 약 7초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


**Extension 을 만드는 데 정말로 필요한 건 텍스트 파일 두 개뿐입니다.** 컴파일러도, Makefile 도, 빌드 도구도 없이 시작합니다.

## 진행 순서

| 스크립트 | 내용 |
|---|---|
| `00-the-old-way.sql` | **먼저 9.1 이전 방식으로** `old_hello()` 를 만들어본다 |
| `01-build-from-scratch.sql` | control 파일 + SQL 파일을 **psql 안에서 직접 만들어** `CREATE EXTENSION` 까지 |
| `02-add-a-version.sql` | 배포 후 기능 추가하기 - 업그레이드 스크립트 + `default_version` |
| `03-package-it.sql` | 남에게 나눠주려면? PGXS Makefile 4줄 |
| `04-compare.sql` | **`old_hello` vs `hello` 나란히 비교** - 무엇이 달라졌나 |

> 같은 일을 하는 함수를 **두 가지 방식으로** 만들어 놓고 끝에서 비교합니다. "extension 이 왜 필요한가"에 대한 가장 짧은 답이 이 대조표입니다.

## 만들어지는 것

```
hello.control          # 3줄 - extension 의 이름표
hello--1.0.sql         # 3줄 - 설치 스크립트
hello--1.0--1.1.sql    # 업그레이드 스크립트
```

```ini
# hello.control 전체 (STEP 1 시점. 뒤에서 default_version 을 1.1 로 올립니다)
comment = '내가 만든 첫 extension'
default_version = '1.0'
relocatable = true
```

```sql
-- hello--1.0.sql 전체
CREATE FUNCTION hello(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT 'Hello, ' || name || '!' $$;
```

이 두 파일을 `$(pg_config --sharedir)/extension/` 에 놓는 순간 끝입니다. **서버 재시작도, 등록 절차도 없습니다.**

## 이런 출력이 나오면 성공입니다

```
 name  | default_version |        comment
-------+-----------------+------------------------
 hello | 1.0             | 내가 만든 첫 extension

CREATE EXTENSION
     인사     |       인사2
--------------+-------------------
 Hello, 세계! | Hello, PG 스터디!
```

**소속 도장이 자동으로 찍힙니다:**
```
 함수  | 소속  | deptype
-------+-------+---------
 hello | hello | e

NOTICE:  cannot drop function hello(text) because extension hello requires it
```
→ `hello--1.0.sql` 안에는 그냥 `CREATE FUNCTION` 만 썼습니다. 소속은 PostgreSQL 이 붙여준 것입니다. 이것이 Extension 시스템의 핵심입니다.

**버전 올리기:**
```
 source | target |   path
--------+--------+----------
 1.0    | 1.1    | 1.0--1.1

ALTER EXTENSION hello UPDATE TO '1.1';

      바뀐_함수      |  새_함수
---------------------+------------
 안녕하세요, 세계님! | Bye, 세계!
```

## ⚠️ Dockerfile 의 `chmod 777` 에 대하여

```dockerfile
RUN chmod 777 /usr/share/postgresql/16/extension
```

**실습 전용입니다. 운영 환경에서는 절대 이렇게 하지 마세요.** 이 lab 은 "psql 안에서 파일을 직접 만들어보는" 것이 핵심이라 쓰기를 허용했습니다. 실제로는 `make install`(root) 이나 패키지 매니저가 파일을 놓습니다.

## 직접 해볼 것

```bash
./run.sh psql
```
```sql
-- 파일을 고치고 다시 설치해보세요
\! printf "%s\n" "CREATE FUNCTION shout(t text) RETURNS text" "LANGUAGE sql IMMUTABLE STRICT" "AS \$\$ SELECT upper(t) || '!!!' \$\$;" >> /usr/share/postgresql/16/extension/hello--1.0.sql

DROP EXTENSION hello;
CREATE EXTENSION hello VERSION '1.0';
SELECT shout('pg study');
```

`ext/` 디렉토리에 완성본이 들어있으니, 에디터로 열어 비교해보세요.

## 하이라이트 - `old_hello` vs `hello`

같은 일을 하는 함수인데, 포장했느냐만 다릅니다.

```
 old_hello (옛날 방식) |  hello (extension)
-----------------------+---------------------
 Hello, 세계!          | 안녕하세요, 세계님!
```

```
           항목           |     old_hello (옛날 방식)      |        hello (extension)
--------------------------+--------------------------------+-------------------------------
 패키지로 인식되나        | 아니오 (\dx 에 없음)           | 예 (\dx 에 보임)
 pg_depend 소속 기록      | 0 건                           | 2 건
 설치된 버전을 알 수 있나 | 없음 (개념 자체가 없음)        | 있음 - 1.1
 함수 하나만 DROP 하면    | 그냥 지워짐 (실수 방지 없음)   | 거부됨 (extension 이 필요로 함)
 통째로 제거하려면        | 함수 이름을 전부 알아야 함     | DROP EXTENSION 한 줄
 새 버전 배포             | 스크립트 재실행 → 충돌         | ALTER EXTENSION ... UPDATE
```

**`pg_dump` 결과도 비교합니다.**

```
  [old_hello] 백업에 나오는 내용:
    CREATE FUNCTION public.old_hello(name text) RETURNS text
        LANGUAGE sql IMMUTABLE STRICT
        AS $$SELECT 'Hello, ' || name || '!'$$;

  [hello] 백업에 나오는 내용:
    CREATE EXTENSION IF NOT EXISTS hello WITH SCHEMA public;
```

함수가 하나일 땐 사소해 보이지만, hstore 처럼 **57개면 백업에 57개 정의가 박제**됩니다. 그 규모를 실제 contrib 로 재현한 것이 **📦 lab01 / `00-the-old-way.sql`** 입니다.

## 다음 단계

- **lab01** - `CREATE EXTENSION` 이 내부에서 실제로 하는 일
- **lab02** - 같은 것을 PGXS 로 제대로 빌드하고 `pg_dump` 연동까지
- **lab03** - C 로 짜서 `.so` 를 만들고 서버 안에서 실행하기
