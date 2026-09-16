# Lab 03 직접 해보기 - 유사도 검색과 pg_trgm 과의 차이

```bash
./run.sh up
./run.sh psql
```

```sql
CREATE EXTENSION pg_bigm;
CREATE TABLE pg_tools (tool text, description text);
INSERT INTO pg_tools VALUES
  ('pg_bigm', 'Tool that provides 2-gram full text search capability in PostgreSQL'),
  ('pg_trgm', 'Tool that provides 3-gram full text search capability in PostgreSQL');
CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);
```

## STEP 1 - 유사도 검색 (`=%`)

```sql
SET pg_bigm.similarity_limit = 0.2;
SELECT tool FROM pg_tools WHERE tool =% 'bigm';
```

`pg_bigm.similarity_limit`(0.2) 이상인 것만 돌아온다 - LIKE 처럼 패턴을 몰라도 "이 단어와 비슷한 것"을 찾을 수 있다.

## STEP 2 - `bigm_similarity()` 와 대소문자

```sql
CREATE EXTENSION pg_trgm;
SELECT similarity('ABC', 'abc');       -- 1 (구분 안 함)
SELECT bigm_similarity('ABC', 'abc');  -- 0 (구분함)
```

```sql
SELECT bigm_similarity('ABC', 'A');  -- 0.25 - 앞뒤 공백까지 고려한 2-gram(" A")을 공유
SELECT bigm_similarity('ABC', 'B');  -- 0    - 공유하는 2-gram 이 없음
```

## STEP 3 - FASTUPDATE 와 pending list

```sql
SELECT * FROM pg_gin_pending_stats('pg_tools_idx');  -- 0/0 (CREATE INDEX 시점 데이터는 pending list 를 안 거친다)

INSERT INTO pg_tools SELECT 'extra_' || g, 'additional description number ' || g
  FROM generate_series(1, 500) g;

SELECT * FROM pg_gin_pending_stats('pg_tools_idx');  -- 이제 0이 아니다
```

FASTUPDATE=off 인덱스와 비교:

```sql
CREATE INDEX pg_tools_idx_nofu ON pg_tools USING gin (description gin_bigm_ops) WITH (FASTUPDATE = off);
INSERT INTO pg_tools SELECT 'extra2_' || g, 'yet another description number ' || g FROM generate_series(1, 500) g;
SELECT * FROM pg_gin_pending_stats('pg_tools_idx_nofu');  -- 항상 0/0 - pending list 자체가 없다
```

---

## 다음 단계

- 이전 lab: [`../02-bigram-index-and-search/`](../02-bigram-index-and-search)
- 다음 lab: [`../04-comparison-and-ops/`](../04-comparison-and-ops)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
