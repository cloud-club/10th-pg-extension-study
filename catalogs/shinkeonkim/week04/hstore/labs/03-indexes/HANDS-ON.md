# Lab 03 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 지원 연산자 조회

```sql
SELECT am.amname, opc.opcname, amop.amopopr::regoperator
FROM pg_opclass opc JOIN pg_am am ON am.oid = opc.opcmethod
JOIN pg_amop amop ON amop.amopfamily = opc.opcfamily AND amop.amoplefttype = 'hstore'::regtype
WHERE opc.opcintype = 'hstore'::regtype ORDER BY 1, 2, 3;
```

`<@`가 어느 인덱스 클래스에도 없는지 확인한다.

---

## 2. 데이터와 GIN

`sql/01-index-support.sql`의 `CREATE TABLE item` ~ `VACUUM (ANALYZE) item`을 실행한 뒤:

```sql
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';   -- Seq Scan
CREATE INDEX item_gin ON item USING gin (attrs);
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';   -- Bitmap Index Scan
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07';            -- 여전히 Seq Scan
```

---

## 3. Recheck

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';
```

`Rows Removed by Index Recheck`가 decoy로 넣은 500과 같아야 한다. decoy는 `shade=>red, color=>blue`라서 키 `color`와 값 `red`는 있지만 짝이 아니다.

---

## 4. 식 인덱스와 GiST

```sql
CREATE INDEX item_brand ON item ((attrs -> 'brand'));
CREATE INDEX item_gist16  ON item USING gist (attrs gist_hstore_ops(siglen = 16));
CREATE INDEX item_gist128 ON item USING gist (attrs gist_hstore_ops(siglen = 128));
SELECT relname, pg_size_pretty(pg_relation_size(oid)) FROM pg_class WHERE relname LIKE 'item\_%' AND relkind = 'i';
```

---

- 이전 랩: [`../02-storage-and-toast/`](../02-storage-and-toast)
- 다음 랩: [`../04-concurrency/`](../04-concurrency)
- 종합 문서: [`../../README.md`](../../README.md)
