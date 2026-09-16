# pg_bigm — 내부 동작과 코드베이스

> 아래 내용은 pg_bigm 공식 저장소(`pgbigm/pg_bigm`, `REL1_2_STABLE` 브랜치)의 실제 소스를 확인하고, [`../labs/`](../labs) 의 각 lab 에서 preload 유무에 따른 동작을 직접 재현·검증해 정리했다.

## 파일 구성

```
pg_bigm.control                 # extension 메타데이터
pg_bigm--1.0--1.1.sql            # 버전 간 업그레이드 스크립트
pg_bigm--1.1--1.2.sql
pg_bigm--1.2.sql                 # 신규 설치용 베이스 스크립트
bigm.h                           # 공통 헤더 - BIGM 매크로, 자료구조 선언
bigm_op.c                        # GUC 정의, likequery/show_bigm/bigm_similarity 등 함수 구현
bigm_gin.c                       # GIN 연산자 클래스 지원 함수(extractValue/extractQuery/consistent 등)
```

`contrib` 가 아니라는 점이 중요하다 - `apt.postgresql.org`(PGDG) 저장소에도 없다. 이 lab 의 `Dockerfile` 이 `intro/labs/03-c-extension` 과 같은 방식으로 GitHub 소스를 받아 PGXS 로 직접 빌드하는 이유다.

## `_PG_init()` - 훅도, 백그라운드 워커도 없다

```c
void
_PG_init(void)
{
    DefineCustomBoolVariable("pg_bigm.enable_recheck", ..., PGC_USERSET, ...);
    DefineCustomIntVariable("pg_bigm.gin_key_limit", ..., PGC_USERSET, ...);
    DefineCustomRealVariable("pg_bigm.similarity_limit", ..., PGC_USERSET, ...);
    DefineCustomStringVariable("pg_bigm.last_update", ..., PGC_INTERNAL,
                               GUC_REPORT | GUC_NOT_IN_SAMPLE | GUC_DISALLOW_IN_FILE, ...);
    EmitWarningsOnPlaceholders("pg_bigm");
}
```

이게 전부다. `RequestAddinShmemSpace()` 도, `RegisterBackgroundWorker()` 도 없다 - **커스텀 GUC 변수 4개를 등록하는 것 말고는 아무것도 하지 않는다.** `pg_stat_statements`(훅+공유메모리)나 `pg_cron`(백그라운드 워커)과는 preload 가 필요한 이유 자체가 다르다는 뜻이다.

## 그런데 왜 "preload 하라"고 하나 - 직접 재현해서 확인한 것

공식 문서는 "`shared_preload_libraries` 또는 `session_preload_libraries` 를 설정해야 한다"고 말한다. [`labs/01-preload-and-guc-registration/`](../labs/01-preload-and-guc-registration) 은 일부러 그걸 끈 채로 시작해서 정확히 무엇이 되고 안 되는지 확인했다.

1. **`CREATE EXTENSION pg_bigm` 은 preload 없이도 성공한다.** `CREATE FUNCTION ... AS 'MODULE_PATHNAME', 'symbol'` 은 그 심볼이 실제로 존재하는지 검증하기 위해 **그 자리에서 라이브러리를 dlopen 한다.** 그래서 `CREATE EXTENSION` 을 직접 실행한 세션은 설치가 끝나는 순간 이미 `pg_bigm.so` 가 메모리에 로드되어 있다 - `_PG_init()` 도 이때 실행되어 커스텀 GUC가 해당 자료형과 기본값으로 등록된다(`pg_settings.vartype = 'real'`, `source = 'default'`로 직접 확인했다).
2. **`LIKE` 검색과 GIN 인덱스는 preload 와 전혀 무관하다.** 어떤 세션이든 `gin_bigm_ops` 연산자 클래스의 지원 함수를 처음 호출하는 순간, PostgreSQL 함수 관리자(`fmgr`)가 자동으로 그 세션에 라이브러리를 로드한다 - 모든 C 언어 함수의 공통 동작이다.
3. **평범한 `SET pg_bigm.similarity_limit = 0.2;` 는 preload 도, `CREATE EXTENSION` 조차도 필요 없다.** PostgreSQL 은 점(`.`)이 포함된 미지의 GUC 이름을 만나면 "placeholder" 로 일단 받아준다 - 이건 pg_bigm 만의 특징이 아니라 PostgreSQL 의 범용 커스텀 GUC 메커니즘이다. `pg_bigm` 을 설치조차 하지 않은 이름(`whatever.foo`)으로도 똑같이 성공하는 것으로 직접 확인했다.
4. **그런데 `ALTER SYSTEM SET pg_bigm.similarity_limit = ...;` 는 다르다.** 이건 **현재 세션이 그 이름을 실제 GUC 로 알고 있어야만** 동작한다 - placeholder 를 새로 만들어주지 않는다. `CREATE EXTENSION` 을 직접 실행한 세션에서는 성공하지만, "이미 설치돼 있는 DB 에 그냥 접속만 한" 새 세션에서는 `ERROR: unrecognized configuration parameter "pg_bigm.similarity_limit"` 로 실패한다 - 이 lab 에서 두 세션을 나란히 띄워 직접 재현했다.

즉, **preload 가 없어도 기능적으로는 다 동작하지만, "어떤 세션에서 언제 GUC 를 다룰 수 있는가"가 세션마다 들쭉날쭉해진다.** `shared_preload_libraries`(모든 세션이 시작부터 로드) 나 `session_preload_libraries`(PostgreSQL 9.4+, 새 세션마다 자동 로드 - 서버 재시작 없이 설정 반영 가능)를 쓰면 이 불일치가 사라진다.

## GIN 연산자 클래스는 어떻게 `LIKE` 를 가로채나

pg_bigm 은 플래너 훅으로 쿼리를 다시 쓰는 게 아니다. PostgreSQL 의 GIN 인덱스 프레임워크가 이미 "이 연산자를 지원하는 연산자 클래스가 인덱스에 있으면 그 인덱스를 고려하라"는 일반 메커니즘을 제공하고, `gin_bigm_ops` 가 `~~`(`LIKE`) 연산자에 대해 다음 지원 함수를 등록해뒀을 뿐이다.

| 지원 함수 | 역할 |
| --- | --- |
| `gin_extract_value_bigm` | 인덱싱할 값(테이블의 텍스트)을 2-gram 목록으로 분해해 GIN 엔트리로 등록 |
| `gin_extract_query_bigm` | 검색 조건(`LIKE '%검색어%'`)을 2-gram 목록으로 분해 |
| `gin_bigm_consistent` / `gin_bigm_triconsistent` | 후보가 조건을 만족하는지(모든 2-gram 을 포함하는지) 판단 - `triConsistent` 는 GIN 9.4+ 의 3상태 버전으로 더 빠르다 |
| `gin_bigm_compare_partial` | 부분 일치 비교 (내부 정렬/탐색용) |

그래서 일반 `EXPLAIN` 에 `Bitmap Index Scan` + `Index Cond: (col ~~ '%...%'::text)` 로 그대로 나타난다 - `pg_bigm` 전용 노드가 따로 있는 게 아니다. 그리고 GIN 인덱스는 항목 후보만 골라줄 뿐 완전한 정답을 보장하지 않기 때문에 (2-gram 이 전부 포함돼 있어도 순서가 다르면 오답일 수 있다 - "trial" 과 "trivial"), 항상 힙에서 원문을 다시 확인하는 **Recheck** 단계가 붙는다 (`pg_bigm.enable_recheck`, 기본 on).

---

## 자료구조 — pg_bigm 이 실제로 무엇을 저장하나

"GIN 을 쓴다"까지는 `pg_trgm` 과 같다. **차이는 GIN 엔트리에 무엇을 넣느냐**에서 시작하고, 이 선택 하나가 아래 모든 특성을 결정한다.

### `bigm` — 조각 하나를 담는 구조체

```c
/* bigm.h */
typedef struct
{
    bool        pmatch;         /* partial match is required? */
    int8        bytelen;        /* byte length of bi-gram string */

    /*
     * Bi-gram string; we assume here that the maximum bytes for a character
     * are four.
     */
    char        str[8];
}   bigm;
```
<sub>[bigm.h — pgbigm/pg_bigm, REL1_2_STABLE](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm.h)</sub>

세 필드가 각각 중요하다.

| 필드 | 의미 | 여기서 따라 나오는 것 |
| --- | --- | --- |
| `char str[8]` | **원본 바이트를 그대로** 담는다 (4바이트 문자 2개까지) | 해싱이 없다 → **충돌이 없다** |
| `int8 bytelen` | 실제 바이트 길이 (한글 2글자면 6) | 조각이 **가변 길이**다 |
| `bool pmatch` | "이 조각은 접두어로 취급하라" | **1글자 검색**이 가능해진다 |

`pg_trgm` 은 `typedef char trgm[3];` — **고정 3바이트**다. 한글 3글자 조각은 9바이트라 담을 수 없어서 CRC32 로 눌러 담는다(`compact_trigram()`). 그래서 `pg_trgm` 은 해시 충돌이 원리적으로 가능하고, `pg_bigm` 은 불가능하다.

### `BIGM` — 조각 배열 (varlena)

```c
/* bigm.h */
typedef struct
{
    int32       vl_len_;        /* varlena header (do not touch directly!) */
    char        data[1];
}   BIGM;

#define CALCGTSIZE(len) (VARHDRSZ + len * sizeof(bigm))
#define GETARR(x)       ( (bigm *)( (char*)x + VARHDRSZ ) )
#define ARRNELEM(x)     ( ( VARSIZE(x) - VARHDRSZ )/sizeof(bigm) )
```

문자열 하나에서 뽑은 조각들을 담는 가변 길이 배열이다. `generate_bigm()`(인덱싱용)과 `generate_wildcard_bigm()`(검색용)이 이걸 만들어 돌려준다.

### GIN 엔트리는 `text` 다 — 이게 핵심이다

```c
/* bigm_gin.c - gin_extract_value_bigm() */
        ptr = GETARR(bgm);
        for (i = 0; i < bgmlen; i++)
        {
            text       *item = cstring_to_text_with_len(ptr->str, ptr->bytelen);
            entries[i] = PointerGetDatum(item);
            ptr++;
        }
```

**조각을 `text` 로 바꿔 GIN 엔트리로 넣는다.** `pg_trgm` 은 `trgm2int()` 로 3바이트를 `int32` 로 만들어 넣는다.

이 차이가 만드는 결과:

| | pg_bigm (`text` 엔트리) | pg_trgm (`int32` 엔트리) |
| --- | --- | --- |
| 엔트리 트리의 정렬 순서 | **사전순** (사람이 읽을 수 있다) | 해시값 순 (의미 없음) |
| "이 글자로 시작하는 조각들" | **연속 구간을 이룬다** | 흩어져 있다 |
| GIN 부분 일치(`comparePartial`) | **가능** | 불가능 |
| 조각 확인 | `SELECT show_bigm('클럽')` → `{" 클",클럽,"럽 "}` | `SELECT show_trgm('클럽')` → `{0x...,0x...,0x...}` |

### `gin_bigm_compare_partial` — pg_trgm 에는 없는 지원 함수

GIN 연산자 클래스의 **지원 함수 5번(`comparePartial`)** 은 "엔트리 트리를 접두어로 훑을 때 어디서 멈출지"를 판정한다.

```c
/* bigm_gin.c */
Datum
gin_bigm_compare_partial(PG_FUNCTION_ARGS)
{
    ...
}
```

`pg_trgm` 은 이 함수를 **등록하지 않는다.** 게을러서가 아니라 등록할 수 없어서다 — 엔트리가 해시값이라 접두어 구간이라는 개념이 성립하지 않는다.

이 함수가 있어서 1글자 검색이 동작한다.

```c
/* bigm_op.c - make_bigrams() */
    if (charlen < 2)
    {
        compact_bigram(bptr, ptr, pg_mblen(str));
        bptr->pmatch = true;      /* ← 포기하지 않고 "부분 일치"로 전환 */
        bptr++;
        return bptr;
    }
```

같은 자리에서 `pg_trgm` 은 `if (charlen < 3) return tptr;` 로 **아무것도 만들지 않고 포기**하고, 그러면 GIN 은 `GIN_SEARCH_MODE_ALL`(인덱스 전체 스캔)로 떨어진다.

### Recheck 을 건너뛰는 최적화

```c
/* bigm_gin.c - gin_extract_query_bigm() */
            /*
             * Check whether the heap tuple fetched by index search needs to
             * be rechecked against the query. If the search word consists of
             * one or two characters and doesn't contain any space character,
             * we can guarantee that the index test would be exact. That is,
             * the heap tuple does match the query, so it doesn't need to be
             * rechecked.
             */
```

**검색어가 공백 없는 1~2글자면 인덱스 판정이 곧 정답이므로 힙 재확인을 생략한다.** `pg_trgm` 에는 대응 코드가 없다. 하필 `pg_trgm` 이 가장 약한 구간에서 `pg_bigm` 이 추가 최적화를 갖고 있는 셈이다.

### 튜닝 손잡이 — `gin_key_limit`

```c
/* bigm_gin.c */
            *nentries = (bigm_gin_key_limit == 0) ?
                bgmlen : Min(bigm_gin_key_limit, bgmlen);
```

검색어에서 뽑은 조각 중 **앞에서 몇 개까지만 인덱스 조건으로 쓸지**를 정한다(기본 0 = 제한 없음). 검색어가 아주 길면 GIN 스캔 자체의 오버헤드가 커지므로, 일부만 쓰고 나머지는 Recheck 에 맡기는 트레이드오프다. `pg_trgm` 에는 이 손잡이가 없다(대신 GiST 쪽에 `siglen` 이 있다).

### 운영 관측용 함수 — `pg_gin_pending_stats()`

```sql
SELECT * FROM pg_gin_pending_stats('pg_tools_idx');
--  pages | tuples
```

GIN 의 FASTUPDATE pending list 크기를 본다. **`pg_bigm` 이 제공하지만 pg_bigm 인덱스 전용이 아니라 모든 GIN 인덱스에 쓸 수 있다** — `pg_trgm` 인덱스나 `tsvector` 인덱스에도 그대로 쓸 수 있는 범용 함수다.

<sub>더 깊은 대조(같은 역할의 함수를 좌우로 놓고 본 것)는 [`../../bigm-vs-trgm/docs/02-source-side-by-side.md`](../../bigm-vs-trgm/docs/02-source-side-by-side.md) 에 있다.</sub>

---

## "text similarity measurement" 는 정말 유사도 검색인가

`pg_bigm.control` 의 설명은 이렇다.

```ini
comment = 'text similarity measurement and index searching based on bigrams'
```

pg_bigm은 LIKE 검색 외에 조각 기반 유사도 검색도 제공한다. `=%` 연산자는 GIN 인덱스를 이용해 유사도 조건에 맞는 후보를 찾는다.

### 1. 오탈자·띄어쓰기가 달라도 매치된다

10만 행 한국어 말뭉치에 몇 개 행을 심어놓고 확인했다.

```sql
SELECT doc, round(bigm_similarity(doc, '클라우드클럽')::numeric, 4) AS sim
FROM sim_demo WHERE doc =% '클라우드클럽' ORDER BY sim DESC;
```

| doc | sim |
| --- | ---: |
| `클라우드클럽` | 1.0000 |
| `클라우드 클럽` | 0.8571 |
| `클라으드클럽` | 0.7143 |

**아래 두 행은 `LIKE '%클라우드클럽%'` 으로는 절대 안 잡힌다.** 띄어쓰기가 들어갔거나 한 글자가 틀렸기 때문이다. `=%` 는 그걸 잡는다 — **부분 문자열 검색이 아니라 조각 기반 유사도 검색이 맞다.**

### 2. `=%` 는 GIN 인덱스를 탄다 — `LIKE` 와 다른 경로로

```
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM sim_demo WHERE doc =% '클라우드클럽';

 Aggregate (actual rows=1 loops=1)
   ->  Bitmap Heap Scan on sim_demo (actual rows=3 loops=1)
         Recheck Cond: (doc =% '클라우드클럽'::text)
         Rows Removed by Index Recheck: 4
         ->  Bitmap Index Scan on sim_bigm (actual rows=7 loops=1)
               Index Cond: (doc =% '클라우드클럽'::text)
```

**`enable_seqscan` 을 끄지 않아도 플래너가 인덱스를 고른다.** 인덱스가 후보 7행을 올리고 Recheck 이 4행을 걸러 3행이 남았다.

인덱스를 타는 이유는 `gin_bigm_ops` 가 `=%` 연산자(`SimilarityStrategyNumber`)도 함께 등록해뒀기 때문이고, `extractQuery` 가 전략 번호로 분기한다.

```c
/* bigm_gin.c - gin_extract_query_bigm() */
    switch (strategy)
    {
        case LikeStrategyNumber:
            /* 와일드카드 패턴에서 조각을 뽑는다. 조각이 "전부" 있어야 매치 */
            bgm = generate_wildcard_bigm(str, slen, &removeDups);
            ...
        case SimilarityStrategyNumber:
            /* 검색어 전체를 조각으로 분해한다. 조각이 "충분히 많이" 겹치면 매치 */
            bgm = generate_bigm(VARDATA(val), VARSIZE(val) - VARHDRSZ);
            ...
    }
```

**두 전략의 차이가 여기 있다.**

| | `LIKE` (`~~`) | 유사도 (`=%`) |
| --- | --- | --- |
| 조각 추출 함수 | `generate_wildcard_bigm()` — 와일드카드를 해석 | `generate_bigm()` — 검색어 전체를 분해 |
| `consistent` 의 판정 | 조각이 **전부** 있어야 참 | 겹친 조각 비율이 **임계값 이상**이면 참 |
| Recheck | 조각 순서가 다를 수 있으므로 필요 | 실제 유사도를 계산해야 하므로 필요 |
| 임계값 | 없음 | `pg_bigm.similarity_limit` (기본 0.3) |

### 3. 임계값이 실제로 후보 수를 바꾼다

같은 10만 행에서 `pg_bigm.similarity_limit` 만 바꿔가며 잰 결과:

| `similarity_limit` | 매치된 행 수 |
| ---: | ---: |
| 0.1 | 23 |
| 0.3 (기본) | 3 |
| 0.8 | 2 |

### 4. `pg_trgm` 의 유사도와 무엇이 다른가

공식부터 다르다. 두 확장 모두 `DIVUNION` 이라는 **같은 이름의 매크로**로 분기하는데(`pg_bigm` 이 `pg_trgm` 코드를 출발점으로 삼은 흔적이다), **`pg_bigm` 은 그 매크로를 정의하지 않아서 반대쪽 가지가 컴파일된다.**

```c
/* bigm_op.c - cnt_sml_bigm().  bigm.h/bigm_op.c 어디에도 #define DIVUNION 이 없다 */
#ifdef DIVUNION
    return ((float4) count) / ((float4) (len1 + len2 - count));
#else
    return ((float4) count) / ((float4) ((len1 > len2) ? len1 : len2));   /* ← 이쪽 */
#endif
```

| | 공식 | 대소문자 |
| --- | --- | --- |
| `bigm_similarity()` | `공통 / max(len1, len2)` | **구분한다** |
| `similarity()` (pg_trgm) | `공통 / (len1 + len2 - 공통)` 자카드 | 무시한다 (`IGNORECASE`) |

분모가 자카드 쪽이 항상 크거나 같으므로, **같은 겹침이라도 `bigm_similarity()` 가 구조적으로 더 높은 값을 낸다.** 여기에 "3-gram 은 한 글자 오타에 조각 3개가 깨지고 2-gram 은 2개만 깨진다"는 효과가 겹쳐 격차가 더 벌어진다. 스터디 예시 문자열로 잰 실측:

| 비교 쌍 | `bigm_similarity()` | `similarity()` |
| --- | ---: | ---: |
| `신건` ↔ `신컨` | **0.3333** | 0.2000 |
| `김신건` ↔ `김신컨` | **0.5000** | 0.3333 |
| `클라우드클럽` ↔ `클라으드클럽` | **0.7143** | 0.4000 |

**기본 임계값이 우연히 둘 다 0.3 이지만(`pg_bigm.similarity_limit` / `pg_trgm.similarity_threshold`), 재는 자가 다르므로 `pg_bigm` 의 0.3 이 훨씬 관대하다.** 한쪽에서 다른 쪽으로 옮길 때는 실제 데이터로 임계값을 다시 잡아야 한다.

### 5. 그래도 없는 것

`pg_trgm` 이 갖고 있는 것 중 `pg_bigm` 에 **대응물이 아예 없는** 기능:

- **`ORDER BY col <-> '검색어' LIMIT n` (KNN 정렬)** — `=%` 는 임계값 필터일 뿐 정렬을 못 한다. "가장 비슷한 3건"을 인덱스로 뽑으려면 `pg_trgm` + GiST 가 필요하다.
- **단어 단위 유사도** (`word_similarity`, `strict_word_similarity`) — 긴 본문에서 짧은 검색어를 찾을 때 필요한데 `pg_bigm` 에는 없다.
- **정규식** (`~`, `~*`) — 다만 `pg_trgm` 도 한글에서는 사실상 못 쓴다([`../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../bigm-vs-trgm/docs/01-ngram-index-internals.md) 3장).

재현 스크립트: [`../../bigm-vs-trgm/experiments/03-operator-coverage-and-correctness/`](../../bigm-vs-trgm/experiments/03-operator-coverage-and-correctness)

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [실무 활용 가이드](03-production-playbook.md)
- [n-gram 인덱싱 원리 통합 정리](../../bigm-vs-trgm/docs/01-ngram-index-internals.md)
- [소스 나란히 보기](../../bigm-vs-trgm/docs/02-source-side-by-side.md)
- [n-gram 기초 (2-gram vs 3-gram)](../../../web/README.md)

## 참고 링크

- [pg_bigm 소스 (pgbigm/pg_bigm, GitHub)](https://github.com/pgbigm/pg_bigm/tree/REL1_2_STABLE)
- [bigm.h - 자료구조 정의](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm.h)
- [bigm_gin.c - GIN 지원 함수](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm_gin.c)
- [bigm_op.c - 조각 생성 · 유사도 · GUC](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm_op.c)
- [pg_bigm 1.2 문서 - Load pg_bigm](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md#load-pg_bigm)
- [PostgreSQL 공식 문서 - GIN 확장성 인터페이스 (comparePartial 포함)](https://www.postgresql.org/docs/16/gin-extensibility.html)
