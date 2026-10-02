# Lab 01 · 수동 실습

```bash
./run.sh up
./run.sh psql
```

---

## 1. 설치

```sql
SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'hstore';
CREATE EXTENSION hstore;
SELECT name, version, trusted, relocatable FROM pg_available_extension_versions WHERE name = 'hstore';
```

`installed_version`이 설치 전에는 비어 있고 `trusted`가 `t`인지 확인한다. 서버 재시작은 필요 없다.

---

## 2. 리터럴

```sql
SELECT 'a=>1, b=>2'::hstore;
SELECT '  a  =>  1 ,   b=>2 '::hstore;                     -- 공백은 무시
SELECT 'ccc=>1, b=>2, aa=>3, ab=>4'::hstore;               -- 길이 → 바이트 순으로 정렬된다
SELECT 'a=>1, a=>2'::hstore;                               -- 중복 키는 하나만 남는다
SELECT 'a=>NULL, b=>"NULL", c=>""'::hstore;
SELECT pg_typeof('n=>42'::hstore -> 'n');                  -- text
```

`b`가 `aa`보다 앞에 오는 이유를 설명해 본다. 중복 키에서 어느 값이 남았고, 문서가 그것을 보장하는지 생각해 본다.

---

## 3. 연산자

```sql
CREATE TABLE product (id serial PRIMARY KEY, name text, attrs hstore NOT NULL DEFAULT '');
INSERT INTO product (name, attrs) VALUES
  ('shirt',  'color=>red, size=>M, material=>cotton'),
  ('mug',    'color=>white, capacity=>350ml'),
  ('laptop', 'brand=>acme, ram=>16GB, color=>silver'),
  ('hoodie', 'color=>red, size=>L, material=>cotton, promo=>yes');

SELECT name FROM product WHERE attrs @> 'color=>red';
SELECT name FROM product WHERE attrs ? 'promo';
SELECT name FROM product WHERE attrs ?& ARRAY['color', 'size'];
SELECT attrs || 'color=>blue, stock=>10' FROM product WHERE id = 1;
SELECT attrs - 'material'::text FROM product WHERE id = 1;   -- ::text 가 없으면 오류: 아래 참고
```

`||`에서 같은 키가 어느 쪽 값으로 남는지, `-`가 없는 키를 지울 때 어떻게 되는지 확인한다.

---

## 4. 첨자와 갱신

```sql
SELECT attrs['color'] FROM product;
UPDATE product SET attrs['color'] = 'blue', attrs['stock'] = '7' WHERE id = 1;
UPDATE product SET attrs = attrs || 'size=>XL' WHERE id = 1;
UPDATE product SET attrs = attrs - 'stock'::text WHERE id = 1;
```

---

## 5. 변환

```sql
SELECT hstore_to_jsonb('n=>42, t=>true');
SELECT hstore_to_jsonb_loose('n=>42, flag=>t, word=>true, zip=>007, ver=>1.10');
```

strict와 loose에서 `t`와 `true`, `007`, `1.10`이 각각 어떻게 달라지는지 확인한다.

---

- 종합 문서: [`../../README.md`](../../README.md)
- 다음 실습: [`../02-storage-and-toast/`](../02-storage-and-toast)
