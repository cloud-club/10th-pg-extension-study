# pg_trgm — 무엇을, 왜

> 텍스트를 3글자씩 겹쳐 자른 "트라이그램(trigram)"으로 유사도를 재고, `LIKE`/`ILIKE`/정규식/유사도 검색을 GIN·GiST 인덱스로 가속하는 **PostgreSQL 공식 contrib 모듈**.

## 한 줄로

`pg_bigm` 이 2-gram 이라면 `pg_trgm` 은 3-gram 이다. 다만 둘의 차이는 "n 이 2냐 3이냐" 하나가 아니다 - `pg_trgm` 은 **유사도(similarity)를 먼저 정의하고, 그 유사도를 인덱스로 가속하는 도구**로 설계됐고, `LIKE` 가속은 거기서 파생된 기능에 가깝다. 그래서 정규식·KNN·오탈자 검색까지 커버하는 대신, 짧은 키워드와 CJK 에서 약점이 생긴다.

## 역할과 할 수 있는 것

| 기능 | 문법 | GIN | GiST |
| --- | --- | :-: | :-: |
| 부분 문자열 검색 | `LIKE '%키워드%'`, `ILIKE` | ○ | ○ |
| **정규식 검색** | `~`, `~*` | ○ | ○ |
| 유사도 검색 (오탈자 허용) | `%` 연산자, `similarity()` | ○ | ○ |
| 단어 단위 유사도 | `<%`, `%>`, `word_similarity()` | ○ | ○ |
| 엄격한 단어 유사도 | `<<%`, `%>>`, `strict_word_similarity()` | ○ | ○ |
| **거리순 정렬 (KNN)** | `ORDER BY col <-> '검색어' LIMIT n` | ✕ | **○** |
| 동등 비교 | `=` | ○ (1.6+) | ○ (1.6+) |

`pg_bigm` 이 `LIKE` 와 `=%` 두 가지만 하는 것과 비교하면 **지원 범위가 훨씬 넓다.** 특히 마지막 두 줄(정규식, KNN)은 `pg_bigm` 에 대응물이 아예 없다.

## Before / After

**Before (인덱스 없이)**

```sql
-- 오탈자를 허용하는 검색을 애플리케이션에서 하려면? 편집 거리를 직접 구현하거나,
-- 후보를 다 긁어와서 언어 레벨에서 비교해야 한다.
SELECT * FROM products WHERE name LIKE '%keyboad%';  -- 오타라서 0건
```

**After**

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops);

-- 오타가 있어도 비슷한 것을 찾는다. 임계값은 pg_trgm.similarity_threshold (기본 0.3)
SELECT name, similarity(name, 'keyboad') AS sim
FROM products
WHERE name % 'keyboad'
ORDER BY sim DESC;
```

## 왜 필요한가

- **contrib 이라 어디에나 있다.** PostgreSQL 소스에 함께 배포되고, PGDG 패키지(`postgresql-contrib`)에 들어 있고, PostgreSQL 13 부터는 `trusted = true` 라서 **수퍼유저가 아니어도 `CREATE EXTENSION pg_trgm` 이 된다.** 매니지드 DB 에서 거의 예외 없이 지원되는 이유다 (`pg_bigm` 은 `trusted` 가 아니라 수퍼유저 권한이 필요하다 - [`../../bigm-vs-trgm/`](../../bigm-vs-trgm) 에서 직접 확인했다).
- **`LIKE` 뿐 아니라 정규식(`~`)도 인덱스를 탄다.** PostgreSQL 9.3 부터 정규식을 NFA 로 컴파일한 뒤 거기서 트라이그램을 추출하는 코드(`trgm_regexp.c`)가 들어왔다. 로그 검색처럼 정규식이 필요한 워크로드에서는 이게 유일한 선택지에 가깝다.
- **GiST 를 쓰면 KNN(`ORDER BY <->`)이 된다.** "가장 비슷한 것 10건"을 인덱스만으로 뽑을 수 있다 - GIN 에는 없는 기능이다.
- **유사도 개념이 명확히 정의돼 있다.** `similarity(a, b) = |공통 트라이그램| / |합집합 트라이그램|` 이라는 자카드 유사도이고, 이건 `trgm.h` 의 `DIVUNION` 매크로로 소스에 그대로 박혀 있다 ([02](02-internals-and-source.md)).

## 이 모듈이 아닌 것

- **형태소 분석기가 아니다.** `tsvector`/`tsquery` 처럼 어간 추출·불용어 처리·관련도 랭킹을 하지 않는다. 순수하게 "글자 3개짜리 조각이 얼마나 겹치느냐"만 본다.
- **짧은 키워드 검색 도구가 아니다.** 패턴에서 트라이그램을 하나도 뽑아내지 못하면 **인덱스를 안 타는 게 아니라, 인덱스 전체를 훑는다(`GIN_SEARCH_MODE_ALL`)** - 시퀀셜 스캔보다 느려진다. 이게 `pg_trgm` 의 가장 중요한 함정이고, [`../../bigm-vs-trgm/experiments/01`](../../bigm-vs-trgm/experiments/01-keyword-length-and-selectivity) 에서 실측했다.
- **CJK 정규식 검색 도구가 아니다.** `LIKE` 는 한글에서도 잘 되지만, **정규식(`~`)은 U+07FF 를 넘는 문자(한글·한자·가나)에서 트라이그램 추출이 아예 동작하지 않는다.** 이건 `pg_trgm` 이 아니라 PostgreSQL 정규식 엔진의 컬러맵 구조(`MAX_SIMPLE_CHR`) 때문이며, [02](02-internals-and-source.md) 에서 소스와 실측으로 확인했다.

## `pg_bigm` 에 대한 흔한 오해 하나 — 직접 재보고 정정한 것

이 스터디의 [`pg_bigm` 카탈로그](../../pg_bigm/README.md)를 포함해 여러 자료가 "`pg_trgm` 은 `KEEPONLYALNUM` 때문에 한글 같은 비알파벳 문자를 걸러내서 사실상 안 된다"고 적는다. **직접 재보니 사실이 아니다.**

```sql
SELECT show_trgm('가나다라');
--  {0x0dbca6,0x1fb1ac,0x66c945,0xb4c7cf,0xecf7cd}   -- 5개, 정상 생성된다
```

`KEEPONLYALNUM` 이 쓰는 `ISWORDCHR` 는 `t_isalnum_with_len()` 이라 **멀티바이트를 인식한다.** 한글은 유니코드상 알파벳이므로 그대로 단어 문자로 취급되고, 3바이트라 `trgm` 타입(고정 3바이트)에 담기지 않으니 CRC32 로 해싱돼 들어간다. 즉 한글 트라이그램은 **정상적으로 만들어진다.**

`pg_trgm` 이 한글에서 약한 진짜 이유는 따로 있다:

1. **한국어 검색어가 2글자인 경우가 매우 흔한데, 트라이그램은 3글자가 필요하다** - `LIKE '%검색%'` 은 트라이그램을 0개 추출한다.
2. **정규식은 3바이트 문자에서 아예 동작하지 않는다** (위 참고).
3. **`KEEPONLYALNUM` 이 구두점을 단어 경계로 날린다** - `192.168.0.1` 이 `192`/`168`/`0`/`1` 로 쪼개진다. 한글 문제는 아니지만 IP·버전·코드 검색에서 크게 걸린다.

같은 결론("짧은 한글 키워드는 pg_bigm")에 도달하긴 하지만 **이유가 다르고, 이유가 다르면 처방도 달라진다** - 예를 들어 (1)번은 `LIKE '% 검색 %'` 처럼 패턴을 바꾸는 것만으로 상당 부분 우회된다 ([02](02-internals-and-source.md) 의 "패딩" 절). 근거와 실측은 [`../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../bigm-vs-trgm/docs/01-ngram-index-internals.md) 에 모아뒀다.

## 더 읽기

- [내부 동작과 코드베이스](02-internals-and-source.md) - 패딩·해싱·GIN/GiST 구조, 정규식 추출의 한계
- [버전별 변천사](03-version-history.md) - 1.0 부터 1.6 까지, 업그레이드 스크립트 원문 기준
- [실무 활용 가이드](04-production-playbook.md) - 매니지드 DB, 운영 함정
- 실습: [`../labs/`](../labs) (5개 lab)
- **pg_bigm 과의 비교**: [`../../bigm-vs-trgm/`](../../bigm-vs-trgm)

## 참고 링크

- [PostgreSQL 공식 문서 - pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- [contrib/pg_trgm 소스 (REL_16_STABLE)](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
