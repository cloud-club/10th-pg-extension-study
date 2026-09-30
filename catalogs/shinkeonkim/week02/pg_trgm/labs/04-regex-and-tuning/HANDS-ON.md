# Lab 04 직접 해보기 - 정규식과 짧은 키워드 함정

```bash
./run.sh up
./run.sh sql     # 5만 행 데이터 준비
./run.sh psql
```

```sql
SET enable_seqscan = off;   -- 인덱스 경로를 강제로 보기 위해
```

## 함정 1 - 한 글자 차이로 모든 것이 바뀐다

```sql
-- (a) 3글자
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%제브라%';

-- (b) 2글자
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%제브%';
```

**세 줄만 보면 된다.**

| | Bitmap Index Scan `actual rows` | Rows Removed by Index Recheck | 인덱스 버퍼 |
| --- | ---: | ---: | ---: |
| (a) `%제브라%` (정답 1행) | 1 | 0 | 3 |
| (b) `%제브%` (정답 3행) | **50,004** | 50,001 | 694 |

(b) 는 정답이 3행인데 인덱스가 **테이블 전체**를 후보로 올렸다. 둘 다 `Index Cond` 가 붙어 있어서 플랜만 훑으면 정상으로 보인다 - 이게 이 함정이 위험한 이유다.

원인은 소스 한 줄이다.

```c
/* trgm_op.c - make_trigrams() */
if (charlen < 3)
    return tptr;          /* 조각을 하나도 안 만들고 포기 */

/* trgm_gin.c */
if (trglen == 0)
    *searchMode = GIN_SEARCH_MODE_ALL;   /* 인덱스 엔트리를 전부 읽는다 */
```

`GIN_SEARCH_MODE_ALL` 은 "인덱스를 안 쓴다"가 아니라 **"인덱스를 통째로 읽는다"** 이다. 인덱스 읽기 비용 + 시퀀셜 스캔 비용을 둘 다 낸다.

## 그런데 우회할 수 있다 - 패딩을 얻어내면 된다

```sql
-- (c) 앞을 고정하면 LPADDING 2 가 적용된다
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '제브%';

-- (d) 공백으로 감싸면 비단어 문자 경계라 양쪽에 패딩이 붙는다
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '% 제브 %';
```

| | Bitmap Index Scan `actual rows` | 인덱스 버퍼 |
| --- | ---: | ---: |
| (c) `제브%` | **3** | 5 |
| (d) `% 제브 %` | **2** | 7 |

같은 2글자인데 후보가 5만에서 한 자릿수로 줄었다. 근거는 `get_wildcard_part()` 의 주석이다.

> If the found word is bounded by non-word characters or string boundaries then this function will include corresponding padding spaces into buf.

**실무 처방**: `pg_bigm` 을 못 쓰는 환경이라면 자동완성은 `'키워드%'`, 단어 검색은 `'% 키워드 %'` 로 바꾼다. 의미가 달라지는 것(부분 일치 → 접두어/단어 일치)을 받아들일 수 있는지가 판단 기준이다.

## 함정 2 - 한글 정규식은 아예 동작하지 않는다

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM logs WHERE body ~ 'zebra';
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM logs WHERE body ~ '제브라';
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM logs WHERE body LIKE '%제브라%';
```

| 쿼리 | Bitmap Index Scan `actual rows` |
| --- | ---: |
| `~ 'zebra'` (1바이트) | 1 |
| `~ '제브라'` (3바이트) | **50,004** |
| `LIKE '%제브라%'` (대조군) | 1 |

**같은 문자열인데 `LIKE` 는 되고 정규식만 안 된다.** 경계를 직접 확인해보자.

```sql
INSERT INTO logs (body) VALUES ('café naïve résumé'), ('ΑΒΓΔΕ 그리스 문자');
VACUUM ANALYZE logs;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM logs WHERE body ~ 'naïve';   -- 2바이트: 1행
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM logs WHERE body ~ 'ΑΒΓΔΕ';   -- 2바이트: 1행
```

**2바이트까지는 되고 3바이트부터 안 된다.** 원인은 `pg_trgm` 이 아니라 정규식 엔진에 있다.

```c
/* src/include/regex/regcustom.h */
#define MAX_SIMPLE_CHR  0x7FF   /* suitable value for Unicode */
```

U+07FF 는 UTF-8 에서 2바이트로 인코딩되는 마지막 코드포인트다. 그 위 문자는 "high colormap" 으로 가고, `pg_reg_getnumcharacters()` 가 -1 을 돌려주어 `trgm_regexp.c` 가 그 컬러를 펼치지 못한다.

### 한글 정규식이 꼭 필요할 때

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs
WHERE body LIKE '%제브라%'        -- 인덱스가 후보를 좁히고
  AND body ~ '제브라\s*zebra';    -- 정규식은 힙에서 필터로만 동작
```

## STEP 3 - 구두점

```sql
SELECT show_trgm('192.168.0.1');
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%168.0%';
```

`Rows Removed by Index Recheck` 가 붙는다 - `KEEPONLYALNUM` 이 점을 단어 경계로 만들어 후보가 늘어났다는 뜻이다.

---

## 운영 체크리스트

| 항목 | 메모 |
|---|---|
| 가장 큰 함정 | 3글자 미만 키워드는 인덱스가 있는 게 없는 것보다 느리다 |
| 진단 방법 | `Bitmap Index Scan` 의 `actual rows` 가 테이블 전체 행수에 가까우면 `GIN_SEARCH_MODE_ALL` 상태다 |
| 한글 정규식 | `~` 는 인덱스 효과가 없다. `LIKE` 로 좁히고 필터로만 쓸 것 |
| 구두점 검색 | IP·버전·경로·식별자는 쪼개진다 → `pg_bigm` 고려 |
| 인덱스 종류 | 기본은 GIN. `ORDER BY <->` 가 필요할 때만 GiST |
| GiST siglen | 긴 텍스트면 기본 96비트가 포화된다 (PG13+ `siglen=64` 등) |
| 버전 | `pg_upgrade` 후 `ALTER EXTENSION pg_trgm UPDATE` 를 잊지 말 것 |

## 다음 단계

- **실전 통합**: [`../05-fastapi-search-api/`](../05-fastapi-search-api)
- **원리 정리**: [`../../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../../bigm-vs-trgm/docs/01-ngram-index-internals.md)
