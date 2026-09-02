# Lab 06 - 직접 해보기 · (c) 연산자 클래스를 추가하는 extension

lab04 에서 확인했듯 **함수는 인덱스를 못 탑니다.** 그 벽을 넘는 부류가 이겁니다. 연산자 클래스는 **"이 연산자를 이 인덱스로 처리하는 법"** 을 알려주는 규칙 묶음입니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 판별 쿼리

```sql
CREATE EXTENSION pg_trgm;
CREATE EXTENSION btree_gin;
CREATE EXTENSION btree_gist;
CREATE EXTENSION unaccent;
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

**연산자클래스 열이 채워집니다.** `btree_gin` 은 **타입도 연산자도 0 이고 연산자 클래스(29개)만** 있습니다 - 기존 타입을 다른 인덱스에 끼워넣는 어댑터라서 그렇습니다. `btree_gist` 도 같은 어댑터지만 타입 6개·연산자 12개가 함께 잡히는데, **사용자가 쓸 새 타입이 아니라** GiST 인덱스 안에 키를 담는 내부 표현(`gbtreekey4` …)과 그 보조 연산자입니다.

---

## STEP 2 - pg_trgm: `LIKE '%...%'` 에 인덱스를 태우기

20만 행을 만들고 평범한 B-tree 인덱스를 겁니다.

```sql
CREATE TABLE users AS
SELECT g AS id,
       (ARRAY['김철수','이영희','박민수','최지훈','정수진','강민지','조현우','윤서연'])[1+(g%8)] || g::text AS name,
       'user' || g || '@example.com' AS email
FROM   generate_series(1, 200000) g;
CREATE INDEX idx_users_name_btree ON users (name);
ANALYZE users;
SET max_parallel_workers_per_gather = 0;
```

### 먼저 문제를 확인하세요

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM users WHERE name LIKE '%김철수%';
```
→ **Seq Scan.** B-tree 인덱스가 있는데도 못 씁니다.

앞이 고정된 패턴은 됩니다. **B-tree 는 "앞에서부터" 정렬된 자료구조이기 때문입니다.**

```sql
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '김철수1%';
```
→ Index Scan.

### 트라이그램 인덱스를 걸어봅니다

```sql
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);
ANALYZE users;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM users WHERE name LIKE '%김철수%';
```
→ **Bitmap Index Scan.** 같은 쿼리, 같은 데이터인데 계획이 바뀌었습니다.

`gin_trgm_ops` 가 그 연산자 클래스입니다. **인덱스 종류(GIN)는 원래 있던 것이고, pg_trgm 은 "text 를 GIN 에 넣는 법"만 알려준 것입니다.**

### 원리 - 문자열을 3글자 조각으로 쪼갠다

```sql
SELECT show_trgm('hello') AS 영문;
```

**여기가 이 lab 에서 가장 중요한 부분입니다.**

```sql
SELECT show_trgm('김') AS "1글자", show_trgm('김철') AS "2글자", show_trgm('김철수') AS "3글자";
```

패턴이 3글자보다 짧으면 **찾을 조각이 없습니다.** 직접 확인하세요.

```sql
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김%';
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김철%';
EXPLAIN (COSTS OFF) SELECT count(*) FROM users WHERE name LIKE '%김철수%';
```

| 패턴 | 계획 |
|---|---|
| `%김%` (1글자) | **Seq Scan** - 인덱스 못 씀 |
| `%김철%` (2글자) | **Seq Scan** |
| `%김철수%` (3글자) | Bitmap Index Scan |

> 이걸 모르고 "trgm 인덱스 걸었는데 왜 안 빨라지죠?" 하는 경우가 흔합니다. **한국어는 2글자 검색어가 매우 많아서 특히 자주 걸립니다.**

값은 공짜가 아닙니다. 인덱스 크기를 비교해보세요.

```sql
RESET max_parallel_workers_per_gather;
SELECT i.relname AS 인덱스, am.amname AS 종류, pg_size_pretty(pg_relation_size(i.oid)) AS 크기
FROM   pg_class i JOIN pg_index x ON x.indexrelid=i.oid JOIN pg_am am ON am.oid=i.relam
WHERE  x.indrelid='users'::regclass ORDER BY pg_relation_size(i.oid) DESC;
```

---

## STEP 3 - 진짜 강점은 유사도 검색

```sql
SELECT similarity('김철수','김철수') AS 동일,
       similarity('김철수','김철순') AS 한글자_다름,
       similarity('postgres','postgre') AS 영문_오타,
       similarity('김철수','박민수') AS 다른_이름;
```

`%` 연산자는 임계값 이상으로 비슷한 것을 고릅니다.

```sql
SHOW pg_trgm.similarity_threshold;
SELECT name, round(similarity(name, '김철수1')::numeric, 3) AS 유사도
FROM   users WHERE name % '김철수1' ORDER BY 유사도 DESC LIMIT 5;
```

임계값을 낮추면 후보가 늘어납니다.

```sql
SET pg_trgm.similarity_threshold = 0.15;
SELECT count(*) AS "임계값 0.15 일 때 후보 수" FROM users WHERE name % '김철수1';
RESET pg_trgm.similarity_threshold;
```

### GiST 는 KNN 정렬을 할 수 있습니다

```sql
CREATE INDEX idx_users_name_trgm_gist ON users USING gist (name gist_trgm_ops);
ANALYZE users;
EXPLAIN (COSTS OFF) SELECT name FROM users ORDER BY name <-> '김철수1' LIMIT 5;
SELECT name, round((name <-> '김철수1')::numeric, 3) AS 거리
FROM users ORDER BY name <-> '김철수1' LIMIT 5;
```

**`ORDER BY 거리 LIMIT n` 을 인덱스만으로 처리합니다.** GIN 은 이걸 못 합니다.

| 용도 | GIN | GiST |
|---|---|---|
| `LIKE '%x%'` 검색 | 빠름 | 느림 |
| 유사도 `%` 검색 | 가능 | 가능 |
| `<->` KNN 정렬 | **불가** | **가능** |
| 인덱스 크기 | 큼 | 작음 |
| 빌드 속도 | 느림 | 빠름 |

---

## STEP 4 - btree_gin / btree_gist: 어댑터

이 둘은 **새 기능을 주지 않습니다.** 기존 타입을 다른 인덱스에서 쓸 수 있게만 해줍니다.

### btree_gin - 한 인덱스에 = 조건과 LIKE 조건을 함께

```sql
CREATE TABLE logs AS
SELECT g AS id, (ARRAY['INFO','WARN','ERROR'])[1+(g%3)] AS level, 'message ' || g AS msg
FROM generate_series(1, 100000) g;
CREATE INDEX idx_logs_multi ON logs USING gin (level, msg gin_trgm_ops);
ANALYZE logs;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM logs WHERE level='ERROR' AND msg LIKE '%999%';
```

`level` 은 그냥 `text` 입니다. GIN 에 넣을 수 있는 이유가 `btree_gin` 입니다.

### btree_gist - 배타 제약(EXCLUDE)

**"같은 방에 시간이 겹치는 예약을 막는다"** - UNIQUE 로는 표현할 수 없는 제약입니다.

```sql
CREATE TABLE reservations (
    id serial PRIMARY KEY,
    room int,
    period tstzrange,
    EXCLUDE USING gist (room WITH =, period WITH &&)
);
INSERT INTO reservations (room, period) VALUES (101, '[2026-09-01 10:00, 2026-09-01 12:00)');
```

겹치는 예약을 넣어보세요.

```sql expect-error
INSERT INTO reservations (room, period) VALUES (101, '[2026-09-01 11:00, 2026-09-01 13:00)');
```
```
ERROR:  conflicting key value violates exclusion constraint "reservations_room_period_excl"
```

다른 방이거나 시간이 안 겹치면 들어갑니다.

```sql
INSERT INTO reservations (room, period) VALUES (102, '[2026-09-01 11:00, 2026-09-01 13:00)');
INSERT INTO reservations (room, period) VALUES (101, '[2026-09-01 12:00, 2026-09-01 14:00)');
SELECT * FROM reservations ORDER BY room, period;
```

`period WITH &&` 는 원래 GiST 가 할 수 있습니다. **`room WITH =` 를 GiST 에서 쓰려고 `btree_gist` 가 필요한 것입니다.**

---

## STEP 5 - unaccent

```sql
SELECT unaccent('Café résumé naïve') AS 정규화, unaccent('Müller Straße') AS 독일어,
       unaccent('한글은 그대로') AS 한글;
```

```sql
CREATE TABLE menu (name text);
INSERT INTO menu VALUES ('Café Latte'),('Crème Brûlée'),('Jalapeño'),('Americano');
SELECT name FROM menu WHERE name ILIKE '%creme%';
SELECT name FROM menu WHERE unaccent(name) ILIKE unaccent('%creme%');
```

### 인덱스를 걸려면 함정이 하나 있습니다

```sql
SELECT provolatile FROM pg_proc WHERE proname='unaccent' LIMIT 1;
```
→ `s` (STABLE). **IMMUTABLE 이 아니라서 표현식 인덱스를 만들 수 없습니다.** 사전 파일을 바꾸면 결과가 달라질 수 있기 때문입니다.

```sql expect-error
CREATE INDEX idx_menu_bad ON menu (unaccent(name));
```
```
ERROR:  functions in index expression must be marked IMMUTABLE
```

**사전을 명시하는 래퍼를 IMMUTABLE 로 감싸면** 됩니다 (널리 쓰이는 관용구입니다).

```sql
CREATE FUNCTION immutable_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
CREATE INDEX idx_menu_unaccent ON menu (immutable_unaccent(name));
SELECT name FROM menu WHERE immutable_unaccent(name) = 'Creme Brulee';
```

전문 검색 사전으로도 쓸 수 있습니다.

```sql
SELECT to_tsvector('simple', unaccent('Crème Brûlée')) AS tsvector;
```

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | `pg_opclass` (+ 연산자·지원 함수) |
| 하는 일 | **기존 인덱스 종류에 "이 타입/연산자를 다루는 법"을 등록** |
| 꼭 기억할 것 | 트라이그램은 **3글자**가 단위 - 그보다 짧은 패턴은 인덱스를 못 탑니다 |
