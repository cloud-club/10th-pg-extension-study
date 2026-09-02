# Lab 10 - 직접 해보기 · (g) Foreign Data Wrapper

**"PostgreSQL 밖에 있는 데이터를 테이블처럼 보이게" 하는 부류**입니다. 카탈로그에 `pg_foreign_data_wrapper` 행이 생기는 것이 서명입니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - file_fdw: CSV 파일을 테이블로

```sql
CREATE EXTENSION file_fdw;
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass) AS 함수,
       count(*) FILTER (WHERE d.classid='pg_foreign_data_wrapper'::regclass) AS FDW
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='file_fdw'
GROUP  BY e.extname;
```

FDW 의 실체는 **핸들러 함수 한 쌍**입니다.

```sql
SELECT fdwname AS FDW, fdwhandler::regproc AS handler, fdwvalidator::regproc AS validator
FROM   pg_foreign_data_wrapper ORDER BY fdwname;
```

`handler` 가 플래너/실행기와 대화하는 콜백 묶음을 돌려줍니다. **FDW 를 만든다는 것은 그 콜백들을 C 로 구현하는 것**입니다.

원본 파일을 먼저 보세요.

```sql
\! cat /lab/data/cities.csv
```

세 단계로 테이블이 됩니다 - **SERVER** → (USER MAPPING) → **FOREIGN TABLE**.

```sql
CREATE SERVER csv_server FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE cities (id int, city text, population bigint)
SERVER csv_server
OPTIONS (filename '/lab/data/cities.csv', format 'csv', header 'true');
```

이제 **그냥 테이블입니다.**

```sql
SELECT * FROM cities ORDER BY population DESC;
SELECT count(*) AS 도시수, sum(population) AS 총인구 FROM cities;
```

**일반 테이블과 JOIN 도 됩니다.** 이게 FDW 의 진짜 값어치입니다.

```sql
CREATE TABLE regions (city text, region text);
INSERT INTO regions VALUES ('서울','수도권'),('인천','수도권'),('부산','영남'),('대구','영남'),('대전','충청');
SELECT r.region AS 권역, sum(c.population) AS 인구
FROM   cities c JOIN regions r ON r.city = c.city
GROUP  BY r.region ORDER BY 인구 DESC;
```

한계도 확인하세요.

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT city FROM cities WHERE population > 2000000;
```
→ **Foreign Scan + Filter.** 인덱스가 없으니 **매번 파일 전체를 읽습니다.**

```sql expect-error
INSERT INTO cities VALUES (6, '울산', 1100000);
```
```
ERROR:  cannot insert into foreign table "cities"
```
→ `file_fdw` 는 **읽기 전용**입니다.

---

## STEP 2 - postgres_fdw: 다른 PostgreSQL 을 테이블로

원리를 보기 위해 **자기 자신에 연결**합니다.

```sql
CREATE EXTENSION postgres_fdw;
CREATE TABLE orders_remote AS
SELECT g AS id, (ARRAY['서울','부산','인천','대구'])[1+(g%4)] AS city,
       (g % 100 + 1) * 1000 AS amount, now() - (g || ' hours')::interval AS ordered_at
FROM   generate_series(1, 100000) g;
CREATE INDEX ON orders_remote (city);
ANALYZE orders_remote;
```

```sql
CREATE SERVER remote_pg FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'localhost', port '5432', dbname 'study');
CREATE USER MAPPING FOR CURRENT_USER SERVER remote_pg
  OPTIONS (user 'postgres', password 'postgres');
```

**USER MAPPING** 이 file_fdw 와의 차이입니다 - 원격에 붙으려면 자격 증명이 필요합니다.

컬럼을 하나씩 안 쓰고 통째로 가져올 수 있습니다.

```sql
CREATE SCHEMA remote;
IMPORT FOREIGN SCHEMA public LIMIT TO (orders_remote) FROM SERVER remote_pg INTO remote;
SELECT foreign_table_schema, foreign_table_name FROM information_schema.foreign_tables;
SELECT * FROM remote.orders_remote ORDER BY id LIMIT 3;
```

---

## STEP 3 - 푸시다운: 이 부류의 성패를 가르는 것

`postgres_fdw` 의 성능은 **"조건을 원격에서 거르느냐"** 하나에 달려 있습니다. `EXPLAIN (VERBOSE)` 의 **`Remote SQL:`** 한 줄을 보면 됩니다.

### 잘 되는 경우

```sql
EXPLAIN (VERBOSE, COSTS OFF)
SELECT id, amount FROM remote.orders_remote WHERE city = '부산' AND amount > 90000;
```
```
Remote SQL: SELECT id, amount FROM public.orders_remote
            WHERE ((city = '부산'::text)) AND ((amount > 90000))
```
→ **WHERE 절이 원격 SQL 에 들어갔습니다.** 필요한 행만 넘어옵니다.

집계도 밀어냅니다.

```sql
EXPLAIN (VERBOSE, COSTS OFF)
SELECT city, count(*), sum(amount) FROM remote.orders_remote GROUP BY city;
```
→ `Remote SQL` 에 `GROUP BY` 가 보이면 **원격이 집계까지 끝내고 4행만 보냅니다.**

### 안 되는 경우

원격이 모르는 함수를 쓰면 밀어낼 수 없습니다.

```sql
CREATE FUNCTION local_only(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN upper(t); END $$;
EXPLAIN (VERBOSE, COSTS OFF)
SELECT id FROM remote.orders_remote WHERE local_only(city) = '부산';
```
```
Filter: (local_only(orders_remote.city) = '부산'::text)     ← 로컬에서 거른다
Remote SQL: SELECT id, city FROM public.orders_remote       ← 10만 행을 다 끌어온다
```

> **`LANGUAGE sql` 로 만들면 이 반례가 성립하지 않습니다.** 플래너가 본문을 인라인해서 `upper(city)` 로 펼쳐버리고, `upper` 는 원격도 아는 함수라 오히려 푸시다운됩니다. 인라인되지 않는 `plpgsql` 이어야 "원격이 모르는 함수"가 됩니다.

같은 쿼리를 내장 함수로 쓰면 밀려납니다.

```sql
EXPLAIN (VERBOSE, COSTS OFF)
SELECT id FROM remote.orders_remote WHERE upper(city) = '부산';
```

**푸시다운이란 "조건·조인·집계·정렬·LIMIT 을 데이터가 있는 쪽에서 처리하게 넘기는 것"입니다.** 넘기지 못하면 전부 끌어와서 로컬에서 걸러야 하고, 네트워크가 병목이 됩니다.

### 쓰기도 됩니다

```sql
INSERT INTO remote.orders_remote VALUES (999999, '제주', 5000, now());
SELECT * FROM remote.orders_remote WHERE id = 999999;
DELETE FROM remote.orders_remote WHERE id = 999999;
```

---

## STEP 4 - 생태계와 실무 판단

```sql
SELECT fdwname AS FDW FROM pg_foreign_data_wrapper ORDER BY 1;
SELECT s.srvname AS 서버, f.fdwname AS FDW
FROM pg_foreign_server s JOIN pg_foreign_data_wrapper f ON f.oid=s.srvfdw ORDER BY 1;
```

| FDW | 출처 | 대상 | 메모 |
|---|---|---|---|
| `postgres_fdw` | contrib | 다른 PostgreSQL | 푸시다운 강력. 가장 성숙 |
| `file_fdw` | contrib | 서버 로컬 CSV/TSV | 읽기 전용, 인덱스 없음 |
| `dblink` | contrib | 다른 PostgreSQL | 레거시. 함수 기반. 신규는 postgres_fdw |
| `mysql_fdw` / `mongo_fdw` / `oracle_fdw` | 서드파티 | MySQL / MongoDB / Oracle | oracle_fdw 는 마이그레이션에 자주 쓰임 |

**도입 전 체크리스트**

- 서드파티 FDW 는 **푸시다운 지원 범위가 제각각**입니다. `EXPLAIN (VERBOSE)` 로 반드시 확인하세요
- **트랜잭션이 원격까지 이어지지 않습니다** (2PC 를 별도 설정하지 않는 한)
- 원격 통계가 없으면 계획이 나빠집니다 - `ANALYZE` 를 외래 테이블에도 걸어주세요
- 매니지드 DB 는 `postgres_fdw`/`file_fdw` 정도만 허용하는 경우가 많습니다

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | `pg_foreign_data_wrapper` + 핸들러 함수 |
| 하는 일 | 플래너·실행기 콜백을 구현해 **외부 데이터를 테이블처럼** |
| 성패를 가르는 것 | **푸시다운** - `EXPLAIN (VERBOSE)` 의 `Remote SQL:` 을 보세요 |
