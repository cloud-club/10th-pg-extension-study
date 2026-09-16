# pg_bigm — 무엇을, 왜

> LIKE 검색을 2-gram(bigram) GIN 인덱스로 가속하는 서드파티 익스텐션.
> 한글/일본어처럼 띄어쓰기가 불분명한 언어와 1~2글자짜리 짧은 키워드에서 PostgreSQL 표준 `pg_trgm`(3-gram)보다 유리하도록, NTT DATA(일본)가 만들었다.

## 한 줄로

> `WHERE description LIKE '%검색%'` 같은 부분 문자열 검색은 인덱스가 없으면 항상 전체 스캔이다. `pg_bigm` 은 텍스트를 2글자씩 겹쳐 자른 "2-gram" 조각들로 GIN 인덱스를 만들어, `LIKE` 를 쓴 그대로 인덱스를 태울 수 있게 해준다. 즉, 쿼리를 바꿀 필요가 없다.

## 역할과 할 수 있는 것

- **`LIKE` 부분 문자열 검색 가속**
    - `CREATE INDEX ... USING gin (col gin_bigm_ops)` 하나로 끝난다. 
    - 쿼리 문법을 바꿀 필요가 없다. (**`ILIKE` 는 인덱스를 타지 않는다**)
- **유사도 검색 — `LIKE` 와는 별개의 오탈자 허용 검색이다**: `=%` 연산자와 `bigm_similarity()` 로 "정확히 일치하지 않아도 비슷한 것"을 찾는다. `클라우드클럽` 으로 검색하면 `클라우드 클럽`(띄어쓰기 변형)과 `클라으드클럽`(오타)이 함께 잡히고, **`=%` 도 GIN 인덱스를 탄다.** 임계값은 `pg_bigm.similarity_limit`(기본 0.3). 실측과 원리: [02](02-internals-and-source.md) 의 "similarity measurement 는 정말 유사도 검색인가".
- **1~2글자 짧은 검색어에 강하다**: 최소 단위가 2글자이고, 1글자일 때는 GIN 부분 일치로 전환한다. 3글자가 필요한 `pg_trgm` 이 아예 조각을 못 만드는 구간을 그대로 커버한다 — 한글/일본어/중국어처럼 **2글자 단어가 흔한 언어에서 결정적인 차이**가 된다.
- **보조 함수**: `show_bigm()`(2-gram 분해 확인), `likequery()`(검색어 → LIKE 패턴 이스케이프), `pg_gin_pending_stats()`(GIN pending list 크기 확인).

## Before / After

100만 행 한국어 말뭉치([NSMC](https://github.com/e9t/nsmc))에 검색어 `클둥이` 를 0.1% 비율로 심어두고 실제로 잰 것이다. 재현: [`../experiments/00-explain-before-after/`](../experiments/00-explain-before-after)

**Before (인덱스 없이)**

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE doc LIKE '%클둥이%';

 Finalize Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=1654 read=19621
   ->  Gather (actual rows=3 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         ->  Partial Aggregate (actual rows=1 loops=3)
               ->  Parallel Seq Scan on docs (actual rows=334 loops=3)
                     Filter: (doc ~~ '%클둥이%'::text)
                     Rows Removed by Filter: 333000
                     Buffers: shared hit=1654 read=19621
 Execution Time: 482.847 ms
```

1,001행을 찾으려고 **100만 행을 전부 읽는다.** 워커 하나당 333,000행을 버렸고(`Rows Removed by Filter`), 21,275개 버퍼를 읽었다.

**After**

```sql
CREATE INDEX docs_idx ON docs USING gin (doc gin_bigm_ops);

-- 쿼리는 한 글자도 안 바꿨다
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE doc LIKE '%클둥이%';

 Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=23 read=68
   ->  Bitmap Heap Scan on docs (actual rows=1001 loops=1)
         Recheck Cond: (doc ~~ '%클둥이%'::text)
         Heap Blocks: exact=83
         ->  Bitmap Index Scan on docs_idx (actual rows=2000 loops=1)
               Index Cond: (doc ~~ '%클둥이%'::text)
               Buffers: shared hit=8
 Execution Time: 3.462 ms
```

**버퍼를 21,275개에서 91개로 줄였고, 실행 시간은 483 ms → 3.5 ms 다.** 힙은 83블록만 읽는다.

<sub>인덱스 스캔이 2,000행을 돌려준 것은 정답(1,001행)의 약 2배인데, 같은 실험의 다른 14개 칸은 전부 정답과 정확히 일치한다. 이 칸만 원인을 확정하지 못해 [`../experiments/00-explain-before-after/`](../experiments/00-explain-before-after) 에 "미해결"로 기록해뒀다.</sub>

### 그런데 항상 이렇게 되지는 않는다

**"인덱스를 만들면 인덱스를 탄다"는 말은 사실이 아니다.** 플래너는 비용을 비교해서 더 싼 쪽을 고르므로, **테이블이 작거나 매치되는 행이 너무 많으면 인덱스가 있어도 `Seq Scan` 을 고른다.** 같은 실험에서 행 수와 선택도를 격자로 놓고 잰 결과:

| 행 수 | 검색어 (선택도) | 인덱스 없음 | **인덱스 있음** |
| ---: | --- | --- | --- |
| 100 | `클둥이` (1%) | Seq Scan | **Seq Scan** ← 인덱스가 있어도 안 탄다 |
| 100 | `코아` (30%) | Seq Scan | **Seq Scan** |
| 1,000 | `클둥이` (0.2%) | Seq Scan | Bitmap Heap Scan |
| 1,000 | `코아` (30%) | Seq Scan | **Seq Scan** ← 같은 테이블인데 검색어에 따라 갈린다 |
| 10,000 | `코아` (30%) | Seq Scan | Bitmap Heap Scan |
| 1,000,000 | `클둥이` (0.1%) | Parallel Seq Scan | Bitmap Heap Scan |

**전환점은 행 수 하나로 정해지지 않는다 — 선택도가 같이 결정한다.** 위 예시를 100행짜리 장난감 테이블에서 그대로 따라 하면 After 에서도 `Seq Scan` 이 나오고 "인덱스가 안 먹네?" 하고 오해하기 딱 좋다. 전체 표와 분석은 [`../experiments/00-explain-before-after/`](../experiments/00-explain-before-after) 에 있다.

## 왜 필요한가

- **PostgreSQL 표준 전문검색(`tsvector`/`tsquery`)은 "단어" 단위 형태소 분석이 전제다.** 한국어처럼 교착어라 형태소 분석기가 따로 필요하거나, 부분 문자열(자동완성, 코드 조각, 부분 일치) 검색처럼애초에 "단어"라는 개념이 안 맞는 경우가 있다. `LIKE` 는 그런 요구에 가장 단순하게 맞는 도구인데, 인덱스가 없으면 느리다는 게 문제였다 - pg_bigm 이 그 인덱스를 만들어준다.
- **`pg_trgm` 도 비슷한 일을 하지만, 한국어 환경에서는 실용성이 떨어진다.** 3-gram 은 2글자 검색어에서 트라이그램을 **하나도** 만들지 못하고, 그러면 인덱스를 안 타는 게 아니라 **인덱스 전체를 훑는다**(`GIN_SEARCH_MODE_ALL`) - 인덱스가 없느니만 못한 상태가 된다. 한국어는 `클클`, `코아`, `신건` 처럼 2글자 검색어가 매우 흔해서 이 구간에 자주 걸린다.

  <sub>**흔한 오해 정정**: "`pg_trgm` 은 `KEEPONLYALNUM` 때문에 한글을 걸러낸다"는 설명을 여러 자료에서 볼 수 있고 이 문서도 한동안 그렇게 적어뒀지만, **직접 재보니 사실이 아니다.** `show_trgm('가나다라')` 는 조각 5개를 정상 생성한다 - `ISWORDCHR` 가 쓰는 `t_isalnum_with_len()` 은 멀티바이트를 인식하고 한글은 유니코드상 알파벳이다. `KEEPONLYALNUM` 이 실제로 문제를 일으키는 건 **구두점**(`192.168.0.1` 이 `192`/`168`/`0`/`1` 로 쪼개진다)이지 한글이 아니다. 근거와 실측: [`../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../bigm-vs-trgm/docs/01-ngram-index-internals.md)</sub>
- **쿼리를 바꾸지 않아도 된다.** 별도의 검색 문법(`@@`, `to_tsquery` 등)을 배우거나 애플리케이션을 고칠 필요 없이, 기존 `LIKE` 쿼리에 인덱스만 얹으면 된다 - 마이그레이션 비용이 낮다.

## 이 모듈이 아닌 것

- **랭킹/형태소 분석을 하는 전문검색 엔진이 아니다.** "관련도 순 정렬", "어간 추출" 같은 기능은 없다 - 순수하게 "이 부분 문자열이 포함되어 있는가"만 빠르게 판단한다.
- **정규식 엔진이 아니다.** `pg_trgm` 과 달리 `~`/`~*`(정규식) 연산자를 지원하지 않는다.
- **`ILIKE` 도 인덱스를 타지 않는다.** 10만 행에서 직접 확인한 결과 `doc ILIKE '%CLOUDCLUB%'` 는 **`Seq Scan`** 이었다 — `gin_bigm_ops` 연산자 클래스에 `~~*` 가 등록되어 있지 않기 때문이다. 공식 비교표가 `LIKE` 만 명시한 것이 정확했다. 실측: [`../../bigm-vs-trgm/experiments/03-operator-coverage-and-correctness/`](../../bigm-vs-trgm/experiments/03-operator-coverage-and-correctness)
- **작고 안정적인 코드베이스다.** contrib 모듈이 아니라 소스로 직접 빌드해야 하고([02](02-internals-and-source.md)), 배포 주기도 PostgreSQL 코어와 무관하게 독립적이다.

## 더 읽기

- [내부 동작과 코드베이스](02-internals-and-source.md) - preload 가 실제로 왜, 얼마나 필요한가
- [실무 활용 가이드](03-production-playbook.md) - pg_trgm 비교, 매니지드 DB 지원, 대안
- 실습: [`../labs/`](../labs) (5개 lab)

## 참고 링크

- [pg_bigm 공식 저장소 (pgbigm/pg_bigm)](https://github.com/pgbigm/pg_bigm)
- [pg_bigm 1.2 문서 (영문)](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md)
