# pg_trgm

> 텍스트를 3글자씩 겹쳐 자른 트라이그램으로 `LIKE`·정규식·유사도 검색을 GIN/GiST 인덱스로 가속하는 **PostgreSQL 공식 contrib 모듈**. `pg_bigm`(2-gram)보다 기능 표면적이 훨씬 넓지만, 2글자 검색어와 한글 정규식에서는 인덱스가 오히려 독이 된다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 검색 · 텍스트 |
| 버전 | 실습 환경: PostgreSQL 16 / pg_trgm **1.6** (PostgreSQL 14 이후 SQL 정의는 그대로) |
| 라이선스 | PostgreSQL License (PostgreSQL 본체와 함께 배포) |
| 저장소 · 문서 | [contrib/pg_trgm](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm) · [공식 문서](https://www.postgresql.org/docs/16/pgtrgm.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | week02 |

이 문서는 아래 조사와 실습 결과를 종합한 것이다.

- [`docs/01-what-and-why.md`](docs/01-what-and-why.md) - 무엇을 하는지, 왜 필요한지
- [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md) - 내부 동작과 실제 코드베이스
- [`docs/03-version-history.md`](docs/03-version-history.md) - 1.0~1.6, PG 메이저별 매핑을 직접 조회해 확정
- [`docs/04-production-playbook.md`](docs/04-production-playbook.md) - 실무 활용, 매니지드 DB 지원
- [`labs/`](labs) - Docker 기반 실습 5개 (`./run.sh` 또는 각 lab 의 `HANDS-ON.md`)
- [`experiments/`](experiments) - 정량 벤치마크 2건 (`./bench.sh` 로 재현)
- **[`../bigm-vs-trgm/`](../bigm-vs-trgm)** - `pg_bigm` 과의 비교 (원리 + 실험 3건)

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

```sql
-- 오타가 있으면 0건이다. 편집 거리를 애플리케이션에서 직접 구현하거나
-- 후보를 전부 긁어와 언어 레벨에서 비교해야 한다.
SELECT * FROM articles WHERE title LIKE '%김신컨%';   -- 0건 (실제 데이터는 '김신건')
```

**After**

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX articles_title_gin ON articles USING gin (title gin_trgm_ops);

-- 오타가 있어도 관련도 순으로 찾아준다
SELECT title, similarity(title, '김신컨 발표 자료') AS sim
FROM articles
WHERE title % '김신컨 발표 자료'
ORDER BY sim DESC;
--  김신건 발표 자료 | 0.6667
```

## 2. 설치 & 데모

```sql
-- contrib 이라 설치할 게 없다. PostgreSQL 13+ 부터는 trusted 라
-- 수퍼유저가 아니어도 된다 (pg_bigm 은 수퍼유저가 필요하다).
CREATE EXTENSION pg_trgm;
```

```sql
-- 실제 쿼리와 결과
SELECT show_trgm('word');
--  {"  w"," wo",ord,"rd ",wor}     앞 공백 2개 + 뒤 1개를 붙이고 3글자씩 자른다

SELECT show_trgm('가나다라');
--  {0x0dbca6,0x1fb1ac,0x66c945,0xb4c7cf,0xecf7cd}
--  ^ 한글도 조각이 정상 생성된다. 0x.. 는 3바이트 고정 타입에 담으려고
--    CRC32 로 해싱한 결과일 뿐, "걸러진" 게 아니다.

SELECT similarity('abcd','abce');
--  0.42857143      공통 3 / (5 + 5 - 3) = 3/7   자카드 유사도
```

전체 실습은 [`labs/`](labs) 에서 Docker 로 직접 돌려볼 수 있다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 3글자 이상 부분 문자열 검색, **정규식 검색**(ASCII/유럽어), **"가장 비슷한 것 N건" 랭킹**(GiST KNN), 오탈자 허용 검색. 그리고 **수퍼유저 권한이 없는 환경** |
| 이럴 때는 피한다 | **2글자 이하 검색어가 흔할 때** (인덱스가 없느니만 못하다), **한글 정규식**, 구두점이 의미를 갖는 검색(IP·버전·경로) - 이럴 땐 `pg_bigm` |
| 비용 | GIN 인덱스가 원본 테이블의 절반 수준(20만 행 39 MB). `FASTUPDATE` 기본 on. GiST 는 기본 `siglen` 이 긴 텍스트에서 포화된다 |
| 대안 | `pg_bigm`(2-gram, 짧은 CJK 키워드), PostgreSQL 내장 전문검색(`tsvector`, 랭킹·어간 추출), ParadeDB `pg_search`(BM25) |

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | contrib |
| AWS Aurora | ○ | contrib |
| Supabase | ○ | contrib |
| Neon | ○ | contrib |
| GCP Cloud SQL | ○ | contrib |
| Azure Database for PostgreSQL | ○ | contrib |

<sub>`pg_trgm` 은 contrib + **`trusted = true`**(PostgreSQL 13+)라 매니지드에서 막히는 일이 사실상 없다. `shared_preload_libraries` 도 필요 없다. 이 점이 `pg_bigm`(소스 빌드 + 수퍼유저 필요)과의 가장 큰 실무적 차이다 - [`docs/04-production-playbook.md`](docs/04-production-playbook.md).</sub>

---

## 5. 내부 동작 원리

- **훅도 백그라운드 워커도 공유 메모리도 없다.** `_PG_init()` 은 커스텀 GUC 3개(`similarity_threshold` 0.3 / `word_similarity_threshold` 0.6 / `strict_word_similarity_threshold` 0.5)를 등록할 뿐이다. `pg_bigm` 과 구조가 같다.
- **`LIKE` 를 가로채는 게 아니라 GIN/GiST 연산자 클래스라는 표준 확장점을 쓴다.** `EXPLAIN` 에도 평범한 `Bitmap Index Scan` 으로 나온다.
- **패딩이 핵심이다.** 단어 앞에 공백 2개(`LPADDING`), 뒤에 1개(`RPADDING`)를 붙인 뒤 자른다. `pg_bigm` 은 1+1 이다.
- **멀티바이트 조각은 CRC32 로 해싱된다.** `typedef char trgm[3]` 이 고정 3바이트라 한글 3글자(9바이트)를 그대로 담을 수 없기 때문이다. 그래서 해시 충돌이 원리적으로 가능하고(Recheck 이 잡아준다), 엔트리가 정렬 가능하지 않아 **부분 일치 탐색을 지원할 수 없다.**
- 자세한 소스 인용: [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md) · [`../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../bigm-vs-trgm/docs/01-ngram-index-internals.md)

## 6. 벤치마크 / 실습 결과

직접 돌리며 확인한 것 - **여러 건이 기존에 널리 인용되던 설명을 정정하는 결과였다.**

| 조건 | 결과 |
| --- | --- |
| `show_trgm('가나다라')` | 조각 **5개 정상 생성**. **"`KEEPONLYALNUM` 때문에 한글이 걸러진다"는 흔한 설명은 틀렸다** - `ISWORDCHR` 가 쓰는 `t_isalnum_with_len()` 은 멀티바이트를 인식한다 |
| 20만 행에서 `LIKE '%클클%'` (2글자) | **인덱스 스캔이 200,000행(테이블 전체)을 후보로 올린다.** `Rows Removed by Index Recheck: 199,800`, 인덱스 버퍼 5,097, 231.6 ms. 같은 조건 `pg_bigm` 은 후보 200행 / 버퍼 4 / 0.52 ms |
| 같은 2글자를 `LIKE '% 클클 %'` 로 | 후보가 한 자릿수로 줄어든다 - `get_wildcard_part()` 가 **비단어 문자 경계에 패딩을 붙이기** 때문. `pg_bigm` 을 못 쓰는 환경의 실용적 우회다 |
| 5만 행에서 `~ 'naïve'`(2바이트) vs `~ '제브라'`(3바이트) | 2바이트는 후보 1행, **3바이트는 후보 50,004행(전체)**. 경계가 정확히 `MAX_SIMPLE_CHR 0x7FF` 다 - **한글 정규식은 인덱스가 무력화된다** |
| 같은 한글을 `LIKE '%제브라%'` 로 | 후보 1행. **`LIKE` 는 되는데 정규식만 안 된다** |
| GiST 기본 `siglen=12` vs `siglen=256` (20만 행, 2회 실행) | 인덱스 버퍼 4,375~4,480 → **412~432**, 크기도 41.0 MB → 32.9 MB 로 **작아진다**. "GiST 가 느리다"가 아니라 "기본 96비트가 포화됐다"가 정확한 진단이었다 |
| 3글자 이상 검색어 | **`pg_trgm` 이 `pg_bigm` 보다 버퍼를 덜 읽는다** (4 vs 7). 3-gram 조각이 더 희귀하기 때문 |
| `show_trgm('192.168.0.1')` | `192`/`168`/`0`/`1` 로 쪼개진다. **`KEEPONLYALNUM` 이 실제로 문제를 일으키는 건 한글이 아니라 구두점이었다** |
| `doc <% '검색어'` vs `'검색어' <% doc` | 앞은 **Seq Scan**, 뒤는 인덱스 사용. 연산자 패밀리에 `%>` 만 등록되어 있어 인덱스 컬럼이 왼쪽에 와야 한다 |

재현 스크립트: [`labs/`](labs) · [`experiments/`](experiments) · [`../bigm-vs-trgm/experiments/`](../bigm-vs-trgm/experiments)

## 7. 실전 통합 - FastAPI 백엔드에서 쓰기

[`labs/05-fastapi-search-api/`](labs/05-fastapi-search-api) 는 `pg_trgm` 을 실제 서비스에 통합하는 예제다. **`pg_bigm` 통합([같은 lab](../pg_bigm/labs/05-fastapi-search-api))과 비교하면 애플리케이션의 책임이 더 많다는 것이 드러난다.**

- **검색어 길이를 애플리케이션이 검증해야 한다.** 3글자 미만이면 `%q%` 대신 `q%` 로 보낸다 - 20,016행 테이블에서 `%클클%` 은 인덱스 스캔이 20,016행을 돌려주고 8.21 ms, `클클%` 은 1행에 0.062 ms 였다.
- **`likequery()` 같은 이스케이프 헬퍼가 없어서 직접 구현해야 한다** (`%`, `_`, `\` + `ESCAPE '\'`).
- **한글 정규식이면 인덱스가 안 먹는다는 것을 미리 판정해 알려준다** (`any(ord(ch) > 0x7FF ...)`).
- 대신 `pg_bigm` 에 없는 것을 쓸 수 있다: **관련도 정렬**, **KNN 자동완성**(결과가 없어도 "가까운 N건"), **정규식**.
- GUC 는 파라미터 바인딩이 안 되고 드라이버의 `%s` 와 `%` 연산자가 충돌하는 함정은 `pg_bigm` 과 똑같이 겪었다.

## 8. pg_bigm 과 어느 쪽을 쓸 것인가

```
검색어가 2글자 이하가 흔한가?
├─ 예 → 수퍼유저 권한이 있고 소스 빌드가 가능한가?
│        ├─ 예 → pg_bigm
│        └─ 아니오 → pg_trgm + 패턴 우회 ('키워드%' 또는 '% 키워드 %')
└─ 아니오 → 정규식 / KNN 정렬 / ILIKE 가 필요한가?
            ├─ 예 → pg_trgm  (KNN 이면 GiST, 아니면 GIN)
            └─ 아니오 → 둘 다 무방. 설치가 쉬운 pg_trgm 이 기본값
```

전체 비교와 근거는 [`../bigm-vs-trgm/`](../bigm-vs-trgm) 에 있다.

---

## 참고 링크

- [PostgreSQL 공식 문서 - pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- [contrib/pg_trgm 소스 (REL_16_STABLE)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
- [trgm_regexp.c - 정규식 → 트라이그램 그래프](https://github.com/postgres/postgres/blob/REL_16_STABLE/contrib/pg_trgm/trgm_regexp.c)
- [src/include/regex/regcustom.h - MAX_SIMPLE_CHR](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/regex/regcustom.h)
- 나머지 인용 출처는 각 `docs/` 문서 하단의 "참고 링크" 참고
