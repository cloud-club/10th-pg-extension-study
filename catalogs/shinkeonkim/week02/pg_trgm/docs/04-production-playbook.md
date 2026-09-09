# pg_trgm — 실무 활용 가이드

> 실제 운영에서 무엇에 쓰는지, 매니지드 DB 지원 현황, 인덱스 선택과 운영상 함정을 정리한다. 재현 스크립트는 [`../labs/`](../labs), 실측은 [`../experiments/`](../experiments) 와 [`../../bigm-vs-trgm/experiments/`](../../bigm-vs-trgm/experiments).

## 실무에서 실제로 하는 일

| 용도 | 문법 | 인덱스 |
| --- | --- | --- |
| 부분 문자열 검색 (영문·3글자 이상) | `LIKE '%keyword%'` | GIN |
| 오탈자 허용 검색 | `col % '검색어'` + `similarity()` 정렬 | GIN 또는 GiST |
| **"가장 비슷한 것 N건"** | `ORDER BY col <-> '검색어' LIMIT 10` | **GiST 만** |
| **정규식 로그 검색** | `col ~ 'ERROR.*timeout'` | GIN 또는 GiST |
| 중복 레코드 후보 찾기 (레코드 링키지) | `a.name % b.name` 조인 | GIN |
| 자동완성 (접두어) | `LIKE '검색어%'` | GIN - 짧은 키워드도 잘 된다 ([02](02-internals-and-source.md) 패딩 절) |

## 매니지드 DB 지원 현황

`pg_trgm` 은 contrib 이고 **PostgreSQL 13 부터 `trusted = true`** 라서 지원 여부를 걱정할 일이 거의 없다. 직접 확인한 것:

```bash
$ docker exec pg cat /usr/share/postgresql/16/extension/pg_trgm.control
comment = 'text similarity measurement and index searching based on trigrams'
default_version = '1.6'
module_pathname = '$libdir/pg_trgm'
relocatable = true
trusted = true          # ← 이 줄
```

```sql
-- 수퍼유저가 아닌 롤로 직접 확인
SET ROLE app;
CREATE EXTENSION pg_trgm;   -- 성공 (DB 에 CREATE 권한만 있으면 된다)
CREATE EXTENSION pg_bigm;   -- ERROR: permission denied to create extension "pg_bigm"
                            -- HINT: Must be superuser to create this extension.
```

| 서비스 | pg_trgm | pg_bigm | 비고 |
| --- | --- | --- | --- |
| AWS RDS for PostgreSQL | ✅ | ✅ | 둘 다 지원 |
| AWS Aurora PostgreSQL | ✅ | ✅ | 둘 다 지원 |
| GCP Cloud SQL | ✅ | ✅ (PG17+, 플래그 필요) | pg_bigm 은 `cloudsql.enable_pg_bigm` + 재시작 |
| Azure Database for PostgreSQL | ✅ | 확인 필요 | |
| Supabase | ✅ | 확인 필요 | |
| Neon | ✅ | 확인 필요 | |
| Heroku Postgres | ✅ | 확인 필요 | |

<sub>`pg_trgm` 쪽은 "contrib + trusted 이므로 사실상 전 서비스 지원"이라는 일반론이고, `pg_bigm` 열은 [`../../pg_bigm/docs/03-production-playbook.md`](../../pg_bigm/docs/03-production-playbook.md) 에서 근거를 찾아 정리한 것을 옮겼다. **"확인 필요"는 "안 된다"가 아니라 공식 목록에서 확인하지 못했다는 뜻이다.**</sub>

**이 표가 실무에서 갖는 의미**: 짧은 한글 키워드 검색 성능만 보면 `pg_bigm` 이 낫지만, **매니지드 환경에서 이식성이 중요하거나 수퍼유저 권한이 없다면 `pg_trgm` 이 유일한 선택지일 수 있다.** 그럴 때의 차선책은 [02](02-internals-and-source.md) 의 패딩 우회(`'% 키워드 %'`, `'키워드%'`)다.

## 인덱스 선택 - GIN 이냐 GiST 냐

| | GIN (`gin_trgm_ops`) | GiST (`gist_trgm_ops`) |
| --- | --- | --- |
| 구조 | 역색인 (트라이그램 → TID 포스팅 리스트) | 시그니처 비트맵 (블룸 필터형, 손실 압축) |
| `LIKE`/정규식 검색 | **훨씬 빠르다** (실측 인덱스 버퍼 13 vs 4,375~4,480) | 느리다 |
| `ORDER BY <->` (KNN) | ✕ | **○ - 유일한 이유** |
| 인덱스 크기 (실측, 한국어 20만 행) | 39.35 MB | 41.0 MB (siglen 12) / 32.9 MB (siglen 256) |
| 빌드 시간 | 보통 GiST 보다 빠르다 | 느리다 |
| 튜닝 손잡이 | `FASTUPDATE`, `gin_pending_list_limit` | `siglen` (PG 13+) |

**기본은 GIN 이다.** GiST 는 `ORDER BY col <-> '검색어' LIMIT n` 이 필요할 때만 고른다. 둘 다 필요하면 실제로 두 개를 만들어도 된다 - 쓰기 비용을 감당할 수 있다면.

## 보안/운영 고려사항

- **가장 큰 함정: 짧은 키워드는 인덱스가 있는 게 없는 것보다 느리다.** 트라이그램을 하나도 못 뽑으면 `GIN_SEARCH_MODE_ALL` 로 인덱스 전체를 훑는다. **애플리케이션에서 검색어 길이를 검증해, 3글자 미만이면 아예 다른 경로(접두어 검색, 별도 컬럼, pg_bigm)로 보내는 게 맞다.**

  ```sql
  -- 운영 중 이 상태를 찾아내는 법: 인덱스 스캔이 돌려준 행 수를 본다
  EXPLAIN (ANALYZE, BUFFERS) SELECT ... WHERE body LIKE '%검색%';
  --  ->  Bitmap Index Scan on ...  (actual rows=200003 ...)   ← 테이블 전체면 이 상태다
  --      Rows Removed by Index Recheck: 200002
  ```

- **한국어 텍스트에 `~`(정규식)를 쓰면서 인덱스 효과를 기대하지 말 것.** U+07FF 초과 문자에서는 정규식 트라이그램 추출이 동작하지 않는다 ([02](02-internals-and-source.md)). 한글 정규식이 꼭 필요하면 후보를 `LIKE` 로 먼저 좁히고 정규식은 필터로만 쓰는 2단 구성을 고려한다.

  ```sql
  -- 한글 정규식을 그나마 인덱스로 좁히는 패턴
  WHERE body LIKE '%오류%'          -- 인덱스가 후보를 좁히고
    AND body ~ '오류\s*코드\s*[0-9]+'  -- 정규식은 힙에서 필터로만 동작
  ```

- **`similarity_threshold` 를 낮추면 후보가 폭증한다.** 기본 0.3 도 짧은 문자열에서는 꽤 관대하다. `%` 연산자를 쓰는 API 라면 임계값을 사용자 입력으로 받지 말고 서버에서 고정하거나 상한을 두는 편이 안전하다 (GUC 는 파라미터 바인딩이 안 되므로 값 검증 후 문자열로 끼워 넣어야 한다 - [`../labs/05-fastapi-search-api/`](../labs/05-fastapi-search-api) 에서 실제로 겪는 함정이다).
- **`FASTUPDATE`(GIN 기본 on)는 pending list 를 쌓는다.** `pg_bigm` 과 같은 이슈다. 읽기 위주 + 최신성이 중요하면 `FASTUPDATE=off` 를 고려하고, 아니면 `gin_pending_list_limit` 로 상한을 관리한다.
- **긴 텍스트를 GiST 로 인덱싱한다면 `siglen` 을 올려라.** 기본 96비트는 문장 몇 개만 넘어가도 포화된다. 실측에서는 **256 까지 올려야 눈에 띄게 달라졌다**(버퍼 4,375~4,480 → 412~432) — 64·128 정도로는 완만하게만 좋아진다. 인덱스 크기도 함께 줄어들므로 올리지 않을 이유가 거의 없다 ([`../experiments/01`](../experiments/01-gin-vs-gist-build-and-probe)).
- **`pg_trgm` 과 `pg_bigm` 은 같은 DB 에 공존한다.** 연산자 클래스 이름이 겹치지 않으므로(pg_bigm 1.1 의 개명 이후) 컬럼별로 골라 쓸 수 있다.

## 비교: 언제 무엇을 쓰나

| 상황 | 추천 |
| --- | --- |
| 영문 위주, 3글자 이상 부분 문자열 | **pg_trgm + GIN** |
| 정규식 검색이 필요 (ASCII/유럽어) | **pg_trgm** - 대안이 없다 |
| "가장 비슷한 것 N건" 랭킹 | **pg_trgm + GiST** (`<->` KNN) - 대안이 없다 |
| 한글/CJK 2글자 키워드 부분 문자열 | **pg_bigm** |
| 구두점이 의미를 갖는 검색 (IP, 버전, 경로, 코드) | **pg_bigm** (`KEEPONLYALNUM` 이 없다) |
| 수퍼유저 권한이 없는 매니지드 환경 | **pg_trgm** (trusted) |
| 자연어 랭킹·형태소 분석 | `tsvector`/`tsquery` (한국어는 별도 파서 필요) |
| BM25 랭킹, 검색 엔진급 경험 | ParadeDB `pg_search` 등 |

정면 비교와 실측은 [`../../bigm-vs-trgm/`](../../bigm-vs-trgm) 에 모아뒀다.

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [내부 동작과 코드베이스](02-internals-and-source.md)
- [버전별 변천사](03-version-history.md)

## 참고 링크

- [PostgreSQL 공식 문서 - pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- [PostgreSQL 공식 문서 - Trusted Extensions (CREATE EXTENSION)](https://www.postgresql.org/docs/16/sql-createextension.html)
- [PostgreSQL 공식 문서 - GIN Fast Update / gin_pending_list_limit](https://www.postgresql.org/docs/16/gin-implementation.html)
