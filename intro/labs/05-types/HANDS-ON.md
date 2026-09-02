# Lab 05 - 직접 해보기 · (b) 타입을 추가하는 extension

함수만 늘던 lab04 와 달리, 여기서는 **`pg_type` · `pg_operator` · `pg_opclass` 가 함께 늘어납니다.** 새 타입 하나를 제대로 만들려면 값의 표현, 입출력 함수, 비교 연산자, 인덱스 지원까지 한 벌이 필요하기 때문입니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - 판별 쿼리

```sql
CREATE EXTENSION hstore;
CREATE EXTENSION citext;
CREATE EXTENSION ltree;
CREATE EXTENSION earthdistance CASCADE;
CREATE EXTENSION intarray;
```

```sql
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)     AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)     AS 타입,
       count(*) FILTER (WHERE d.classid='pg_operator'::regclass) AS 연산자,
       count(*) FILTER (WHERE d.classid='pg_opclass'::regclass)  AS 연산자클래스
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname <> 'plpgsql'
GROUP  BY e.extname ORDER BY e.extname;
```

lab04 의 결과와 비교해보세요. **타입·연산자·연산자클래스 열이 채워집니다.** `intarray` 는 이 중 결이 다른데, 저장용 새 타입을 만드는 대신 **기존 `int[]` 에 연산자를 더하는** 변형이기 때문입니다 (타입 2개가 잡히지만 둘 다 보조용 - 질의 표현식 `query_int` 와 GiST 인덱스 키 `intbig_gkey` 입니다).

---

## STEP 2 - hstore: key→value 를 한 컬럼에

```sql
SELECT 'name=>John, age=>30'::hstore AS h,
       ('name=>John, age=>30'::hstore) -> 'name' AS 값_꺼내기,
       akeys('a=>1, b=>2'::hstore) AS 키목록,
       'a=>1'::hstore || 'b=>2'::hstore AS 병합;
```

```sql
CREATE TABLE products (id serial PRIMARY KEY, name text, attrs hstore);
INSERT INTO products (name, attrs) VALUES
  ('노트북','cpu=>M3, ram=>16GB, color=>silver'),
  ('키보드','layout=>ANSI, switch=>brown'),
  ('모니터','size=>27, panel=>IPS, hz=>144');
SELECT name, attrs->'color' AS 색상, attrs ? 'hz' AS hz_있음 FROM products;
```

연산자로 검색합니다 - `@>` 는 포함, `?` 는 키 존재.

```sql
SELECT name FROM products WHERE attrs @> 'panel=>IPS';
SELECT name FROM products WHERE attrs ? 'ram';
CREATE INDEX idx_products_attrs ON products USING gin (attrs);
```

> **지금이라면 대부분 `jsonb` 를 씁니다.** hstore 는 값이 전부 `text` 이고 중첩이 안 됩니다. hstore 가 남아 있는 이유는 **더 가볍고 단순하기 때문** - 평면 태그/속성만 필요하다면 여전히 유효합니다.

```sql
SELECT 'a=>1, b=>2'::hstore::jsonb AS hstore에서_jsonb로;
```

---

## STEP 3 - citext: 대소문자를 구분하지 않는 text

문제부터 봅니다. 일반 `text` 는 이메일 중복을 못 막습니다.

```sql
CREATE TABLE users_plain (email text PRIMARY KEY);
INSERT INTO users_plain VALUES ('User@Example.com');
INSERT INTO users_plain VALUES ('USER@EXAMPLE.COM');
SELECT * FROM users_plain;
```
→ **두 행이 다 들어갔습니다.** 사용자 입장에선 같은 이메일인데요.

`citext` 로 바꾸면 타입 차원에서 막힙니다.

```sql
CREATE TABLE users_ci (email citext PRIMARY KEY);
INSERT INTO users_ci VALUES ('User@Example.com');
```
```sql expect-error
INSERT INTO users_ci VALUES ('USER@EXAMPLE.COM');
```
```
ERROR:  duplicate key value violates unique constraint "users_ci_pkey"
```

비교도 대소문자 무관입니다.

```sql
SELECT email, email = 'user@example.COM' AS 대소문자_무관_비교 FROM users_ci;
```

**인덱스가 그대로 동작하는지**가 핵심입니다. 5만 건 넣고 확인해보세요.

```sql
INSERT INTO users_ci SELECT 'user' || g || '@example.com' FROM generate_series(1, 50000) g;
ANALYZE users_ci;
EXPLAIN (COSTS OFF) SELECT * FROM users_ci WHERE email = 'USER12345@EXAMPLE.COM';
```
→ **Index Scan.** 대소문자 무시 비교가 타입에 내장되어 있어서 인덱스를 그대로 씁니다.

### extension 없이 하는 방법과 비교

```sql
CREATE TABLE users_expr (email text);
CREATE UNIQUE INDEX ON users_expr (lower(email));
INSERT INTO users_expr VALUES ('User@Example.com');
```
```sql expect-error
INSERT INTO users_expr VALUES ('USER@EXAMPLE.COM');
```

**표현식 유니크 인덱스로도 됩니다.** 대신 조회할 때마다 `WHERE lower(email) = lower($1)` 을 빠뜨리지 않아야 합니다. citext 는 그 규율을 타입에 넣은 것입니다 - **extension 의 값어치는 대개 "불가능을 가능하게"가 아니라 "실수할 여지를 없애는" 쪽에 있습니다.**

---

## STEP 4 - ltree: 계층 경로를 값 하나로

```sql
CREATE TABLE catalog_tree (path ltree PRIMARY KEY, label text);
INSERT INTO catalog_tree VALUES
  ('electronics','전자제품'),
  ('electronics.computer','컴퓨터'),
  ('electronics.computer.laptop','노트북'),
  ('electronics.computer.desktop','데스크톱'),
  ('electronics.phone','휴대폰'),
  ('books','도서'),
  ('books.tech','기술서적'),
  ('books.tech.database','데이터베이스');
CREATE INDEX ON catalog_tree USING gist (path);
SELECT path, label, nlevel(path) AS 깊이 FROM catalog_tree ORDER BY path;
```

`<@` 는 하위 전체, `@>` 는 상위 전체 - **양방향 조회가 대칭입니다.**

```sql
SELECT path, label FROM catalog_tree WHERE path <@ 'electronics' ORDER BY path;
SELECT path, label FROM catalog_tree WHERE path @> 'electronics.computer.laptop' ORDER BY path;
```

패턴 매칭도 됩니다.

```sql
SELECT path FROM catalog_tree WHERE path ~ '*.computer.*' ORDER BY path;
SELECT path FROM catalog_tree WHERE path ~ '*{2}' ORDER BY path;
```

```sql
SELECT subpath('a.b.c.d', 0, 2) AS 앞_2단계,
       'a.b'::ltree || 'c.d'::ltree AS 이어붙이기,
       index('a.b.c.d','c') AS c의_위치;
```

> **트레이드오프**: 경로가 값에 박혀 있어서 **노드를 옮기면 하위 경로를 전부 갱신**해야 합니다. 읽기가 압도적으로 많고 구조가 잘 안 바뀌는 트리에 맞습니다.

---

## STEP 5 - cube + earthdistance: extension 위에 세워진 extension

```sql
\! grep -E "requires|comment" /usr/share/postgresql/16/extension/earthdistance.control
SELECT src.extname AS extension, tgt.extname AS 의존_대상, d.deptype
FROM   pg_depend d
JOIN   pg_extension src ON src.oid = d.objid    AND d.classid    = 'pg_extension'::regclass
JOIN   pg_extension tgt ON tgt.oid = d.refobjid AND d.refclassid = 'pg_extension'::regclass;
```

`cube` 는 N 차원 상자 타입입니다.

```sql
SELECT '(1,2,3)'::cube AS 점, '(0,0,0),(1,1,1)'::cube AS 상자,
       cube_distance('(0,0,0)','(1,1,1)') AS 거리, cube_dim('(1,2,3)') AS 차원수;
```

`earthdistance` 는 **위경도를 3차원 좌표로 바꿔 cube 에 얹은 것**뿐입니다.

```sql
SELECT round((earth_distance(ll_to_earth(37.5547,126.9707), ll_to_earth(37.4979,127.0276)))::numeric) AS 미터;
```
→ 서울역~강남역, 약 8km.

```sql
CREATE TABLE places (name text, lat float8, lon float8);
INSERT INTO places VALUES
  ('서울역',37.5547,126.9707),('강남역',37.4979,127.0276),('경복궁',37.5796,126.9770),
  ('남산타워',37.5512,126.9883),('부산역',35.1151,129.0403);
CREATE INDEX idx_places_earth ON places USING gist (ll_to_earth(lat, lon));
SELECT name, round(earth_distance(ll_to_earth(lat,lon), ll_to_earth(37.5547,126.9707))::numeric) AS 미터
FROM   places
WHERE  earth_box(ll_to_earth(37.5547,126.9707), 5000) @> ll_to_earth(lat, lon)
ORDER  BY 미터;
```

`earth_box` 로 **인덱스가 쓸 수 있는 사각 후보**를 먼저 만들고 정확한 거리로 정렬합니다. 이 2단계 구조가 **PostGIS 의 GiST 필터와 같은 원리**입니다.

---

## STEP 6 - intarray: 타입 없이 연산자만 더하기

```sql
SELECT ARRAY[1,2,3,4] & ARRAY[3,4,5] AS 교집합,
       ARRAY[1,2,3] | ARRAY[3,4] AS 합집합,
       ARRAY[1,2,3] - ARRAY[2] AS 차집합,
       icount(ARRAY[1,2,3,4]) AS 개수;
SELECT sort(ARRAY[3,1,2]) AS 정렬, uniq(sort(ARRAY[3,1,2,1,3])) AS 중복제거,
       idx(ARRAY[10,20,30], 20) AS "20의_위치";
```

```sql
CREATE TABLE articles (id serial PRIMARY KEY, title text, tag_ids int[]);
INSERT INTO articles (title, tag_ids) VALUES
  ('PostgreSQL 입문',ARRAY[1,2,5]),('인덱스 튜닝',ARRAY[1,3]),
  ('벡터 검색',ARRAY[1,4,5]),('도커 기초',ARRAY[6]);
CREATE INDEX idx_articles_tags ON articles USING gin (tag_ids gin__int_ops);
SELECT title FROM articles WHERE tag_ids @> ARRAY[1,5];
SELECT title FROM articles WHERE tag_ids && ARRAY[3,4];
SELECT title FROM articles WHERE tag_ids @@ '1 & (4 | 3)'::query_int;
```

`gin__int_ops` 가 **intarray 가 제공하는 연산자 클래스**입니다 (기본 `array_ops` 보다 정수 배열에 최적화). 그리고 `.so` 이름이 extension 이름과 다르다는 것도 확인해두세요.

```sql
\! grep module_pathname /usr/share/postgresql/16/extension/intarray.control
```
→ `$libdir/_int`. **extension 이름 ≠ 라이브러리 이름**입니다. lab08 에서 다시 나옵니다.

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | `pg_type` + `pg_proc` + `pg_operator` + `pg_opclass` |
| 왜 한 벌인가 | 타입 하나가 쓸모 있으려면 입출력·비교·인덱스 지원이 다 필요 |
| 판단 기준 | **코어 타입(`jsonb`, 배열)으로 안 되는가?** 를 먼저 물어보세요 |
