# Lab 04 - 직접 해보기 · (a) 함수를 추가하는 extension

가장 흔하고 가장 단순한 부류입니다. **카탈로그에 `pg_proc` 행만 늘어납니다.**

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 판별 쿼리: 이 extension 은 무엇을 남기는가

2부의 모든 lab 이 이 쿼리로 시작합니다. **처음 보는 extension 을 만났을 때 성격을 파악하는 도구**입니다.

```sql
CREATE EXTENSION pgcrypto;
CREATE EXTENSION tablefunc;
CREATE EXTENSION fuzzystrmatch;
CREATE EXTENSION "uuid-ossp";
```

```sql
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)     AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)     AS 타입,
       count(*) FILTER (WHERE d.classid='pg_operator'::regclass) AS 연산자,
       count(*) FILTER (WHERE d.classid='pg_opclass'::regclass)  AS 연산자클래스,
       count(*) FILTER (WHERE d.classid='pg_am'::regclass)       AS 인덱스AM
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname <> 'plpgsql'
GROUP  BY e.extname ORDER BY e.extname;
```

**함수 열만 채워져 있고 나머지는 0 입니다.** 이게 (a) 부류의 서명입니다.

`shared_preload_libraries` 도 비어 있는지 확인하세요 - 이 부류는 서버 설정이 필요 없습니다.

```sql
SHOW shared_preload_libraries;
```

---

## STEP 2 - pgcrypto: 비밀번호를 DB 안에서 다루기

```sql
SELECT crypt('my_password', gen_salt('bf', 8)) AS bcrypt_hash;
```

같은 비밀번호를 두 번 해싱하면 **결과가 다릅니다.** 솔트가 매번 다르기 때문입니다.

```sql
SELECT crypt('same', gen_salt('bf', 8)) AS 첫번째, crypt('same', gen_salt('bf', 8)) AS 두번째;
```

그런데 검증은 됩니다. 저장된 해시를 솔트로 다시 쓰기 때문입니다.

```sql
CREATE TABLE accounts (id serial PRIMARY KEY, username text, pw_hash text);
INSERT INTO accounts (username, pw_hash) VALUES ('alice', crypt('correct-horse', gen_salt('bf', 8)));
SELECT username,
       pw_hash = crypt('correct-horse', pw_hash) AS 맞는_비번,
       pw_hash = crypt('wrong-guess',   pw_hash) AS 틀린_비번
FROM   accounts;
```

해시·HMAC·대칭키 암호화도 있습니다.

```sql
SELECT encode(digest('hello', 'sha256'), 'hex') AS sha256,
       encode(hmac('hello', 'secret-key', 'sha256'), 'hex') AS hmac_sha256;
SELECT pgp_sym_decrypt(pgp_sym_encrypt('민감한 데이터', 'my-key'), 'my-key') AS 복호화_결과;
```

> **트레이드오프**: 암호화를 DB 에서 하면 **키가 DB 서버에 있게 됩니다.** 쿼리 로그·`pg_stat_activity` 에 평문이 남을 수도 있습니다. 애플리케이션에서 하는 편이 나은 경우가 많습니다.

pgcrypto 가 넣은 함수 목록을 눈으로 보세요.

```sql
SELECT p.proname AS 함수, pg_get_function_identity_arguments(p.oid) AS 인자
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
JOIN   pg_proc p      ON p.oid = d.objid
WHERE  d.refclassid='pg_extension'::regclass AND d.classid='pg_proc'::regclass
  AND  d.deptype='e' AND e.extname='pgcrypto'
ORDER  BY p.proname LIMIT 12;
```

---

## STEP 3 - tablefunc: 피벗과 계층 쿼리

```sql
CREATE TABLE sales (dept text, month text, revenue numeric);
INSERT INTO sales VALUES
  ('영업','01',100),('영업','02',120),('영업','03',140),
  ('개발','01',200),('개발','02',180),('개발','03',260),
  ('지원','01', 50),('지원','02', 70),('지원','03', 60);
SELECT * FROM sales ORDER BY dept, month;
```

`crosstab` 으로 세로를 가로로 눕힙니다.

```sql
SELECT * FROM crosstab(
    'SELECT dept, month, revenue FROM sales ORDER BY 1, 2',
    'SELECT DISTINCT month FROM sales ORDER BY 1'
) AS ct(부서 text, "1월" numeric, "2월" numeric, "3월" numeric);
```

**같은 일을 표준 SQL 로도 할 수 있습니다.** 직접 비교해보세요.

```sql
SELECT dept AS 부서,
       sum(revenue) FILTER (WHERE month='01') AS "1월",
       sum(revenue) FILTER (WHERE month='02') AS "2월",
       sum(revenue) FILTER (WHERE month='03') AS "3월"
FROM   sales GROUP BY dept ORDER BY dept;
```

> 결과가 같습니다. **`FILTER` 절이 표준으로 들어온 뒤 `crosstab` 의 쓸모는 줄었습니다.** extension 을 도입할 때 "이거 이미 코어에 있는 것 아닌가?" 를 먼저 확인해야 하는 이유입니다. 다만 컬럼이 동적으로 정해질 때는 여전히 `crosstab` 이 편합니다.

계층 쿼리도 있습니다.

```sql
CREATE TABLE org (id text, parent text, name text);
INSERT INTO org VALUES
  ('1',NULL,'대표'),('2','1','개발본부'),('3','1','영업본부'),
  ('4','2','백엔드팀'),('5','2','프론트팀'),('6','3','국내영업팀');
SELECT * FROM connectby('org','id','parent','1',0,'/') AS t(id text, parent text, level int, path text)
JOIN org USING (id);
```

---

## STEP 4 - fuzzystrmatch: 비슷한 문자열 찾기

```sql
SELECT levenshtein('김철수','김철순') AS 한글_1글자차이,
       levenshtein('kitten','sitting') AS 영문_3글자차이,
       levenshtein('same','same') AS 동일;
```

오타 교정에 씁니다.

```sql
CREATE TABLE cities (name text);
INSERT INTO cities VALUES ('서울'),('부산'),('인천'),('대구'),('대전'),('광주'),('울산');
SELECT name AS 후보, levenshtein('대젼', name) AS 편집거리 FROM cities ORDER BY 편집거리 LIMIT 3;
```

발음 기반 매칭도 있습니다 (영어 전용).

```sql
SELECT soundex('Smith') AS smith, soundex('Smyth') AS smyth,
       soundex('Smith') = soundex('Smyth') AS 같은_발음;
SELECT metaphone('Thompson',10) AS thompson, dmetaphone('Schmidt') AS schmidt;
```

### 반드시 확인할 함정

```sql
EXPLAIN (COSTS OFF) SELECT name FROM cities WHERE levenshtein('대젼', name) <= 1;
```

**Seq Scan 입니다.** `levenshtein` 은 함수일 뿐 연산자 클래스가 없어서 **인덱스를 못 씁니다.** 행이 100만 개면 100만 번 계산합니다.

→ 인덱스로 후보를 먼저 좁히려면 **연산자 클래스를 제공하는 extension** 이 필요합니다. 그게 `pg_trgm`, 즉 **lab06** 입니다.

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | `pg_proc` 만 |
| 서버 설정 | 필요 없음 (`CREATE EXTENSION` 만) |
| 매니지드 DB | 대부분 지원 |
| 한계 | 함수는 **인덱스를 타지 않습니다** |

전체 흐름을 한 번에 보려면 `./run.sh`.
