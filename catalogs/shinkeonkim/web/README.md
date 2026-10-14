# web — 카탈로그 시각화 앱

이 카탈로그의 **개념 정리와 시각화를 한곳에 모은** React + TypeScript + Vite + Tailwind(shadcn 스타일) 앱이다.
예전의 `references/`(마크다운)와 `visualizations/`(정적 HTML)를 여기로 합쳤고, 두 디렉터리는 삭제했다.
확장을 하나 더 붙일 때 파일 여러 개를 손대지 않도록, **사이드바·라우트·이전/다음 이동이 전부 하나의 레지스트리에서 파생**된다.

```sh
bun install
bun run dev        # http://localhost:5173
bun run build      # dist/  (base: './' 라 하위 경로에 올려도 된다)
bun run typecheck
```

## 새 확장/주제를 붙이는 법

1. `src/pages/<확장>/<페이지>.tsx` 를 만든다 (기본 내보내기 하나).
2. `src/content/registry.ts` 의 `SECTIONS` 에 한 덩어리를 추가한다.

```ts
{
  week: 'week03',                      // 소속 주차
  slug: 'pg-something',
  title: 'pg_something',
  hint: '한 줄 소개',
  accent: 'bigm',                       // 사이드바 점 색
  pages: [
    { slug: 'about', title: '구조와 규칙', hint: '...',
      view: lazy(() => import('@/pages/something/About')) },
  ],
}
```

그게 전부다. 라우트(`/#/<섹션>/<페이지>`), 사이드바 항목, 페이지 하단의 이전/다음이 자동으로 따라온다.

## 커밋하는 것 / 안 하는 것

`.gitignore` 는 이 디렉터리 안에 둔다 — 저장소 루트에는 웹 앱 규칙이 없다.

| | |
| --- | --- |
| 무시 | `node_modules/` · `dist/` · `.vite/` · `*.tsbuildinfo` · `src/animations/.clotho-schema.json`(CDN 캐시) · `.env*` · `*.log` |
| **커밋** | **`bun.lock`** — 설치가 재현되지 않으면 이 카탈로그의 측정 원칙이 앱 쪽에서 깨진다 |

무시하는 것은 전부 명령 한 줄로 다시 만들어진다 — `bun install` · `bun run build` ·
`python3 src/animations/build.py`.

## 절을 가리키는 방법

`§4` 같은 기호를 쓰지 않는다 — 읽는 사람이 그게 어디인지 직접 찾아야 하기 때문이다.
대신 `<Ref>` 로 **절 이름을 쓰고 실제로 그 자리로 데려간다.**

```tsx
<Ref to="/foundations/gin#structure">GIN 의 엔트리 트리</Ref>   {/* 다른 페이지 */}
<Ref to="#corpus">실제 말뭉치로 재본 것</Ref>                    {/* 같은 페이지 */}
```

절에는 `<Section id="...">` 로 id 를 단다. HashRouter 라 브라우저 기본 앵커 이동은 라우팅을 깨뜨리므로,
같은 페이지는 `Ref` 가 직접 스크롤하고 다른 페이지는 `AppShell` 이 마운트 후 앵커를 찾아간다.
`behavior: 'smooth'` 는 쓰지 않는다 — 자동화 환경이나 "동작 줄이기" 설정에서 조용히 무시된다.

## 구조

```
src/
  animations/        clotho 애니메이션 — build.py 가 JSON 과 index.ts 를 생성한다
  components/
    ui/              shadcn 스타일 프리미티브 (button/card/table/tabs/badge/…)
    layout/          AppShell · Sidebar · PageHeader/Section · Callout · PageNav
    charts/          ChartBox(Chart.js 래퍼) · VersionSwitch
    viz/             Clotho 플레이어 · Diagram(mermaid) · FragmentStrip
    common/          Stat · CodeBlock · SourceNote · SupportCell
  content/           registry.ts (사이드바·라우트의 단일 출처) · glossary.ts
  data/              측정값만 모아 둔 곳 — 아래 규칙 참조
  pages/             섹션별 페이지
```

## 데이터 규칙

`src/data/` 에는 **실제로 스크립트를 돌려 나온 값만** 넣는다. 추정치·기대값을 넣지 않는다.

| 파일 | 출처 |
| --- | --- |
| `measurements.ts` | 실험 01~07 · pg_bigm 00 · pg_trgm 01/02 (예전 `assets/data.js` 를 그대로 옮긴 것) |
| `operators.ts` | 실험 03 — 연산자 행렬 · 유사도 점수 |
| `threshold.ts` | pg_trgm 실험 02 — 임계값 스윕 · KNN |
| `whitespace.ts` | 실험 08 — 공백/구두점 조각 · 인덱스 동작 |
| `images.ts` | trivy 로 잰 베이스 이미지 취약점 |
| `hstore-experiments.json` | Week 04 hstore 실험 01~05 요약(중앙값·범위·반복 수). `scripts/sync-hstore-results.py` 가 로컬 결과에서 만든다 |
| `hstore-demo.json` | hstore 페이지의 SQL 예제와 **실제 출력**. `scripts/capture-hstore-demo.py` 가 임시 DB에서 실행해 저장한다 |
| `hstore-source.json` | `contrib/hstore`(PostgreSQL REL_16_15)의 발췌·행 범위·blob 해시. `scripts/extract-hstore-source.py` |
| `pgvector-experiments.json` | Week 05 pgvector·pgvectorscale 실험 01~07 요약. `scripts/sync-pgvector-results.py` 가 `week05/experiments/*/results` 에서 만든다 |
| `pgvector-demo.json` | pgvector 페이지의 SQL 예제와 **실제 출력**. `scripts/capture-pgvector-demo.py` 가 임시 DB에서 실행해 저장한다 |
| `pgvector-index-demo.json` | IVFFlat·HNSW 페이지의 측정(lists×probes, m·ef_construction·ef_search, 분포 변화 후 REINDEX, 삭제 후 VACUUM, maintenance_work_mem NOTICE). `scripts/capture-pgvector-index-demo.py` 가 임시 DB에서 설정마다 2회 빌드해 저장한다 |

각 파일 머리에 **측정 환경과 재현 경로**를 주석으로 적어 둔다. 페이지에서는 `<SourceNote path="…" />` 로
그 경로를 화면에도 노출한다 — 출처 없는 숫자가 화면에 올라가지 않게 하는 장치다.

## 애니메이션

> **`main.tsx` 에서 `StrictMode` 를 쓰지 않는다.** React 18 의 StrictMode 는 개발 모드에서 이펙트를
> 마운트 → 정리 → 재마운트 하는데, clotho 플레이어(0.2.0)의 스케줄러가 그 정리를 넘기지 못해
> **개발 서버에서만 애니메이션이 0ms 에 멈춘다.** 프로덕션 빌드에서는 정상 재생된다.
> 다시 켜면 애니메이션이 조용히 멈추므로 `main.tsx` 주석에도 적어 두었다.
>
> 참고로 플레이어는 **화면 밖에 있으면 스스로 멈춘다**(`useInView`). 자동 테스트에서 재생을 확인하려면
> 먼저 `scrollIntoView` 해야 한다 — 이건 의도된 동작이다.


```sh
python3 src/animations/build.py            # JSON + index.ts 생성 + 스키마 검증
python3 src/animations/build.py --check    # 검증만
bun run check:animations                   # 모든 문서를 6개 시점에서 실제로 SVG 로 그려본다
bun run check                              # typecheck + 위 검사
```

`check:animations` 는 파싱만 하는 게 아니라 **시점마다 장면을 만들어 SVG 로 직렬화**하고, 빈 프레임과
페이지가 참조하는 id 까지 대조한다 — "파싱은 되는데 그리다 죽는" 경우를 잡으려는 것이다.

`build.py` 가 문서를 만들고 스키마로 검증한 뒤 `index.ts` 를 갱신한다. 페이지에서는 `<Clotho id="gin-structure" />`
한 줄로 쓴다. 새 문서를 넣으면 `DOCS` 에 등록만 하면 `index.ts` 에 자동으로 실린다.

### 카메라 (장마다 이동)

**배율은 고정하고 이동만 한다.** 확대·축소가 반복되면 읽기 어렵기 때문이다.

`chapter_frames()` 가 **모든 장에서 크기가 같은 보이지 않는 틀**(`cam0`, `cam1`, …)을 만들고
그 틀만 `camera.focus` 대상으로 삼는다. 상자 크기가 같으니 배율이 같아지고, 카메라는 위아래로 움직이기만 한다.
틀의 가로는 내용 전체 폭으로 고정해 **글자가 옆으로 잘릴 여지를 없앤다.**

걸렸던 것들 — 다시 밟지 않게 적어 둔다.

- **내용이 캔버스 폭을 거의 다 쓰면 배율이 1 에 붙는다.** focus 는 대상 상자를 화면에 *맞추는* 것이라
  가로가 병목이면 확대할 여지가 없다 → `widen(doc, pad)` 로 좌우 여백을 만든다.
- **틀 rect 의 기본 stroke 가 `#6366f1` 이다** — 명시적으로 지우지 않으면 파란 테두리가 그대로 보인다.
- 장에 요소를 하나라도 빠뜨리면 그 요소가 초점 밖으로 나가 **옆이 잘린다.**

`bun run check:animations` 가 이걸 전부 확인한다 — 렌더 가능 여부, 빈 프레임, 참조하는 id,
**장마다 배율이 같은지**, **초점 밖으로 잘리는 요소**, **글자끼리 겹침**, 장면 진단.

## 그림을 어떻게 그리나

| | 언제 | 무엇으로 |
| --- | --- | --- |
| **Diagram** | 구조·흐름을 보여주는 정지된 그림 | mermaid. 아스키 아트로 그리지 않는다 — 줄맞춤이 폰트에 의존하고 화면이 좁아지면 무너진다 |
| **Clotho** | 단계를 따라가야 이해되는 설명 | `src/animations/` 의 JSON. 화면에 들어오면 자동 재생 |
| **ChartBox** | 측정한 수치 | Chart.js |

```tsx
<Diagram chart={`flowchart LR\n  a["조각"] --> b["행 목록"]`} caption="한 줄 해설" />
```

`Diagram` 은 렌더에 실패하면 원본 텍스트를 그대로 보여준다 — 아무것도 안 보이는 것보다 낫다.

## 다크 전용

테마 토글이 없다. 색은 `src/index.css` 의 CSS 변수 한 곳에서만 오고, 차트 색은 `src/lib/chart.ts` 의
`C` 상수와 같은 값을 쓴다. clotho 문서의 색도 `build.py` 상단에서 같은 팔레트를 쓴다.
**세 곳을 함께 고쳐야 한다** — 그래서 값이 세 파일에만 있다.

## 주차별 탐색

사이드바의 주차 선택으로 Week 02(검색), Week 03(pg_cron), Week 04(hstore), Week 05(pgvector·pgvectorscale)를 전환한다.
각 섹션의 `week`가 소속 주차를 정하며, 이전/다음 이동도 같은 주차 안에서만 이어진다.
새 주차는 `registry.ts`의 `WEEKS`와 `SECTIONS`에 등록한다.
기존 `#/start/overview`, `#/foundations/gin` 등 링크는 유지한다. 섹션 slug는 주차 전체에서 유일해야 한다.

Week 03 진입점은 `#/pg-cron/about`이다. 사이드바는 기존 URL을 유지하면서 다음 네 분류로 나눈다.

- 시작하기: 개요 → 활용
- 기초 개념: shared_preload_libraries → `$$` 문자열 → 예약 테이블 → 예약 저장·수정 → 프로세스 → Background worker → max_worker_processes
- pg_cron 실행과 운영: 실행 모드 → 서버 중단과 놓친 예약 → 실패 처리 → 동시성과 운영 → AWS RDS → 운영 한계
- 심화·검증: 소스 파일·함수 지도 → v1.6.8 원문 분석 → 실험

`SectionDef.routeSlug`를 사용하면 여러 사이드바 분류가 `#/pg-cron/...` URL 접두사를 공유할 수 있다.
웹 원문 분석은 실습 이미지와 같은 pg_cron v1.6.8을 기준으로 한다. 함수 지도는 별도로 2026-09-15의 main commit `5cedfa4`를 고정해 `entry.c`, `misc.c`, `job_metadata.c`, `task_states.c`, `pg_cron.c`를 함께 안내한다.
`src/data/cron-source.json`에 원문 발췌, 파일 해시, 행 번호와 원문 링크를 보관한다.
`cron-lifecycle`, `cron-concurrency`, `cron-event-loop` Clotho 문서는 소스 기반 설명용이며 실측 타임라인이 아니다.
pg_stat_statements의 문서와 실습은 `../etc/pg_stat_statements/`로 옮겼다.

### pg_cron 추가 조사와 측정 데이터

`#/pg-cron/recipes`: 활용 7가지의 전체 개요와 전제조건. `#/pg-cron/experiments`: 실험 03·04 차트와 진단.
회차별 측정 원본과 서버 로그는 실험 실행 시 `../week03/pg_cron/experiments/*/results/`에 생성되며 Git에서 제외한다. 검토할 요약값은 `src/data/cron-experiments.json`에 게시한다.

```sh
python3 scripts/sync-cron-results.py          # 로컬에서 실험을 모두 실행한 뒤 요약 게시
python3 scripts/sync-cron-results.py --check  # 게시된 요약의 반복 수·필수 필드 검사
```

실험과 웹 해설은 pg_cron 1.6.8 기준이다. week03의 기존 Markdown 소스 분석은 1.6.7 기준으로 남아 있다.
실험 03·04는 각 조건을 기본 10회 실행한다. 실험 페이지는 가설·예상·반복별 관측 범위와 평균, 추가 검증이 필요한 원인 추정을 구분한다.

### 코드와 실행 결과

`CodeBlock`은 SQL·C·Bash·설정 파일·Python·JSON 문법을 강조한다.
언어가 정해진 블록은 `language="sql"`처럼 지정하고, 설명용 텍스트는 `language="text"`로 둔다.
`output`과 `outputCaption`을 지정하면 코드 아래에 간격을 둔 출력 영역이 생긴다.
실측과 예상 출력은 캡션에서 구분한다. 출력에는 문법 강조를 적용하지 않는다.

프로세스·소스 페이지의 두 잡 실행 결과는 `src/data/cron-concurrency-demo.json`에 저장한다.
다음 명령은 전용 임시 Docker DB에서 SQL을 실행하고, 동일 잡 겹침 0·최대 동시 실행 2를 검증한 뒤 데이터를 갱신한다.

```sh
python3 scripts/capture-cron-demo.py
```

이 결과는 함수 실행 구간의 동시성을 보여준다. SQL 기동 비용이나 CPU 처리량 측정이 아니다.

예약 테이블 페이지의 출력은 `src/data/cron-storage-demo.json`에 저장한다. 다음 명령은 전용 임시 DB에서
예약 등록, `cron.job`, `cron.job_run_details`, 업무 결과와 내부 relation 경로를 확인하고 결과를 갱신한다.

```sh
python3 scripts/capture-cron-storage.py
```

실행 모드 페이지는 기본 설명과 접어서 표시하는 심화 설명으로 나눈다.
처음 등장하는 postmaster·client backend·pg_cron launcher는 프로세스 페이지에서 역할과 실행 위치부터 설명한다.
SQL 예제는 실행 문장 하나와 그 결과를 한 쌍으로 표시한다. 함수 본문이나 예약 문자열 안의 SQL은 하나의 문장 일부이므로 분리하지 않는다.

## Week 04 · hstore

진입점은 `#/hstore/about`이다. 사이드바는 네 분류로 나뉜다. 네 분류 모두 URL 접두사 `#/hstore/...`를 공유한다(`SectionDef.routeSlug`).

- 시작하기: 개요와 첫 사용 → 설치와 기본 문법 → trusted 확장이란 → 언제 쓰고 언제 피하나 → 실무 사용처 → 실전 액션
- 저장과 조회: 저장 방식 → jsonb와의 차이 → GiST·GIN 내부 구조 → 인덱스
- 갱신·동시성·운영: 갱신 비용 → 동시성 → Redis 해시와 비교 → 운영과 관리형 DB
- 구현과 검증: 소스 파일·함수 지도 → 실험 질문과 결과 → 참고 자료

페이지에 올라가는 숫자와 SQL 출력은 손으로 적지 않는다. 세 파일에서만 온다.

```sh
python3 scripts/sync-hstore-results.py           # 로컬 실험 결과 → src/data/hstore-experiments.json
python3 scripts/sync-hstore-results.py --check   # 게시된 요약의 반복 수(01:3 · 02:5 · 03:5 · 04:10 · 05:5회 이상)와 필수 필드 검사
python3 scripts/capture-hstore-demo.py           # 임시 DB에서 예제를 실행해 src/data/hstore-demo.json 갱신
python3 scripts/extract-hstore-source.py <pgsrc> # 소스 발췌 갱신
python3 src/animations/build.py                  # 애니메이션(수치는 hstore-experiments.json 에서 읽는다)
```

실험 원본은 `../week04/hstore/experiments/*/results/`에 생성되며 Git에서 제외한다. 실험 다섯 개는 같은 Compose 프로젝트를 쓰므로 동시에 실행하지 않는다.

Clotho 문서 7개는 `src/animations/hstore_docs.py`에 있고 `build.py`가 함께 만든다. `hstore-storage-layout`, `hstore-gin-lookup`, `hstore-vs-jsonb-types`는 소스와 실습 출력 기반의 개념 모형이고, `hstore-update-rewrite`, `hstore-lost-update`, `hstore-redis-path`, `hstore-offsets-vs-lengths`는 실험 결과 요약의 수치를 읽어 그린다. 재생 시간은 실제 실행 시간과 무관하다.

## Week 05 · pgvector · pgvectorscale

진입점은 `#/pgvector/about`이다. 모든 목록은 URL 접두사 `#/pgvector/...`를 공유한다.

기본 학습은 `private/pgvector-pgvectorscale-guide`의 문단·예시·설명 순서를 그대로 옮긴 10장이다.

1. 벡터 검색과 ANN
2. pgvector 전체 구조
3. IVFFlat
4. HNSW
5. RAM, SSD와 Random Access
6. StreamingDiskANN
7. SBQ
8. Filtered Vector Search
9. 기술 비교와 선택 기준
10. 용어집과 복습

실습과 실험은 기본 학습 아래 별도 목록에 둔다. `Lab 목록과 실행 순서`는 실습 3개를 안내하고,
`설치와 SQL 실습`에는 실제 출력, `실험 질문과 결과`에는 실험 7개와 정정 이력을 모은다.
기존의 상세 설명·튜닝 그래프·빌드 비용·필터 검색 실측은 하단 `심화 · 구현과 실측` 목록에서 읽는다.
기본 학습에 같은 내용을 다시 끼워 넣지 않는다. 기존 `#/pgvector/first` 링크는 01장으로 이동한다.

`src/pages/pgvector/reading/*.tsx`는 다음 명령으로 생성한다. 직접 수정하지 않고 원문을 고친 뒤 다시 생성한다.
코드 블록은 `CodeBlock`, Mermaid는 `Diagram`, 문단·목록·표는 정적 JSX로 옮긴다.
앱 실행이나 빌드에 private 디렉터리가 필요하지 않다. 동기화 검증에는 원문이 필요하다.

```sh
python3 scripts/sync-pgvector-guide.py
python3 scripts/sync-pgvector-guide.py --check
```

심화 페이지는 기존 `guide.tsx`의 요약·질문·심화·퀴즈 컴포넌트를 사용한다.
퀴즈 문항은 `quizzes.tsx`, 실측 데이터 접근자는 `stats.ts`와 `indexStats.ts`에 있다.

페이지의 숫자와 SQL 출력은 세 파일에서만 온다. 페이지 공용 접근자는 `src/pages/pgvector/stats.ts`(실험·데모)와 `indexStats.ts`(IVFFlat·HNSW 측정, 실행 평균·범위)다.

```sh
python3 scripts/sync-pgvector-results.py          # week05 실험 결과 → src/data/pgvector-experiments.json
python3 scripts/sync-pgvector-results.py --check  # 구조와 실험 07 데이터(서로 다른 벡터 수) 검사
python3 scripts/capture-pgvector-demo.py          # 임시 DB(Compose 프로젝트 pgvector-demo-capture)에서 예제 실행 → src/data/pgvector-demo.json
python3 scripts/capture-pgvector-index-demo.py    # 임시 DB(pgvector-index-demo-capture)에서 인덱스 파라미터 측정 → src/data/pgvector-index-demo.json (약 2분)
python3 src/animations/build.py                   # 애니메이션(수치는 두 JSON 에서 읽는다)
```

week05 실험 결과(`../week05/experiments/*/results/`)는 week04와 달리 Git에 함께 둔다 — 정정 이력(실험 03→04, 실험 07 첫 판)을 원본으로 남기기 위해서다.

Clotho 문서 4개는 `src/animations/pgvector_docs.py`에 있다. `pgv-exact-vs-ann`, `pgv-hnsw-search`, `pgv-ivfflat-probes`는 개념 모형이고, `pgv-filtered-search`는 실험 07의 버퍼·지연시간을 읽어 그린다. 재생 시간은 실제 실행 시간과 무관하다.

기본 학습의 그래프 애니메이션 4개는 `src/animations/pgvector_graphs.py`에서 만든다.
IVFFlat의 동네 경계와 probes, HNSW의 층 이동, DiskANN의 후보 목록과 지름길,
StreamingDiskANN의 필터 통과 과정을 시각화한다. 이 문서들의 좌표·거리·재생 시간은 개념 예시이며 실측값이 아니다.
`sync-pgvector-guide.py`의 `VISUALS`가 해당 설명 절 끝에 플레이어를 삽입하므로 원문을 다시 동기화해도 유지된다.
노드는 한 번 선언하고 속성 트랙으로 갱신한다. Clotho 0.4.0의 discrete 보간은 구간 중간에서 바뀌므로,
상태 변경 직전에도 키프레임을 두어 실제 방문 시각까지 기존 상태를 유지한다.
작성 기준: [Clotho 애니메이션 작성 스킬](https://clotho-docs.shinkeonkim.com/docs/skill/overview/).

`src/pages/pgvector/implementation/`은 기본 학습에서 이어 읽는 구체적인 구현 설명이다.
IVFFlat의 표본·중심·목록 저장, HNSW의 층 배정·이웃 선택·후보 큐,
pgvectorscale의 그래프 삽입·prune·시작 노드·streaming 재정렬을 의사 코드와 함께 설명한다.
`sync-pgvector-guide.py`의 `IMPLEMENTATIONS`가 본문의 해당 절에 연결한다.
원문 가이드가 다른 곳에 있다면 `--source-dir /path/to/guide`로 지정한다.

## Cloudflare Worker · 로컬 배포

공개 주소: [pg-study.shinkeonkim.com](https://pg-study.shinkeonkim.com/#/pgvector/about).
`wrangler.jsonc`의 Worker 이름은 `pg-study`이며 `dist/`만 정적 자산으로 업로드한다.
`pg-study.shinkeonkim.com`은 Custom Domain으로 연결한다. 원문·실험 스크립트는 웹 배포에 포함되지 않는다.

Wrangler CLI를 설치하고 대상 Cloudflare 계정으로 `wrangler login`한 로컬 머신에서 실행한다.
현재 확인한 CLI 버전은 4.71.0이다.

```sh
cd catalogs/shinkeonkim/web
bun install
bun run deploy:cloudflare
```

이 명령은 전체 검사 → 빌드 → `wrangler deploy` 순서로 실행한다.
GitHub Actions나 Cloudflare의 Git 자동 배포는 구성하지 않는다.
로그인 토큰은 Wrangler가 로컬에서 관리하며 저장소에 넣지 않는다.


## Week 07 · postgres_fdw

진입은 `#/postgres-fdw/about`이다. `시작하기`·`기본 학습`·`실습과 검증`·`심화 · 구현과 운영` 목록을 같은 URL 접두사로 제공한다. 기본 10장, Lab 수동 해설 5개, 실측 실험 페이지, 심화 6장이 연결된다. Week 06은 hll을 별도 학습 묶음으로 제공한다.

카탈로그를 제외한 Week 07 설명 원문은 모두 `web/content/fdw/`에 둔다. `docs/basic`·`docs/advanced`·`labs`·`experiments`는 웹 문서 소스이며 week07 디렉터리는 SQL·스크립트·실측 원본만 보관한다. Markdown을 수정하면 아래 명령으로 정적 JSX를 생성한다. 런타임 Markdown 파서를 추가하지 않으며 페이지는 레지스트리의 lazy import로 로드한다.

```sh
python3 scripts/sync-fdw-guide.py
python3 scripts/sync-fdw-guide.py --check
python3 scripts/sync-fdw-results.py
python3 scripts/sync-fdw-results.py --check
```

`src/pages/fdw/reading`은 원문에서 생성한 페이지다. 직접 수정하지 않는다. 학습 지도·가정 계산기·실측 표는 `About.tsx`·`Network.tsx`·`Experiments.tsx`다. 실측은 `src/data/fdw-results.json`에서 읽으며 Lab 5개와 실험 3개의 원본·정답·반복 횟수를 검증한다. 두 동기화 검사는 `check`에 포함된다.

실행은 저장소 루트에서 각 `week07/postgres_fdw/labs/<Lab>/run.sh`를 사용한다. 공유 환경은 PostgreSQL 18.6 두 컨테이너이며 호스트 포트를 공개하지 않는다. 스냅샷·권한·정상 롤백·잠금·FETCH·연결을 assert로 확인한다. EXPLAIN 반복 측정은 서버 시간이고 앱 풀·WAN·wire bytes·RSS·서비스 p99와 구분한다.

질문을 반영할 때 원문 개념·Lab·실험 해석을 함께 수정한다. 설명 순서가 맞지 않으면 원문과 레지스트리부터 재구성한다. 가정 계산값을 실측 JSON에 넣지 않는다.


Week 07 개요에는 국내 기업 사례에서 도출한 조사 질문을 먼저 제시한다. `#/postgres-fdw/industry-cases`는 우아한형제들 실제 마이그레이션, 네이버·카카오클라우드 공식 사용 절차, 매드업의 dblink 비교 사례를 원문 링크·확인일·전제와 함께 설명한다. 원문은 `content/fdw/industry-cases.md`이며 공식 가이드와 내부 적용 경험을 구분한다. 기업의 성능 수치는 로컬 실측 JSON에 넣지 않는다.


## 번외 · PostgreSQL JOIN

`#/pg-joins/about`에서 시작하며 주차 선택의 `번외 · PostgreSQL JOIN`으로 이동한다. Week 번호를 추가하지 않는다. 학습 지도, 기본 5장, 심화, Lab 총 8페이지를 제공한다. 설명 원문은 `content/joins/`, 생성 페이지는 `src/pages/joins/`다. 원문 수정 후 `python3 scripts/sync-joins-guide.py`를 실행하며 `--check`는 전체 검사에 포함된다. 기존 FDW Markdown 렌더러를 재사용한다.

실행 SQL·Docker 구성·검증기·원본 계획은 `../extra/pg-joins/`에 둔다. 저장소 루트에서 `bash catalogs/shinkeonkim/extra/pg-joins/run.sh`로 재현한다. 세 JOIN의 결과 동일성, 실제 노드, BitmapOr와 메모리별 해시 배치를 검증한다. 원본 계획은 단일 실행 관측이며 성능 순위로 해석하지 않는다.


`#/postgres-fdw/blog-review`는 기업 블로그의 주의사항을 공식 동작·적용 조건·자체 관측으로 나누어 검토한다. 원문은 `content/fdw/blog-review.md`이며 JOIN·트랜잭션·쓰기·운영 장에도 보강 내용을 반영한다. 별도 단일 관측 실험 `../week07/postgres_fdw/experiments/04-blog-review/verify.py`는 준비된 공유 Lab에서 실행하고 `results/run.json`을 저장한다. CTE·로컬 키 배열·쓰기 차단·표 옵션 우선순위·연결 수명·원격 표 보존을 검증하며 반복 실험 3개의 성능 결과와 구분한다. `check:fdw-review`는 저장된 원본을 읽기 전용으로 검증하고 전체 `check`에 포함된다.


관련 확장 심화 5페이지는 `content/fdw/related/`에서 관리하고 `sync-fdw-guide.py`로 생성한다. 메뉴는 `관련 확장 · 선택과 운영`이다. dblink·file_fdw·pg_trgm·pg_stat_statements/auto_explain·pg_cron의 역할, 비용, 운영 책임과 실습 전제를 다룬다. 기존 자동 Lab의 관측과 추가 수동 예제·미검증 항목을 구분한다.


`#/postgres-fdw/join-comparison`은 직접 JOIN·키 배열·원격 전처리·전체 로컬 staging을 같은 1,000행으로 비교한다. 준비 5회·읽기 예열 2회/본 측정 10회이며 지속 psql 세션 wall time을 측정한다. 원본은 `../week07/postgres_fdw/experiments/05-join-strategies/results/run.json`이다. 재실행 후 `python3 scripts/sync-fdw-join-comparison.py`와 `python3 scripts/sync-fdw-guide.py`를 순서대로 실행한다. 결과 검증은 전체 check에 포함된다. 기존 EXPLAIN 서버 시간과 다른 지표이며 준비 포함 합산 모델은 직접 end-to-end 측정과 구분한다.

## Week 06 · hll

`#/hll/about`에서 시작한다. Week 05 pgvector 자료는 보존하며 Week 06만 추가한다. 기본 10장, 심화 4장, Lab 4개, 학습 지도·근거·실측 3장과 레지스터 실험실·공간 계산기 총 23페이지다. 설명 원문은 `content/hll/`, 생성 페이지는 `src/pages/hll/reading/`, 인터랙티브 모형은 `src/pages/hll/`에 있다.

실습 코드·Docker·SQL·원본 결과도 `labs/hll/`에 둔다. 저장소 루트에서 `bash catalogs/shinkeonkim/web/labs/hll/run.sh`를 실행한다. 전용 PostgreSQL 18.6·hll 2.21 환경이며 공유 DB·호스트 포트를 사용하지 않는다. 기능·표현 전이·병합·오차 60시행·해시 seed 점검·시간 30표본을 검증한다. 초기 생성 시간은 단일 관측이며 저장 bytes와 RSS, 이론 RSE와 최대 오류, 교육 모형과 실제 구현을 구분한다.

실험을 다시 실행하면 웹 디렉터리에서 아래 순서로 동기화한다. 생성 페이지를 직접 수정하지 않는다.

```sh
python3 scripts/sync-hll-results.py
python3 scripts/sync-hll-guide.py
python3 scripts/sync-hll-results.py --check
python3 scripts/sync-hll-guide.py --check
```

두 검사는 전체 check에 포함된다. 특히 입력 타입·seed별 이상 관측은 삭제하지 않고 미확정 원인과 후속 조사 범위를 명시한다. 원본 ID·해시 계약·버전·정밀도·기간·반복 수를 함께 기록한다.


HLL Lab 4개에는 원본 결과에서 만든 그림 9개와 읽는 법·해석을 붙였다. SVG·PNG는 `public/hll/plots/`, 생성 코드는 `labs/hll/plot-results.py`, 버전은 `labs/hll/requirements-plots.txt`다. 그림 생성에만 Matplotlib와 한국어 폰트(Apple SD Gothic Neo 또는 Noto Sans CJK)가 필요하며 웹 실행·빌드에는 필요하지 않다. `manifest.json`은 원본 3개·생성 코드·그림의 해시를 기록하고 `check:hll-plots`가 검사한다. 실제 표본과 합산 모델을 구분하며 초기 생성 수치의 해설도 원본과 대조한다.

run.sh는 기본 벤치·저장 관측을 실행하고 날짜별 범위도 자동으로 기록한다. 개별 저장 관측은 `python3 labs/hll/inspect-storage.py`로 다시 실행할 수 있다. 그 뒤 plotting requirements를 설치한 Python 환경에서 `python labs/hll/plot-results.py`를 실행하고 원문의 해석을 갱신한다. 기존 results/guide 동기화도 실행한다. `inspect-storage.py --check`는 저장된 실제 payload를 읽기 전용으로 검사한다.
