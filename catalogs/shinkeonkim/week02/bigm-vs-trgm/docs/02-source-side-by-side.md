# 소스 나란히 보기 — 같은 역할, 다른 구현

> [`01-ngram-index-internals.md`](01-ngram-index-internals.md) 가 "원리"라면 이 문서는 **대조표**다. 두 확장에서 같은 역할을 하는 코드를 좌우로 놓고, 다른 곳만 짚는다. 인용은 `postgres/REL_16_STABLE` 의 `contrib/pg_trgm/` 과 `pgbigm/pg_bigm/REL1_2_STABLE` 원문이다.

## 파일 대응

| 역할 | pg_trgm | pg_bigm |
| --- | --- | --- |
| 옵션 매크로 · 타입 정의 | `trgm.h` (140줄) | `bigm.h` (97줄) |
| 조각 생성 · 유사도 · GUC | `trgm_op.c` (1,337줄) | `bigm_op.c` (765줄) |
| GIN 지원 함수 | `trgm_gin.c` (360줄) | `bigm_gin.c` (466줄) |
| GiST 지원 함수 | `trgm_gist.c` (974줄) | **없음** |
| 정규식 → 조각 그래프 | `trgm_regexp.c` (2,361줄) | **없음** |
| SQL 정의 | `pg_trgm--1.3.sql` + 업그레이드 6개 | `pg_bigm--1.2.sql` + 업그레이드 2개 |

**전체 코드량이 3배 이상 차이 나고, 그 차이는 거의 전부 `trgm_regexp.c` 와 `trgm_gist.c` 다.** `pg_bigm` 은 "LIKE 를 GIN 으로 가속한다"는 한 가지 일만 한다.

## 1. 타입 정의 — 여기서부터 갈린다

```c
/* pg_trgm: trgm.h */                    /* pg_bigm: bigm.h */
typedef char trgm[3];                    typedef struct
                                         {
                                             bool   pmatch;    /* 부분 일치 필요? */
                                             int8   bytelen;   /* 실제 바이트 길이 */
                                             char   str[8];    /* 원본 바이트 */
                                         } bigm;
```

- `trgm` 은 **정확히 3바이트 고정**. 그래서 멀티바이트 조각은 반드시 해싱해야 한다.
- `bigm` 은 **가변 길이 + 부분 일치 플래그**. 원본을 그대로 담을 수 있고, "이 조각은 접두어로 취급하라"는 신호를 실을 자리가 있다.

이 한 가지 선택이 3장(짧은 키워드)과 4장(부분 일치)의 결과를 전부 결정한다.

## 2. 조각 생성

```c
/* pg_trgm: trgm_op.c */                        /* pg_bigm: bigm_op.c */
static void                                     static void
compact_trigram(trgm *tptr, char *str,          compact_bigram(bigm *bptr, char *str,
                int bytelen)                                   int bytelen)
{                                               {
    if (bytelen == 3)                               CPBIGM(bptr, str, bytelen);
        CPTRGM(tptr, str);                      }
    else                                        /* CPBIGM = memcpy + bytelen 기록.
    {                                              해싱이 없다. 끝. */
        pg_crc32 crc;
        INIT_LEGACY_CRC32(crc);
        COMP_LEGACY_CRC32(crc, str, bytelen);
        FIN_LEGACY_CRC32(crc);
        /* use only 3 upper bytes from crc,
           hope, it's good enough hashing */
        CPTRGM(tptr, &crc);
    }
}
```

주석의 `hope, it's good enough hashing` 이 정직하다 - **CRC32 상위 3바이트로 눌러 담으므로 충돌이 가능하다.** Recheck 이 있어서 정답이 틀리지는 않지만, 서로 다른 한글 트라이그램이 같은 엔트리에 모이면 포스팅 리스트가 길어진다.

## 3. 조각이 n 보다 짧을 때 — 성능 차이의 근원

```c
/* pg_trgm: make_trigrams() */                  /* pg_bigm: make_bigrams() */
static trgm *                                   static bigm *
make_trigrams(trgm *tptr, char *str,            make_bigrams(bigm *bptr, char *str,
              int bytelen, int charlen)                      int bytelen, int charlen)
{                                               {
    char *ptr = str;                                char *ptr = str;

    if (charlen < 3)                                if (charlen < 2)
        return tptr;   /* ← 포기 */                 {
                                                        compact_bigram(bptr, ptr,
    ...                                                                pg_mblen(str));
}                                                       bptr->pmatch = true;  /* ← 전환 */
                                                        bptr++;
                                                        return bptr;
                                                    }
                                                    ...
                                                }
```

그리고 그 결과가 GIN 에게 전달되는 방식:

```c
/* trgm_gin.c */                                /* bigm_gin.c */
    /*                                              /*
     * If no trigram was extracted then we            * If no bigram was extracted then we
     * have to scan all the index.                    * have to scan all the index.
     */                                               */
    if (trglen == 0)                                if (*nentries == 0)
        *searchMode = GIN_SEARCH_MODE_ALL;              *searchMode = GIN_SEARCH_MODE_ALL;
```

**폴백 코드는 문장까지 똑같다.** 차이는 **거기에 도달하느냐**다 - `pg_bigm` 은 1글자여도 `pmatch` 조각을 하나 만들어내므로 `*nentries == 0` 이 되지 않는다.

## 4. 부분 일치 — pg_bigm 에만 있는 GIN 지원 함수

GIN 연산자 클래스의 **`comparePartial` (지원 함수 5번)** 은 "엔트리 트리를 접두어로 훑을 때 어디서 멈출지" 판정한다.

| | pg_trgm | pg_bigm |
| --- | --- | --- |
| `comparePartial` | **등록 안 함** | `gin_bigm_compare_partial` |

`pg_trgm` 이 등록하지 않는 건 게을러서가 아니라 **등록할 수 없어서다.** 엔트리가 CRC32 해시값이라 "이 글자로 시작하는 조각들"이 엔트리 트리에서 연속 구간을 이루지 않는다. `pg_bigm` 은 엔트리가 원본 바이트의 `text` 라 사전순으로 정렬되어 있고, 그래서 접두어 구간 탐색이 성립한다.

**"2-gram 이라 짧은 키워드에 강하다"는 설명은 절반만 맞다.** 나머지 절반은 **조각을 해싱하지 않아서 접두어 탐색이 가능하다**는 것이고, 이쪽이 1글자 검색까지 되는 진짜 이유다.

## 5. Recheck 판정

```c
/* trgm_gin.c - gin_trgm_consistent() */
        case LikeStrategyNumber:
            /* Check if all extracted trigrams are presented. */
            res = true;
            for (i = 0; i < nkeys; i++) { if (!check[i]) { res = false; break; } }
            break;
    /* *recheck 는 함수 진입부에서 항상 true 로 설정된다 */
```

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
            recheck = (bool *) palloc(sizeof(bool));
            if (bgmlen == 1 && !removeDups)
            {
                const char *sp;
                *recheck = false;
                for (sp = str; (sp - str) < slen;)
                {
                    if (t_isspace(sp)) { *recheck = true; break; }
                    sp += IS_HIGHBIT_SET(*sp) ? pg_mblen(sp) : 1;
                }
            }
            else
                *recheck = true;
```

```c
/* bigm_gin.c - gin_bigm_consistent() */
            *recheck = bigm_enable_recheck &&
                ((nkeys != 1) || *((bool *) extra_data[0]));
```

`pg_bigm` 은 **"검색어가 공백 없는 1~2글자면 인덱스 판정이 곧 정답"** 이라고 보고 힙 재확인을 생략한다. `pg_trgm` 에는 대응 코드가 없다. **`pg_trgm` 이 가장 약한 구간에 `pg_bigm` 이 추가 최적화를 갖고 있는 셈**이라, 실측 격차가 이론치보다 더 벌어진다.

## 6. 유사도 공식 — 같은 `#ifdef`, 반대 결과

두 확장 모두 `DIVUNION` 이라는 **똑같은 이름의 매크로**로 공식을 분기한다. `pg_bigm` 이 `pg_trgm` 코드를 출발점으로 삼았다는 흔적이다. 그런데 **한쪽만 그 매크로를 정의해 뒀다.**

```c
/* pg_trgm: trgm.h — DIVUNION 을 define 한다 */
#define DIVUNION
...
#ifdef DIVUNION
#define CALCSML(count, len1, len2) \
    ((float4)(count)) / ((float4)((len1) + (len2) - (count)))          /* ← 이쪽이 쓰인다 */
#else
#define CALCSML(count, len1, len2) \
    ((float4)(count)) / ((float4)(((len1) > (len2)) ? (len1) : (len2)))
#endif
```

```c
/* pg_bigm: bigm_op.c — DIVUNION 을 어디에서도 define 하지 않는다 */
#ifdef DIVUNION
    return ((float4) count) / ((float4) (len1 + len2 - count));
#else
    return ((float4) count) / ((float4) ((len1 > len2) ? len1 : len2));  /* ← 이쪽이 쓰인다 */
#endif
```

```bash
$ grep -rn "DIVUNION" bigm.h bigm_op.c
bigm_op.c:670:#ifdef DIVUNION        # ← #define 이 없다. 항상 #else 로 컴파일된다
```

즉 **공식이 다르다.**

| | 공식 | 성격 |
| --- | --- | --- |
| `similarity()` (pg_trgm) | `공통 / (len1 + len2 - 공통)` | 자카드 (합집합으로 나눔) |
| `bigm_similarity()` (pg_bigm) | `공통 / max(len1, len2)` | 겹침 비율 (더 긴 쪽으로 나눔) |

분모가 항상 자카드 쪽이 크거나 같으므로, **같은 겹침이라도 `bigm_similarity()` 가 구조적으로 더 높은 값을 낸다.** 직접 검산해보면 정확히 맞는다.

```sql
SELECT array_length(show_trgm('abcd'),1) AS l1,   -- 5
       array_length(show_trgm('abce'),1) AS l2,   -- 5
       similarity('abcd','abce');                  -- 0.42857143
-- 공통 3개 → 3 / (5 + 5 - 3) = 3/7 = 0.428571…    ✓ 자카드

SELECT similarity('데이터베이스','데이타베이스'),  bigm_similarity('데이터베이스','데이타베이스');
--       0.4                                        0.71428573
-- trgm: 조각 7개씩, 공통 4개 → 4 / (7 + 7 - 4) = 0.4          ✓
-- bigm: 조각 7개씩, 공통 5개 → 5 / max(7, 7)     = 0.714285…  ✓
```

**한글 오탈자 한 글자에서 격차가 두 배 가까이 벌어지는 데는 두 가지 이유가 겹쳐 있다.**

1. **조각 길이**: 한 글자가 틀리면 3-gram 은 조각 3개가 동시에 깨지고, 2-gram 은 2개만 깨진다 (공통 4개 vs 5개).
2. **분모**: 자카드는 합집합(10)으로, `pg_bigm` 은 최대 길이(7)로 나눈다.

거기에 대소문자 처리까지 반대다.

```sql
SELECT similarity('ABC','abc'), bigm_similarity('ABC','abc');
--       1                        0
-- pg_trgm 은 IGNORECASE 로 소문자화하고, pg_bigm 은 바이트 그대로 본다
```

**실무 함의: 두 확장의 유사도 임계값을 같은 숫자로 두면 안 된다.** 기본값이 우연히 둘 다 0.3(`pg_trgm.similarity_threshold` / `pg_bigm.similarity_limit`)이지만 재는 자가 다르므로, `pg_bigm` 의 0.3 이 훨씬 관대하다. 한쪽에서 다른 쪽으로 옮길 때는 실제 데이터로 임계값을 다시 잡아야 한다.

## 7. `_PG_init()` — 둘 다 GUC 만 등록한다

```c
/* trgm_op.c */                                 /* bigm_op.c */
DefineCustomRealVariable(                       DefineCustomBoolVariable(
  "pg_trgm.similarity_threshold", ... 0.3);       "pg_bigm.enable_recheck", ...);
DefineCustomRealVariable(                       DefineCustomIntVariable(
  "pg_trgm.word_similarity_threshold", ... 0.6);  "pg_bigm.gin_key_limit", ...);
DefineCustomRealVariable(                       DefineCustomRealVariable(
  "pg_trgm.strict_word_similarity_threshold",     "pg_bigm.similarity_limit", ...);
  ... 0.5);                                     DefineCustomStringVariable(
                                                  "pg_bigm.last_update", ...);
```

**훅도, 백그라운드 워커도, 공유 메모리도 없다 - 양쪽 다.** `pg_stat_statements`(훅+공유메모리)나 `pg_cron`(워커)과는 부류가 다르다. 그래서 [`../../pg_bigm/docs/02-internals-and-source.md`](../../pg_bigm/docs/02-internals-and-source.md) 에서 정리한 "preload 없이도 기능은 되지만 세션마다 GUC 인식이 들쭉날쭉하다"는 구조가 `pg_trgm` 에도 똑같이 적용된다. 차이는 **공식 문서가 `pg_bigm` 에만 preload 를 권장한다**는 것뿐이다.

## 8. 설치 권한 — `.control` 한 줄

```ini
# pg_trgm.control                              # pg_bigm.control
default_version = '1.6'                        default_version = '1.2'
module_pathname = '$libdir/pg_trgm'            module_pathname = '$libdir/pg_bigm'
relocatable = true                             relocatable = true
trusted = true          # ← 이 줄이 없다 →
```

직접 확인한 결과:

```sql
SET ROLE app;               -- 수퍼유저 아님, DB 에 CREATE 권한만 있음
CREATE EXTENSION pg_trgm;   -- CREATE EXTENSION
CREATE EXTENSION pg_bigm;   -- ERROR: permission denied to create extension "pg_bigm"
                            -- HINT:  Must be superuser to create this extension.
```

매니지드 환경이나 권한이 제한된 팀 DB 에서는 **이 한 줄이 기술적 우열보다 먼저 결론을 내버릴 수 있다.**

## 더 읽기

- [n-gram 인덱싱 원리](01-ngram-index-internals.md)
- [정량 비교 실험](../experiments/)
- [pg_trgm 내부 동작](../../pg_trgm/docs/02-internals-and-source.md) · [pg_bigm 내부 동작](../../pg_bigm/docs/02-internals-and-source.md)

## 참고 링크

- [contrib/pg_trgm (REL_16_STABLE)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
- [pgbigm/pg_bigm (REL1_2_STABLE)](https://github.com/pgbigm/pg_bigm/tree/REL1_2_STABLE)
- [PostgreSQL 공식 문서 - GIN 확장성 인터페이스 (comparePartial 포함)](https://www.postgresql.org/docs/16/gin-extensibility.html)
