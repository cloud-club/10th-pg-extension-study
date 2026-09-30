# Lab 04 직접 해보기 - pg_trgm 과 비교

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - 짧은 키워드에서 pg_trgm 과 비교

```sql
CREATE EXTENSION pg_bigm;
CREATE EXTENSION pg_trgm;

CREATE TABLE bench (doc text);
INSERT INTO bench SELECT 'lorem ipsum ' || g FROM generate_series(1, 20000) g;
INSERT INTO bench VALUES ('AB');

CREATE INDEX bench_bigm_idx ON bench USING gin (doc gin_bigm_ops);
SET enable_seqscan = off;
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%AB%';   -- cost 낮음

DROP INDEX bench_bigm_idx;
CREATE INDEX bench_trgm_idx ON bench USING gin (doc gin_trgm_ops);
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%AB%';   -- cost 몇 백 배 높음
```

둘 다 `Index Cond` 는 붙지만, 2글자로는 온전한 trigram(3글자)을 못 만들어서 `pg_trgm` 쪽 후보가 훨씬 많다 (`rows=4000` 근처).

## STEP 2 - `gin_key_limit`

```sql
CREATE INDEX bench_bigm_idx ON bench USING gin (doc gin_bigm_ops);
SET pg_bigm.gin_key_limit = 2;
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%lorem ipsum dolor%';
RESET pg_bigm.gin_key_limit;
```

`gin_key_limit` 을 낮추면 인덱스 스캔은 가벼워지지만 후보가 늘어나 Recheck 부담이 커진다 - 아주 긴 키워드에서만 고려할 트레이드오프.

---

## 정리

| | pg_trgm | pg_bigm |
|---|---|---|
| n-gram 단위 | 3-gram | 2-gram |
| 사용 가능 인덱스 | GIN, GiST | GIN 만 |
| 사용 가능 연산자 | LIKE, ILIKE, ~, ~* | LIKE 만 |
| 한글 조각 생성 | **된다** (멀티바이트는 CRC32 해싱) | 된다 (원본 바이트 그대로) |
| 한글 2글자 검색어 | **조각 0개 → 인덱스 전체 스캔** | 조각을 만든다 |
| 구두점 (`192.168.0.1`) | `KEEPONLYALNUM` 이 단어 경계로 쪼갠다 | 그대로 인덱싱 |
| 1~2글자 키워드 | 느림 | 빠름 |
| 유사도 함수 대소문자 | 구분 안 함 | 구분함 |

## 다음 단계

- 이전 lab: [`../03-similarity-and-functions/`](../03-similarity-and-functions)
- **실전 통합**: [`../05-fastapi-search-api/`](../05-fastapi-search-api) - FastAPI 백엔드 통합 예제
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
