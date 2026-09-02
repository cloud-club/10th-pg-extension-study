# Lab 11 - 직접 해보기 · (h) 내부를 노출하는 extension

이 부류는 **새 기능을 더하지 않습니다.** PostgreSQL 이 이미 갖고 있는 내부 자료구조를 **SQL 로 볼 수 있게** 열어줄 뿐입니다. "왜 느린가"를 추측이 아니라 관찰로 답하게 해줍니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - pg_buffercache: 공유 버퍼 안을 들여다보기

```sql
CREATE EXTENSION pg_buffercache;
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid=d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='pg_buffercache'
ORDER  BY 1, 2;
```

**함수 3개 + 뷰 1개.** 이 부류의 전형적인 모습입니다. (`pg_buffercache_pages` 가 원래의 함수이고, PG 16 에서 요약용 `pg_buffercache_summary` · `pg_buffercache_usage_counts` 가 더해졌습니다.)

테이블 두 개를 만들고 **한쪽만 실컷 읽어봅니다.**

```sql
CREATE TABLE hot_table  AS SELECT g AS id, repeat('x', 200) AS pad FROM generate_series(1,50000) g;
CREATE TABLE cold_table AS SELECT g AS id, repeat('y', 200) AS pad FROM generate_series(1,50000) g;
CREATE INDEX ON hot_table (id);
ANALYZE hot_table; ANALYZE cold_table;
SELECT count(*) FROM hot_table;
SELECT count(*) FROM hot_table WHERE id < 10000;
SELECT count(*) FROM hot_table WHERE id > 40000;
```

이제 **어떤 테이블이 캐시를 얼마나 차지하고 있는지** 보세요.

```sql
SELECT c.relname AS 관계, count(*) AS 버퍼수,
       pg_size_pretty(count(*) * 8192::bigint) AS 캐시크기,
       round(100.0 * count(*) / (SELECT count(*) FROM pg_buffercache), 1) AS "버퍼점유%"
FROM   pg_buffercache b JOIN pg_class c ON c.relfilenode = b.relfilenode
GROUP  BY c.relname ORDER BY 버퍼수 DESC LIMIT 10;
```

`hot_table` 이 위에 있고 `cold_table` 은 아래거나 아예 없습니다. **실무에서는 이 쿼리로 `shared_buffers` 를 늘려야 할지 판단합니다.**

```sql
SELECT count(*) AS 전체버퍼,
       count(*) FILTER (WHERE relfilenode IS NOT NULL) AS 사용중,
       count(*) FILTER (WHERE relfilenode IS NULL)     AS 비어있음,
       count(*) FILTER (WHERE isdirty)                 AS 더티
FROM   pg_buffercache;
SHOW shared_buffers;
```

> **비어있는 버퍼가 많다** = `shared_buffers` 가 남는다. **비어있는 버퍼가 0 이고 데이터가 계속 밀려난다** = 늘릴 여지가 있다.

교체 알고리즘(clock sweep)이 쓰는 카운터도 보입니다.

```sql
SELECT usagecount AS 사용횟수, count(*) AS 버퍼수
FROM pg_buffercache WHERE relfilenode IS NOT NULL GROUP BY usagecount ORDER BY usagecount;
```

---

## STEP 2 - pgstattuple: 테이블이 얼마나 부풀었나

```sql
CREATE EXTENSION pgstattuple;
CREATE TABLE t_bloat AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,100000) g;
VACUUM t_bloat;   -- 기준선 정리 (아래 설명 참고)
SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플, round(dead_tuple_percent::numeric,2) AS "죽은%",
       round(free_percent::numeric,2) AS "여유%"
FROM   pgstattuple('t_bloat');
```

> `CREATE TABLE AS` 직후에 `VACUUM` 을 한 번 돌린 이유: 대량 INSERT 는 블록을 여러 개씩 미리 확장해서 **끝에 빈 페이지를 남깁니다.** 그대로 두면 뒤에서 부르는 첫 `VACUUM` 이 그 꼬리까지 잘라내면서 "VACUUM 이 파일을 줄였다"처럼 보여 실습의 요점이 흐려집니다.

**3분의 1을 지우고** 다시 보세요.

```sql
DELETE FROM t_bloat WHERE id % 3 = 0;
SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플, round(dead_tuple_percent::numeric,2) AS "죽은%",
       round(free_percent::numeric,2) AS "여유%"
FROM   pgstattuple('t_bloat');
```

**파일 크기는 그대로인데 죽은 튜플이 생겼습니다.** MVCC 라서 DELETE 가 공간을 반납하지 않습니다.

```sql
VACUUM t_bloat;
SELECT pg_size_pretty(table_len) AS 파일크기, tuple_count AS 살아있는튜플,
       dead_tuple_count AS 죽은튜플, round(free_percent::numeric,2) AS "여유%"
FROM   pgstattuple('t_bloat');
```

**VACUUM 후에도 파일 크기는 그대로입니다.** 죽은 튜플이 "여유 공간"으로 바뀌었을 뿐, OS 에 돌려주지는 않습니다 - 재사용 가능한 상태가 된 것입니다.

```sql
VACUUM FULL t_bloat;
SELECT pg_size_pretty(table_len) AS "VACUUM FULL 후", round(free_percent::numeric,2) AS "여유%"
FROM   pgstattuple('t_bloat');
```

**이제 줄었습니다.** 대신 `VACUUM FULL` 은 **테이블 전체에 ACCESS EXCLUSIVE 락**을 겁니다 (운영 중에는 `pg_repack` 을 씁니다).

인덱스도 볼 수 있습니다.

```sql
CREATE INDEX idx_bloat ON t_bloat (id);
SELECT version, index_size, root_block_no, internal_pages, leaf_pages,
       round(avg_leaf_density::numeric,1) AS "리프밀도%"
FROM   pgstatindex('idx_bloat');
```

> **주의**: `pgstattuple()` 은 **테이블 전체를 읽습니다.** 큰 테이블에 운영 중 돌리면 부담됩니다. 샘플링 버전을 쓰세요.

```sql
SELECT round(approx_free_percent::numeric,2) AS "근사 여유%", approx_free_space
FROM pgstattuple_approx('t_bloat');
```

---

## STEP 3 - pageinspect: 8KB 페이지의 raw 바이트까지

여기가 가장 밑바닥입니다.

```sql
CREATE EXTENSION pageinspect;
CREATE TABLE t_page (id int, name text);
INSERT INTO t_page VALUES (1,'hello'),(2,'world'),(3,'한글');
SELECT lsn, checksum, lower, upper, special, pagesize, version
FROM   page_header(get_raw_page('t_page', 0));
```

`lower`/`upper` 사이가 **빈 공간**입니다. 페이지는 앞에서 슬롯이, 뒤에서 데이터가 자랍니다.

```sql
SELECT lp AS 슬롯, lp_off AS 오프셋, lp_len AS 길이,
       t_xmin AS 생성_트랜잭션, t_xmax AS 삭제_트랜잭션, t_hoff AS 헤더크기
FROM   heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0;
```

### MVCC 를 눈으로 보기

```sql
UPDATE t_page SET name = 'HELLO' WHERE id = 1;
SELECT lp AS 슬롯, t_xmin, t_xmax, t_ctid AS 다음_버전_위치,
       CASE WHEN t_xmax = 0 THEN '살아있음' ELSE '이전 버전' END AS 상태
FROM   heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0;
```

**행이 하나 늘었습니다.** UPDATE 는 제자리 수정이 아니라 **새 버전을 쓰고 옛 버전에 `t_xmax` 를 찍는 것**입니다. `t_ctid` 가 다음 버전을 가리킵니다. "왜 UPDATE 가 테이블을 부풀리나"에 대한 답이 이 한 화면에 있습니다.

실제 바이트도 볼 수 있습니다.

```sql
SELECT lp, encode(t_data, 'hex') AS 바이트
FROM heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0 LIMIT 2;
```

B-tree 인덱스의 내부 구조도 열립니다.

```sql
CREATE INDEX idx_page ON t_page (id);
SELECT * FROM bt_metap('idx_page');
SELECT itemoffset, ctid, itemlen, data FROM bt_page_items('idx_page', 1) LIMIT 5;
```

> `pageinspect` 는 `superuser = true` 입니다. **매니지드 DB 에서 대개 못 씁니다.** lab01 STEP 6 에서 일반 유저로 설치가 거부되는 것을 확인했던 그 extension 입니다.

---

## STEP 4 - pg_visibility / pg_prewarm

**Index Only Scan 이 왜 안 되는지** 추적하는 도구입니다.

```sql
CREATE EXTENSION pg_visibility;
CREATE EXTENSION pg_prewarm;
CREATE TABLE t_vis AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;
CREATE INDEX ON t_vis (id);
ANALYZE t_vis;
SELECT count(*) AS 전체페이지,
       count(*) FILTER (WHERE all_visible) AS all_visible,
       count(*) FILTER (WHERE all_frozen)  AS all_frozen
FROM   pg_visibility_map('t_vis');
```
→ **all_visible 이 0 입니다.** 방금 만든 테이블은 VACUUM 이 아직 안 돌았습니다.

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM t_vis WHERE id BETWEEN 100 AND 200;
```
→ `Heap Fetches` 가 0 이 아닙니다. 인덱스만으로는 **행이 보이는지 판단할 수 없어서** 힙을 확인하러 갑니다.

```sql
VACUUM t_vis;
SELECT count(*) AS 전체페이지,
       count(*) FILTER (WHERE all_visible) AS all_visible,
       count(*) FILTER (WHERE all_frozen)  AS all_frozen
FROM   pg_visibility_map('t_vis');
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM t_vis WHERE id BETWEEN 100 AND 200;
```
→ **`Heap Fetches: 0`.** Visibility Map 이 채워지자 진짜 Index Only Scan 이 됐습니다.

> **"Index Only Scan 인데 왜 안 빠르죠?"** 의 답이 대개 여기 있습니다. `EXPLAIN` 의 `Heap Fetches` 를 보고, 0 이 아니면 VACUUM 상태를 의심하세요.

캐시 예열도 해보세요.

```sql
SELECT pg_prewarm('t_vis') AS 로드한_블록수;
SELECT c.relname, count(*) AS 버퍼수
FROM pg_buffercache b JOIN pg_class c ON c.relfilenode=b.relfilenode
WHERE c.relname = 't_vis' GROUP BY c.relname;
```

---

## 정리

| extension | 노출하는 것 | 실무 용도 |
|---|---|---|
| `pg_buffercache` | 공유 버퍼 내용 | `shared_buffers` 사이징 |
| `pgstattuple` | bloat / dead tuple | VACUUM · repack 필요성 판단 |
| `pageinspect` | 페이지 raw 구조 | 학습, 데이터 손상 조사 |
| `pg_visibility` | Visibility Map | Index Only Scan 이 안 되는 이유 추적 |
| `pg_freespacemap` | Free Space Map | 공간 재사용 상태 |
| `pg_prewarm` | 캐시 예열 | 재시작 후 성능 회복 |
| `pgrowlocks` | 행 잠금 상태 | 락 경합 조사 |

**공통점**: 새 기능이 아니라 **관측 도구**입니다. 대부분 `superuser` 권한이 필요하고, 큰 테이블에 돌리면 부담이 됩니다.
