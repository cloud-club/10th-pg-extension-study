# Lab 02 직접 해보기 - 2-gram 인덱스로 LIKE 가속하기

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - 2-gram 분해

```sql
CREATE EXTENSION pg_bigm;
SELECT show_bigm('가나다라');
```
```
{" 가",가나,나다,다라,"라 "}
```

앞뒤에 공백 하나씩 붙이고, 두 글자씩 겹쳐가며 잘라낸다. 한글도 그대로 된다 - `pg_trgm` 은 알파벳이 아니면 기본 설정에서 다 걸러낸다.

## STEP 2 - GIN 인덱스로 LIKE 가속

```sql
CREATE TABLE pg_tools (tool text, description text);
INSERT INTO pg_tools VALUES
  ('pg_bigm', 'Tool that provides 2-gram full text search capability in PostgreSQL'),
  ('오타로_검색', '한글 문서에서도 부분 문자열 검색이 빨라야 한다는 요구사항 예시');

CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);

SET enable_seqscan = off;
EXPLAIN SELECT * FROM pg_tools WHERE description LIKE '%검색%';
```

`Bitmap Index Scan` + `Index Cond` 가 그대로 나온다 - 별도 검색 문법이 필요 없다.

## STEP 3 - Recheck 이 왜 필요한가

```sql
CREATE TABLE tbl (doc text);
INSERT INTO tbl VALUES ('He is awaiting trial'), ('It was a trivial mistake');
CREATE INDEX tbl_idx ON tbl USING gin (doc gin_bigm_ops);

EXPLAIN ANALYZE SELECT * FROM tbl WHERE doc LIKE likequery('trial');
```

"trivial" 도 "trial" 의 2-gram(tr, ri, ia, al)을 전부 포함해서 후보로 걸리지만, `Rows Removed by Index Recheck` 가 그걸 걸러낸다.

```sql
SET pg_bigm.enable_recheck = off;
SELECT * FROM tbl WHERE doc LIKE likequery('trial');  -- "trivial" 오답이 섞여 나온다
RESET pg_bigm.enable_recheck;
```

## STEP 4 - likequery() 로 안전하게 이스케이프

```sql
SELECT likequery('100% 확신하는_검색어\단어');
```

`%`, `_`, `\` 를 이스케이프하고 앞뒤에 `%` 를 붙인다 - 애플리케이션이 직접 이스케이프 로직을 짤 필요가 없다.

---

## 다음 단계

- 이전 lab: [`../01-preload-and-guc-registration/`](../01-preload-and-guc-registration)
- 다음 lab: [`../03-similarity-and-functions/`](../03-similarity-and-functions)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
