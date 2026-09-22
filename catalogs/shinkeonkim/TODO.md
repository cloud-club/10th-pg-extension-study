# TODO — shinkeonkim 카탈로그 작업 목록

> `pg_bigm` 을 정리하다 `pg_trgm` 과의 비교가 필요해져서 시작된 확장 작업의 진행 상황.
> 완료한 항목은 `[x]` 로 바꾸고, 근거가 되는 파일 경로를 함께 남긴다.

## A. pg_trgm 카탈로그 신규 작성

- [x] `week02/pg_trgm/docs/01-what-and-why.md`
- [x] `week02/pg_trgm/docs/02-internals-and-source.md`
- [x] `week02/pg_trgm/docs/03-version-history.md` (PG 메이저별 `default_version` 을 직접 조회해 확정)
- [x] `week02/pg_trgm/docs/04-production-playbook.md`
- [x] lab 01 `01-install-and-trigram-anatomy` — 설치 · trusted · 패딩 · 멀티바이트 해싱 · 유사도 공식
- [x] lab 02 `02-gin-vs-gist` — 버퍼 수로 재는 GIN/GiST 비교, `siglen` 튜닝
- [x] lab 03 `03-similarity-and-knn` — 유사도 3형제, KNN
- [x] lab 04 `04-regex-and-tuning` — 짧은 키워드 함정, 한글 정규식 U+07FF 벽
- [x] lab 05 `05-fastapi-search-api` — FastAPI 통합 예제 (`/explain` 엔드포인트로 함정을 직접 보여준다)
- [x] `week02/pg_trgm/labs/README.md`
- [x] `week02/pg_trgm/experiments/01-gin-vs-gist-build-and-probe/` — `siglen` 12~256 스윕
- [x] `week02/pg_trgm/experiments/02-threshold-and-knn-latency/` — 임계값 스윕, 재현율, KNN 비용
- [x] `week02/pg_trgm/experiments/README.md`
- [x] `week02/pg_trgm/README.md` (TEMPLATE.md 형식 종합 카탈로그 문서)

## B. bigm vs trgm 비교

- [x] `week02/bigm-vs-trgm/docs/01-ngram-index-internals.md` — 인덱싱 원리 근본 정리
- [x] `week02/bigm-vs-trgm/docs/02-source-side-by-side.md` — 소스 대조
- [x] `experiments/01-keyword-length-and-selectivity/` — 키워드 길이 × 선택도 격자
- [x] `experiments/02-index-build-size-and-write/` — 빌드 · 크기 · 쓰기 · 조각 통계 · 영문 대조군
- [x] `experiments/03-operator-coverage-and-correctness/` — 연산자 행렬 + 유사도 점수 대조
- [x] `experiments/README.md`
- [x] `week02/bigm-vs-trgm/README.md`

## C. 추가 요청 사항 (2회차)

### C-1. n-gram 참고자료 디렉토리 신설

- [x] `references/` 디렉토리 신설 + `references/README.md`
- [x] `references/01-n-gram-basics.md` — **2-gram 과 3-gram 을 근본부터**
      (인덱싱 가능하게 만드는 변환, 패딩, n 의 트레이드오프, 한글 조합 수, **실측 유니크 조각 수**)
- [x] `references/02-tsvector-tsquery.md` — **PostgreSQL 내장 전문검색**
      (문자 단위 vs 어휘 단위, 한국어 재현율 **실측 38%**, 언제 무엇을 쓰나)

### C-2. pg_bigm 문서 보완

- [x] **experiments `00-explain-before-after/` 신설** — 행 수(100~1,000,000) × 선택도(0.1% / 30%) 격자로
      플래너 전환점을 실측. **100행에서는 인덱스가 있어도 `Seq Scan`**, 1,000행에서 같은 테이블인데도
      검색어에 따라 플랜이 갈린다는 것을 확인
- [x] 그 결과를 `docs/01-what-and-why.md` 의 Before/After 절에 실제 EXPLAIN 출력과 함께 반영
- [x] **`docs/03-version-history.md` 삭제** + `04-production-playbook.md` → `03-production-playbook.md` 로
      번호 정리 + 모든 링크 수정
- [x] **`docs/02-internals-and-source.md` 심화** — `bigm` 구조체 / `BIGM` varlena / GIN 엔트리가 `text` 라는
      사실과 그 귀결 / `gin_bigm_compare_partial` / `gin_key_limit` / `pg_gin_pending_stats()` +
      GitHub 소스 링크
- [x] **유사도 검색 설명 보강** — `=%` 가 진짜 오탈자 허용 검색이고 **GIN 인덱스도 탄다는 것을 EXPLAIN 으로 확인**,
      `extractQuery` 의 전략 분기, `pg_trgm` 과의 공식·대소문자·임계값 대조

### C-3. 예시 데이터 통일 + 실제 한글 말뭉치 도입

- [x] 예시 문자열 통일: `클라우드클럽` / `클둥이` · `김신건` / `클클` · `코아` · `신건` · `신컨`
- [x] **NSMC(CC0) 말뭉치 도입** — `week02/corpus.sh` 를 각 실험에 복사, `.corpus/` 캐시 + `.gitignore`,
      네트워크 없으면 합성 데이터 폴백
- [x] 기존 "15문장 어휘 풀" 합성 데이터를 실제 말뭉치로 대체 (신규 실험 6건 전부)

## D. 기존 문서 정정

- [x] **"pg_trgm 은 KEEPONLYALNUM 때문에 한글이 안 된다"** 정정 —
      `pg_bigm/docs/01-what-and-why.md`, `labs/02/README.md`, `labs/04/HANDS-ON.md`, `labs/04/sql/`
- [x] `pg_bigm/experiments/README.md` 의 철회된 **"12,000배"** 주장 정정
- [x] 초기 탐색값(20만 행 probe 의 49/77/60 MB)을 깨끗한 조건의 재측정값으로 교체
      <br>*(1차에서 완료로 잘못 표시했다가, 정합성 검증에서 3개 파일에 그대로 남아있는 것을 발견해 실제로 처리)*

## E. 마무리

- [x] `catalogs/README.md` 목록에 `pg_bigm` · `pg_trgm` 추가
- [x] `catalogs/shinkeonkim/README.md` 에 `pg_trgm` · `bigm-vs-trgm` · `references` 추가
- [x] 상대 경로 링크 일괄 검증 (479개 전부 정상)
- [x] 포트 충돌 확인 (신규: labs 15960~15964 / 18964, experiments 15970~15971 · 15980~15982 · 15956)
- [x] 모든 lab `./run.sh` · 실험 `./bench.sh` 가 에러 없이 완주하는지 확인

---

## F. 정합성 검증 (전체 자료 대조)

문서 간 수치·주장이 충돌하지 않는지 전수 검증하고 고친 것들이다.

- [x] **초기 probe 값 3개 파일에 잔존** — `pg_trgm/docs/02`, `pg_trgm/docs/04`, `bigm-vs-trgm/docs/01` 의
      `49/77/60 MB`·버퍼 `4/9,834/5,846` 를 깨끗한 실험값으로 교체 (D 항목이 미완료였다)
- [x] **`siglen=64` 면 GIN 과 같아진다는 주장이 실험과 충돌** — lab 02(문장 8개 반복, 5만 행)에서는 참이지만
      실제 말뭉치(20만 행)에서는 `siglen=64` 가 GIN 의 약 231배, 256에서도 약 32배다.
      lab 02 README·HANDS-ON·labs/README 에 데이터 한정 조건을 명시하고, `experiments/01` 이 lab 결론을
      수정한다는 것을 본문에 적었다
- [x] **"총 조각 수가 같다(L+1)"는 설명이 같은 표의 영문 데이터와 모순** — `show_bigm()`/`show_trgm()` 은
      **문서별 중복 제거 후**를 돌려준다는 사실을 빠뜨렸다. 중복 제거 전/후를 모두 재도록 실험을 고치고,
      두 확장의 **단어 분리 기준 차이**(`!t_isspace` vs `t_isalnum_with_len`)까지 함께 설명하도록 정정
- [x] **조각 통계가 실험이 쓰지 않는 테이블에서 측정돼 있었다** — 실험의 `docs_ko` 가 아니라 접미사 없는
      원본 말뭉치로 잰 값을 표에 실었다(663,107 → 실제 791,053). 실험 스크립트가 표를 직접 생성하도록 수정
- [x] **실험 02 가 재현되지 않았다** — `docs_ko` 의 `serial` id 부여 순서와 `docs_en` 의 `setseed()+random()`
      호출 순서가 실행 계획에 따라 달라졌다. 둘 다 `generate_series` 값 기반으로 결정화하고,
      **두 번 연속 실행이 바이트 단위로 동일**한 것을 확인
- [x] **GIN 두 줄이 서로 다른 검색어로 측정된 표** — `bigm-vs-trgm/docs/01` 의 비교표에서 bigm 은 2글자,
      trgm 은 6글자 결과를 나란히 놓았다. 6글자로 통일하고 각 열의 출처를 명시
- [x] **`ILIKE` 서술이 실측과 모순** — `pg_bigm/docs/01` 이 "`LIKE`/`ILIKE` 가속"이라고 했지만
      실측은 `Seq Scan` 이었다(`gin_bigm_ops` 에 `~~*` 미등록). 정정
- [x] **개수·목록 불일치** — `pg_bigm/README` 의 "벤치마크 2건"(실제 3건), `experiments/README` 표에
      실험 00 누락, `pg_bigm` 문서에서 신규 자료(`bigm-vs-trgm`·`pg_trgm`·`references`)로 가는 링크 없음
- [x] **합성 데이터로 잰 옛 실험값에 단서 추가** — `pg_bigm/experiments/01` 의 "차이 5~13%" 옆에
      "말뭉치에서는 25%" 를 병기
- [x] 상대 링크 513개 전수 검증 (깨진 링크 0개), 모든 `.sh` 문법 검사

## G. 재현성 검증 (실험별 2회 실행)

아래 6건을 각각 두 번씩 돌려 결정적 지표가 일치하는지 확인했다. 시간 지표는 비교에서 제외했다.
(이후 추가된 `05` 도 2회 확인했고, `04`·`06` 은 **1회만 돌렸다** — 그렇게 표시해 두었다.)

| 실험 | 결과 |
| --- | --- |
| `bigm-vs-trgm/01` 키워드 격자 | ✅ **완전 일치** — 발행값과도 일치 |
| `bigm-vs-trgm/02` 빌드·크기·쓰기 | ✅ **완전 일치** (데이터 생성 결정화 후) |
| `bigm-vs-trgm/03` 연산자 행렬 | ✅ **완전 일치** |
| `pg_bigm/00` Before/After 전환점 | ✅ **완전 일치** — 15개 칸 전부, "미해결" 칸도 해결됨 |
| `pg_trgm/01` siglen 스윕 | ⚠️ GIN 완전 일치 / **GiST 버퍼 ±5%** — "48→64 반등" 관찰이 노이즈로 판명돼 철회 |
| `pg_trgm/02` 임계값·KNN | ⚠️ 임계값·재현율 완전 일치 / **KNN `LIMIT 1` 65~230 으로 3.5배** |

- [x] `pg_trgm/01`·`02` 의 데이터 삽입을 결정화 (`serial` → `generate_series` 값 + `ORDER BY`)
- [x] GiST 지표를 단일값 → **범위**로 바꾸고, GiST 빌드 비결정성을 각 문서에 명시
- [x] `pg_trgm/01` 의 "siglen 48→64 반등" 관찰 **철회** (2회 재실행 모두 감소)
- [x] `pg_bigm/00` 의 "미해결" 절을 **해결 경위**로 재작성
- [x] 바뀐 수치를 인용처 5곳에 전파 (`pg_trgm/docs/02`·`04`, `pg_trgm/README`,
      `pg_trgm/experiments/README`, `bigm-vs-trgm/docs/01`)
- [x] **GiST 빌드가 왜 비결정적인지 확인** — `pageinspect` 로 3회 빌드의 트리를 직접 비교했다(J-5).
      **"무엇이" 달라지는지는 확정했다** — 페이지 수·엔트리 수·리프 페이지 수가 전부 다르다
      (18,416 / 18,427 / 18,392). **측정이 아니라 빌드 결과 자체가 다르다.**
      다만 **"왜"** 는 여전히 모른다 — `gtrgm_picksplit()` 의 분할 선택이 무엇에 의존하는지 파봐야 한다

## H. 추가 요청 (3회차) — 규모 확대 · 용량 · 길이/패턴

- [x] **`experiments/04-storage-overhead-at-scale`** — 10만~**500만 행**(50배)에서 인덱스가 테이블 대비
      몇 배인지. `btree` 대조군 포함. **배수가 규모에 따라 떨어진다**(trgm 2.48× → 1.01×)는 것과
      그 원인(엔트리 트리 = 고정비, 포스팅 리스트 = 압축된 변동비)을 확인
- [x] **`experiments/05-pattern-and-length`** — 100만 행에서 **순수 LIKE / bigm / trgm** ×
      **길이 2·3·5·10·20** × **`%X%` / `X%` / `%X`** 45칸 격자.
      정답 행 수를 45칸 전부 500 으로 고정하는 설계(`<BASE20> 문장 <BASE20>`)로
      "길이 때문인지 선택도 때문인지" 를 분리
- [x] 두 실험을 `experiments/README`, `bigm-vs-trgm/README`, `references/01` 에 반영
- [x] `05` 2회 실행 재현성 확인 — 결정적 지표 45칸 전부 동일, 버퍼만 0.5% 미만 편차

**주요 발견**

- 인덱스는 순수 `LIKE` 대비 **50~110배** 빠르고, **검색어 길이(3~20글자)는 거의 영향이 없다**
- **`pg_trgm` 의 2글자에서만 패턴 모양이 결정적** — `%클둥%` 797 ms vs `클둥%` 1.49 ms (**535배**)
- **인덱스가 전혀 없어도 `X%` 가 `%X%` 보다 3~4배 빠르다** (버퍼는 같고 CPU 비교 횟수만 다르다)
- 저장 용량은 **테이블의 1~2.5배**, 규모가 클수록 낮아진다

## I. 추가 요청 (4회차) — HTML 시각화 · 전문검색 재비교

요청: (1) 성능 실험 설명을 HTML 로, Chart.js 와 [clotho](https://github.com/shinkeonkim/clotho) 로 차트·시각화.
(2) 그 HTML 에 **구체적인 실험 코드 위치 · 어떤 실험인지 · 수치 비교**가 나올 것.
(3) n-gram 시각화 설명을 별도로. (4) `tsvector`/`tsquery` 설명과 비교를 다시.

### I-1. 실험 06 — 전문검색 재비교

- [x] **`bigm-vs-trgm/experiments/06-fulltext-vs-ngram/bench.sh`** — 100만 행에서
      `LIKE` 를 정답으로 놓은 **재현율**, 접두어 `:*` 회복률, 인덱스 크기·빌드, 속도,
      각자만 되는 것(구절 검색 / 어휘 중간 부분 문자열)
- [x] `06/README.md` 작성
- [x] `experiments/README.md` · `bigm-vs-trgm/README.md` 에 06 반영
- [x] `references/02-tsvector-tsquery.md` 를 **100만 행 실측**으로 갱신
      (기존 199,993행 비공식 수치 23,687 vs 62,684 / 38% → 키워드 6개 표 + 평균 20.4%)
- [x] `experiments/README.md` 의 02 요약이 **옛 조각 수(663k vs 655k)** 로 남아 있던 것 정정 → 857k vs 793k

**주요 발견**

- **`tsvector`/`tsquery` 는 익스텐션이 아니라 코어다** — `pg_extension` 에 없다. 층위가 다른 비교였다
- 사전 없는 `simple` 설정에서 한국어 재현율 **평균 20.4%**(키워드별 7~38%), `:*` 로 **84.6%**
- `:*` 는 반쪽짜리 — **키워드 앞에 뭔가 붙은 경우(`이영화`)는 원리상 못 잡는다**
- `영화가` 안의 `화가`: `LIKE` **25,366** vs `tsquery` **445**(1.8%)
- 구절 검색(`영화 <-> 연기`) 45행은 **전문검색만** 된다 — 어휘소의 위치를 저장하기 때문
- 인덱스 크기 tsv 121 MB / bigm 123 MB / trgm 158 MB — 다만 **분모(테이블 291 MB)에 `tsv` 생성 컬럼이 이미 포함**되어 있어 tsvector 에 유리하게 기운 비교다

### I-2. HTML 시각화 (`web/`)

- [x] **`animations/build.py`** — clotho 문서 4종을 생성하고 **스키마로 검증**한 뒤
      `assets/animations.js`(`window.CLOTHO_DOCS`)로 인라인. id 패턴(`^[a-z0-9][a-z0-9_-]*`) 가드 포함
      — `ngram-slice` · `two-char-trap` · `gin-pipeline` · `lexeme-vs-ngram`
- [x] **`assets/data.js`** — 모든 실측 수치를 한 곳에. **실제로 `bench.sh` 를 돌려 나온 값만** 적는다
- [x] **`assets/style.css`** · **`assets/viz.js`**(테마 토글 · Chart.js 헬퍼 · clotho 마운트 + 폴백)
- [x] **`experiments.html`** — 실험 01/05/04/02 + 플랜 전환점 + GIN 파이프라인 + 재현성 표.
      각 절에 **무엇을 재나 / 코드 위치 / 재현 명령 / 상세 문서** 메타 블록
- [x] **`ngram.html`** — B-tree 가 못 하는 일 → 패딩 → n 의 트레이드오프 → 2글자 함정 → GIN 파이프라인
- [x] **`fulltext.html`** — "확장이 아니다" 정정으로 시작, 어휘소 vs 조각, 재현율, 각자만 되는 것, 선택 기준
- [x] **`index.html`** — 허브. 결론 표 + 세 페이지 안내 + 재현 방법

**설계 원칙**

- 숫자는 **`assets/data.js` 한 곳에만** 둔다. HTML 에 리터럴로 박지 않는다
- 파생값(배수·평균)은 페이지에서 계산한다 — 원본이 바뀌면 같이 바뀌도록
- clotho·Chart.js 를 CDN 에서 못 받아도 **페이지가 읽히게** 한다(clotho 는 챕터 목록으로 폴백)
- `file://` 로 열어도 동작해야 하므로 clotho 문서를 `fetch` 하지 않고 JS 로 인라인한다

## J. 추가 요청 (5회차) — 개념 보강 · 다크 전용 · 버전 매트릭스

요청: (1) 연관 개념 정리 (2) `pg_cron`·`pg_stat_statements` 를 week03 으로 (3) `pg_trgm` 이 뒤 패딩을
하나만 붙이는 이유 (4) 유사도 애니메이션 (5) 다크 모드 전용 (6) B-tree 가 왜 못 하는지 (7) 한국어에서
`pg_bigm` 이 유리한 이유 (8) `A^n` 추론 검증 (9) 실험 05 를 세 엔진 모두 (10) Recheck 이란 (11) GIN 페이지
(+) 알려진 사실과 다른 측정 결과 표시 · `visualizations` 를 week02 로 · TODO 잔여 작업
(+) PostgreSQL 16~19 버전별 벤치 · 차트에 버전 선택기

### J-1. 구조 정리

- [x] `pg_cron` · `pg_stat_statements` 를 **`week03/`** 으로 이동, 카탈로그 README 2곳의 회차 표기 갱신
- [x] `visualizations/` 를 **`web/`** 로 이동, 상대 경로 전부 갱신 (`data.js` 의 `repo` 포함)

### J-2. 새 개념 문서 (`references/`)

- [x] **`03-btree-vs-inverted-index.md`** — B-tree 가 답할 수 있는 질문의 모양(정렬 순서 위의 연속 구간),
      접두어는 되고 부분 문자열은 안 되는 이유, `text_pattern_ops`/콜레이션, **n-gram 말고 다른 선택지들**
      (`reverse()` + B-tree, 접미사 트리, 전문검색, 외부 엔진)
- [x] **`04-gin-index.md`** — 엔트리 트리 · 포스팅 리스트/트리 · 펜딩 리스트(FASTUPDATE) · 검색 경로 ·
      `GIN_SEARCH_MODE_ALL` · GiST 대조 · 실무 파라미터
- [x] **`05-recheck-and-lossy-index.md`** — Recheck 의 정의, **lossy 비트맵(`work_mem`)과 손실 인덱스의 구분**,
      거짓 양성이 원리상 불가피한 이유, `pg_bigm` 의 Recheck 생략 최적화(실제 소스 인용)
- [x] **`06-korean-and-ngram.md`** — `pg_bigm` 이 한국어에서 유리한 다섯 근거(언어 2 + 구현 3),
      `A^n` 추론 검증, `RPADDING = 1` 인 이유 세 가지
- [x] `references/README.md` 에 **개념 지도**와 "미리 알아두면 좋은 것" 표 추가

### J-3. 시각화 (`web/`)

- [x] **다크 전용으로 전환** — `style.css` 라이트 토큰 제거(`color-scheme: dark`), 테마 토글 삭제,
      `viz.js` 의 테마 기계 제거, **clotho 캔버스 배경도 다크로**(`build.py` 팔레트 교체)
- [x] **새 애니메이션 3편** — `btree-vs-inverted` · `gin-structure` · `similarity-compare`
- [x] **`gin.html`** 신규 — GIN 구조 · 검색 경로 · **Recheck 이란** · GiST 대조 · 파라미터
- [x] **`corrections.html`** 신규 — 알려진 서술 중 재보니 달랐던 12가지 + **아직 확인 못한 것** 목록
- [x] `ngram.html` 확장 — B-tree 절 전면 재작성, `RPADDING` 절, `A^n` 추론 검증 절,
      한국어 유리 근거 절, **유사도 절**
- [x] `experiments.html` 확장 — 실험 01 **선택도 축** 차트, 실험 05 **세 엔진 격자**, 실험 07 **버전 선택기**
- [x] `index.html` 을 5개 페이지 허브로 갱신
- [x] 모든 페이지 네비게이션 통일 (6개 링크)

### J-4. 새 실험

- [x] **`experiments/07-postgres-version-matrix`** — PG 16/17/18/19beta1.
      버전별로 `pg_bigm` 을 다시 빌드(PGXS)하고 같은 지표를 잰다
- [x] `experiments/01` 에 **선택도 축**(0.1/1/5/10/30%) 추가 — 길이를 3글자로 고정
- [x] `experiments/03` 에 **`strict_word_similarity`(`<<%`)** 추가 + 세 유사도 의미 대조
- [x] `pg_trgm/experiments/01` 의 siglen 스윕을 **512·1024 까지** 확장
- [x] `pg_trgm/experiments/01` 에 **`pageinspect` 로 ALLISTRUE 포화 직접 관측** + GiST 빌드 결정성 3회 비교

**주요 발견**

- **`pg_bigm` 1.2 는 PostgreSQL 19beta1 에서 빌드되지 않는다** — PG19 에서 전역 `database_ctype_is_c` 가
  `pg_locale_t` 의 필드로 옮겨지고 `char2wchar()` 가 헤더에서 빠졌다. Dockerfile 주석의 "16~19 지원"은 사실이 아니었다
- **결정적 지표는 PG 16·17·18 에서 한 자리도 다르지 않다** — `GIN_SEARCH_MODE_ALL` 은 버전으로 해결되지 않는다
- **인덱스 빌드만 PG18 에서 약 2배 빨라진다** (원인 미확인)
- **PostgreSQL 18 이 `EXPLAIN` 의 `actual rows` 를 소수로 바꿨다** — 파서가 조용히 실패해 그 버전만 빈칸이 됐다
- **`trial` vs `trivial` 은 3-gram 에서 거짓 양성이 아니다** — `ria` 조각이 없어 인덱스 단계에서 탈락한다.
  3-gram 의 거짓 양성 예는 `arterial triage`. 2-gram 기준으로는 원래 예가 맞다
- **선택도를 300배 흔들어도(0.1%→30%) 3글자 구간에서 두 인덱스의 순위는 바뀌지 않는다** —
  bigm 이 유리한 칸을 정하는 것은 선택도가 아니라 **길이**다
- **`strict_word_similarity` 는 한국어에 잘 안 맞는다** — 붙여쓴 복합어(`클라우드클럽`) 안의 부분을 계속 놓친다

### J-5. 잔여 과제 정리 (모두 수행)

- [x] **`experiments/01` 선택도 축** (0.1/1/5/10/30%) — **선택도는 순위를 안 바꾼다**는 결론.
      검색어가 서로의 부분 문자열이 되어 정답이 오염되는 함정도 겪고 고쳤다(`클둥이오` → `클둥오`)
- [x] **`experiments/02` 영문 대조군을 실제 말뭉치로** — Project Gutenberg 3권.
      유니크 조각 294 → **1,937**(6.6배). 방향은 맞았지만 배수가 크게 틀렸다
- [x] **`experiments/03` `strict_word_similarity`** — 방향 규칙과 세 유사도의 의미 대조.
      **한국어 복합어에는 strict 판이 안 맞는다**
- [x] **`experiments/04` 어휘 증가 대조군** — 예상과 달리 **움직인 것은 `tsvector` 뿐**.
      n-gram 의 고정비는 문서 수가 아니라 **문자 조합 공간**이 정한다
- [x] **`experiments/05` 의 "접두어가 빠른 이유"·"bigm 우위" 두 절 확인** — 둘 다 원래 설명이 틀렸다.
      접미어는 "패턴 모양"이 아니라 **"매치 위치"** 문제였고,
      "bigm 이 1.5~2배 빠르다"는 **20회 중앙값으로 재니 노이즈여서 철회**했다
- [x] **`pg_trgm/experiments/01` siglen 512·1024** — **256 이 최적이고 그 위로는 무너진다**(3회 재현)
- [x] **`pg_bigm/experiments/01` 말뭉치로 재작성** — 크기 차이 5~13% → **27~73%**
- [x] **`pg_bigm/experiments/02` 말뭉치 + 선택도 통제로 재작성** —
      선택도를 통제하니 1차 판에서 자릿수가 흔들리던 칸이 전부 안정됐다
- [x] **GiST `ALLISTRUE` 포화율 관측** — 오프셋을 두 번 헛짚고(4 → 0 → **12**) 결국 쟀다.
      `gist_page_items_bytea()` 가 돌려주는 것은 키 datum 이 아니라 **IndexTuple 통째**라,
      `t_tid`(6) + `t_info`(2) + varlena 헤더(4) = **12번째 바이트**가 flag 였다.
      **교훈: 바이트 오프셋을 가정으로 쓰지 말고 값의 분포로 검증할 것** — 스크립트가 이제 flag 값 분포를 항상 함께 낸다
- [x] **GiST 빌드 비결정성의 정체 확인** — 같은 데이터로 3회 빌드해 트리 구조를 직접 셌다.
      페이지 18,416 / 18,427 / 18,392, 엔트리 218,353 / 218,364 / 218,330 — **전부 다르다.**
      **측정이 흔들린 게 아니라 만들어진 트리가 매번 다르다.** (왜인지는 여전히 모른다)

**주요 발견**

- **`ALLISTRUE` 포화는 실재하지만 "긴 문서 + 기본 `siglen=12`" 에서만 일어난다** — 내부 노드의 **94.7%**.
  `siglen` 을 24 로 한 단계만 올려도 **0.0%** 로 사라진다
- **짧은 문서는 어느 `siglen` 에서도 포화하지 않는다** — 그런데도 GiST 가 GIN 보다 버퍼를 345배 읽는다.
  **"GiST 가 느린 건 ALLISTRUE 때문"이라는 흔한 설명은 절반만 맞다** — 짧은 문서에서는 원인이 시그니처 충돌이다
- **`siglen=512` 폭증도 포화가 아니다** — 포화율 0.1%. **내부 노드가 12.7배 폭증**하고 인덱스 크기가 정확히 그만큼 커진다
  (18,336 → 232,992 / 143.74 → 1,820.28 MB, 두 자리까지 일치)

## K. 인덱스 공존 감사 (실험 서버를 만들다 발견)

`lab-server` 에 캐시를 넣으려고 `_bigm`·`_trgm` 인덱스를 둘 다 남겨뒀더니
**trgm 의 2글자 `%X%` 가 정상으로 나왔다** — 무너져야 맞는 칸인데.
플래너가 bigm 인덱스를 고르고 있었다. 그래서 **기존 실험 전부를 되짚었다.**

- [x] **`bench.sh` 12개 전수 감사** — 인덱스 생성/삭제 흐름 기준
  - 11개는 안전했다: 둘 다 `DROP` 후 하나만 만들거나(01·03·05·07), 이름 하나를 재사용하거나(02·04·`pg_trgm/01`),
    만들고 재고 지운 뒤 다음 것을 만든다(`pg_bigm/01`·`02`, `pg_trgm/02`). `pg_bigm/00` 은 인덱스가 하나뿐이다.
  - **`06-fulltext-vs-ngram` 하나만 세 인덱스를 동시에 둔 채 `LIKE` 를 쟀다**
- [x] **영향 범위 확정** — 속도 표 하나뿐. 재현율·크기·교차·구절은 순수 집계라 무관하고,
      `tsquery @@` 는 `docs_tsv` 로만 풀려 경합이 없다
- [x] **버퍼로 실제 사용 인덱스를 역추적** — 결정적 지표라 지문이 된다
  - 영화: 옛 버퍼 37,248 ≈ 다시 잰 bigm 37,252 (trgm 은 72,032) → **bigm, 라벨 맞음**
  - 스토리: 옛 버퍼 **22,854** = 다시 잰 trgm **22,854** (bigm 은 22,873) → **trgm, 라벨 틀림**
  - **같은 표 안에서 한 줄은 bigm, 한 줄은 trgm 이었다**
- [x] **`06` 을 고쳐 다시 실행** — 상대 인덱스를 지우고 재고, 플랜의 `Index Scan on` 으로 **"쓴 인덱스" 열**을 기록.
      `LIKE` 를 trgm 으로 푸는 경우도 함께 재도록 추가
- [x] 측정 원칙에 **5번 항목 신설** — "인덱스는 한 번에 하나만 두고, 쓴 인덱스는 플랜에서 확인한다"
- [x] README · `data.js` · `fulltext.html` · 정정 목록(21건)에 반영

**덤으로 나온 발견**

- **2글자 `영화` 를 `pg_trgm` 으로 풀면 버퍼 2배(37,252 → 72,032), 시간 17배** —
  전문검색 비교 안에서도 2글자 함정이 그대로 나타난다. `LIKE`(trgm) 행을 새로 재면서 알게 됐다

## L. 12회차 — 이미지 취약점 · 공백/구두점 · 웹 앱 재작성

### L-1. 베이스 이미지 취약점 (`FROM postgres:16-bookworm` 경고)

- [x] **직접 스캔했다.** Docker Scout 은 Docker Hub 로그인이 필요해 못 썼고, `aquasec/trivy 0.74.0` 으로 쟀다.
      같은 이미지에서 **critical 16 / high 93** — 에디터가 띄운 5/32 와 다르다. **스캐너가 다르면 숫자도 다르다**는
      점을 페이지에 명시했다
- [x] **`-trixie` 는 나아지지 않는다** — critical 16→14, high 93→98. **먼저 옮겨 놓고 나중에 잰 자리다**(추측으로
      적지 않는다는 원칙을 스스로 어겼다). 유지하는 이유는 CVE 가 아니라 "현재 stable" 하나뿐이라고 적었다
- [x] **`-alpine` 만 자릿수가 다르다** — critical 1 / high 30, 그리고 **패치 없는 항목이 0건**. Debian 쪽은
      109건 중 고칠 수 있는 것이 22건뿐이고 **그 22건이 전부 `gosu`(Go stdlib)** 다 — `apt-get upgrade` 로는
      한 건도 안 줄어든다
- [x] **musl 에서 값이 달라지는지 재봤다** — alpine 에 pg_bigm 을 빌드해 `show_bigm`/`show_trgm`/유사도 5칸을
      대조했고 **전부 글자까지 같았다.** 그래도 갈아타지 않는 이유는 "발행한 수치가 전부 glibc 판"이라서다.
      콜레이션·정렬과 ICU 경로는 **재보지 않았다**
- [x] Dockerfile 23개를 trixie 로 옮기고 `libicu-dev` 추가 (없으면 `unicode/ucol.h` 없음으로 빌드 실패)
- [x] **`pg_config` 를 버전 경로로 고정** — 버전 없는 `postgresql-contrib` 가 더 새 메이저를 끌어와
      `PGVER=16` 인데 `-I/usr/include/postgresql/18/server` 로 컴파일되고 `postgres.h: No such file` 로 죽었다.
      `postgresql-contrib-${PGVER}` + `/usr/lib/postgresql/${PGVER}/bin/pg_config` 로 바꿔 16·17·18 빌드 확인

### L-2. `%검색어%` 가 trgm 에서 느린 이유 — 문서에 있나

- [x] **있다.** pg_trgm 공식 문서가 그대로 적는다 —
      *"a pattern with no extractable trigrams will degenerate to a full-index scan"*
- [x] 다만 **관측은 두 갈래**다. 20만 행에서는 플래너가 전체 인덱스 스캔보다 `Seq Scan` 이 싸다고 판단해
      인덱스를 아예 안 썼고, 100만 행에서는 문서대로 전체 인덱스 스캔이 나왔다. **둘 다 나타난다**고 적었다

### L-3. ILIKE — 확장 문서도 같은 말을 하나

- [x] **한다.** pg_bigm 문서는 이용 가능한 연산자를 *"LIKE only"*, pg_trgm 문서는
      *"…`LIKE`, `ILIKE`, `~`, `~*` and `=`"* 로 적는다. `pg_amop` 실측과 일치
- [x] 실험 03 README 의 "공식 문서는 원리상 가능하다는 뉘앙스를 준다"는 서술을 **문서 인용으로 교체**했다

### L-4. 공백이 든 문장의 조각 — 실험 08 신설

- [x] **`experiments/08-space-and-punctuation/`** 신설. 세 절로 나눠 잰다 —
      조각의 생김새(결정적) / 공백이 든 패턴의 인덱스 동작 / `% X %` 우회
- [x] **공백은 조각 안에 들어가지만 낱말 경계 자리로만** — `ab cd` 에 `"b "` 는 있고 `b c` 는 없다
- [x] **갈리는 지점은 구두점** — `pg_bigm` 은 남기고 `pg_trgm` 은 버린다. `foo|bar` 결과가
      PostgreSQL 공식 문서 예시와 **글자까지 같다**(대조군으로 넣었다)
- [x] `% 클럽 %` 우회는 동작하지만 **정답이 250 → 203행으로 바뀐다** — 의미가 "낱말 검색"으로 옮겨간다
- [x] `references/01` 의 패딩 절과 `references/06` A-4 에 반영

### L-5. `web/` — React + bun + TypeScript + shadcn 재작성

- [x] `visualizations/` 의 정적 HTML 6장을 **React 앱 25쪽**으로 재구성. 사이드바로 확장·주제를 오간다
- [x] **레지스트리 하나에서 파생** — `src/content/registry.ts` 에 섹션을 추가하면 라우트·사이드바·이전/다음이
      자동으로 따라온다. 새 확장을 붙일 때 손댈 파일이 두 개다
- [x] `assets/data.js` → `src/data/measurements.ts` (값은 손대지 않고 그대로 옮겼다) +
      `operators.ts` · `threshold.ts` · `whitespace.ts` · `images.ts` 신설
- [x] `animations/` 를 `web/src/animations/` 로 이동. `build.py` 가 이제 `index.ts` 를 생성하고,
      Vite 가 JSON 을 직접 import 한다 (예전의 `window.CLOTHO_DOCS` 인라인 번들 제거).
      플레이어는 `@kokoa/clotho/react` 의 `AnimationPlayer` + `koreanStrings`
- [x] **`references/` 흡수** — 00~06 의 내용을 페이지로 옮기고, 중복 문단은 한 곳에만 뒀다.
      references 에만 있던 것(`ts_debug` 토큰 종류, 어간 추출, `websearch_to_tsquery`, Recheck FAQ)도 실었다
- [x] **새 시각화** — 조각 칩(공백을 `␣` 로 보여준다) · 45칸 히트맵 격자 · 용어 사전 검색 ·
      정정 목록 필터 · `GIN_SEARCH_MODE_ALL` 절
- [x] 예전 HTML 로 가던 링크 13개 파일을 `web/` 로 갱신. `visualizations/README.md` 는 이전 안내로 대체
      (파일 자체는 **지우지 않았다** — 아직 커밋 전이라 되살릴 수 없어서, 지우는 명령만 적어 두었다)

## M. 13회차 — ILIKE 성능 실측 · 디렉터리 정리

### M-1. `ILIKE` 는 실제로 빨라지는가 — 실험 09 신설

- [x] **`experiments/09-ilike-and-case-insensitive/`** 신설. 실험 03 이 `enable_seqscan=off` 로 "되는가"만 봤던
      자리를, **플래너를 건드리지 않고** 시간·버퍼로 다시 잰다
- [x] 대소문자 변형을 `id` 나머지로 심어 **`LIKE` 와 `ILIKE` 의 정답 행 수가 설계로 달라지게** 했다
      (`CloudClub` / `CLOUDCLUB` / `cloudclub` / 한글 대조군 / 2글자 마커)
- [x] **pg_trgm 의 `ILIKE` 는 38배 빠르고 recheck 이 0** — `IGNORECASE` 로 조각이 이미 소문자다
- [x] **거꾸로 `LIKE` 는 같은 인덱스에서 덜 정확하다** — 후보 600행 중 400을 Recheck 이 버린다(정답 200).
      **대소문자 구분 검색에는 pg_bigm 이 낫다**(후보 200, recheck 0)
- [x] **한글에서도 `ILIKE` 는 pg_bigm 인덱스를 죽인다** — 1.05 → 54.00 ms (51배). ORM 의 `icontains` 가
      기본으로 `ILIKE` 를 내보내면 조용히 무시된다. Seq Scan 자체도 `ILIKE` 가 3.6배 비싸다
- [x] **2글자 함정은 `ILIKE` 에도 그대로** — 세 엔진 전부 Seq Scan
- [x] **대안 측정: `lower()` 함수 인덱스** — 1.51 ms 로 trgm 네이티브 `ILIKE`(1.46 ms)와 동등하고
      인덱스가 32 MB 로 더 작다(trgm 54 MB). 대신 질의를 고쳐야 하고 대소문자 구분을 포기한다
- [x] 결정적 지표 2회 실행 전부 동일. 웹 앱에 `#/experiments/ilike` 로 실었고 정정 2건 추가

### M-2. `visualizations/` · `references/` 흡수 후 삭제

- [x] `references/README.md` 에만 있던 **말뭉치 선정 근거와 공용 검색어 표**를 `#/meta/method` 로 옮겼다
      (`클클` 이 `클라우드클럽` 의 부분 문자열이 아니라는 점, 말뭉치 기준 출현 횟수 포함)
- [x] `experiments.html` 에만 있던 **"패턴 효과만 정규화한 차트"와 그 해설**을 `#/experiments/pattern-length` 에 추가
- [x] `week02/corpus.sh` 를 `week02/corpus.sh` 로 옮기고 참조를 갱신
- [x] `references/00`~`06` 과 `README` 의 남은 고유 내용을 전부 확인하고 옮겼다 —
      "아직 확인하지 못한 것" 표(`#/meta/corrections`), `ts_debug` 토큰 종류, `websearch_to_tsquery`,
      Recheck FAQ, 패턴 효과 정규화 차트, 2글자 bigm 대조군(버퍼 504)
- [x] **수치 대조로 검증했다** — 두 디렉터리의 3자리 이상 숫자를 전부 뽑아 `web/src` 에 있는지 기계적으로 확인
- [x] 두 디렉터리 삭제 + 링크 22개 파일 갱신

### M-3. clotho 애니메이션 점검 — 실제로 안 돌고 있었다

- [x] **`web/scripts/check-animations.mjs` 신설** — 7개 문서를 6개 시점에서 장면으로 만들고 SVG 로
      직렬화한다. 빈 프레임과 페이지가 참조하는 id 까지 대조한다 (`bun run check:animations`)
- [x] **버그 발견: 개발 서버에서 애니메이션이 0ms 에 멈춰 있었다.** 문서는 정상인데 재생만 안 됐다 —
      `React.StrictMode` 가 이펙트를 마운트 → 정리 → 재마운트 하는 동안 clotho 플레이어의 스케줄러가
      살아남지 못한다. **프로덕션 빌드에서는 정상**이라 빌드만 확인했으면 놓쳤을 자리다
- [x] `main.tsx` 에서 StrictMode 를 걷어내고 **이유를 주석과 README 양쪽에 적었다** (다시 켜면 애니메이션이 조용히 멈춘다)
- [x] 7개 전부 브라우저에서 재생 확인 — 타임라인이 실제로 전진하고 노드 수가 늘어난다
      (similarity-compare 는 텍스트 1개 → 57개로 쌓인다)
- [x] 플레이어가 **화면 밖에서는 스스로 멈춘다**(`useInView`)는 것도 확인 — 의도된 동작이라 그대로 두고 문서화

## N. 14회차 — 절 참조 · 1글자 근거 · 카메라 · Recheck 비용

### N-1. `§` 기호를 없애고 실제 링크로

- [x] 웹 페이지 12곳의 `§4` 류를 **절 이름 + 실제 이동**으로 바꿨다. `<Ref>` 컴포넌트를 새로 만들었다 —
      같은 페이지면 직접 스크롤하며 주소의 해시도 갱신하고(공유 가능), 다른 페이지면 이동 후 앵커를 찾아간다
- [x] `AppShell` 에 **해시 스크롤**을 붙였다. 페이지가 lazy 라 마운트가 늦어서 잠깐 재시도한다
- [x] **함정**: `scrollIntoView({behavior:'smooth'})` 가 자동화 환경에서 조용히 무시된다 —
      기본 동작으로 바꿔 고쳤고 이유를 주석에 남겼다
- [x] 마크다운 문서 37곳의 `§` 도 절 이름으로 교체 (TODO 의 옛 기록 포함)

### N-2. "정렬돼 있으면 1글자 검색이 된다" 의 근거 — 실험 10 신설

- [x] 애니메이션이 주장만 하고 근거가 없던 자리다. **`experiments/10-one-char-and-partial-match/`** 신설
- [x] **오해부터 걷어냈다** — `show_bigm('클')`/`show_trgm('클')` 은 **둘 다** 조각을 돌려준다.
      그건 색인하는 쪽(`extractValue`)이고, 갈리는 것은 질의하는 쪽(`extractQuery`)이다
- [x] **`pg_opclass`·`pg_amproc` 를 직접 읽었다** — `gin_bigm_ops` 는 엔트리 타입 `text`(opckeytype=0) +
      `gin_bigm_compare_partial` 등록, `gin_trgm_ops` 는 `int4` + **comparePartial 없음**
- [x] 실측: 1글자 `%ퟛ%` → bigm 버퍼 404 / 1.42 ms, 없음 3,225 / 27.1 ms, trgm **Seq Scan**.
      후보 400 = 정답 400, recheck 0
- [x] 사슬 6단계를 GIN 페이지(`#/foundations/gin#sorted`)에 그대로 실었다

### N-3. clotho 카메라 — 장마다 강조

- [x] `@kokoa/clotho` **0.2.0 → 0.4.0** 업그레이드 (camera `tracks`/`focus` 지원). `build.py` 의 스키마 URL 도 갱신
- [x] **함정 하나**: 내용이 캔버스 폭을 거의 다 쓰면 focus 가 가로에 막혀 배율이 1 에 붙는다 —
      즉 아무 일도 안 일어난다. `widen()` 헬퍼로 좌우 여백을 만들어 확대할 여지를 줬다
- [x] **함정 둘**: 아직 등장하지 않은 요소로는 초점을 못 잡는다(`camera-focus` 진단). 그 장의 첫 요소가
      나타난 뒤로 시각을 미루도록 `chapter_focus()` 를 고쳤다
- [x] `gin-structure`(배율 1.63~2.00)와 `btree-vs-inverted`(1.73~2.00)에 적용, 마지막에 전체로 되돌아온다
- [x] **검사기를 확장했다** — 장마다 배율이 붙는지 확인하고, 장면 진단이 하나라도 있으면 실패로 본다

### N-4. B-tree 애니메이션 구체화

- [x] 6장 신설 "교집합은 후보다" — `arterial triage` 로 거짓 양성을 보여주고 Recheck 으로 잇는다 (30초 → 36초)
- [x] 2장에 경계값 계산과 **콜레이션이 C 가 아니면 성립하지 않는다**(`text_pattern_ops`) 를 추가
- [x] 3장에 흩어진 값의 **자모 구간**(ㄱ/ㅋ/ㅋ/ㅎ) 표시 — "흩어진다" 를 눈에 보이게
- [x] 4장에 대가(키가 글자 수 + 1 개) 와 실측 배수 추가

### N-5. "Recheck 도 결국 원문을 읽는 것 아닌가" 에 답하기

- [x] Recheck 페이지에 **비용 절**을 신설. 다섯 갈래로 답한다 —
      ① 후보 행만 읽는다 ② 비용 단위는 행이 아니라 **페이지**다 ③ 비트맵이라 **물리 순서로 정렬해** 읽는다
      ④ 행 하나 확인 비용 자체는 싸다 ⑤ **후보가 전부가 되면 정말로 느려진다**
- [x] 실험 10 이 마침 좋은 증거다 — 후보 400행에 버퍼 404장(거의 행 하나에 페이지 하나).
      주입을 `id % 1000` 으로 흩어 놨기 때문이고, 그래서 손익분기가 어디서 생기는지가 눈에 보인다

## O. 15회차 — 전문검색 대조 · 형태소 분석기 · 다이어그램 · 카메라 재설계

### O-1. 실험 09 에 코어 전문검색(tsvector + GIN) 대조군 추가

- [x] 같은 테이블에 `tsv` 생성 컬럼과 GIN 인덱스를 얹고 **같은 표에서** 쟀다
      (테이블이 커져 Seq Scan 버퍼가 3,226 → 7,488 이 됐다 — 앞선 판과 절대값을 견주면 안 된다)
- [x] **F1** 마커를 낱말로 심어 정답이 600행으로 같아지는 구간 — tsvector 604버퍼/0.70ms vs trgm 622/1.68 vs lower+bigm 622/1.74.
      **버퍼는 같은데 2~3배 빠르다**
- [x] **F2** 한글은 사실상 동률 (204/0.36 vs 216/0.48)
- [x] **F3 가 핵심** — 낱말 *가운데* `%우드클럽%` 에서 tsvector 는 **4버퍼 0.11ms 로 가장 빠른데 0행**을 돌려준다.
      bigm 은 210버퍼 0.49ms 에 200행. **속도를 정답 수와 떼어 읽으면 속는 표**의 실례로 남겼다
- [x] 인덱스 크기도 뒤집힌다 — `gin (tsvector)` 44 MB > `gin_bigm_ops` 35 MB, 게다가 생성 컬럼 비용은 미포함

### O-2. 한국어 형태소 분석기 — 새 페이지

- [x] `#/fulltext/korean-analyzer` 신설. **textsearch_ko(mecab-ko)** · **PGroonga** · **pg_search(ParadeDB)** 셋을 정리
- [x] `textsearch_ko` 가 질문에 정확히 대응한다 — 코어 전문검색을 그대로 두고 **사전만 바꿔 끼운다**
      (`CREATE EXTENSION textsearch_ko; SET default_text_search_config = korean;`)
- [x] **이 페이지는 실측이 아니다**라고 맨 위에 못박았다. 직접 설치해 재보지 않았으므로 성능 수치를 싣지 않는다
- [x] 현실 제약(매니지드 DB · 수퍼유저 권한)을 표로 두고, 붙일 수 없을 때의 선택지로 되돌려 보낸다
- [x] `#/fulltext/tsvector` 와 `#/fulltext/korean-recall` 양쪽에서 연결

### O-3. `#/meta/environment` 삭제

- [x] 페이지·데이터(`data/images.ts`)·레지스트리 항목 제거. 남은 참조 4곳을 다른 곳으로 돌렸다

### O-4. 아스키 다이어그램 → mermaid

- [x] `Diagram` 컴포넌트 신설(mermaid 11, 앱 팔레트로 테마 지정, 렌더 실패 시 원본 텍스트 표시)
- [x] **12개**를 옮겼다 — B-tree 5개(트리 구조 · 접두어 구간 · 흩어진 값 · 저장 단위 뒤집기 · 집합 연산),
      GIN 3개(세 층 구조 · 엔트리 구간 · 검색 흐름), n-gram 3개(추론 사슬 · 희귀함의 연쇄 · 트레이드오프),
      Recheck 1개(`arterial triage` 거짓 양성)
- [x] `EXPLAIN` 출력·SQL·소스 인용은 그대로 코드 블록으로 뒀다 — 그건 다이어그램이 아니다

### O-5. 애니메이션 자동 재생

- [x] 7개 문서 전부 `settings.autoplay = true`
- [x] **함정**: 마운트 시점에 화면 밖이면 "재생 중" 표시만 되고 시간이 0 에 멈춘다.
      `Clotho` 가 **화면에 들어온 뒤에 플레이어를 붙이도록** 고쳤다(IntersectionObserver + 자리 표시자)

### O-6. 1글자 검색 설명 배치

- [x] `pg_trgm` 페이지 제목을 **"짧은 검색어 함정"** 으로 바꾸고 1·2·3글자를 나란히 둔 표를 추가
- [x] 개요 비교표의 "1~2글자" 한 줄을 **1글자 / 2글자 두 줄**로 갈랐다 (trgm 은 둘 다 안 된다)
- [x] `pg_bigm` 구조 페이지에 **"짧은 검색어 — 여기가 존재 이유다"** 절 신설
- [x] 세 곳 모두 "2-gram 이라서가 아니라 **엔트리가 정렬돼 있어서**" 라는 근거로 연결

### O-7. 카메라 재설계 — 배율 고정, 이동만

- [x] 장마다 배율이 달라지던 것을 고쳤다. `chapter_frames()` 가 **모든 장에서 크기가 같은 보이지 않는 틀**을
      만들고 그 틀만 초점 대상으로 삼는다 → 배율이 1.49 로 고정되고 카메라는 위아래로 이동만 한다
- [x] 틀의 가로를 내용 전체 폭으로 고정 — **글자가 옆으로 잘릴 여지를 없앴다**(사용자가 지적한 증상)
- [x] **원인 두 가지를 찾았다** — ① 장 그룹에 요소를 빠뜨려 초점 밖으로 나갔다
      ② 마지막 "전체 되돌아보기" 초점을 두 요소로만 잡아 그 폭에 맞춰 확대돼 옆이 잘렸다
- [x] **틀 rect 의 기본 stroke 가 `#6366f1`** 이라 파란 테두리가 보이던 것도 고쳤다
- [x] 겹치던 본문을 재배치하고 캔버스를 1,060 → 1,170 으로 키웠다
- [x] 검사기에 **배율 일정 검사 · 초점 밖 잘림 검사 · 글자 겹침 검사**를 추가했다

## P. 16회차 — 어휘 다듬기 · 카메라 여백 · 유사도 예시 교체

### P-1. 한글 어휘

- [x] **"정면 비교" → "비교"** — 11개 파일에서 걷어냈다
- [x] **"표면적"(surface area 직역) → "지원하는 기능이 많다 / 지원 범위"** — 8개 파일
- [x] **"값을 치르다" → "대가를 치르다"**
- [x] 과한 표현을 실측에 맞게 낮췄다 — "재앙이다" → "크게 나빠진다", "전멸한다" → "겹치는 조각이 거의 남지 않는다",
      "당했다" → "이 문제를 겪었다", "속는다" → "거꾸로 읽게 된다", "조용히 죽는다" → "조용히 멈춘다"

### P-2. 카메라에 좌우 여백

- [x] 틀 폭을 내용 폭(860)에 딱 맞추던 것을 **좌우 64씩 여백**을 둔 988 로 바꿨다.
      배율 1.49 → **1.30** 으로 내려가고 글자가 화면 가장자리에 붙지 않는다
- [x] `similarity-compare` 에도 같은 카메라를 붙였다 (세 문서 모두 배율 1.30 고정, 이동만)

### P-3. 유사도 예시를 6글자로

- [x] 주 예시를 **`클둥이`→`클동이`(3글자)** 에서 **`클라우드클럽`→`클라으드클럽`(6글자)** 으로 바꿨다.
      3글자는 조각이 4개뿐이라 "원래 조각이 없어서 그런 것" 처럼 읽힌다
- [x] 6글자에서는 **겹친 조각이 5 대 4 로 한 개 차이인데 점수는 0.7143 대 0.4000 으로 벌어진다** —
      조각 수가 아니라 **분모**가 만든 차이라는 것이 드러난다 (자카드는 안 겹친 6개를 전부 분모에 넣는다)
- [x] 3글자 쌍은 **임계값 함정** 장으로 옮겼다 — 0.5000 ≥ 0.3 vs 0.1429 < 0.3 으로 선을 넘는 사례
- [x] 애니메이션(장 5개, 36초) · `#/pg-trgm/similarity` · `#/pg-bigm/korean` 세 곳을 같은 이야기로 맞췄다

### P-4. 자동 재생 — 앞선 판단을 정정했다

- [x] 15회차에 "화면 밖에서 마운트되면 재생이 0ms 에 멈춘다"고 보고 지연 마운트를 넣었는데,
      **원인은 자동화 브라우저의 `document.visibilityState === 'hidden'`** 이었다.
      숨은 탭에서는 `requestAnimationFrame` 도 `IntersectionObserver` 도 돌지 않는다
- [x] 지연 마운트를 **되돌렸다.** IntersectionObserver 가 발화하지 않는 환경에서는 플레이어가 영영 안 붙는다 —
      원래 문제보다 나쁘다. 지금은 바로 붙이고, 화면 밖 정지는 clotho 의 `useInView` 에 맡긴다

## 남은 것 / 후속 과제

작업하며 발견했지만 이번 범위에서 끝내지 못한 것들이다.

- [x] ~~**`pg_bigm/experiments/00` 의 "미해결" 칸**~~ — **재현성 검증에서 해결됐다.** 머신이 유휴인 상태로
      두 번 연속 돌리니 두 실행 모두 정답과 같은 **1,001** 이 나왔다. `CREATE INDEX` 뒤 `VACUUM ANALYZE`
      수정이 옳았고, 직후 실행에서 안 먹힌 것은 다른 실험 컨테이너가 CPU 를 점유한 탓으로 보인다
      (인과는 직접 확인하지 못해 관측 사실만 기록)
- [x] **`pg_trgm/experiments/01` 의 `siglen` 상한** — 256에서 버퍼가 급락했으므로 512·1024
      (`SIGLEN_MAX` 2,024바이트)까지 가보면 최적점이 더 있을 수 있다.
- [x] **GiST `ALLISTRUE` 포화를 직접 관측** — `pageinspect` 로 GiST 페이지를 열어보면 크기·버퍼 거동에서
      추론한 설명을 확정할 수 있다.
- [x] **영문 대조군을 실제 말뭉치로** — `bigm-vs-trgm/experiments/02` 의 영문은 어휘 12개 조합 합성이라
      유니크 조각 수(294)가 비현실적이다. 방향은 맞지만 배수는 믿을 수 없다. **→ J-4 에서 Project Gutenberg 3권으로 교체, 1,937 로 정정.**
- [x] **`04` 를 어휘가 계속 늘어나는 데이터로 다시** — 지금은 말뭉치를 순환 참조해 유니크 조각이
      고정이라 배수 감소가 과장됐다. 행마다 새 어휘가 섞이는 생성기를 쓰면 실제에 가까워진다
- [x] **`05` 의 "접미어가 부분 일치보다 느린 이유"와 "bigm 이 trgm 보다 빠른 이유"** 확인 —
      둘 다 관측에서 추론만 했다
- [x] **선택도 축을 촘촘히** — 지금은 0.1% 와 30% 두 점뿐이다. 1%/5%/10% 를 넣으면 전환점이 선명해진다.
- [x] **`strict_word_similarity`(`<<%`) 의 인덱스 동작**을 `bigm-vs-trgm/experiments/03` 에 추가.
- [x] **`pg_bigm/experiments/01`(빌드 시간·크기)을 실제 말뭉치로 다시** — 합성 데이터로 "차이 5~13%"라고
      적혀 있는데, 말뭉치에서는 25%로 나왔다. 그 실험 자체를 갱신하는 것이 맞다.
- [x] `pg_bigm/experiments/02`(실행 시간)도 같은 이유로 NSMC 말뭉치 + `id` 나머지 주입 방식으로 재작성.

---

## 측정 원칙 (이번 작업에서 정한 것)

`pg_bigm/experiments/02` 가 세 번째 실행에서 결과가 재현되지 않아 분석을 수정해야 했던 경험에서 나온 원칙이다.

1. **벽시계 시간 대신 결정적 지표를 먼저 본다** — `EXPLAIN (ANALYZE, BUFFERS)` 의
   `Bitmap Index Scan` 이 돌려준 `actual rows`, `Rows Removed by Index Recheck`, `Buffers: shared hit`.
   같은 데이터·같은 쿼리면 실행마다 거의 변하지 않는다. 시간은 보조 지표로만 적는다.
2. **난수 대신 `id` 나머지로 검색어를 주입한다** — 실행마다 정확히 같은 비율, 같은 물리적 배치.
3. **선택도를 통제 변수로 명시한다** — 실제 매치 비율을 먼저 재서 기록한다.
4. **정답 행 수를 미리 알고 설계한다** — "인덱스가 후보를 정답까지 좁혔는가"를 판정하려면 정답을 알아야 한다.
5. **README 에는 실제로 스크립트를 돌려 나온 값만 적는다.**
6. **설명되지 않는 값은 설명되지 않는다고 적는다.** 그리고 그렇게 남겨둔 것도 다시 재본다 — `pg_bigm/experiments/00` 의 "미해결" 칸은 재현 검증에서 실제로 해결됐다.
7. **결론을 적기 전에 두 번 돌린다.** 이 원칙 자체가 재현성 검증에서 나왔다 — 실험 6건을 각각 두 번씩
   돌려보니 **GIN 기반 지표는 전부 완전히 동일했지만, GiST 기반 지표는 재현되지 않았다.**

| 지표 | 재현성 |
| --- | --- |
| 플랜 종류(Seq Scan / Bitmap Heap Scan) | **완전히 동일** |
| GIN `actual rows` · `Rows Removed by Index Recheck` · 버퍼 | **완전히 동일** |
| GIN 인덱스 크기 | **완전히 동일** |
| 조각 통계, 유사도 점수, 재현율 | **완전히 동일** |
| **GiST 버퍼** | **±5% 흔들린다** (KNN `LIMIT 1` 은 65~230 으로 3.5배) |
| **GiST 인덱스 크기** | 대체로 안정적이나 한 칸에서 10% 튀었다 |
| 실행 시간 | 머신 부하에 따라 최대 2배 |

**GiST 인덱스 빌드가 완전히 결정적이지 않다** — 데이터 삽입 순서를 `generate_series` 값으로 고정해도
페이지 분할 결과가 실행마다 조금씩 달라진다. 그래서 GiST 수치는 **범위로 적고, 자릿수 차이만 해석한다.**


## 측정 과정에서 실제로 걸린 함정 (재현하려는 사람을 위해)

- **`CREATE INDEX` 뒤에 `VACUUM` 을 안 하면 죽은 튜플이 인덱스에 남아 후보 수가 부풀려진다.**
  죽은 튜플은 가시성 검사에서 조용히 걸러지므로 `Rows Removed by Index Recheck` 에도 안 잡힌다.
- **`EXPLAIN ANALYZE` 노드 줄 형식이 `TIMING` 설정에 따라 다르다** —
  `TIMING ON`: `(actual time=1.2..3.4 rows=200 loops=1)` / `TIMING OFF`: `(actual rows=200 loops=1)`.
- **`psql -tAc "SET ...; SELECT ..."` 는 `SET` 의 명령 태그까지 출력한다** → `| tail -1`.
- **`VACUUM` 은 트랜잭션 블록 안에서 못 돈다** → `psql -c` 를 나눠야 한다.
- **정답 행을 `LIKE` 로 골라내면 말뭉치가 섞인다** → `id` 로 특정할 것.
- **`word_similarity` 는 피연산자 순서가 인덱스 사용 여부를 바꾼다** →
  `doc %> '검색어'`(= `'검색어' <% doc`) 여야 하고, `doc <% '검색어'` 는 `Seq Scan` 이다.

## Week 03 보강 · 2026-09-15

- [x] pg_stat_statements 자료를 week04로 이동하고 카탈로그 링크 수정
- [x] 웹에 주차 선택과 주차별 이전/다음 이동 추가
- [x] pg_cron 사용·소스 분석·운영 페이지 추가 (v1.6.7 기준)
- [x] Clotho 실행 흐름·초 간격 동시성 시각화 추가
- [x] SPI 실행 및 worker 속도 단정 설명 정정

## pg_cron 활용 리서치·추가 실험 · 2026-09-15

- [x] 공식 문서 기반 활용 예제 6가지와 설치 전제·실행 보장 경계 정리
- [x] 실험 03: 3개 조건 × 2회 · 직렬화/동시 상한/접수 구간 처리량 측정
- [x] 한도 2 정체의 원본 보존 및 원자적 등록으로 추가 진단 2회
- [x] 실험 04: SKIP LOCKED 소비자 2개·40항목 및 강제 예외 롤백 2회 검증
- [x] 웹 활용·실험 페이지 및 원본에서 생성한 차트 데이터 추가
- [ ] 정체 원인 가설의 패치 전후 검증 (관찰과 가설은 실험 03에서 분리 기록)

## Week 03·04·웹 전체 점검 · 2026-09-15

- [x] 10개 lab 최초 실행과 SQL/API 재실행, 수동 SQL 가이드 8개 검증
- [x] 모든 lab에 LESSON.md 및 run.sh explain, 자동 실행 해설 추가
- [x] cron 접속 인증·실행 시간 측정 경계·취소 의미와 pgss 통계 해석 정정
- [x] 실험 진입점 7개 실행, 과거 수치와 별도 검증 로그 보존
- [x] 활용 SQL 3종, preload 누락 경로, 가이드의 N+1 개선 함수 실제 DB 확인
- [x] 웹 38페이지·모바일 주차 전환·내부 링크·Clotho 9개·production build 검증
- [x] 검증 스크립트와 원본 로그를 verification/에 정리

검증 도구와 실행 로그는 로컬 scripts/·verification/에 보관하며 Git에서 제외한다. 공유할 실험 근거는 각 experiments/의 README와 results/를 기준으로 한다.

## Week 04 · hstore + pg_stat_statements 이동 · 2026-09-21

- [x] pg_stat_statements 자료를 `week04/`에서 `etc/pg_stat_statements/`로 이동하고 링크(`../README.md`, `web/README.md`)·회차 표기 수정
- [x] hstore 소스 분석(REL_16_15 `contrib/hstore`, 파일 blob 해시 고정) — `web/src/data/hstore-source.json`
- [x] Docker 실습 4개(설치·문법 / 저장 구조 / 인덱스 / 동시성): 모두 `./run.sh`로 실행하고 assertion으로 판정 검증
- [x] 실험 5종(저장 크기 3회 · 갱신 5회 · 인덱스 5회 · 동시성 10회 · Redis 비교 5회) 실행, 웹 요약 게시
- [x] 웹 Week 04 섹션 13페이지 + Clotho 7개(저장 구조·갱신 재기록·GIN 조회·유실 갱신·Redis 경로·압축 차이·jsonb 타입)
- [x] 카탈로그 `hstore.md`, `week04/hstore/README.md`, 실험 README 5개
- [x] 측정 중 바로잡은 것 9건 기록 (웹 `실험` 페이지 4절)
- [ ] 브라우저(실제 렌더) 확인 — Chrome 확장이 로컬 서버에 접근하지 못해 못 했다. typecheck·build·SSR 스모크 13페이지·Clotho 검사로 대체
- [ ] Supabase·Aurora의 hstore 지원 여부 공식 문서 확인
- [ ] 압축 차이의 원인을 hstore 바이트를 직접 바꿔 검증(현재는 합성 데이터 대조까지)
