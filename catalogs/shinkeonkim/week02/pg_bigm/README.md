# pg_bigm

> LIKE 검색을 2-gram(bigram) GIN 인덱스로 가속하는 서드파티 익스텐션 - 한글/일본어처럼 띄어쓰기가 불분명한 언어와 1~2글자 짧은 키워드에서 PostgreSQL 표준 pg_trgm(3-gram)보다 유리하다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 검색 · 텍스트 |
| 버전 | 실습 환경: PostgreSQL 16 / pg_bigm 1.2 (git 태그 `v1.2-20250903`, PostgreSQL 16~19 대응) |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [pgbigm/pg_bigm (GitHub)](https://github.com/pgbigm/pg_bigm) |
| 정리한 사람 | shinkeonkim |
| 회차 | week02 |

이 문서는 아래 심화 조사와 실습 결과를 종합한 것이다. 근거와 세부 내용은 각 문서를 참고한다.

- [`docs/01-what-and-why.md`](docs/01-what-and-why.md) - 무엇을 하는지, 왜 필요한지
- [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md) - 내부 동작 원리와 실제 코드베이스
- [`docs/03-production-playbook.md`](docs/03-production-playbook.md) - 실무 활용, 매니지드 DB 지원
- [`labs/`](labs) - Docker 기반 실습 5개 (`./run.sh` 또는 각 lab 의 `HANDS-ON.md`)
- [`experiments/`](experiments) - 정량 벤치마크 3건 (`./bench.sh` 로 직접 재현 가능)

**`pg_trgm` 과의 비교는 별도 디렉터리로 분리했다** - 이 문서를 쓴 뒤 직접 재보니 여기 적힌 비교 서술 중 일부가 사실이 아니었고, 그 정정 내용이 그쪽에 있다.

- [`../bigm-vs-trgm/`](../bigm-vs-trgm) - **두 확장 비교** (인덱싱 원리 · 소스 대조 · 정량 실험 3건)
- [`../pg_trgm/README.md`](../pg_trgm/README.md) - pg_trgm 카탈로그
- [`web/`](../../web/README.md) - [2-gram vs 3-gram 기초](../../web/README.md) · [tsvector/tsquery](../../web/README.md)

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

```sql
-- 인덱스 없이 - 테이블 전체를 훑는다. 특히 한글 짧은 키워드일수록 대안이 마땅치 않다.
SELECT * FROM pg_tools WHERE description LIKE '%검색%';
```

**After**

```sql
CREATE EXTENSION pg_bigm;
CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);

-- 쿼리는 그대로다 - LIKE 문법을 바꿀 필요가 없다.
SELECT * FROM pg_tools WHERE description LIKE '%검색%';
```

## 2. 설치 & 데모

```sql
-- pg_bigm 은 contrib 도 PGDG 패키지도 아니다 - 소스를 받아 PGXS 로 직접 빌드해야 한다
-- (이 lab 의 Dockerfile 이 git 태그를 고정해 빌드한다).
-- shared_preload_libraries 는 "권장"이지 기능상 필수는 아니다 (docs/02 참고).

CREATE EXTENSION pg_bigm;
```

```sql
-- 실제 쿼리와 결과
SELECT show_bigm('풀텍스트검색');
--  {" 풀",검색,"색 ",스트,텍스,트검,풀텍}

CREATE TABLE tbl (doc text);
INSERT INTO tbl VALUES ('He is awaiting trial'), ('It was a trivial mistake');
CREATE INDEX tbl_idx ON tbl USING gin (doc gin_bigm_ops);

SELECT * FROM tbl WHERE doc LIKE likequery('trial');
--  He is awaiting trial   (Recheck 이 "trivial"을 걸러낸다)
```

전체 실습은 [`labs/`](labs) 에서 Docker 로 직접 돌려볼 수 있다 (각 lab 디렉터리에서 `./run.sh`).

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 한글/CJK 텍스트에 `LIKE '%키워드%'` 를 자주 쓰는데 느릴 때, 특히 1~2글자 짧은 키워드 |
| 이럴 때는 피한다 | GiST 인덱스가 필요하거나 정규식(`~`,`~*`) 연산자가 필요할 때(`pg_trgm` 이 낫다), 관련도 랭킹/형태소 분석이 필요할 때(전문검색이 낫다) |
| 비용 | 인덱스 컬럼 크기 ~102MB 제한. FASTUPDATE 기본 on 이라 쓰기는 빠르지만 pending list 관리가 필요. PGDG 패키지가 없어 직접 빌드/버전 고정이 필요 |
| 대안 | `pg_trgm`(contrib, 3-gram), PostgreSQL 내장 전문검색(`tsvector`/`tsquery`), ParadeDB `pg_search`(BM25) |

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | 2021년 공식 지원 발표 - 한/중/일 멀티바이트 전문검색 가속 목적 명시 |
| AWS Aurora | ○ | RDS 와 함께 지원 |
| GCP Cloud SQL | ○ (PG17+) | `cloudsql.enable_pg_bigm` 플래그 필요 (재시작 유발) |
| Azure Database for PostgreSQL | 확인 필요 | 공식 목록에서 명시적으로 확인 못함 |
| Supabase / Neon | 확인 필요 | 공식 목록에서 확인 못함 |

<sub>PGDG 패키지가 없는 서드파티 확장이라 지원 여부가 서비스마다 크게 갈린다 - 세부 근거는 [`docs/03-production-playbook.md`](docs/03-production-playbook.md) 참고.</sub>

---

## 5. 내부 동작 원리

- **훅도 백그라운드 워커도 없다.** `_PG_init()` 은 커스텀 GUC 4개(`pg_bigm.enable_recheck` 등)를 등록할 뿐이다 - `pg_stat_statements`/`pg_cron` 과는 근본적으로 다른 부류다.
- **`LIKE` 를 가로채는 게 아니라, GIN 인덱스 프레임워크의 표준 확장점(연산자 클래스)을 쓴다.** `gin_bigm_ops` 가 `~~`(LIKE) 연산자에 대한 지원 함수(`extractValue`/`extractQuery`/`consistent`)를 등록해뒀을 뿐이라, `EXPLAIN` 에도 평범한 `Bitmap Index Scan` 으로 나온다.
- **preload 가 "권장"인 이유는 훅/워커와 무관하다.** `CREATE FUNCTION` 의 심볼 검증 때문에 `CREATE EXTENSION` 을 실행한 세션은 이미 라이브러리가 로드돼 있지만, **그냥 접속만 한 다른 세션은 그렇지 않다** - 그래서 `ALTER SYSTEM SET pg_bigm.*` 가 세션에 따라 되기도 안 되기도 한다. preload 를 켜면 모든 세션이 시작부터 일관되게 인식한다.
- 자세한 소스 코드 인용: [`docs/02-internals-and-source.md`](docs/02-internals-and-source.md)

## 6. 벤치마크 / 실습 결과

이 lab (`labs/`, PostgreSQL 16 / pg_bigm 1.2, Docker) 을 직접 돌리며 확인한 것 - **preload 관련 가설은 여러 번 재검증 끝에야 정확한 설명에 도달했다** (아래는 최종적으로 검증된 사실이다):

| 조건 | 결과 |
| --- | --- |
| preload 없이 `CREATE EXTENSION pg_bigm` 실행 | 성공. `pg_settings` 확인 결과 이 세션은 이미 `vartype=real`(진짜 GUC, placeholder 아님) - `CREATE FUNCTION` 의 심볼 검증이 그 자리에서 라이브러리를 로드하기 때문 |
| 같은 서버, "설치만 되어있고 함수는 한 번도 안 부른" 새 세션에서 `ALTER SYSTEM SET pg_bigm.similarity_limit=...` | **실패** (`unrecognized configuration parameter`) - 그 세션 프로세스 메모리에는 아직 `.so` 가 없다 |
| 같은 새 세션에서 평범한 `SET pg_bigm.similarity_limit=...` (세션 로컬) | **성공** - 그런데 `pg_bigm` 을 설치도 안 한 임의의 이름(`whatever.foo`)으로도 똑같이 성공해서, 이건 pg_bigm 과 무관한 PostgreSQL 범용 placeholder 메커니즘임을 확인 |
| 2글자 키워드(`%AB%`)로 `pg_bigm` vs `pg_trgm` 인덱스 비교 | 둘 다 `EXPLAIN` 에 `Index Cond` 가 붙지만, `pg_trgm` 쪽 cost 가 약 300배 높음(후보 4000/20000행) - "인덱스를 타는가"가 아니라 "얼마나 선택적인가"의 문제 |
| `pg_gin_pending_stats()` 를 `CREATE INDEX` 직후(기존 행 대상)에 확인 | 0/0 - CREATE INDEX 로 처음 빌드된 행은 pending list 를 거치지 않는다. 인덱스가 있는 상태에서 새로 INSERT 해야 pending list 가 실제로 쌓이는 것을 볼 수 있었다 |

각 항목의 재현 스크립트: [`labs/01-preload-and-guc-registration/`](labs/01-preload-and-guc-registration) ~ [`labs/04-comparison-and-ops/`](labs/04-comparison-and-ops).

## 7. 실전 통합 - FastAPI 백엔드에서 쓰기

[`labs/05-fastapi-search-api/`](labs/05-fastapi-search-api) 는 pg_bigm 을 실제 서비스에 통합하는 예제다. FastAPI 검색 엔드포인트 하나가 `likequery()` 로 부분 문자열 검색을, `=%`/`bigm_similarity()` 로 오탈자 허용 검색을 제공한다. 핵심은 애플리케이션 코드에 pg_bigm 전용 문법이 거의 없다는 것 - 인덱스가 붙은 평범한 `LIKE` 쿼리일 뿐이다. 다만 `=%` 연산자가 드라이버의 `%s` 파라미터 파서와 충돌해 `%%`로 이스케이프해야 하는 점, GUC(`pg_bigm.similarity_limit`)는 파라미터 바인딩이 안 되어 값 검증 후 문자열로 끼워 넣어야 하는 점은 실제로 이 lab 을 만들며 겪은 통합 함정이다.

## 8. 정량 벤치마크 - 얼마나 차이 나는지 숫자로

[`experiments/`](experiments)에서 실제로 측정했다 (`bench.sh`로 재현 가능, README.md에는 실측값만 적혀 있다):

- **Before/After 의 전환점**([`00`](experiments/00-explain-before-after)): **100행에서는 인덱스가 있어도 `Seq Scan`** 이고, 1,000행에서는 같은 테이블·같은 인덱스인데 검색어에 따라 플랜이 갈린다(선택도 0.1% → 인덱스, 30% → `Seq Scan`). **"인덱스를 만들면 인덱스를 탄다"는 서술은 사실이 아니었고**, 전환점은 행 수와 선택도 두 축이 함께 정한다. 실제 한국어 말뭉치(NSMC)로 측정.
- **인덱스 빌드 시간·크기**([`01`](experiments/01-index-build-time-and-size-vs-pg_trgm)): **빌드 시간은 동률**이고 **크기는 trgm 이 27~73% 크다**(5만 행 1.73배 → 100만 행 1.27배로 격차가 줄어든다). "~102MB vs ~228MB"라는 문서상의 차이는 컬럼 최대 크기 제한이지, 실제 인덱스 크기가 그 배수로 벌어진다는 뜻이 아니었다. <sub>이전 판은 합성 데이터로 "5~13%"라고 적었는데 실제 말뭉치에서 다시 재니 이렇게 갈렸다.</sub>
- **검색 실행 시간**([`02`](experiments/02-query-latency-at-scale)): **100만 행에서 2글자 키워드를 `gin_trgm_ops` 인덱스로 검색하면 인덱스가 아예 없을 때보다 6~10배 느려진다** (520~811ms vs 70~94ms) - 세 번의 독립 실행 모두에서 재현된 안정적인 결과다. `gin_bigm_ops`는 항상 trgm보다는 빨랐지만, 그 정도는 실행마다 크게 흔들렸다(0.05ms~108ms) - 조사해보니 "짧은 키워드" 테스트 단어가 전체 행의 절반 이상과 매치되도록 설계되어 있어(실험 설계 결함, README 에 기록) 저선택도 상황에서의 물리적 I/O 패턴에 따라 결과가 요동친 것이었다. 긴 구절(고선택도) 검색에서는 세 번 모두 bigm/trgm이 동률로 빠르고 안정적이었다 - 문제는 "짧으면서 동시에 흔한" 키워드일 때만 나타난다. **직접 재현하다가 원래 주장(1·2회차) 중 하나가 3회차에서 재현되지 않는 것을 발견해 분석을 수정한 사례** - 자세한 경위는 `experiments/02` 의 README 참고.

---

## 참고 링크

- [pg_bigm 공식 저장소 (pgbigm/pg_bigm)](https://github.com/pgbigm/pg_bigm)
- [pg_bigm 1.2 문서 (영문)](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md)
- [Amazon RDS for PostgreSQL Supports pg_bigm extension (AWS 공식 발표)](https://aws.amazon.com/about-aws/whats-new/2021/04/amazon-rds-for-postgresql-supports-pg-bigm-extension-for-faster-full-text-search/)
- 나머지 인용 출처는 각 `docs/` 문서 하단의 "참고 링크" 참고
