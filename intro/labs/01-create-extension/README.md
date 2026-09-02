# Lab 01 - `CREATE EXTENSION` 이 실제로 하는 일

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


## 이 lab 에서 확인할 것

| 스크립트 | 확인 내용 |
|---|---|
| `00-the-old-way.sql` | **9.1 이전 방식을 그대로 재현** - 왜 Extension 시스템이 필요했는지 |
| `01-before-after.sql` | Extension 이전에는 왜 불편했는가 / 한 줄이 무엇을 만드는가 |
| `02-filesystem.sql` | Extension = `.control` + `.sql` (+ `.so`) 파일 3종. `pg_config` 로 경로 찾기 |
| `03-catalog.sql` | `pg_extension` 레코드, extension 이 데려온 객체 세어보기 |
| `04-pg-depend.sql` | **`deptype='e'` 가 멤버십의 실체** - 단독 DROP 거부, DROP EXTENSION 일괄 삭제, `ALTER EXTENSION ADD` |
| `05-version.sql` | 업그레이드 경로를 BFS 로 찾는다 - `pg_extension_update_paths()` 로 직접 확인 |
| `06-cascade-schema.sql` | `requires` / `CASCADE` / 전용 스키마 / **trusted extension 과 클라우드 DB** |

## 하이라이트 - `00-the-old-way.sql`

hstore 설치 스크립트에서 안전장치 두 줄만 걷어내면 **옛날 `contrib/hstore.sql` 이 됩니다.** 그걸 그대로 실행해서 9.1 이전 상황을 재현합니다.

```
--- 잘 됩니다. hstore 가 동작합니다 ---
 값 | 키목록
----+-------
  1 | {a,b}

--- 문제 ①  DB 는 hstore 를 "설치했다"고 생각하지 않습니다 ---
  Name   | Version |   Schema   |         Description
---------+---------+------------+------------------------------
 plpgsql | 1.0     | pg_catalog | PL/pgSQL procedural language      ← hstore 가 없다

 hstore 가 만든 함수 수 |  소속이 기록된 객체 수
------------------------+------------------------
                     57 |                      0
```

**함수 57개가 생겼는데 소속 기록은 0건.** 이어서 네 가지 문제를 하나씩 확인합니다.

| 문제 | 확인 방법 |
|---|---|
| ① 지울 수 없다 | `DROP TYPE hstore` → 78개 객체가 의존 |
| ② 백업이 굳는다 | `pg_dump \| grep -c "^CREATE FUNCTION"` → **57** |
| ③ 다시 설치 못 한다 | `CREATE EXTENSION hstore` → `type "hstore" already exists` |
| ④ CASCADE 도 불완전 | 타입 2개를 CASCADE 로 지워도 **함수 4개가 남음** (인자가 `internal`) |

마지막에 정리하고 `CREATE EXTENSION hstore` 로 제대로 설치해 대비를 보여줍니다.

## 이런 출력이 나오면 성공입니다

```
--- [실험] extension 소속 함수를 개별 DROP 하면? ---
NOTICE:  거부됨: cannot drop function gen_salt(text) because extension pgcrypto requires it
NOTICE:  => deptype='e' 가 개별 삭제를 막는다
```

```
--- find_update_path() 가 BFS 로 계산한 경로 (1.4 에서 출발) ---
 source | target |          path
--------+--------+-------------------------
 1.4    | 1.8    | 1.4--1.5--1.6--1.7--1.8
```
→ `hstore--1.4--1.8.sql` 이라는 파일은 **없습니다**. PostgreSQL 이 경로를 계산한 것입니다.

```
--- [실험] 일반 유저로 trusted / non-trusted 설치 시도 ---
NOTICE:  citext      (trusted=true)  -> 설치 성공
NOTICE:  pageinspect -> permission denied to create extension "pageinspect"
```
→ RDS/Supabase 에서 superuser 없이 일부 extension 만 설치되는 이유가 이것입니다.

## 직접 해볼 것

```bash
./run.sh psql
```
```sql
-- 설치 가능한 extension 을 하나 골라 넣어보고, 무엇이 딸려왔는지 세어보세요
CREATE EXTENSION ltree;
\dx+ ltree

-- 그 extension 이 만든 타입/연산자/함수를 카탈로그에서 찾아보세요
SELECT d.classid::regclass, count(*)
FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='ltree'
GROUP BY 1;
```
