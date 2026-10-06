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
- [x] 웹 Week 04 섹션 14페이지 + Clotho 7개(저장 구조·갱신 재기록·GIN 조회·유실 갱신·Redis 경로·압축 차이·jsonb 타입)
- [x] 카탈로그 `hstore.md`, `week04/hstore/README.md`, 실험 README 5개
- [x] 측정 중 바로잡은 것 9건 기록 (웹 `실험` 페이지 4절)
- [ ] 브라우저(실제 렌더) 확인 — Chrome 확장이 로컬 서버에 접근하지 못해 못 했다. typecheck·build·SSR 스모크 13페이지·Clotho 검사로 대체
- [ ] Supabase·Aurora의 hstore 지원 여부 공식 문서 확인
- [ ] 압축 차이의 원인을 hstore 바이트를 직접 바꿔 검증(현재는 합성 데이터 대조까지)

## Week 04 · hstore 후속 보강 · 2026-09-22

- [x] trusted 확장 조사(control 파일 `superuser`/`trusted` 파라미터, PUBLIC 기본 권한, 소유권 분리) + `#/hstore/trusted` 신규 페이지. 비슈퍼유저 role로 실제 CREATE EXTENSION 성공/거절, 확장-내부객체 소유권 분리를 DB에서 직접 검증
- [x] 저장 방식 페이지에 pglz 압축 임계값(`min_comp_rate=25%`, `first_success_by=1024B`, `src/common/pg_lzcompress.c`)로 K=100은 압축되고 K=500은 안 되는 이유를 수치로 직접 연결
- [x] 동시성 페이지 라벨 정리: "성공한 UPDATE"(SQL 오류 없음)와 "남은 키"(실제 반영)가 다른 숫자라는 걸 표·캘아웃으로 명시, KEY_LABEL 문구 통일, 차트 다중 줄 라벨 배열로 수정
- [x] hstore_docs.py의 중앙값 반올림을 JS Math.round와 일치시킴(Python `:.0f`의 은행가 반올림 때문에 62.5가 62/63으로 페이지와 애니메이션에서 다르게 보이던 문제)
- [x] jsonb 대비 hstore 실제 강점 재정리: `pg_opclass` 전수 조회로 jsonb는 코어에 GiST가 없음을 확인(hstore만 btree·hash·GIN·GiST 4종 전부) → VsJsonb·WhenToUse·Indexes 페이지에 근거로 반영
- [ ] 브라우저 실제 렌더 확인은 이번에도 못 함(로컬 서버 접근 불가는 동일) — typecheck·build·SSR 스모크 14페이지·애니메이션 17개 검사로 대체

## Week 04 · hstore 실무 사용처 · CRUD 액션 · 차트 해설 · 2026-09-23

- [x] hstore 실무 사용처 추가 조사: Rails `ActiveRecord::Store`/`PostgreSQL::OID::Hstore`, Django `HStoreField`가 코어에 있음을 공식 문서·소스로 확인, osm2pgsql 공식 문서의 `--hstore`/`--hstore-column`, `hstore_translate` 계열(여러 독립 포크)로 필드별 다국어 번역 패턴 확인 → `#/hstore/use-cases` 신규 페이지
- [x] CRUD 액션 페이지(`#/hstore/actions`) 신규: 조회(단일/복수 키·존재확인·필터·역참조·unnest·집계)·삽입(리터럴/JSON 변환)·수정(병합 `||`·UPSERT·키 이름변경)·삭제(키/값조건/접두사/전체 비우기) 22개 예제를 전부 실제 DB 실행 결과로 구성 + 지원/미지원(우회 필요) 요약표
- [x] "한 테이블에 여러 hstore 컬럼을 쓸 일이 있나" 질문에 근거로 답변: 감사로그 diff(`attrs - attrs_prev`)와 필드별 다국어 번역 두 실무 패턴을 실제 실행 결과로 제시, GIN 인덱스는 컬럼마다 별도로 필요하다는 비용도 캘아웃으로 명시 (UseCases 페이지 `#multi`)
- [x] 차트 5개(Storage 저장크기·Indexes 쿼리시간·Updates WAL·Concurrency 유실키수/TPS·VsRedis 쓰기처리량)에 `ChartNotes` 컴포넌트로 "이 막대/선이 옆보다 왜 크거나 작거나 비슷한지"를 원본 실험 수치로 설명하는 문단 추가
- [x] typecheck·`bun run check`(애니메이션 17개·내비게이션 68페이지·cron/hstore 데이터)·build·SSR 스모크 16페이지·`<Ref>` 앵커 전수 검증 모두 통과
- [ ] 브라우저 실제 렌더 확인은 이번에도 못 함(로컬 서버 접근 불가는 동일) — typecheck·build·SSR 스모크·내비게이션 검사로 대체

## Week 04 · trusted 확장의 유래 · GiST·GIN 내부 구조 · 카탈로그 재정리 · 2026-09-28

- [x] "trusted 확장이 왜 생겼나" 조사: PL만 `pg_pltemplate`(하드코딩된 카탈로그)으로 누리던 "슈퍼유저 없이 설치" 특례가, `CREATE EXTENSION`(PG 9.1)이 생긴 뒤에도 C 함수를 만드는 확장(hstore 등)에는 퍼지지 않았던 이유(`superuser=false`는 스크립트에 슈퍼유저 전용 명령이 없을 때만 통함)를 실제 커밋(`50fc694e`, Tom Lane, 2020-01-29)과 제안 스레드(pgsql-hackers, 2019-08-21)로 확인 → Trusted 페이지에 "7. 왜 생겼나" 절 신규(기존 7절은 8절로 밀림)
- [x] GiST·GIN 인덱스 구조 자체를 다루는 신규 페이지(`#/hstore/gist-gin-internals`): 공식 문서(GiST/GIN Extensibility·Implementation)의 지원 함수 정의 + hstore의 실제 구현(`ghstore_compress`·`ghstore_union`·`ghstore_penalty`·`ghstore_consistent`, PostgreSQL REL_16_15 소스에서 직접 발췌)로 GiST(경계 술어 트리·손실 가능)와 GIN(역색인·posting list)이 왜 다른 것을 저장하는지, hstore GiST가 왜 모든 전략에서 무조건 recheck인지(`ghstore_consistent`의 "All cases served by this function are inexact" 주석), jsonb에는 왜 아직 GiST가 없는지(확인된 사실과 추정을 구분)까지 정리. WhenToUse·Source 페이지에서 교차 링크, foundations/gin·recheck 페이지와도 상호 참조
- [x] `extract-hstore-source.py`에 GiST 지원 함수 발췌 4개 추가(8→12개), `hstore-source.json` 재생성
- [x] 카탈로그 문서(`hstore.md`) 전면 재정리: "실무에서 쓰는 곳"(3절) 신규 추가, "설치" 절에 trusted 유래 요약, "내부 동작 원리" 절에 GiST·GIN 지원 함수 내용 보강, 참고 링크에 커밋·메일링리스트·공식 GiST/GIN 문서·신규 페이지 링크 추가
- [x] typecheck·`bun run check`(애니메이션 17개·내비게이션 69페이지·cron/hstore 데이터)·build·SSR 스모크 17페이지·`<Ref>`(hstore·foundations 교차 링크 포함) 앵커 전수 검증 모두 통과
- [ ] 새 mermaid 다이어그램 2개(GiST 트리·GIN 역색인)는 문법을 기존 통과 사례와 대조해 검토했지만, 로컬 mermaid 파서 실행이 DOMPurify(브라우저 전용 API) 의존성 때문에 이 환경에서 막혀 실제 렌더는 못 봄 — 브라우저 접근 불가는 이전 회차와 동일한 제약
- [ ] jsonb에 GiST 연산자 클래스가 없는 "이유"는 core에 없다는 사실만 확인했고, 왜 아무도 구현하지 않았는지의 공식 근거는 못 찾음 — 페이지에도 추정임을 명시

## Week 04 · GiST 서명 애니메이션 · 2026-09-28

- [x] "본문만으로는 이해가 안 간다"는 피드백에 새 Clotho 애니메이션(`hstore-gist-signature`, 6장·49.5초) 추가: hstore GiST가 실제로 쓰는 CRC-32(`hstore_gist.c`의 `INIT_TRADITIONAL_CRC32`)로 계산한 진짜 비트 위치로 compress(해시→비트)·union(OR 병합)·질의(비트 매칭)·recheck(행 3 decoy 탈락)를 16비트 서명 스트립으로 시각화. GIN 조회 애니메이션과 같은 4행을 써서 같은 decoy가 두 구조 모두에서 왜 후보가 되는지 직접 비교되게 만듦
- [x] `hstore-gist-signature.json`은 `bun scripts/check-animations.mjs`의 글자-겹침 검사에서 처음 실패(질의 후보 라벨이 마지막 비트 칸과 겹침) → 좌표 수정 후 재검증 통과
- [x] GistGinInternals 페이지의 추상적인 mermaid 다이어그램 2개를 이 새 애니메이션과 기존 `hstore-gin-lookup` 애니메이션으로 교체 — 정적 도식보다 단계별로 실제 계산 과정을 보여주는 쪽을 택함
- [x] typecheck·`bun run check`(애니메이션 18개 전부 페이지에서 사용됨·내비게이션 69페이지)·build·SSR 스모크 통과

## Q. 17회차 — week05 pgvector·pgvectorscale 기본 자료 · 2026-10-02

요청: "기본적인 자료부터 만들어주세요" — `TEMPLATE.md` 형식의 기본 카탈로그 문서 작성 단계 (labs·experiments·web 은 이후 회차)

- [x] `catalogs/shinkeonkim/pgvector.md` 작성 — `pgvector/pgvector:pg16`(0.8.7), `timescale/timescaledb-ha:pg16` 번들(0.8.6) 두 이미지를 직접 Docker로 띄워 거리 연산자(`<->`/`<#>`/`<=>`/`<+>`) 실행 결과·HNSW 인덱스 생성·`pg_opclass` 타입별 연산자 클래스 목록을 실제로 확인
- [x] `catalogs/shinkeonkim/pgvectorscale.md` 작성 — `timescaledb-ha:pg16`에서 vectorscale 0.9.1 확인, DiskANN 인덱스 생성(`NOTICE`로 `num_neighbors`/`search_list_size`/`max_alpha`/`SbqCompression` 직접 확인), `pg_opclass`로 `vector_smallint_label_ops`(라벨 필터링용) 존재 확인
- [x] **trusted 여부를 직접 재현** — `vector.control`·`vectorscale.control` 모두 `trusted` 선언이 없어 기본값 false. 별도 DB에 비슈퍼유저 role을 만들어 `CREATE EXTENSION vector;`가 `permission denied... Must be superuser`로 거절되는 것을 확인 (hstore trusted 조사와 같은 방식)
- [x] 매니지드 DB 지원 여부를 웹 검색(2026-10 기준)으로 조사 — pgvector는 RDS/Aurora/Supabase/Neon/Cloud SQL 모두 지원, **pgvectorscale은 Timescale Cloud 외 전부 미지원**(RDS·Aurora·Supabase·Neon·Cloud SQL 확장 목록에 없음). 콘솔에서 직접 설치해 재현하지는 않았다고 문서에 명시
- [x] `catalogs/README.md`·`catalogs/shinkeonkim/README.md` 목록에 반영 (week05)
- [x] week05 Docker 실습(`labs/`)·성능 실험(`experiments/`) 완료 (아래 R절 참고). 웹 자료는 여전히 다음 회차 과제

**작업 중 생긴 일(환경)**

- Docker 데스크톱 디스크가 일시적으로 꽉 차 데몬이 죽었다(호스트 디스크가 순간 100%까지 찼다가 자동으로 회복, 460GB 중 가용 121Mi → 48Gi → 151Gi로 변동). `open -a Docker`로 재기동해 복구하고 검증을 이어갔다 — 재현 조건은 특정하지 못했다

## R. 18회차 — week05 실험·실습·개요 · 2026-10-04

요청: (1) 자료 검증 및 실험이 필요한 부분을 찾아 lab 구성 (2) 가설 검증·실측 전부 기록 (3) pgvector·pgvectorscale이 왜 필요한지, 장단점, 실무 케이스를 리서치해 정리 (4) 개요 페이지로 큰 그림 제공

### R-1. 실험 인프라

- [x] `week05/experiments/runtime/`(compose.yaml + harness.py) 신설 — week04 hstore 실험과 같은 패턴. `timescale/timescaledb-ha:pg16`(vector 0.8.6 + vectorscale 0.9.1 + timescaledb 2.30.2, digest 고정) 하나로 두 확장을 동시에 실험
- [x] `hnsw.ef_search`·`ivfflat.probes`·`diskann.query_search_list_size`·`diskann.query_rescore` 등 런타임 GUC가 **확장 라이브러리가 그 세션에 로드된 뒤에만** `pg_settings`에 나타난다는 것 확인 (`LOAD 'vector'`/`LOAD 'vectorscale-0.9.1'` 필요 — pgrx 빌드라 `.so` 파일명에 버전이 붙는다)

### R-2. 실험 3종 (가설 검증 + 실측)

- [x] **실험 01 · recall vs 튜닝** — HNSW/IVFFlat/DiskANN 질의 시점 파라미터 스윕, ground truth 전수 대조로 recall@10 직접 계산, 2회 반복
  - **버그 둘을 겪고 고쳤다**: ① 128차원 균등분포 난수만 쓰면 "차원의 저주"로 모든 거리가 수렴해 최근접 이웃이 정의되지 않음(recall이 0.0/1.0으로 "너무 깔끔하게" 나온 게 신호였다) → 질의마다 진짜 근접점을 주입해 해결. ② 스칼라 서브쿼리 `(SELECT array_agg(random())...)`가 InitPlan으로 한 번만 평가돼 5만 행이 전부 같은 벡터가 됨(HNSW 자기 자신 질의로 발견) → cross join + GROUP BY로 해결
  - 결과: HNSW·IVFFlat은 파라미터↑ → recall↑·비용↑ 가설대로. **DiskANN은 가장 싼 설정에서도 이미 recall@10=1.0**(이 규모에서는)
- [x] **실험 02 · 빌드 비용·크기** — 20,000/100,000/300,000행에서 세 인덱스 빌드 시간·크기(테이블 대비 비율)
  - 크기 비율은 행 수 15배 구간에서 거의 고정(HNSW 1.37×, IVFFlat 0.91×, **DiskANN 0.79×로 항상 최소**)
  - 빌드 시간은 DiskANN이 압도적으로 느리고 격차가 행 수와 함께 벌어짐(HNSW 대비 11.4배→17.4배, IVFFlat 대비 110배→411배) — 65,536행 병렬 빌드 전환점을 넘겨도 개선 안 됨
- [x] **실험 03 · SBQ 압축(memory_optimized vs plain)** — `storage_layout=plain`(압축 끄기) 빌드가 **이 환경(RAM 3.8GiB)에서 서버 프로세스를 죽였다**(OOM 추정, dmesg로 직접 확인은 못함). 직전 같은 규모의 기본값 빌드는 정상 완료했다. 가설(recall/버퍼 트레이드오프)을 검증하기 전에 더 강한 결과(빌드 자체가 안 됨)를 얻었다 — `bench.py`에 중간 저장을 추가해 크래시해도 결과가 남게 고쳤다
- [x] 옵션 이름(`storage_layout = plain/memory_optimized`)과 빌드 로그 표시 이름(`Plain`/`SbqCompression`)이 다르다는 것 발견 — 로그만 보고 옵션값을 추측하다 `ERROR: Invalid storage type`을 직접 겪었다

### R-3. Docker 실습 3개

- [x] `week05/pgvector/labs/01-install-and-distance-ops` — trusted 여부(`pg_available_extension_versions`), vector/halfvec/sparsevec/bit 4타입, 거리 연산자 6종, HNSW/IVFFlat 생성과 `pg_opclass`
- [x] `week05/pgvector/labs/02-hnsw-vs-ivfflat` — IVFFlat을 빈 테이블에 먼저 만드는 함정 재현(공식 문서 경고) — **크기로는 안 드러나고 recall만 나빠진다**는 것을 직접 확인(두 경우 인덱스 크기가 같게 나옴)
- [x] `week05/pgvectorscale/labs/01-install-and-diskann` — vector·vectorscale 모두 trusted 아님 확인, DiskANN 빌드 NOTICE 해석, **라벨 기반 필터링**(`vector_smallint_label_ops`, pgvector HNSW/IVFFlat에는 없는 기능)을 실제로 실행 — 전역 최근접 이웃이 다른 라벨에 몰려 있어도 지정 라벨만 정확히 반환하는 것 확인
- [x] 포트 16000·16001·16010 신규 할당, 전수 충돌 검사(0건), 모든 `run.sh`/`bench.py` 구문 검사 통과, 상대 링크 17개 파일 전수 검증(깨진 링크 0개 — 처음엔 상대 경로 깊이를 여러 번 잘못 세서 고쳤다)

### R-4. 리서치 (왜 필요한가·장단점·실무 케이스)

- [x] AWS 공식 블로그("Running pgvector in production on Amazon Aurora PostgreSQL")에서 HNSW/IVFFlat 선택 기준, `hnsw.iterative_scan`(필터링 검색 시 후보 부족 문제와 해법), 메모리·인스턴스 가이드 추출
- [x] Timescale(TigerData) 자사 블로그의 pgvector vs Qdrant 벤치마크(5천만 행·768차원) 확인 — 수치와 함께 **벤더 자체 벤치마크라는 한계**(파라미터 튜닝 비대칭, 수평확장 평가 제외)를 명시해서 인용
- [x] 매니지드 DB 지원 현황 재확인: pgvector는 RDS/Aurora/Supabase/Neon/Cloud SQL 전부, **pgvectorscale은 Timescale Cloud 외 전부 미지원**(2026-10 기준)
- [x] SEO 블로그 집계(markaicode, bigdataboutique 등)의 구체적 수치(예: "Ring 사가 1~2천억 임베딩 운영")는 출처를 검증할 수 없어 인용하지 않기로 결정 — 1차 출처(AWS, 제작사 블로그)만 수치로 인용

### R-5. 개요 페이지

- [x] `week05/README.md` 신설 — Before/After, pgvector vs pgvectorscale 비교표, 장단점(실측+1차출처 구분), 실무 결정 기준, 실험 3종 요약표, lab 3개 목록, 한계
- [x] `pgvector.md`·`pgvectorscale.md`의 "6. 벤치마크" 절을 실측값으로 교체, 트레이드오프 절에 `hnsw.iterative_scan`·IVFFlat 빌드 순서·SBQ 크래시 반영, 참고 링크에 week05 연결
- [x] `catalogs/shinkeonkim/README.md` 실습과 실험 표에 week05 개요 링크 추가

## S. 19회차 — week05 실험 문서 구조 보강 · 후속 실험 2종 · 2026-10-04

요청: (1) 각 실험 문서에 "왜 이 실험이 필요했는가"(당위성)를 명시하고 가설·검증 결과를 정확히 구분해서 밝힐 것 (2) 추가로 파볼 만한 주제 제안 후 진행

### S-1. 실험 01~03 문서 구조 보강

- [x] 세 실험 README 모두에 **"왜 이 실험이 필요했는가"** 절 신설 - 카탈로그 문서의 어떤 미실측/추정 서술을 검증하려는 것인지 구체적으로 명시
- [x] 가설을 H1/H2 형식으로 정확한 문장으로 다시 쓰고, 결과 표 다음에 **"가설 검증"** 절을 신설해 채택/기각/부분채택/검증불가를 표나 명시적 문장으로 밝힘 (예: 실험 01 - HNSW·IVFFlat 채택, DiskANN은 천장 효과로 기각)
- [x] "해석" 절에서 "가설 검증"과 중복되는 서술을 정리해 같은 내용을 두 번 말하지 않게 함
- [x] `week05/README.md`의 실험 요약표에 "왜 필요했나"·"가설 검증" 열 추가

### S-2. 실험 04 — 실험 03 크래시의 재현성 (제안한 후속 주제 중 1번)

- [x] 행 수 bisection(30,000/40,000/45,000/48,000/51,000) + `maintenance_work_mem` 스윕(1/2/3GB) + 실험 03과 동일한 빌드 순서 재현, 총 9회 시도, `docker stats`로 피크 메모리 직접 폴링
- [x] **9번 전부 성공 — 크래시가 재현되지 않았다.** 피크 메모리도 최대 402MB로 한도(1~3GB, 3.8GiB)에 전혀 못 미쳤다
- [x] **정정**: 실험 03·`pgvectorscale.md`·`week05/README.md`에 적었던 "SBQ 압축이 없으면 이 환경에서 빌드 자체가 안 될 수 있다"는 결론을 전부 철회하고, "그 순간의 단발성 사건으로 추정, 원인 미특정"으로 되돌림 - pg_trgm의 "siglen 48→64 반등 철회"와 같은 종류의 정정
- [x] 세 문서(실험 03 README 상단에 정정 박스, `pgvectorscale.md` 6절·내부 동작 원리절, `week05/README.md` 장단점·실험 표) 모두 동기화해서 고침

### S-3. 실험 05 — halfvec vs SBQ 압축 (제안한 후속 주제 중 3번)

- [x] 같은 데이터(실험 01과 동일 시드)에서 `vector`+HNSW / `halfvec`+HNSW / `vector`(SBQ)+DiskANN 세 설정을 직접 비교
- [x] H1(크기: SBQ < halfvec) **채택** - SBQ 23.5MB < halfvec 27.8MB < float4 40.5MB, halfvec이 이미 압축 격차의 약 2/3을 커버
- [x] H2(recall: halfvec 손실이 SBQ보다 적을 것) **기각** - 오히려 DiskANN이 recall 1.000으로 가장 높았다. HNSW 빌드 비결정성 + DiskANN의 기존 확인된 천장 효과가 뒤섞여 "압축이 recall에 주는 순수한 영향"을 이 설계로는 분리 못 한다는 것까지 명시
- [x] H3(halfvec 빌드가 float4만큼 빠를 것) **기각** - 오히려 84% 더 느렸다(원인 미확인)
- [x] `pgvector.md`·`pgvectorscale.md`·`week05/README.md`에 halfvec 비교 수치와 "메모리를 줄이려면 halfvec부터" 가이드 반영

### S-4. 보류했던 후속 주제 — 전부 진행

- [x] pgvectorscale GUC `short_desc` 깨짐(`\x13` 등) - lab README에 한 줄로 기록 (실험까지는 안 함)

## T. 20회차 — 보류 주제 마무리: 규모·필터링 실험 2종 · 2026-10-05

요청: "잔여 작업 진행" - S-4에 보류해둔 두 후속 주제를 마무리

### T-1. 실험 06 — DiskANN recall 우위는 300,000행에서도 보이는가

- [x] 실험 01과 같은 생성 방식(배경 + 질의당 근접점 20개)을 300,000행으로 확장, 빌드 비용 때문에 파라미터는 "가장 싼 값"·"중간값" 2단계로 줄여 1회만 실행
- [x] **H1(DiskANN도 규모가 커지면 recall<1.0으로 떨어질 것) 기각** - `query_search_list_size=10`에서도 recall@10=1.000, 51,000행과 완전히 동일
- [x] **H2(그래도 DiskANN의 싼 설정이 HNSW·IVFFlat의 싼 설정보다 나을 것) 채택, 격차가 두 배 넘게 벌어짐** - HNSW `ef_search=10`은 0.63→**0.216**, IVFFlat `probes=1`은 0.54→**0.286**으로 떨어졌는데 DiskANN은 그대로 1.000
- [x] 빌드 시간·크기가 실험 02(같은 300,000행)와 거의 정확히 일치(597.4초 vs 583.2초, 138.3MB vs 137.9MB) - 서로 다른 실행 간 교차 확인
- [x] `pgvector.md`·`pgvectorscale.md`·`week05/README.md`에 반영 - "51,000행의 포화가 작은 규모의 착시가 아니라, 규모가 커질수록 더 뚜렷해지는 패턴"으로 결론 수정

### T-2. 실험 07 — 라벨 필터링의 비용(과 정확성)

- [x] 10개 라벨 × 5,000행(50,000행, 32차원), 질의는 라벨 1 근처인데 필터는 가장 먼 라벨 10으로 거는 가혹한 시나리오 설계
- [x] DiskANN 네이티브 라벨 필터링 vs HNSW + `WHERE` + `hnsw.iterative_scan ∈ {off, relaxed_order, strict_order}` 비교
- [x] **가설(둘 다 정확하고 DiskANN이 더 싸다)이 전제부터 깨짐** - HNSW는 **모든 iterative_scan 설정에서 0/10**(추가로 `hnsw.max_scan_tuples`를 기본값 10배인 200,000까지 올려도 여전히 0/10 - 직접 재확인), DiskANN은 10/10. `enable_indexscan=off` 강제 Seq Scan으로 정답(10행)이 실제로 존재함을 확인
- [x] 해석: AWS 가이드의 `iterative_scan` 권장은 "후보가 근처에는 있지만 부족한" 상황을 겨냥한 것이고, "필터를 통과하는 후보가 그리디 탐색 경로 바깥의 완전히 분리된 영역에 있는" 더 가혹한 상황에는 안 통한다는 것을 직접 확인·명시
- [x] `pgvector.md`(필터링 주의 문단)·`pgvectorscale.md`(트레이드오프 "이럴 때 쓴다", 6절)·`week05/README.md`(장단점, 실무 결정 기준)에 전부 반영

### T-3. 문서 동기화

- [x] `week05/experiments/README.md`·`week05/README.md` 실험 요약표에 06·07 추가, 01↔06·03↔04 관계처럼 서로 참조하게 링크
- [x] 상대 링크 21개 파일 전수 재검증(깨진 링크 0개), 모든 `bench.py` 구문 검사, 컨테이너·볼륨 정리 확인

## U. 21회차 — week05 전체 검수(어색한 문구·맥락 단절·갱신 누락) · 2026-10-05

요청: "week05에 대해서만 보강할 요소가 있는지, 문구가 어색하게 쓰인 것은 없는지, 설명이 부족한 부분이나 맥락의 연결 없이 막 쓰인 문단은 없는지 검수" - 21개 markdown 파일(카탈로그 2개 + week05 전체) 전수 재독

- [x] **pgvectorscale lab의 README·HANDS-ON이 실험 04의 철회 이전 서술을 그대로 두고 있었다** - "이 환경에서는 서버가 죽을 수 있다"고 **단정**한 채였다(실제로는 9번 재현해 9번 다 성공). 둘 다 "9번 재현했지만 죽지 않았다"로 교체 - 되돌리는 패스에서 놓쳤던 것을 이번에 잡았다
- [x] **실험 01의 "DiskANN이 왜 이렇게 좋은가" 질문이 실험 02를 가리키고 있었다** - 하지만 02는 빌드 비용·크기만 재고 recall은 재지 않는다. 실제로 그 질문에 답한 것은 이후에 만든 실험 06이다 - 참조를 06으로 교체
- [x] **`week05/README.md`가 "세 실험 모두"라고 적어뒀는데 표에는 일곱 개가 있었다** - 01~03만 있던 시점에 쓴 문장을 04~07을 추가하면서 갱신하지 않은 것. "일곱 실험 모두"로 고치고, 실험마다 당위성이 다르다는 것(1차 출처 메우기 vs 앞선 실험의 공백 메우기)도 구분해서 적음
- [x] 같은 문서의 "각 실험 README의 '측정 중 겪은 함정'"도 과장이었다 - 그 절은 실험 01에만 있다. 01을 지목하고 "이후 실험은 한계 절에 적었다"로 정정
- [x] **lab 02의 HANDS-ON.md가 자동 스크립트에서만 만들어지는 테이블(`proper_ivfflat`)을 수동 실습에서 그대로 참조하고 있었다** - 수동 실습만 따라가면 그 테이블이 없다. 수동 실습이 직접 만든 테이블(`t`)을 쓰도록 교체, 정확한 비교가 필요하면 자동 스크립트를 먼저 돌리라고 안내 추가
- [x] 상대 경로 깊이를 고치는 sed 작업에서 **링크의 표시 텍스트와 실제 href가 어긋난 자리 3곳**(lab 3개의 HANDS-ON.md "종합 문서" 링크) 발견 - href만 고쳐지고 표시 텍스트는 옛 경로로 남아있었다. 표시 텍스트도 맞춰 고침
- [x] 실험 06의 "수색 공간" → "탐색 공간" (오타성 단어 선택)
- [x] 실험 03·04의 "크래시가 재현되지 않았다"는 같은 내용이 결과·가설검증·해석 세 절에서 거의 그대로 세 번씩 반복되고 있었다 - 가설검증은 H1/H2 판정으로, 해석은 왜 그런지의 설명으로 역할을 나눠 중복 제거. 실험 03은 "자세한 내용은 실험 04를 본다"로 한 곳만 가리키게 정리
- [x] `pgvector.md` 6절(벤치마크) 서두가 "51,000행 기준"이라고 했지만 표에는 20,000~300,000행 구간·50,000행 등 다른 규모 행도 있었다 - "기본 규모 + 바뀐 조건은 행마다 표시"로 교체. 참고 조건 목록에 실험 05·06·07이 빠져 있던 것도 추가
- [x] `pgvector.md` 3절에서 "iterative_scan 권장이 안 통하는 경우"와 "IVFFlat 빌드 순서 문제"가 서로 다른 주제인데 한 문단에 붙어 있던 것을 분리
- [x] `pgvectorscale.md` 6절의 중복 인용(본문에 "(실험 04)"를 적어놓고 문서 맨 아래 참고 조건 목록에는 실험 04·05가 빠져 있던 불일치) 정리 - 인라인 인용 제거, 목록에 04·05 추가
- [x] 위 수정 전부 반영 후 상대 링크 21개 파일 재검증(깨진 링크 0개)

## V. 22회차 — week05 웹 자료 · 실험 07 데이터 정정 · 2026-10-05

요청: "web05에 대한 내용을 web/ 내에서 다른 주차와 마찬가지로 자료를 구성" - week02~04와 같은 형식(registry 섹션·페이지·실측 JSON·Clotho·차트·검사)

- [x] **실험 07 첫 판의 데이터가 5만 행 중 서로 다른 벡터 10개였다** - 실험 01에서 기록해 둔 InitPlan 함정(스칼라 서브쿼리 1회 평가)을 생성 SQL에서 다시 밟았다. 웹으로 옮기며 데모 출력을 보다가 HNSW가 필터 없이도 약 480행에만 닿는 것을 보고 발견. cross join 생성으로 다시 재고 결론 교체: 기본값 0행(유지) · `relaxed_order`는 10행을 채움(첫 판은 "어떤 설정도 0행") · DiskANN 라벨 인덱스가 같은 10행을 약 9배 싸게, 결과는 조금 덜 가깝게. 첫 판 결과는 `results/run-duplicate-bug.json`으로 보존, `bench.py`에 서로 다른 벡터 수 assert 추가
- [x] 위 정정을 `pgvector.md`·`pgvectorscale.md`·`week05/README.md`·`experiments/README.md`·pgvectorscale lab 01(`sql/03-label-filtering.sql`)에 반영
- [x] **"IVFFlat을 빈 테이블에 만들면 recall이 나빠진다(직접 재현)"는 크기만 재고 recall은 재지 않은 서술이었다** - 질의 100개로 실제로 재서 0.655 vs 0.712로 교체(방향은 맞고 차이는 작다)
- [x] `web/scripts/sync-pgvector-results.py`(실험 요약 → `src/data/pgvector-experiments.json`, `--check`), `web/scripts/capture-pgvector-demo.py`(임시 DB 실행 출력 → `src/data/pgvector-demo.json`)
- [x] 페이지 11개(`src/pages/pgvector/`): 개요·설치·언제 쓰나 / ANN·HNSW와 IVFFlat·튜닝 / DiskANN·비용·필터 / 실험·참고 자료. 수치는 전부 `stats.ts`를 거쳐 두 JSON에서 읽는다
- [x] Clotho 4개(`src/animations/pgvector_docs.py`): 정확 vs 근사, HNSW 탐색, IVFFlat probes, 필터 검색(첫 판의 실수 장 포함)
- [x] "언제 쓰나" 페이지의 AWS 체크리스트를 원문과 대조 - `<#>`가 "더 싸다", `maintenance_work_mem` 부족 시 "NOTICE" 등 원문에 없는 표현을 원문대로 교체
- [x] `registry.ts`에 week05 섹션 4개·`WEEKS` 등록, `package.json`의 `check`에 `check:pgvector-data` 추가
- [x] `bun run check`(typecheck · 애니메이션 22개 · 4개 주차 80개 페이지 탐색 · 데이터 검사 3종) · `bun run build` 통과, 프로덕션 빌드에서 11개 페이지 렌더 오류 없음 확인
- [x] `web/README.md`·`README.md`·`week05/README.md`(웹 미작성 한계 줄 교체) 갱신

## W. 23회차 — week05 웹 자료를 초심자 발표용으로 재구성 · 2026-10-05

요청: "좀더 설명이 친절하게 주어지면 좋겠습니다. 처음 postgresql을 접하고, DB 지식이 약간 있는 사람들을 대상으로 발표해도 순차적으로 이해할 수 있게요"

- [x] 페이지 공통 장치 `web/src/pages/pgvector/guide.tsx`: `Goal`(답할 질문 · 전제) · `Recap`(정리 · 다음 페이지와 이유) · `Deep`(접는 심화) · `Term`(첫 등장 용어 풀이)
- [x] 새 페이지: `처음이라면: 일곱 단계`(임베딩→거리→ORDER BY LIMIT→B-tree가 안 되는 이유→ANN→recall, 실제 3차원 예제 출력), `용어 사전`(35개, 비유 포함)
- [x] `개요`를 발표 오프닝으로 재작성: 전제 지식, 페이지별 "답하는 질문" 표, 용어 없는 결론 미리보기. 핵심 수치 StatGrid는 `언제 무엇을 쓰나`로 옮기고 설명을 쉬운 말로
- [x] `설치와 기본 문법`에 **EXPLAIN 읽는 법** 절 추가(Index Scan · Order By · Buffers = 8KB 페이지 · InitPlan) — 이후 페이지가 전부 버퍼 수로 비용을 말하므로
- [x] 모든 페이지에 비유 문단(EasyFirst), 원문 출력·숫자 표·소스 해설·정정 경위는 `Deep`으로 접고 본문에는 결론만
- [x] 튜닝 곡선이 DiskANN을 소개 전에 보여 주던 순서 문제 → 안내 상자로 연결. 사이드바를 "정리와 검증" 섹션으로 재배치(언제 쓰나 → 실험 → 자료)
- [x] 손으로 적힌 숫자 정리: 거리 집중 비율(0.8%·70%)을 출력에서 파싱, 재현 횟수·크기 비율·질의 수를 데이터에서 읽게 변경
- [x] **"같은 비용이면 HNSW가 IVFFlat보다 정확하다"는 실측과 반대였다** — 비교표를 다시 쓰며 숫자와 대조하다 발견. 실험 01(51,000행)에서 IVFFlat `probes=10`이 recall 0.95를 버퍼 730·1.37ms에, HNSW `ef_search=200`이 0.94를 버퍼 5,059·1.21ms에 냈다. 웹 비교표·튜닝 차트 노트·`pgvector.md` 91행을 실측으로 교체하고 해석의 한계(버퍼는 두 구조 사이에서 같은 잣대가 아님, 근접점을 몰아 넣은 데이터가 IVFFlat에 유리했을 수 있음)를 함께 적음. HNSW를 기본으로 권하는 근거는 운영(삽입 순서·재빌드 불필요)으로 정리
- [x] 확인 못 한 서술 제거: "0.7.0부터 병렬 빌드"(버전 불확실), "0.9가 실무 목표 수준", SBQ "차원마다 비트 몇 개"
- [x] `bun run check`(4개 주차 82개 페이지) · `bun run build` 통과, 13개 페이지 프로덕션 렌더 확인

## X. 24회차 — IVFFlat·HNSW 설명 보강 · 2026-10-05

요청: "IVFFLat, HNSW 에 대해서 더 설명을 보강해주세요"

- [x] 한 페이지였던 "HNSW와 IVFFlat"을 **IVFFlat → HNSW → HNSW vs IVFFlat** 세 페이지로 분리(원리가 단순한 IVFFlat 먼저)
- [x] IVFFlat: 이름 풀이(Inverted File + Flat=무압축), 만들기(표본 max(lists×50, 10,000)행 → k-means → 최근접 중심 배정, `ivfbuild.c` 확인), 찾기(중심 비교 + probes개 목록 전수 비교 → 비용 식), lists×probes 실측, 빈 테이블 함정, **분포 변화 후 REINDEX** 실측, 삭제·iterative_scan
- [x] HNSW: 이름 풀이(Small World·Navigable·Hierarchical, 탐욕적 이동), 층 배정 규칙(mL=1/ln m → 한 층 올라갈 확률 1/m, 0층 이웃 2m — `hnsw.h` 확인, 표는 계산값으로 표시), 삽입 과정, 검색 과정과 국소 최적, ef_search ≥ 2×LIMIT 권장(README), m·ef_construction·ef_search 실측, **삭제 후 VACUUM 비용**, **maintenance_work_mem 부족 NOTICE** 실측
- [x] 새 측정 스크립트 `web/scripts/capture-pgvector-index-demo.py` → `src/data/pgvector-index-demo.json`. 32차원·20,000행·무리 100개, 테이블에 없는 질문 100개, 설정마다 2회 빌드. 기존 `pgvector-demo.json`은 건드리지 않음. `sync-pgvector-results.py --check`에 구조·반복 수 검사 추가
- [x] 측정에서 얻은 것: lists↑ → probes=1 recall 1.00→0.87→0.43, lists=500은 중심 비교 몫 때문에 오히려 더 읽음 · m 4→32 크기 2.2배·빌드 약 8배 · **ef_construction=32는 ef_search=200에서도 0.986 천장**(64는 ef_search=40에서 1.000) · 무리 절반으로 만든 뒤 나머지를 넣으면 IVFFlat recall 0.80(REINDEX 후 1.00), HNSW는 1.00 그대로 · 20% 삭제 후 VACUUM HNSW 약 300ms vs IVFFlat 약 7ms · maintenance_work_mem=1MB면 약 1,245행에서 NOTICE, 빌드 2.8배
- [x] 실측 중 발견: pgvector는 `ef_construction < 2*m`을 오류로 거절한다 — 페이지에 실제 오류로 실음
- [x] 비교 페이지는 두 데이터셋(이번 무리 데이터, 실험 01)의 숫자를 나란히 두고 "HNSW가 같은 비용에서 더 정확하다"가 재현되지 않았다는 점과 해석 한계를 유지. HNSW 기본 권장 근거는 운영으로 정리
- [x] 링크·용어 사전·개요의 발표 순서 표·사이드바 갱신. `bun run check`(84개 페이지)·`bun run build` 통과, 프로덕션 렌더 확인

## Y. 25회차 — 개념 페이지에 핵심 3줄 요약 · 마무리 퀴즈 · 2026-10-05

요청: "각 개념 설명에 대한 페이지 상단에는 핵심 3줄 요약, 하단에는 마무리 퀴즈 섹션을 만들어서 이해하게 해주세요"

- [x] `guide.tsx`에 `Summary`(상단 핵심 3줄), `Quiz`(보기 클릭 → 즉시 정답·풀이·다시 읽을 절 링크, 점수, 다시 풀기), `Next` 추가. 점수는 화면 상태로만 두고 저장하지 않음
- [x] 개념 페이지 10개(처음이라면 · 설치와 기본 문법 · 근사 검색과 recall · IVFFlat · HNSW · HNSW vs IVFFlat · 튜닝 곡선 · DiskANN · 빌드 비용과 크기 · 필터가 붙은 검색): 하단 정리 상자를 상단 3줄 요약으로 옮기고, 하단은 퀴즈 → 다음 페이지
- [x] 문항 42개를 `quizzes.tsx`에 모음. 측정값이 들어가는 문항(lists별 recall, ef_construction 천장, VACUUM 시간, 빌드 배수, halfvec 감소율, 필터 비용, 재현 횟수 등)은 페이지와 같은 JSON에서 읽음
- [x] 보기 순서를 문제마다 정해진 규칙으로 돌려 정답 위치 분산(작성 시 정답이 대부분 ②였음 — 전부 첫 보기를 누르면 페이지당 1~2문제만 맞는 것 확인)
- [x] `bun run check`(84개 페이지)·`bun run build` 통과, 10개 페이지에서 요약·퀴즈 렌더와 채점 동작 확인

## Z. 26회차 — week05 기본 학습·그래프 시각화·구현 설명·Worker 배포 · 2026-10-06

- [x] 기본 학습을 가이드의 10장 순서로 재구성. RAM·SSD와 SBQ를 독립 페이지로 추가하고 실습·실험과 구현·실측 심화를 하단 목록으로 분리
- [x] 기본 학습용 Clotho 그래프 모형 4개 추가: IVFFlat 경계와 probes, HNSW 층별 탐색, DiskANN 후보 큐와 지름길, StreamingDiskANN 필터 결과 공급
- [x] Clotho 작성 스킬과 설치된 0.4.0 스키마를 확인. 노드 ID와 anchored connector, 절대 시간의 상태 트랙을 사용하고 discrete 보간의 조기 상태 변경을 수정
- [x] IVFFlat·HNSW·DiskANN 구현 설명을 `web/src/pages/pgvector/implementation/`에 보강. 생성·삽입·검색 의사 코드와 pgvector v0.8.0 / pgvectorscale 0.9.1 소스 연결 추가
- [x] 원 DiskANN의 medoid 설명과 pgvectorscale의 시작 노드 관리 차이, 후보 큐·원본 거리 재평가·추가 탐색의 한계를 구체화
- [x] `wrangler.jsonc`와 로컬 전용 `deploy:cloudflare` 명령 구성. Worker `pg-study`, Custom Domain `pg-study.shinkeonkim.com`, 정적 자산은 `dist/`만 배포
- [x] 로컬 Wrangler 4.71.0의 기존 로그인으로 배포 완료. 배포 버전 `5c54095a-db8c-4715-8434-5293311448c2`. Git/CI 자동 배포는 구성하지 않음
- [x] typecheck·애니메이션 26개 렌더·93개 페이지 내비게이션·실험 데이터 검사·프로덕션 빌드 통과
- [x] 공개 도메인에서 IVFFlat·HNSW·DiskANN의 구현 설명과 Clotho 구간 탐색을 1280px·390px 브라우저로 검증. 렌더 오류·실패한 웹 자산·페이지 가로 넘침 없음
- [x] 가이드 원본 디렉터리가 비어 있는 현재 상태를 확인. 이미 생성한 웹 본문은 유지하고 동기화 스크립트에 `--source-dir`와 원본 누락 안내 추가. 웹 빌드·배포는 원본에 의존하지 않음
