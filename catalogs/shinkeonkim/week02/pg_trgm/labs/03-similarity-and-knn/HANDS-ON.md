# Lab 03 직접 해보기 - 유사도와 KNN

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - 유사도 3형제는 의미가 다르다

```sql
SELECT similarity('word', 'two words')              AS similarity,
       word_similarity('word', 'two words')         AS word_sim,
       strict_word_similarity('word', 'two words')  AS strict_word_sim;
--  0.36363637 | 0.8 | 0.5714286
```

- `similarity` : 두 문자열 **전체**를 비교 → 본문이 길면 점수가 깎인다
- `word_similarity` : 검색어에 가장 잘 맞는 **부분 구간**만 본다
- `strict_word_similarity` : 그 구간이 **단어 경계**에 맞아야 한다

## STEP 2 - 본문이 길어지면 similarity 만 무너진다

```sql
SELECT round(similarity('제브라', body)::numeric, 4)      AS similarity,
       round(word_similarity('제브라', body)::numeric, 4) AS word_sim
FROM (VALUES
  ('제브라 문서'),
  ('제브라 문서 그리고 뒤에 붙는 다른 여러 가지 설명들이 이어진다'),
  ('제브라 문서 그리고 뒤에 붙는 다른 여러 가지 설명들이 이어지고 또 이어지며 계속해서 길어지는 아주 긴 본문의 경우를 가정한 문자열이다')
) AS t(body);
```

|  similarity | word_sim |
| ---: | ---: |
| 0.5714 | 1.0000 |
| 0.1111 | 1.0000 |
| 0.0563 | 1.0000 |

**긴 본문에서 짧은 검색어를 찾는데 `similarity()` 를 쓰면 안 된다** - 임계값을 아무리 낮춰도 본문 길이가 점수를 결정해버린다.

## STEP 3 - 임계값은 연산자마다 다르다

```sql
SELECT name, setting FROM pg_settings WHERE name LIKE 'pg_trgm%';
--  pg_trgm.similarity_threshold              0.3   ->  %
--  pg_trgm.word_similarity_threshold         0.6   ->  <%
--  pg_trgm.strict_word_similarity_threshold  0.5   ->  <<%
```

하나만 바꾸고 다 바뀌었다고 착각하기 쉬운 지점이다.

## STEP 4 - 오탈자 허용 검색

```sql
SELECT name, round(similarity(name, 'keyboad')::numeric, 4) AS sim
FROM products WHERE name % 'keyboad' ORDER BY sim DESC;
```

`LIKE` 로는 0건인 오타가 잡힌다.

```sql
-- 임계값을 낮추면 후보가 늘어난다
SET pg_trgm.similarity_threshold = 0.15;
SELECT count(*) FROM products WHERE name % '키보두';
RESET pg_trgm.similarity_threshold;
```

## STEP 5 - KNN (GiST 전용)

```sql
-- <-> 는 거리다: 거리 = 1 - similarity
SELECT 'keyboard' <-> 'keyboad', 1 - similarity('keyboard','keyboad');

CREATE INDEX products_name_gist ON products USING gist (name gist_trgm_ops);
SET enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT name FROM products ORDER BY name <-> 'keyboad' LIMIT 3;
--  Index Scan using products_name_gist ... Order By: (name <-> 'keyboad')
```

```sql
-- 임계값과 무관하다는 게 KNN 의 장점이다
SELECT name, round((name <-> '전혀 상관없는 검색어')::numeric, 4)
FROM products ORDER BY name <-> '전혀 상관없는 검색어' LIMIT 3;
```

`%` 연산자였다면 0건이었을 검색어에도 "그나마 가까운 3건"을 돌려준다. `pg_bigm` 에는 대응물이 없다.

---

## 정리

| 항목 | pg_trgm | pg_bigm |
|---|---|---|
| 전체 유사도 | `similarity()` / `%` | `bigm_similarity()` / `=%` |
| 단어 유사도 | `word_similarity()` / `<%` | 없음 |
| 엄격 단어 유사도 | `strict_word_similarity()` / `<<%` | 없음 |
| 거리순 정렬(KNN) | `<->` (GiST) | **없음** |
| 대소문자 | 무시 | 구분 |
| 공식 | `공통 / (len1+len2-공통)` 자카드 | `공통 / max(len1,len2)` |

## 다음 단계

- 다음 lab: [`../04-regex-and-tuning/`](../04-regex-and-tuning)
