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

## 구조

```
src/
  animations/        clotho 애니메이션 — build.py 가 JSON 과 index.ts 를 생성한다
  components/
    ui/              shadcn 스타일 프리미티브 (button/card/table/tabs/badge/…)
    layout/          AppShell · Sidebar · PageHeader/Section · Callout · PageNav
    charts/          ChartBox(Chart.js 래퍼) · VersionSwitch
    viz/             Clotho 플레이어 · FragmentStrip
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

각 파일 머리에 **측정 환경과 재현 경로**를 주석으로 적어 둔다. 페이지에서는 `<SourceNote path="…" />` 로
그 경로를 화면에도 노출한다 — 출처 없는 숫자가 화면에 올라가지 않게 하는 장치다.

## 애니메이션

> **`main.tsx` 에서 `StrictMode` 를 쓰지 않는다.** React 18 의 StrictMode 는 개발 모드에서 이펙트를
> 마운트 → 정리 → 재마운트 하는데, clotho 플레이어(0.2.0)의 스케줄러가 그 정리를 넘기지 못해
> **개발 서버에서만 애니메이션이 0ms 에 멈춘다.** 프로덕션 빌드에서는 정상 재생된다.
> 다시 켜면 조용히 죽으므로 `main.tsx` 주석에도 적어 두었다.
>
> 참고로 플레이어는 **화면 밖에 있으면 스스로 멈춘다**(`useInView`). 자동 테스트에서 재생을 확인하려면
> 먼저 `scrollIntoView` 해야 한다 — 이건 의도된 동작이다.


```sh
python3 src/animations/build.py            # JSON + index.ts 생성 + 스키마 검증
python3 src/animations/build.py --check    # 검증만
bun run check:animations                   # 7개 문서를 6개 시점에서 실제로 SVG 로 그려본다
bun run check                              # typecheck + 위 검사
```

`check:animations` 는 파싱만 하는 게 아니라 **시점마다 장면을 만들어 SVG 로 직렬화**하고, 빈 프레임과
페이지가 참조하는 id 까지 대조한다 — "파싱은 되는데 그리다 죽는" 경우를 잡으려는 것이다.

`build.py` 가 문서를 만들고 스키마로 검증한 뒤 `index.ts` 를 갱신한다. 페이지에서는 `<Clotho id="gin-structure" />`
한 줄로 쓴다. 새 문서를 넣으면 `DOCS` 에 등록만 하면 `index.ts` 에 자동으로 실린다.

## 다크 전용

테마 토글이 없다. 색은 `src/index.css` 의 CSS 변수 한 곳에서만 오고, 차트 색은 `src/lib/chart.ts` 의
`C` 상수와 같은 값을 쓴다. clotho 문서의 색도 `build.py` 상단에서 같은 팔레트를 쓴다.
**세 곳을 함께 고쳐야 한다** — 그래서 값이 세 파일에만 있다.
