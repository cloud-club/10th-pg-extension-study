# n-gram 인덱싱은 근본적으로 어떻게 동작하나 — pg_bigm · pg_trgm 통합 정리

> `pg_bigm` 과 `pg_trgm` 을 각각 정리하다 보니 **"둘 다 GIN 을 쓴다"는 말만으로는 성능 차이를 설명할 수 없다**는 걸 알게 됐다. 이 문서는 두 확장이 각자 하는 일을 걷어내고, **"부분 문자열 검색을 인덱스로 바꾼다"는 문제 자체를 PostgreSQL 이 어떤 부품으로 푸는지**를 아래에서 위로 정리한다. 인용한 코드는 `postgres/REL_16_STABLE` 과 `pgbigm/pg_bigm/REL1_2_STABLE` 원문이고, 표에 적힌 숫자는 전부 [`../experiments/`](../experiments) 에서 실제로 잰 값이다.

## 0. 문제 정의 — B-tree 가 못 하는 일

```sql
SELECT * FROM docs WHERE body LIKE '%검색%';
```

B-tree 는 **정렬 가능한 전순서(total order)** 위에서만 동작한다. `body LIKE '검색%'`(접두어)는 정렬 순서상 연속 구간이라 B-tree 로 풀리지만(`text_pattern_ops`), `'%검색%'` 는 그렇지 않다 - "검색"을 포함하는 문자열들은 정렬 순서 어디에나 흩어져 있다.

그래서 **문제를 바꾼다.** "부분 문자열 포함"을 직접 인덱싱하는 대신,

> 문자열을 고정 길이 조각(n-gram)으로 쪼개고, **"이 조각을 포함한 행들"의 집합**을 인덱싱한다.

그러면 `'%검색%'` 는 "`검색` 을 이루는 모든 조각을 **동시에** 포함한 행들의 교집합"이라는, 집합 연산으로 풀 수 있는 문제가 된다. 이 변환에는 세 가지 대가가 따르는데, 이 문서의 나머지는 사실상 그 대가에 대한 이야기다.

| 대가 | 무슨 일이 생기나 | 담당 |
| --- | --- | --- |
| **정확하지 않다** | 조각을 다 포함해도 순서가 다를 수 있다 (`trial` vs `trivial`) | Recheck — 4장 |
| **조각을 못 만들 수 있다** | 검색어가 n 보다 짧으면 조건이 0개다 | `GIN_SEARCH_MODE_ALL` — 3장 |
| **조각이 흔하면 소용없다** | 포스팅 리스트가 테이블 전체에 가깝다 | 선택도 — 5장 |

## 1. 조각 만들기 — 세 가지 설계 결정

두 확장은 "문자열 → n-gram 배열" 함수 하나만 다르고, 나머지는 PostgreSQL 의 GIN 프레임워크가 공통으로 처리한다. 그 함수 안에 든 설계 결정은 **세 개뿐**이다.

### (1) n 을 얼마로 할 것인가, 그리고 패딩을 얼마나 붙일 것인가

```c
/* contrib/pg_trgm/trgm.h */          /* pgbigm/bigm.h */
#define LPADDING		2             #define LPADDING		1
#define RPADDING		1             #define RPADDING		1
```

패딩은 "단어의 시작/끝"이라는 정보를 조각 안에 집어넣기 위한 것이다. `pg_trgm` 이 앞에 공백 **2개**를 붙이는 건 3글자 조각 안에 "단어 맨 앞 한 글자"를 표현하려면 그만큼 필요하기 때문이다.

```sql
SELECT show_trgm('word');   --  {"  w"," wo",ord,"rd ",wor}     (n=3, 패딩 2+1)
SELECT show_bigm('word');   --  {" w",or,rd,"d ",wo}            (n=2, 패딩 1+1)
```

`k` 글자 단어에서 나오는 조각 수는 `k + LPADDING + RPADDING - n + 1` 이다. `pg_trgm` 은 `k+3-3+1 = k+1`, `pg_bigm` 은 `k+2-2+1 = k+1` - **패딩까지 세면 조각 개수는 같다.** 인덱스 크기 차이가 "2-gram 이라 조각이 더 많다" 때문이 아니라는 뜻이고, 실측도 그렇게 나온다 — 6장에서 다룬다.

### (2) 조각을 어떻게 저장할 것인가 — 고정 3바이트 해시 vs 원본 바이트

이게 **두 확장의 가장 근본적인 차이**다.

```c
/* pg_trgm: 조각은 언제나 정확히 3바이트다 */
typedef char trgm[3];

static void
compact_trigram(trgm *tptr, char *str, int bytelen)
{
	if (bytelen == 3)
		CPTRGM(tptr, str);            /* ASCII 3글자면 그대로 */
	else
	{
		pg_crc32	crc;              /* 멀티바이트면 CRC32 로 눌러 담는다 */
		INIT_LEGACY_CRC32(crc);
		COMP_LEGACY_CRC32(crc, str, bytelen);
		FIN_LEGACY_CRC32(crc);
		/* use only 3 upper bytes from crc, hope, it's good enough hashing */
		CPTRGM(tptr, &crc);
	}
}
```

```c
/* pg_bigm: 조각은 가변 길이이고, 원본 바이트를 그대로 담는다 */
typedef struct
{
	bool		pmatch;			/* partial match is required? */
	int8		bytelen;		/* byte length of bi-gram string */
	char		str[8];         /* 4바이트 문자 2개까지 */
}	bigm;
```

여기서 갈라지는 결과가 세 가지다.

| | pg_trgm | pg_bigm |
| --- | --- | --- |
| 한글 조각 | CRC32 해시 3바이트 | 원본 6바이트 그대로 |
| **해시 충돌** | 원리적으로 가능 (Recheck 이 잡아준다) | 없다 |
| **조각의 순서** | 해시값 순서 = 의미 없음 | 사전순 = **접두어 탐색 가능** |

마지막 줄이 3장("조각을 못 만들면 어떻게 되나")의 결론을 미리 결정한다. **pg_bigm 은 GIN 엔트리가 정렬 가능한 원본 문자열이라 "이 글자로 시작하는 모든 bigram" 을 부분 일치로 훑을 수 있고, pg_trgm 은 해시라 그게 불가능하다.**

```sql
SELECT show_trgm('가나다라');
--  {0x0dbca6,0x1fb1ac,0x66c945,0xb4c7cf,0xecf7cd}   ← 해시된 모습
SELECT show_bigm('가나다라');
--  {" 가",가나,나다,다라,"라 "}                        ← 원본 그대로
```

<sub>덧붙여, 이 실측은 흔히 인용되는 "`pg_trgm` 은 `KEEPONLYALNUM` 때문에 한글을 걸러낸다"는 설명이 **틀렸다**는 것도 보여준다 - 조각은 5개 정상 생성된다. `ISWORDCHR` 가 쓰는 `t_isalnum_with_len()` 은 멀티바이트를 인식하고, 한글은 유니코드상 알파벳이다.</sub>

### (3) 무엇을 "단어 문자"로 볼 것인가

```c
/* pg_trgm 만 갖고 있는 옵션 */
#define KEEPONLYALNUM
#define ISWORDCHR(c, len)	(t_isalnum_with_len(c, len))
#define IGNORECASE
```

`pg_bigm` 에는 이 두 매크로에 대응하는 것이 **아예 없다.** 모든 바이트를 그대로 인덱싱한다. 관측되는 차이:

```sql
SELECT show_trgm('192.168.0.1');
--  {"  0","  1"," 0 "," 1 "," 16"," 19",168,192,"68 ","92 "}   ← 점에서 단어가 끊긴다
SELECT show_bigm('192.168.0.1');
--  {" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92}                       ← 점도 조각의 일부

SELECT similarity('ABC','abc'), bigm_similarity('ABC','abc');
--  1  |  0                                                       ← 대소문자 처리가 정반대
```

**어느 쪽이 옳은 게 아니라 대상이 다르다.** 자연어 검색이면 `pg_trgm` 의 정규화가 이득이고, IP·버전·경로·식별자처럼 구두점과 대소문자가 의미를 갖는 검색이면 `pg_bigm` 이 맞다.

## 2. GIN 이 하는 일 — 두 확장이 공유하는 부분

여기부터는 두 확장이 **똑같다.** PostgreSQL 의 GIN 은 "값 하나가 여러 키로 분해되는" 모든 타입을 위한 일반 프레임워크이고, 확장은 아래 5개 함수만 채워 넣는다.

| GIN 지원 함수 | pg_trgm | pg_bigm | 하는 일 |
| --- | --- | --- | --- |
| 1 `compare` | (내장 int4) | (내장 text) | 엔트리 정렬 순서 |
| 2 `extractValue` | `gin_extract_value_trgm` | `gin_extract_value_bigm` | **인덱싱할 값** → 조각 배열 |
| 3 `extractQuery` | `gin_extract_query_trgm` | `gin_extract_query_bigm` | **검색 조건** → 조각 배열 + 검색 모드 |
| 4 `consistent` | `gin_trgm_consistent` | `gin_bigm_consistent` | 조각 존재 여부 → 매치 가능성 판정 |
| 5 `comparePartial` | 없음 | `gin_bigm_compare_partial` | **부분(접두어) 일치 비교** ← pg_bigm 에만 있다 |
| 6 `triConsistent` | `gin_trgm_triconsistent` | `gin_bigm_triconsistent` | 3상태(참/거짓/모름) 버전 |

인덱스의 물리 구조도 공통이다.

```
                 ┌──────────────── 엔트리 트리 (B-tree) ────────────────┐
                 │  "  w" │ " wo" │ "ord" │ "rd " │ "wor" │ ...        │
                 └────┬────────────────┬───────────────────────────────┘
                      │                │
              포스팅 리스트/트리    포스팅 트리
              (TID 들, 압축 저장)   (엔트리가 아주 흔할 때)
```

- 엔트리 트리의 키 = 조각 하나. 그 아래에 **그 조각을 포함한 행들의 TID 목록**(포스팅 리스트)이 달린다.
- TID 가 많아지면 리스트가 별도의 **포스팅 트리**로 승격된다. "흔한 조각"이 비싼 이유가 여기 있다.
- 검색은 조각별 포스팅 리스트를 읽어 **비트맵으로 AND** 한 뒤, 그 비트맵으로 힙을 훑는다 → 그래서 플랜에 항상 `Bitmap Index Scan` + `Bitmap Heap Scan` 이 나온다.

**`EXPLAIN` 에 `pg_bigm` 이나 `pg_trgm` 전용 노드는 없다.** 두 확장 모두 쿼리를 다시 쓰는 훅을 걸지 않고, 연산자 클래스라는 표준 확장점에 함수를 등록할 뿐이다.

## 3. 조각을 못 만들면 어떻게 되나 — 두 확장이 갈라지는 지점

**여기가 성능 차이의 90% 다.** 각 확장의 "조각 만들기" 함수에서 딱 한 줄씩만 비교하면 된다.

```c
/* pg_trgm: trgm_op.c - make_trigrams() */
	if (charlen < 3)
		return tptr;                      /* ← 포기한다. 아무것도 안 만든다 */
```

```c
/* pg_bigm: bigm_op.c - make_bigrams() */
	if (charlen < 2)
	{
		compact_bigram(bptr, ptr, pg_mblen(str));
		bptr->pmatch = true;              /* ← 포기하지 않고 "부분 일치"로 전환한다 */
		bptr++;
		return bptr;
	}
```

`pg_trgm` 이 조각을 0개 만들면 GIN 에게 이렇게 알린다.

```c
/* trgm_gin.c */
	/*
	 * If no trigram was extracted then we have to scan all the index.
	 */
	if (trglen == 0)
		*searchMode = GIN_SEARCH_MODE_ALL;
```

**`GIN_SEARCH_MODE_ALL` 은 "인덱스를 안 쓴다"가 아니다. "인덱스 엔트리를 전부 읽고, 모든 행을 후보로 올린 뒤, 힙에서 하나씩 재확인한다"는 뜻이다.** 인덱스 읽기 비용 + 시퀀셜 스캔 비용을 둘 다 낸다. 그래서 **인덱스가 없는 것보다 느려진다.**

`pg_bigm` 의 `pmatch = true` 는 반대로 간다. GIN 의 **부분 일치(partial match)** 기능을 켜서, 엔트리 트리에서 "그 글자로 시작하는 모든 bigram" 구간을 탐색하고 그 포스팅 리스트들만 합친다 - 조각을 원본 바이트로 정렬해 저장했기 때문에 가능한 일이다(1장 "조각 만들기").

20만 행에서 잰 결과 ([`../experiments/01`](../experiments/01-keyword-length-and-selectivity)):

| 쿼리 | 인덱스 | Bitmap Index Scan 이 돌려준 행 | Rows Removed by Index Recheck | 인덱스 버퍼 |
| --- | --- | ---: | ---: | ---: |
| `LIKE '%제브라%'` (3글자, 정답 1행) | `gin_trgm_ops` | 1 | 0 | 4 |
| `LIKE '%제브%'` (2글자, 정답 1행) | `gin_trgm_ops` | **200,003** | 200,002 | 6,292 |
| `LIKE '%제브%'` (2글자, 정답 1행) | `gin_bigm_ops` | **1** | 0 | 2 |
| `LIKE '%제%'` (1글자, 정답 1행) | `gin_bigm_ops` | **1** | 0 | 2 |

**"인덱스를 타느냐"는 잘못된 질문이다.** 네 경우 모두 `EXPLAIN` 에 `Index Cond` 가 붙는다. 봐야 할 것은 **`Bitmap Index Scan` 이 돌려준 `actual rows`** 다 - 그게 테이블 전체 행 수와 같으면 인덱스가 필터로서 아무 일도 안 한 것이다.

### 그런데 `pg_trgm` 도 패딩을 얻어내면 산다

`LIKE` 패턴에서 조각을 뽑는 `get_wildcard_part()` 의 주석에 답이 있다.

```c
/*
 * If the found word is bounded by non-word characters or string boundaries
 * then this function will include corresponding padding spaces into buf.
 */
```

**경계가 `%`/`_` 면 패딩을 못 붙이지만(뒤에 무슨 글자가 올지 모르니까), 경계가 비단어 문자나 문자열 끝이면 패딩을 붙인다.** 그러면 2글자도 `charlen >= 3` 이 된다.

| 패턴 | 어떤 패딩이 붙나 | Bitmap Index Scan 이 돌려준 행 | 실행 시간 |
| --- | --- | ---: | ---: |
| `LIKE '%제브%'` | 없음 → 조각 0개 | 200,007 | 358 ms |
| `LIKE '제브%'` | 앞 = 문자열 시작 → `LPADDING 2` | **3** | 0.045 ms |
| `LIKE '%제브'` | 뒤 = 문자열 끝 → `RPADDING 1` | **2** | 0.016 ms |
| `LIKE '% 제브 %'` | 공백 = 비단어 문자 → 양쪽 다 | **2** | 0.025 ms |

**실무 처방**: `pg_bigm` 을 못 쓰는 환경(수퍼유저 권한 없음, 매니지드 미지원)에서 짧은 키워드가 문제라면, 자동완성은 `'키워드%'` 로, 단어 단위 검색은 `'% 키워드 %'` 로 바꾸는 것만으로 대부분 해결된다. 의미가 달라지는 걸 받아들일 수 있는지가 판단 기준이다.

### 정규식은 또 다른 벽이 있다 — U+07FF

`pg_trgm` 만 갖고 있는 정규식 지원(`~`, `~*`)은 `LIKE` 와 **완전히 다른 경로**를 탄다. 정규식을 PostgreSQL 정규식 엔진으로 컴파일해 NFA 를 얻고, NFA 의 "컬러(문자 집합)"를 개별 문자로 펼쳐서 조각을 만든다. 펼칠 수 없는 컬러는 포기한다.

```c
/* trgm_regexp.c - getColorInfo() */
		int			charsCount = pg_reg_getnumcharacters(regex, i);
		if (charsCount < 0 || charsCount > COLOR_COUNT_LIMIT)
		{
			/* Non expandable, or too large to work with */
			colorInfo->expandable = false;
			continue;
		}
```

```c
/* src/backend/regex/regexport.c - pg_reg_getnumcharacters() */
	/*
	 * If the color appears anywhere in the high colormap, treat its number of
	 * members as uncertain. ...
	 */
	if (cm->cd[co].nuchrs != 0)
		return -1;
```

```c
/* src/include/regex/regcustom.h */
#define MAX_SIMPLE_CHR	0x7FF	/* suitable value for Unicode */
```

**U+07FF 는 UTF-8 에서 2바이트로 인코딩되는 마지막 코드포인트다.** 그 위의 문자는 정규식 엔진의 "high colormap" 으로 가고, 개수를 셀 수 없다고 보고되어 컬러가 펼쳐지지 않는다. 실측:

| 정규식 | 문자 인코딩 길이 | Bitmap Index Scan 이 돌려준 행 | 실행 시간 |
| --- | --- | ---: | ---: |
| `~ 'zebra'` | 1바이트 | **1** | 0.22 ms |
| `~ 'naïve'` (U+00EF) | 2바이트 | **1** | 0.048 ms |
| `~ 'ΑΒΓΔΕ'` (U+0391~) | 2바이트 | **1** | 0.068 ms |
| `~ '제브라'` (U+C81C~) | **3바이트** | **200,005** | 471 ms |
| `LIKE '%제브라%'` (대조군) | 3바이트 | **1** | 0.032 ms |

**같은 문자열을 찾는데 `LIKE` 는 1행, 정규식은 전체 인덱스 스캔이다.** 한글·한자·가나·이모지 전부 해당한다. `pg_bigm` 은 정규식을 아예 지원하지 않으므로 이 항목에 대안이 없다 - 한국어 정규식 검색은 **두 확장 모두 인덱스로 가속되지 않는 영역**이라고 알아두는 편이 맞다.

## 4. Recheck — 왜 항상 힙을 다시 봐야 하나

조각 집합이 같아도 원문이 다를 수 있다.

```sql
INSERT INTO tbl VALUES ('He is awaiting trial'), ('It was a trivial mistake');
-- "trial" 의 bigram (tr, ri, ia, al) 은 "trivial" 에도 전부 들어있다
```

그래서 GIN 이 올린 후보를 힙에서 원문으로 재확인한다 - 플랜의 `Recheck Cond` 와 `Rows Removed by Index Recheck` 가 그 흔적이다. **`Rows Removed by Index Recheck` 가 크다는 건 인덱스가 후보를 제대로 못 좁혔다는 신호**이므로, 이 값만 봐도 튜닝 지점을 찾을 수 있다.

두 확장 모두 이 단계를 끌 수 있는 손잡이가 있지만 성격이 다르다.

| | pg_trgm | pg_bigm |
| --- | --- | --- |
| Recheck 끄기 | 없음 (항상 켜져 있다) | `pg_bigm.enable_recheck` (기본 on) — **끄면 오답이 나온다. 디버깅용이다** |
| 자동 생략 | 없음 | **검색어가 공백 없는 1~2글자면 자동으로 생략한다** |

`pg_bigm` 의 자동 생략은 소스에 근거가 명확하다.

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

즉 **짧은 키워드에서 `pg_bigm` 은 조각을 만들 수 있을 뿐 아니라 Recheck 까지 건너뛴다** - 하필 `pg_trgm` 이 가장 취약한 구간에서 가장 유리한 최적화를 갖고 있는 셈이다.

## 5. 선택도 — 조각을 만들어도 안 되는 경우

조각을 잘 만들었는데도 느릴 수 있다. **조각이 흔하면** 포스팅 리스트가 테이블 전체에 가깝고, AND 를 해도 후보가 안 줄어든다.

```
"검색" 을 포함하는 행이 전체의 55% 라면
  → 조각을 정확히 뽑아도 후보가 55% 다
  → 비트맵 힙 스캔이 사실상 테이블을 다 읽는다
  → 인덱스 읽기 비용만 추가로 낸 셈
```

[`../../pg_bigm/experiments/02`](../../pg_bigm/experiments/02-query-latency-at-scale) 가 실행마다 결과가 요동쳤던 원인이 정확히 이것이었고(테스트 키워드가 전체의 55.6% 와 매치됐다), 그 실험이 남긴 교훈을 이번 실험 설계에 반영했다 - [`../experiments/01`](../experiments/01-keyword-length-and-selectivity) 은 **선택도를 고정 시드로 통제한 변수로 두고**, 시간 대신 `actual rows`/버퍼 수를 지표로 삼는다.

**정리하면 n-gram 인덱스의 성능은 두 축으로 결정된다.**

```
                  검색어 길이 (조각을 만들 수 있는가)
                       짧다 ◄──────────► 길다
                  ┌────────────────┬────────────────┐
    낮다(희귀)    │  trgm: 최악     │  둘 다 최상     │
                  │  bigm: 최상     │  (실측 동률)    │
   선택도         ├────────────────┼────────────────┤
    높다(흔함)    │  둘 다 나쁘다   │  둘 다 보통     │
                  │  (인덱스 무의미) │                │
                  └────────────────┴────────────────┘
```

**왼쪽 위 칸이 `pg_bigm` 을 쓰는 유일하고 진짜인 이유**다. 오른쪽 열에서는 두 확장의 실측 성능이 사실상 같다.

## 6. GIN 과 GiST — 같은 조각, 다른 자료구조

`pg_trgm` 만 GiST 를 지원한다. 구조가 완전히 다르다.

```c
/* trgm.h - GiST 는 조각을 비트로 눌러 담는다 */
#define SIGLEN_DEFAULT	(sizeof(int) * 3)      /* 12바이트 = 96비트 */
#define HASHVAL(val, siglen) (((unsigned int)(val)) % SIGLENBIT(siglen))
#define HASH(sign, val, siglen) SETBIT((sign), HASHVAL(val, siglen))
#define ALLISTRUE		0x04                   /* 비트가 다 차면 이 플래그로 접힌다 */
```

블룸 필터와 같은 손실 압축이다. 서로 다른 조각이 같은 비트로 떨어지므로 false positive 가 GIN 보다 훨씬 많고, 긴 텍스트에서는 시그니처가 **포화(`ALLISTRUE`)** 되어 필터 역할을 아예 잃는다. PostgreSQL 13 부터 `siglen` 을 조절할 수 있다.

한국어 말뭉치 20만 행(평균 42.7글자) 실측. **검색어는 다섯 줄 모두 6글자 `클라우드클럽`** 으로 통일했다(2글자 검색어를 섞으면 trgm 이 전체 인덱스 스캔으로 떨어져 비교가 안 된다 — 그건 3장의 주제다).

| 인덱스 | 크기 | 인덱스 스캔 버퍼 | KNN(`<->`) |
| --- | ---: | ---: | :-: |
| `gin_bigm_ops` | **29.17 MB** | 16 | ✕ |
| `gin_trgm_ops` | 39.0~39.4 MB | **13** | ✕ |
| `gist_trgm_ops` (siglen 12, 기본) | 41.0 MB | 4,375~4,480 | **○** |
| `gist_trgm_ops(siglen=64)` | 32.4 MB | 3,003~3,012 | **○** |
| `gist_trgm_ops(siglen=256)` | 32.9 MB | 412~432 | **○** |

<sub>크기는 [`../experiments/02`](../experiments/02-index-build-size-and-write), GIN 버퍼는 [`../experiments/01`](../experiments/01-keyword-length-and-selectivity), GiST 버퍼는 [`../../pg_trgm/experiments/01`](../../pg_trgm/experiments/01-gin-vs-gist-build-and-probe) 에서 잰 값이다. GiST 크기는 짧은 문서(평균 42.7글자) 테이블 기준이라 GIN 크기와 데이터가 완전히 같지는 않다. **GIN 값은 2회 실행에서 완전히 동일했고, GiST 값은 ±5% 흔들려 범위로 적었다** — GiST 인덱스 빌드가 완전히 결정적이지 않다.</sub>

**부분 문자열 검색만 놓고 보면 GiST 는 GIN 의 상대가 안 된다.** 같은 검색어에서 `siglen` 을 256까지 올려 최선을 다해도 버퍼가 GIN 의 32배(412~432 vs 13)다. GiST 를 고르는 이유는 오직 `ORDER BY col <-> '검색어' LIMIT n` 하나이며, 이건 GIN 에 대응물이 없다.

<sub>`siglen` 을 키웠는데 인덱스가 **작아진** 것은 직관과 반대다 — 기본 96비트에서 시그니처가 포화(`ALLISTRUE`)돼 트리 구조가 나빠진 결과로 보이지만, `pageinspect` 로 직접 확인하지는 못했다. 자세한 스윕은 [`../../pg_trgm/experiments/01`](../../pg_trgm/experiments/01-gin-vs-gist-build-and-probe).</sub>

## 7. 한 장 요약

| 층위 | 공통 (PostgreSQL 이 한다) | pg_trgm | pg_bigm |
| --- | --- | --- | --- |
| 조각 크기 | | 3-gram, 패딩 2+1 | 2-gram, 패딩 1+1 |
| 조각 저장 | | 고정 3바이트, 멀티바이트는 **CRC32 해시** | 가변 길이, **원본 바이트** |
| 문자 정규화 | | `KEEPONLYALNUM` + `IGNORECASE` | 없음 (바이트 그대로) |
| 조각 < n 일 때 | | **포기 → 전체 인덱스 스캔** | **부분 일치로 전환** |
| Recheck | GIN 프레임워크가 요청 | 항상 | 1~2글자 무공백이면 자동 생략 |
| 인덱스 구조 | GIN 엔트리 트리 + 포스팅 리스트/트리 | GIN + **GiST** | GIN 만 |
| 연산자 | 연산자 클래스 등록 | `LIKE ILIKE ~ ~* % <% <<% <-> =` | `LIKE =%` |
| 설치 | | contrib, **trusted (비수퍼유저 OK)** | 소스 빌드, **수퍼유저 필요** |

## 더 읽기

- [소스 나란히 보기](02-source-side-by-side.md) - 같은 역할의 함수를 좌우로 놓고 비교
- [정량 비교 실험](../experiments/) - 위 표의 숫자를 직접 재현하는 스크립트
- **개념 배경** — [`web/#/foundations/btree` B-tree 는 왜 못 하나](../../../web/README.md) · [`web/#/foundations/gin` GIN 인덱스](../../../web/README.md) · [`web/#/foundations/recheck` Recheck 이란](../../../web/README.md) · [`web/#/pg-bigm/korean` 한국어와 n-gram](../../../web/README.md)
- **차트·애니메이션 버전** — [`web/#/foundations/gin`](../../../web/README.md) · [`web/#/foundations/ngram`](../../../web/README.md)
- [pg_bigm 카탈로그](../../pg_bigm/README.md) · [pg_trgm 카탈로그](../../pg_trgm/README.md)

## 참고 링크

- [PostgreSQL 공식 문서 - GIN 인덱스 구현](https://www.postgresql.org/docs/16/gin-implementation.html)
- [PostgreSQL 공식 문서 - GIN 확장성 인터페이스](https://www.postgresql.org/docs/16/gin-extensibility.html)
- [contrib/pg_trgm 소스 (REL_16_STABLE)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
- [pgbigm/pg_bigm 소스 (REL1_2_STABLE)](https://github.com/pgbigm/pg_bigm/tree/REL1_2_STABLE)
- [src/include/regex/regcustom.h - MAX_SIMPLE_CHR](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/regex/regcustom.h)
