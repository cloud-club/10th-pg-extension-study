# Lab 02 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 원시 바이트 얻기

```sql
CREATE EXTENSION hstore;
CREATE EXTENSION pageinspect;
CREATE TABLE s (id int, attrs hstore);
INSERT INTO s VALUES (1, 'ccc=>333, aa=>1, b=>NULL, aa=>9');

SELECT attrs, pg_column_size(attrs) FROM s;
SELECT t_hoff, encode(substring(t_data FROM 5), 'hex') FROM heap_page_items(get_raw_page('s', 0));
```

`t_data`는 튜플 헤더(`t_hoff`바이트)를 뺀 사용자 데이터라서 앞 4바이트가 `id`이고 그다음이 hstore다. hstore의 첫 바이트가 짧은 헤더(길이 × 2 + 1, 여기서는 `4f` = 39 × 2 + 1)다.

---

## 2. 헤더와 HEntry 해독

`sql/01-on-disk-layout.sql`의 `u32()` 함수와 두 쿼리를 그대로 실행한다.

확인할 것: 쌍 개수 3, 새 형식 플래그 true, HEntry 6개의 끝 위치 1·1·3·4·7·10, 키 `b`의 값에만 `isnull = 1`.

---

## 3. 크기와 NULL

```sql
SELECT pg_column_size(attrs), 4+4+4*2*3+(1+2+1+3+3) - 3 FROM s;
SELECT pg_column_size('a=>NULL'::hstore), pg_column_size('a=>""'::hstore), pg_column_size('a=>x'::hstore);
```

앞 쿼리는 두 값이 같아야 한다. 뒤 쿼리에서 NULL 값과 빈 문자열의 크기가 같고 `'x'`가 1바이트 크다.

---

## 4. TOAST와 압축

`sql/02-toast-and-compression.sql`을 실행하고 hstore와 jsonb의 `stored_bytes`·`compression`, TOAST 크기를 비교한다. 합성 `layout` 표에서 `offsets`가 `lengths`보다 크게 남는 것을 확인한다.

---

- 이전 랩: [`../01-install-and-syntax/`](../01-install-and-syntax)
- 다음 랩: [`../03-indexes/`](../03-indexes)
- 종합 문서: [`../../README.md`](../../README.md)
