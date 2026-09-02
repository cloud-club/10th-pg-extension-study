# Lab 12 - 직접 해보기 · (i) 인덱스 액세스 메서드

**extension 이 할 수 있는 가장 깊은 확장**입니다. B-tree, GiST, GIN 과 **같은 층위에** 새 인덱스 종류를 등록합니다.

```bash
./run.sh up
./run.sh psql
```

---

## STEP 1 - `pg_am` 에 행이 하나 늘어납니다

설치 **전** 목록을 먼저 보세요.

```sql
SELECT amname AS 이름, amhandler::regproc AS handler_함수 FROM pg_am WHERE amtype='i' ORDER BY amname;
```
→ `btree`, `gin`, `gist`, `hash`, `brin`, `spgist` - PostgreSQL 이 기본 제공하는 6개.

```sql
CREATE EXTENSION bloom;
SELECT amname AS 이름, amhandler::regproc AS handler_함수 FROM pg_am WHERE amtype='i' ORDER BY amname;
```

**`bloom` 이 그 목록에 끼어들었습니다.** 코어와 같은 자격입니다.

```sql
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_am'::regclass       THEN (SELECT amname   FROM pg_am       WHERE oid=d.objid)
         WHEN 'pg_proc'::regclass     THEN (SELECT proname  FROM pg_proc     WHERE oid=d.objid)
         WHEN 'pg_opclass'::regclass  THEN (SELECT opcname  FROM pg_opclass  WHERE oid=d.objid)
         WHEN 'pg_opfamily'::regclass THEN (SELECT opfname  FROM pg_opfamily WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='bloom'
ORDER  BY 1, 2;
```

**`pg_am` + 핸들러 함수 + 연산자 클래스**가 한 벌로 들어옵니다. `amhandler` 함수가 "이 인덱스를 만드는 법 · 스캔하는 법 · 비용 추정하는 법" 등 **콜백 20여 개를 채운 구조체**를 돌려줍니다. 그걸 C 로 구현하는 것이 이 부류입니다.

각 AM 이 얼마나 많은 타입을 지원하는지도 보세요.

```sql
SELECT am.amname AS AM, count(DISTINCT opc.opcname) AS 연산자클래스수
FROM   pg_am am LEFT JOIN pg_opclass opc ON opc.opcmethod = am.oid
WHERE  am.amtype='i' GROUP BY am.amname ORDER BY am.amname;
```
→ `btree` 는 수십 개, `bloom` 은 몇 개뿐입니다. **새 AM 을 만들면 지원 타입도 직접 채워야 합니다.**

---

## STEP 2 - bloom: "여러 컬럼 중 아무거나" 검색

> **주의**: 테이블이 좁으면 Seq Scan 이 워낙 싸서 플래너가 bloom 을 안 씁니다. 실제로 bloom 이 이기는 상황(**넓은 행 + 많은 행**)을 만들어야 의미가 있습니다.

```sql
CREATE TABLE events AS
SELECT g AS id,
       (g % 7) AS c1, (g % 11) AS c2, (g % 13) AS c3,
       (g % 17) AS c4, (g % 19) AS c5, (g % 23) AS c6,
       repeat('x', 150) AS payload
FROM   generate_series(1, 500000) g;
ANALYZE events;
SELECT pg_size_pretty(pg_relation_size('events')) AS 테이블_크기;
SET max_parallel_workers_per_gather = 0;
```

### 인덱스 없이

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c3 = 5 AND c5 = 10;
```
→ **Seq Scan.** `Buffers:` 숫자를 적어두세요.

### bloom 인덱스를 걸고

```sql
CREATE INDEX idx_events_bloom ON events USING bloom (c1, c2, c3, c4, c5, c6)
  WITH (length = 80, col1 = 2, col2 = 2, col3 = 2, col4 = 2, col5 = 2, col6 = 2);
ANALYZE events;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c3 = 5 AND c5 = 10;
```
→ **Bitmap Index Scan on idx_events_bloom.** 읽은 버퍼 수가 확 줄었습니다.

**핵심은 여기입니다** - 같은 인덱스 하나로 **어떤 컬럼 조합이든** 처리합니다.

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT count(*) FROM events WHERE c1 = 3 AND c6 = 7;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT count(*) FROM events WHERE c2 = 4 AND c4 = 9 AND c6 = 2;
```

B-tree 로 같은 걸 하려면 **컬럼 조합마다 인덱스가 필요합니다.** 크기를 비교해보세요.

```sql
CREATE INDEX idx_c1 ON events (c1);
CREATE INDEX idx_c2 ON events (c2);
CREATE INDEX idx_c3 ON events (c3);
SELECT i.relname AS 인덱스, am.amname AS 종류, pg_size_pretty(pg_relation_size(i.oid)) AS 크기
FROM   pg_class i JOIN pg_index x ON x.indexrelid=i.oid JOIN pg_am am ON am.oid=i.relam
WHERE  x.indrelid='events'::regclass ORDER BY i.relname;
```

### 원리 - 블룸 필터

각 행의 컬럼 값들을 해싱해 **고정 크기 비트맵(시그니처)** 을 만들어 저장합니다. 검색할 때는 조건 값의 비트가 켜져 있는 행만 후보로 남깁니다.

**"없다"는 확실하고, "있다"는 확실하지 않습니다.** 그래서 `Bitmap Heap Scan` 단계에서 `Rows Removed by Index Recheck` 가 나옵니다 - **거짓 양성을 걸러내는 것**입니다. 이 2단계 구조는 lab06 의 GiST, PostGIS 의 bbox 필터와 같은 발상입니다.

---

## STEP 3 - 언제 쓰고 언제 피하나

```sql
RESET max_parallel_workers_per_gather;
```

범위 검색은 **못 합니다.** 직접 확인하세요.

```sql
SET max_parallel_workers_per_gather = 0;
EXPLAIN (COSTS OFF) SELECT count(*) FROM events WHERE c3 > 5;
RESET max_parallel_workers_per_gather;
```
→ Seq Scan. 해시라서 **순서 정보가 없습니다.**

| 구분 | 상황 |
|---|---|
| **쓰기 좋음** | 컬럼이 많고(5개+) **어떤 조합으로 올지 모를 때** |
| **쓰기 좋음** | 각 컬럼의 선택도가 낮아(중복 많음) B-tree 가 별로일 때 |
| **쓰기 좋음** | 인덱스 저장 공간을 아껴야 할 때 |
| **피할 것** | 범위 검색(`>`, `<`, `BETWEEN`) |
| **피할 것** | 정렬(`ORDER BY`)에 인덱스를 쓰고 싶을 때 |
| **피할 것** | 단일 컬럼 등치 검색 - B-tree 가 압도적 |
| **피할 것** | `UNIQUE` 제약 - 지원하지 않음 |

### 같은 방식으로 만들어진 다른 extension

| extension | 출처 | AM | 용도 |
|---|---|---|---|
| `bloom` | contrib | 블룸 필터 | 다중 컬럼 등치 검색 |
| **`pgvector`** | 서드파티 | IVFFlat / HNSW | **벡터 유사도 검색** |
| `rum` | 서드파티 | GIN 개선판 | 전문검색 + 순위 정렬을 인덱스에서 |
| `zombodb` | 서드파티 | Elasticsearch 연동 | 인덱스가 사실상 ES |
| `pgroonga` | 서드파티 | Groonga 엔진 | 다국어 전문검색 |

> 표에 `pg_bigm` 이 없는 것에 주의하세요. lab06 에서 확인한 **"트라이그램은 3글자 미만이면 인덱스를 못 탄다"** 는 한계를 2글자 색인으로 푸는 extension 이지만, **새 AM 을 만들지는 않습니다** - 기존 GIN 에 연산자 클래스(`gin_bigm_ops`)를 더하는 **lab06 부류**입니다. "깊어 보이는 것"과 "실제로 깊은 것"은 다릅니다.

테이블 AM 도 있다는 것만 알아두세요.

```sql
SELECT amname AS 이름, amtype, CASE amtype WHEN 'i' THEN '인덱스' WHEN 't' THEN '테이블' END AS 종류
FROM pg_am ORDER BY amtype, amname;
```

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | **`pg_am`** + 핸들러 + 연산자 클래스 |
| 하는 일 | 인덱스 콜백 20여 개를 C 로 구현해 **새 인덱스 종류를 등록** |
| 난이도 | 이 10가지 중 가장 높음 - 하지만 **가능하다는 것 자체가 중요** |
| 대표 사례 | pgvector 가 이 방식으로 벡터 검색을 PostgreSQL 에 넣었습니다 |
