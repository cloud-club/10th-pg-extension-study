# pg_trgm — 내부 동작과 코드베이스

> 아래 내용은 PostgreSQL `REL_16_STABLE` 의 `contrib/pg_trgm/` 실제 소스와, [`../labs/`](../labs) · [`../../bigm-vs-trgm/experiments/`](../../bigm-vs-trgm/experiments) 에서 직접 재현한 결과를 대조해 정리했다. 인용한 코드는 모두 원문 그대로다.

## 파일 구성

```
pg_trgm.control            # trusted = true (PG13+) - 수퍼유저 아니어도 설치 가능
pg_trgm--1.3.sql           # 신규 설치 베이스 (1.0~1.2 는 업그레이드 경로로만 남아있다)
pg_trgm--1.0--1.1.sql ...  # 1.1 → 1.6 업그레이드 스크립트
trgm.h                     # 옵션 매크로, trgm 타입, GiST 시그니처 매크로, 유사도 공식
trgm_op.c                  # 트라이그램 생성, similarity/word_similarity, GUC 등록
trgm_gin.c                 # GIN 연산자 클래스 지원 함수
trgm_gist.c                # GiST 연산자 클래스 지원 함수 (시그니처 · KNN)
trgm_regexp.c              # 정규식 → NFA → 트라이그램 추출 (9.3+, 2300줄이 넘는 가장 큰 파일)
```

`pg_bigm` 이 3개 파일 1,300여 줄인 것과 비교하면 규모가 다르다 - 대부분의 차이는 `trgm_regexp.c` 와 `trgm_gist.c` 가 만든다.

## 1. 트라이그램은 어떻게 만들어지나 - 패딩이 핵심이다

```c
/* trgm.h */
#define LPADDING		2
#define RPADDING		1
#define KEEPONLYALNUM
#define IGNORECASE
#define DIVUNION
```

단어 앞에 공백 **2개**, 뒤에 **1개**를 붙인 뒤 3글자씩 밀어가며 자른다.

```sql
SELECT show_trgm('word');
--  {"  w"," wo",ord,"rd ",wor}      -- 4글자 단어에서 5개
```

`pg_bigm` 은 `LPADDING 1 / RPADDING 1` 이다 ([`bigm.h`](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm.h)). 이 비대칭(2 vs 1)이 나중에 "짧은 키워드" 문제로 이어진다.

### `KEEPONLYALNUM` - 구두점은 단어 경계다

```c
#define ISWORDCHR(c, len)	(t_isalnum_with_len(c, len))
```

영숫자가 아닌 문자는 **단어 구분자**로 취급되고, 각 조각이 다시 패딩된다.

```sql
SELECT show_trgm('192.168.0.1');
--  {"  0","  1"," 0 "," 1 "," 16"," 19",168,192,"68 ","92 "}
SELECT show_bigm('192.168.0.1');   -- 비교: pg_bigm 은 점을 그대로 인덱싱한다
--  {" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92}
```

`pg_trgm` 인덱스에서 `LIKE '%168.0%'` 를 찾으면 `168` 과 `0` 이 따로 놀아 후보가 늘어난다 (실측: 인덱스 스캔 19행 → Recheck 로 18행 탈락, `pg_bigm` 은 1행). IP·시맨틱 버전·파일 경로·코드 식별자 검색에서 실제로 문제가 된다.

### `IGNORECASE` - 유사도가 대소문자를 구분하지 않는다

```sql
SELECT similarity('ABC','abc'), bigm_similarity('ABC','abc');
--  1  |  0
```

`pg_trgm` 은 `lowerstr()` 를 태우므로 완전히 같다고 보고, `pg_bigm` 은 소문자화를 하지 않으므로 공통 bigram 이 0개다. 어느 쪽이 옳다기보다 **"오탈자 검색"의 의미가 다르다** - 대소문자 혼용이 흔한 영문 상품명이면 `pg_trgm` 쪽이 편하고, 대소문자가 의미를 갖는 코드·식별자 검색이면 `pg_bigm` 쪽이 맞다.

### 멀티바이트 문자는 해싱된다

```c
/* trgm_op.c */
static void
compact_trigram(trgm *tptr, char *str, int bytelen)
{
	if (bytelen == 3)
		CPTRGM(tptr, str);           /* ASCII 3글자 - 그대로 복사 */
	else
	{
		pg_crc32	crc;
		INIT_LEGACY_CRC32(crc);
		COMP_LEGACY_CRC32(crc, str, bytelen);
		FIN_LEGACY_CRC32(crc);
		/* use only 3 upper bytes from crc, hope, it's good enough hashing */
		CPTRGM(tptr, &crc);
	}
}
```

`typedef char trgm[3];` - 트라이그램은 **항상 정확히 3바이트**다. 한글 한 글자는 UTF-8 로 3바이트라 트라이그램 하나가 9바이트인데, 이걸 CRC32 로 눌러 3바이트에 담는다. 그래서:

```sql
SELECT show_trgm('가나다라');
--  {0x0dbca6,0x1fb1ac,0x66c945,0xb4c7cf,0xecf7cd}
```

**즉 한글 트라이그램은 정상적으로 만들어진다** - "`KEEPONLYALNUM` 때문에 한글이 걸러진다"는 흔한 설명은 틀렸다 (`ISWORDCHR` 가 쓰는 `t_isalnum_with_len()` 은 멀티바이트를 인식한다). 대신 **해시 충돌이 원리적으로 가능하다**는 다른 성질이 생긴다. `pg_bigm` 은 bigram 을 원본 바이트 그대로(`char str[8]` + `bytelen`) 저장하므로 충돌이 없다. 실무상으로는 Recheck 이 잡아주므로 정확성 문제는 아니고, **포스팅 리스트가 필요 이상으로 길어질 수 있다**는 비용 문제다.

## 2. 짧은 키워드에서 무슨 일이 벌어지나 - 한 줄이 전부다

```c
/* trgm_op.c - make_trigrams() */
static trgm *
make_trigrams(trgm *tptr, char *str, int bytelen, int charlen)
{
	char	   *ptr = str;

	if (charlen < 3)
		return tptr;      /* ← 아무것도 만들지 않고 포기한다 */
	...
```

추출된 트라이그램이 0개면 `trgm_gin.c` 가 이렇게 처리한다.

```c
	/*
	 * If no trigram was extracted then we have to scan all the index.
	 */
	if (trglen == 0)
		*searchMode = GIN_SEARCH_MODE_ALL;
```

**`GIN_SEARCH_MODE_ALL` 은 "인덱스를 안 쓴다"가 아니라 "인덱스 엔트리를 전부 읽는다"는 뜻이다.** 그래서 시퀀셜 스캔보다 오히려 느려진다. 20만 행 테이블에서 직접 잰 결과:

| 쿼리 | Bitmap Index Scan 이 돌려준 행 | Rows Removed by Index Recheck | 인덱스 버퍼 | 실행 시간 |
| --- | ---: | ---: | ---: | ---: |
| `LIKE '%제브라%'` (3글자) | **1** | 0 | 4 | 0.035 ms |
| `LIKE '%제브%'` (2글자) | **200,003** | 200,002 | 6,292 | 369 ms |

한 글자 차이로 **인덱스 스캔이 돌려주는 후보가 1행에서 전체 테이블로 바뀐다.** `EXPLAIN ANALYZE` 의 `Bitmap Index Scan ... actual rows` 와 `Rows Removed by Index Recheck` 두 줄만 보면 이 상태를 시간 측정 없이도 확정할 수 있다 - [`../../bigm-vs-trgm/experiments/01`](../../bigm-vs-trgm/experiments/01-keyword-length-and-selectivity) 은 이 두 값을 지표로 삼아 CPU 노이즈와 무관한 측정을 한다.

### 그런데 패딩을 얻어내면 2글자도 산다 — 실무에서 바로 쓸 수 있는 우회

`LIKE` 패턴의 트라이그램 추출은 `get_wildcard_part()` 가 담당하는데, 주석에 이렇게 적혀 있다.

```c
/*
 * Extract the next non-wildcard part of a search string, i.e. a word bounded
 * by '_' or '%' meta-characters, non-word characters or string end.
 * ...
 * If the found word is bounded by non-word characters or string boundaries
 * then this function will include corresponding padding spaces into buf.
 */
```

**경계가 `%`/`_` 면 패딩을 못 붙이지만, 경계가 "비단어 문자"거나 "문자열의 끝"이면 패딩을 붙인다.** 그러면 2글자 키워드도 `charlen >= 3` 이 되어 트라이그램이 생긴다. 같은 20만 행 테이블에서 잰 결과:

| 패턴 | Bitmap Index Scan 이 돌려준 행 | 실행 시간 |
| --- | ---: | ---: |
| `LIKE '%제브%'` | 200,007 | 358 ms |
| `LIKE '제브%'` (앞 고정 → LPADDING 2 적용) | **3** | 0.045 ms |
| `LIKE '%제브'` (뒤 고정 → RPADDING 1 적용) | **2** | 0.016 ms |
| `LIKE '% 제브 %'` (공백 = 비단어 문자 경계) | **2** | 0.025 ms |

마지막 줄이 특히 실용적이다 - **검색어 앞뒤에 공백을 넣는 것만으로 전체 인덱스 스캔이 2행 스캔이 된다** (단어 단위 검색이라는 의미 변화를 받아들일 수 있다면). 자동완성처럼 접두어 검색이면 `'키워드%'` 형태가 이미 최적이다.

## 3. GIN 과 GiST - 같은 트라이그램, 완전히 다른 자료구조

### GIN (`gin_trgm_ops`)

역색인이다. 트라이그램 하나가 엔트리 트리의 키가 되고, 그 아래에 해당 트라이그램을 포함한 행들의 TID 포스팅 리스트가 달린다.

| 지원 함수 | 역할 |
| --- | --- |
| `gin_extract_value_trgm` | 인덱싱할 값 → 트라이그램 배열 |
| `gin_extract_query_trgm` | 검색 조건(`LIKE`/정규식/유사도) → 트라이그램 배열 + 검색 모드 |
| `gin_trgm_consistent` | 어떤 트라이그램들이 발견됐을 때 조건을 만족할 수 있는지 판정 |
| `gin_trgm_triconsistent` | 위의 3상태(참/거짓/모름) 버전 - 1.2(PG 9.6)에서 추가 |

`LIKE` 는 항상 `*recheck = true` 다 - "트라이그램이 다 들어있다"와 "부분 문자열이 실제로 있다"는 다른 문제이기 때문이다. 예를 들어 `%trial%` 의 조각은 `tri`/`ria`/`ial` 인데, `arterial triage` 는 이 셋을 **전부 갖고 있으면서도** `trial` 이라는 연속된 문자열은 없다 - Recheck 이 이걸 걸러낸다. (흔히 예로 드는 `trivial` 은 3-gram 에서는 `ria` 가 없어 인덱스 단계에서 이미 탈락하므로 **거짓 양성 예가 아니다**. 2-gram 기준으로는 맞는 예다 - [`web/#/foundations/recheck`](../../../web/README.md) 참고.) **`pg_bigm` 은 여기서 한 가지 최적화를 더 갖고 있다**: 검색어가 공백 없는 1~2글자면 인덱스 판정이 정확하다고 보고 `*recheck = false` 로 Recheck 자체를 건너뛴다 ([`bigm_gin.c`](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/bigm_gin.c) 의 주석 참고). `pg_trgm` 에는 대응하는 코드가 없다.

### GiST (`gist_trgm_ops`)

시그니처(비트맵) 기반이다. 트라이그램들을 해시해 고정 길이 비트벡터에 OR 로 합친다 - 블룸 필터와 같은 구조다.

```c
/* trgm.h */
#define SIGLEN_DEFAULT	(sizeof(int) * 3)      /* 12바이트 = 96비트 */
#define SIGLEN_MAX		GISTMaxIndexKeySize
#define HASHVAL(val, siglen) (((unsigned int)(val)) % SIGLENBIT(siglen))
#define HASH(sign, val, siglen) SETBIT((sign), HASHVAL(val, siglen))

#define ALLISTRUE		0x04
```

- **손실 압축이다.** 서로 다른 트라이그램이 같은 비트로 떨어지므로 false positive 가 GIN 보다 훨씬 많다 → 힙 재확인 부담이 크다.
- **비트가 다 차면 `ALLISTRUE` 로 접힌다.** 긴 텍스트를 기본 siglen(96비트)으로 인덱싱하면 시그니처가 포화돼 "전부 참" 상태가 되고, 그 서브트리는 필터 역할을 못 한다.
- PostgreSQL 13 부터 **`siglen` 을 연산자 클래스 파라미터로 조절**할 수 있다 (`gtrgm_options`, 1.5에서 추가).

```sql
CREATE INDEX ... USING gist (body gist_trgm_ops(siglen=64));
```

한국어 말뭉치 20만 행(평균 42.7글자)에서 직접 잰 결과 (`LIKE '%클라우드클럽%'`, 정답 1행) — [`../experiments/01`](../experiments/01-gin-vs-gist-build-and-probe):

2회 실행값을 병기한다 — **GIN 은 두 실행이 완전히 같고, GiST 는 몇 % 흔들린다**(GiST 인덱스 빌드가 완전히 결정적이지 않다).

| 인덱스 | 크기 | 인덱스 스캔 버퍼 |
| --- | ---: | ---: |
| `gin_trgm_ops` | **39.35 / 39.35 MB** | **13 / 13** |
| `gist_trgm_ops` (siglen 기본 12) | 41.05 / 41.02 MB | 4,480 / 4,375 |
| `gist_trgm_ops(siglen=64)` | 32.36 / 32.40 MB | 3,012 / 3,003 |
| `gist_trgm_ops(siglen=256)` | 32.92 / 32.83 MB | 412 / 432 |

**부분 문자열 검색만 놓고 보면 GiST 는 GIN 의 상대가 안 된다** — `siglen` 을 256까지 올려 최선을 다해도 버퍼가 GIN 의 32배다. 그리고 **`siglen` 을 키우면 인덱스가 오히려 작아진다**(41.0 → 32.9 MB): 기본 96비트가 포화돼 `ALLISTRUE` 로 접히면서 트리 구조 자체가 나빠지기 때문으로 보인다. GiST 를 쓰는 이유는 오직 하나, **KNN** 이다.

```sql
-- GiST 에서만 되는 것: 인덱스만으로 "가장 비슷한 것 N건"
SELECT body FROM t ORDER BY body <-> '희귀 키워드 제브라' LIMIT 3;
--  Index Scan using t_gist on t
--    Order By: (body <-> '희귀 키워드 제브라'::text)
```

GIN 에는 `<->` 를 위한 정렬 지원 함수가 없어서 이 플랜 자체가 나오지 않는다.

## 4. 정규식은 어떻게 인덱스를 타나 - 그리고 왜 한글에서 안 되나

`trgm_regexp.c` 는 정규식을 PostgreSQL 정규식 엔진으로 컴파일해 NFA 를 얻고, NFA 의 "컬러(문자 집합)"를 펼쳐 **"이 정규식에 매치되는 문자열이라면 반드시 포함해야 하는 트라이그램들의 AND/OR 그래프"** 를 만든다. 그 그래프를 GIN `consistent` 에서 평가한다.

```c
/* trgm_regexp.c - getColorInfo() */
		int			charsCount = pg_reg_getnumcharacters(regex, i);
		...
		if (charsCount < 0 || charsCount > COLOR_COUNT_LIMIT)
		{
			/* Non expandable, or too large to work with */
			colorInfo->expandable = false;
			continue;
		}
```

컬러를 개별 문자로 펼칠 수 없으면(`expandable = false`) 그 컬러는 "알 수 없는 문자"로 처리되고, 그 자리를 지나는 경로에서는 트라이그램을 못 만든다. 그리고 `pg_reg_getnumcharacters()` 는 이렇게 되어 있다.

```c
/* src/backend/regex/regexport.c */
	/*
	 * If the color appears anywhere in the high colormap, treat its number of
	 * members as uncertain. ...
	 */
	if (cm->cd[co].nuchrs != 0)
		return -1;
```

"high colormap" 의 경계는 정규식 엔진의 이 상수다.

```c
/* src/include/regex/regcustom.h */
#define MAX_SIMPLE_CHR	0x7FF	/* suitable value for Unicode */
```

**U+07FF 는 UTF-8 에서 2바이트로 인코딩되는 마지막 코드포인트다.** 즉 정규식 트라이그램 추출은 **2바이트 문자까지만 동작하고, 3바이트 이상(한글 U+AC00~, 한자, 가나, 이모지)에서는 통째로 무력화된다.** 20만 행에서 직접 확인한 결과:

| 정규식 | 문자 크기 | Bitmap Index Scan 이 돌려준 행 | 실행 시간 |
| --- | --- | ---: | ---: |
| `~ 'zebra'` | 1바이트 (ASCII) | **1** | 0.22 ms |
| `~ 'naïve'` | 2바이트 (U+00EF) | **1** | 0.048 ms |
| `~ 'ΑΒΓΔΕ'` | 2바이트 (U+0391~) | **1** | 0.068 ms |
| `~ '제브라'` | **3바이트** (U+C81C~) | **200,005** | 471 ms |
| `LIKE '%제브라%'` (대조군) | 3바이트 | **1** | 0.032 ms |

마지막 두 줄이 핵심이다 - **같은 문자열을 찾는데 `LIKE` 는 1행, 정규식은 전체 인덱스 스캔이다.** `LIKE` 경로(`generate_wildcard_trgm`)는 문자를 직접 CRC32 해싱하므로 멀티바이트를 잘 다루지만, 정규식 경로는 정규식 엔진의 컬러맵을 거쳐야 해서 U+07FF 벽에 막힌다. **한국어 텍스트에 `~` 연산자를 쓰면서 `pg_trgm` 인덱스가 도와주기를 기대하면 안 된다.**

<sub>이건 이 카탈로그를 만들며 소스까지 따라가 확인한 내용이다. PostgreSQL 공식 문서의 pg_trgm 페이지에는 "추출할 트라이그램이 없으면 전체 인덱스 스캔이 된다"는 일반적 경고는 있지만, 그 경계가 U+07FF 라는 언급은 없다.</sub>

## 5. GUC 와 preload

```c
/* trgm_op.c - _PG_init() */
	DefineCustomRealVariable("pg_trgm.similarity_threshold", ..., 0.3, 0.0, 1.0, PGC_USERSET, ...);
	DefineCustomRealVariable("pg_trgm.word_similarity_threshold", ..., 0.6, ...);
	DefineCustomRealVariable("pg_trgm.strict_word_similarity_threshold", ..., 0.5, ...);
```

`pg_bigm` 과 마찬가지로 **훅도 백그라운드 워커도 공유 메모리도 없다.** 커스텀 GUC 3개만 등록한다.

```sql
SELECT name, setting, boot_val FROM pg_settings WHERE name LIKE 'pg_trgm%';
--  pg_trgm.similarity_threshold             | 0.3 | 0.3
--  pg_trgm.strict_word_similarity_threshold | 0.5 | 0.5
--  pg_trgm.word_similarity_threshold        | 0.6 | 0.6
```

그래서 `pg_bigm` 문서([`../../pg_bigm/docs/02-internals-and-source.md`](../../pg_bigm/docs/02-internals-and-source.md))에서 정리한 "preload 없이도 기능은 다 되지만 세션마다 GUC 인식이 들쭉날쭉해진다"는 구조가 `pg_trgm` 에도 그대로 적용된다. 다만 **공식 문서가 `pg_trgm` 에는 preload 를 요구하지 않는다** - 어느 쪽도 기능상 필수가 아니고, `ALTER SYSTEM SET pg_trgm.*` 를 쓸 계획이 있을 때만 신경 쓰면 된다. [`../labs/04-regex-and-tuning/`](../labs/04-regex-and-tuning) 에서 직접 재현한다.

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [버전별 변천사](03-version-history.md)
- [실무 활용 가이드](04-production-playbook.md)
- **n-gram 인덱싱 원리 통합 정리**: [`../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../bigm-vs-trgm/docs/01-ngram-index-internals.md)

## 참고 링크

- [contrib/pg_trgm 소스 (REL_16_STABLE)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
- [trgm_regexp.c - 정규식 → 트라이그램 그래프](https://github.com/postgres/postgres/blob/REL_16_STABLE/contrib/pg_trgm/trgm_regexp.c)
- [src/include/regex/regcustom.h - MAX_SIMPLE_CHR](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/regex/regcustom.h)
- [src/backend/regex/regexport.c - pg_reg_getnumcharacters](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/backend/regex/regexport.c)
- [PostgreSQL 공식 문서 - pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
