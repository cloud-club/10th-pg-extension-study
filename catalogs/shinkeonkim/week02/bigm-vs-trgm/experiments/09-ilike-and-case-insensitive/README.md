# 실험 09 — `ILIKE` 는 실제로 빨라지는가

> **질문.** [실험 03](../03-operator-coverage-and-correctness) 은 `enable_seqscan=off` 로 강제해서 "연산자가 인덱스를 타는가"를 봤다.
> 그건 **인덱스 경로가 존재하는가**이지 **그게 이득인가**가 아니다. 여기서는 **플래너를 건드리지 않고** 시간·버퍼를 잰다.

## 쉽게 먼저 — 한 문단

`ILIKE` 는 대소문자를 무시하는 `LIKE` 입니다. `pg_trgm` 은 조각을 만들 때 **미리 소문자로 바꿔** 넣기 때문에(`IGNORECASE`), 대소문자를 무시하는 검색이 오히려 **인덱스에게 자연스러운 질문**입니다. 실측에서 `ILIKE` 는 인덱스 없이 돌릴 때보다 **38배 빨랐고 헛걸음이 한 건도 없었습니다.** 반대로 `pg_bigm` 은 `ILIKE` 를 아예 인덱스로 못 풀어서, **한글 검색어에서도** 인덱스가 통째로 무시됩니다 — 대소문자가 없는 한글인데도요.

## 재현

```sh
./bench.sh          # 빌드 -> 측정 -> 정리
./bench.sh keep     # 컨테이너를 남긴다
REPEAT=1 ./bench.sh # 1회만
ROWS=50000 ./bench.sh
```

- PostgreSQL 16.15 / pg_bigm 1.2 / pg_trgm 1.6 / **200,000행**
- 대소문자 변형을 `id` 나머지로 심어 **`LIKE` 와 `ILIKE` 의 정답 행 수가 설계로 달라지게** 했다.

  | `id % 1000` | 심은 문자열 | 걸리는 조건 |
  | ---: | --- | --- |
  | 0 | `CloudClub` | `LIKE '%CloudClub%'` (200행) · `ILIKE` (600행 중 하나) |
  | 250 | `CLOUDCLUB` | `ILIKE` 만 |
  | 500 | `cloudclub` | `ILIKE` 만 |
  | 750 | `클라우드클럽` | 대소문자가 없는 **대조군** (200행) |
  | 100 | `Zx` | 2글자 마커 (201행 — 말뭉치에 1건 있었다) |

- 인덱스는 **한 번에 하나만** 둔다. 상대 인덱스를 트랜잭션 안에서 치우고 재고 롤백한다.
- 플랜에서 실제로 쓴 인덱스 이름을 읽어 **검증 열**에 기록한다.
- **결정적 지표(정답·플랜·쓴 인덱스·후보 행·recheck·버퍼)는 2회 실행에서 전부 동일했다.**

인덱스 크기: `docs_bigm` **32 MB** · `docs_trgm` **54 MB** · `docs_lbigm` **32 MB** · `docs_ltrgm` **54 MB**

## A. `LIKE` vs `ILIKE` — ASCII

| 엔진 | 조건 | 정답 | 플랜 | 쓴 인덱스 | 후보 | recheck 제거 | 버퍼 | ms |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| 없음 | `LIKE '%CloudClub%'` | 200 | Parallel Seq Scan | — | — | 0 | 3,226 | 17.09 |
| bigm | `LIKE '%CloudClub%'` | 200 | Bitmap Index Scan | `docs_bigm` ✔ | **200** | **0** | **222** | **0.56** |
| trgm | `LIKE '%CloudClub%'` | 200 | Bitmap Index Scan | `docs_trgm` ✔ | **600** | **400** | 621 | 1.28 |
| 없음 | `ILIKE '%cloudclub%'` | 600 | Parallel Seq Scan | — | — | 0 | 3,226 | 56.04 |
| bigm | `ILIKE '%cloudclub%'` | 600 | **Parallel Seq Scan** | — ✘ | — | 0 | 3,226 | 52.55 |
| trgm | `ILIKE '%cloudclub%'` | 600 | Bitmap Index Scan | `docs_trgm` ✔ | **600** | **0** | **621** | **1.46** |

### 분석

**(a) `pg_trgm` 의 `ILIKE` 는 진짜로 빠르다 — 38배.** 56.04 ms → 1.46 ms, 버퍼 3,226 → 621. 그리고 **`Rows Removed by Index Recheck` 가 0** 이다. 인덱스가 후보를 정답까지 정확히 좁혔다는 뜻이다.

**(b) 그런데 같은 인덱스에서 `LIKE` 는 오히려 덜 정확하다.** 정답이 200행인데 인덱스는 **600행을 올리고 400행을 Recheck 이 걷어낸다.** 이유는 `pg_trgm` 이 조각을 만들 때 소문자화하기 때문이다.

```c
/* contrib/pg_trgm/trgm.h */
#define IGNORECASE
```

> **인덱스 입장에서 자연스러운 연산은 `ILIKE` 이고, `LIKE` 쪽이 오히려 "추가 필터가 붙은" 질의다.**
> 대소문자를 구분해야 하는 검색이라면 `pg_trgm` 인덱스는 **후보를 좁히는 데까지만** 도와주고 마지막 판정은 힙에서 한다.

**(c) `pg_bigm` 은 `ILIKE` 에서 인덱스를 통째로 못 쓴다.** 연산자 클래스에 `~~*` 가 등록돼 있지 않아서다([실험 03](../03-operator-coverage-and-correctness)). 인덱스가 있으나 없으나 같다(52.55 vs 56.04 ms).

## B. 2글자 함정은 `ILIKE` 에도 오는가 — 온다

| 엔진 | 조건 | 정답 | 플랜 | 버퍼 | ms |
| --- | --- | ---: | --- | ---: | ---: |
| 없음 | `ILIKE '%zx%'` | 201 | Parallel Seq Scan | 3,226 | 79.05 |
| bigm | `ILIKE '%zx%'` | 201 | **Parallel Seq Scan** | 3,226 | 54.69 |
| trgm | `ILIKE '%zx%'` | 201 | **Parallel Seq Scan** | 3,226 | 58.15 |

**세 칸이 전부 같다.** `pg_trgm` 은 2글자라 조각을 하나도 못 만들고, `pg_bigm` 은 `ILIKE` 자체를 못 받는다. **`ILIKE` 를 쓴다고 2글자 함정이 없어지지 않는다.**

## C. 대소문자가 없는 한글에서도 `ILIKE` 값을 치르는가 — 치른다

| 엔진 | 조건 | 정답 | 플랜 | 후보 | 버퍼 | ms |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 없음 | `LIKE '%클라우드클럽%'` | 200 | Parallel Seq Scan | — | 3,226 | 17.21 |
| bigm | `LIKE '%클라우드클럽%'` | 200 | Bitmap Index Scan | 200 | **216** | **1.05** |
| trgm | `LIKE '%클라우드클럽%'` | 200 | Bitmap Index Scan | 200 | 213 | 0.65 |
| 없음 | `ILIKE '%클라우드클럽%'` | 200 | Parallel Seq Scan | — | 3,226 | **61.23** |
| bigm | `ILIKE '%클라우드클럽%'` | 200 | **Parallel Seq Scan** | — | 3,226 | **54.00** |
| trgm | `ILIKE '%클라우드클럽%'` | 200 | Bitmap Index Scan | 200 | **213** | **0.75** |

### 분석 — 여기가 이 실험에서 가장 실무적인 칸이다

**(a) `pg_bigm` 에서 `LIKE` → `ILIKE` 한 글자 차이가 51배다** (1.05 → 54.00 ms). 검색어가 한글이라 **대소문자 개념이 아예 없는데도** 그렇다. 플래너는 "대소문자를 무시하라"는 요청을 받으면 그 컬럼의 `gin_bigm_ops` 인덱스를 쓸 방법이 없고, 문자 종류를 따지지 않는다.

> **"한글만 검색하니까 `LIKE` 든 `ILIKE` 든 상관없겠지"가 이 카탈로그에서 가장 비싼 오해다.**
> ORM 이 기본값으로 `ILIKE` 를 내보내는 경우가 흔하고(예: `icontains`), 그러면 `pg_bigm` 인덱스는 조용히 무시된다.

**(b) `ILIKE` 는 인덱스가 없어도 비싸다.** 순수 Seq Scan 에서 17.21 → 61.23 ms, **3.6배**다. 대소문자 폴딩을 행마다 하기 때문이다. 즉 `ILIKE` 는 **인덱스를 못 쓰게 만드는 비용 + 비교 자체가 비싼 비용** 을 둘 다 낸다.

**(c) `pg_trgm` 은 한글 `ILIKE` 에서 값을 거의 안 치른다** (0.65 → 0.75 ms). 조각이 이미 소문자화된 상태라 대소문자 무시가 공짜에 가깝다.

## D. `pg_bigm` 의 대안 — `lower()` 함수 인덱스

`pg_bigm` 에는 `ILIKE` 가 없다. 그러면 대소문자 무시 검색을 포기해야 하나? **아니다.** 인덱스를 `lower(doc)` 에 걸고 질의도 소문자로 맞추면 된다.

```sql
CREATE INDEX docs_lbigm ON docs USING gin (lower(doc) gin_bigm_ops);
SELECT count(*) FROM docs WHERE lower(doc) LIKE '%cloudclub%';
```

| 엔진 | 정답 | 플랜 | 쓴 인덱스 | 후보 | recheck | 버퍼 | ms |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| 없음 | 600 | Parallel Seq Scan | — | — | 0 | 3,226 | 50.85 |
| **lower + bigm** | 600 | Bitmap Index Scan | `docs_lbigm` ✔ | 600 | **0** | **621** | **1.51** |
| lower + trgm | 600 | Bitmap Index Scan | `docs_ltrgm` ✔ | 600 | 0 | 621 | 1.51 |

**`pg_trgm` 의 네이티브 `ILIKE`(1.46 ms)와 사실상 같다.** 그리고 인덱스가 **32 MB vs 54 MB** 로 오히려 작다.

**대신 대가가 있다.**

- **질의를 고쳐야 한다** — `doc ILIKE '%X%'` → `lower(doc) LIKE lower('%X%')`. ORM 이 만들어 주는 쿼리라면 손대기 어렵다.
- **대소문자 구분 검색을 포기한다** — 같은 컬럼에 둘 다 필요하면 인덱스를 두 개 둬야 한다.
- **`lower()` 는 로케일에 의존한다** — 터키어 `I`/`ı` 같은 경계 사례가 있다. 이 실험은 그 부분을 재지 않았다.

## E. 정규식 `~*`

| 엔진 | 정답 | 플랜 | 버퍼 | ms |
| --- | ---: | --- | ---: | ---: |
| 없음 | 600 | Parallel Seq Scan | 3,226 | 37.95 |
| bigm | 600 | **Parallel Seq Scan** | 3,226 | 30.82 |
| trgm | 600 | Bitmap Index Scan (`docs_trgm`) | **621** | **1.44** |

ASCII 정규식은 `pg_trgm` 만 가속한다 — **한글 정규식은 두 확장 모두 안 된다**(정규식 엔진의 `MAX_SIMPLE_CHR = 0x7FF`). [실험 03](../03-operator-coverage-and-correctness) 참조.

## 정리 — 고르는 표

| 상황 | 답 | 근거 |
| --- | --- | --- |
| 대소문자 무시 검색이 필요하고 **쿼리를 고칠 수 있다** | **`pg_bigm` + `lower()` 인덱스** | 1.51 ms · 인덱스 32 MB (trgm 54 MB) |
| 대소문자 무시 검색이 필요하고 **쿼리를 못 고친다**(ORM 등) | **`pg_trgm`** | 네이티브 `ILIKE` 1.46 ms |
| **대소문자를 구분해야 한다** | **`pg_bigm`** | trgm 은 후보 600행 중 400을 Recheck 으로 버린다 |
| 2글자 검색어 | **`pg_bigm` + `LIKE`** | `ILIKE` 로는 어느 쪽도 안 된다 |
| ASCII 정규식 | **`pg_trgm`** | 대안 없음 |

**한 줄로.** `ILIKE` 자체는 `pg_trgm` 에서 잘 동작하고 오히려 `LIKE` 보다 인덱스에 잘 맞는다. 문제는 **`pg_bigm` 을 쓰면서 `ILIKE` 를 보내는 조합**이고, 한글이라 안전할 것 같아도 그렇지 않다.

## 한계

- 200,000행 한 규모, 검색어 한 종류(`cloudclub` / `클라우드클럽`)로만 쟀다.
- **`lower()` 의 로케일 의존성을 재지 않았다** — 터키어 `I` 문제 등.
- 함수 인덱스의 **쓰기 비용**을 재지 않았다. `lower()` 를 매 INSERT 마다 계산해야 하므로 일반 인덱스보다 비싸다.
- `gist_trgm_ops` 는 재지 않았다. GIN 두 종류와 함수 인덱스만 봤다.
- 시간은 머신 부하에 좌우된다 — **자릿수 차이만 해석할 것.** 결정적 지표(후보 행·recheck·버퍼)는 2회 실행 전부 동일했다.

## 관련

- [실험 03 — 연산자 커버리지](../03-operator-coverage-and-correctness) — "되는가"를 강제 설정으로 본 판
- [실험 05 — 패턴 × 길이](../05-pattern-and-length) — 2글자 함정의 본편
- [실험 08 — 공백과 구두점](../08-space-and-punctuation) — 조각이 어떻게 만들어지나
- [pg_trgm 공식 문서](https://www.postgresql.org/docs/16/pgtrgm.html) · [pg_bigm 공식 문서](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md)
