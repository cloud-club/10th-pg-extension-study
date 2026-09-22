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

사이드바의 주차 선택으로 Week 02(검색), Week 03(pg_cron), Week 04(hstore)를 전환한다.
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

- 시작하기: 개요와 첫 사용 → 설치와 기본 문법 → 언제 쓰고 언제 피하나
- 저장과 조회: 저장 방식 → jsonb와의 차이 → 인덱스
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
