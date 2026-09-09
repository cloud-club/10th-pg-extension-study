import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type Accent = 'bigm' | 'trgm' | 'tsv' | 'ok' | 'warn' | 'default'

export type PageDef = {
  /** URL 조각. 섹션 안에서 유일하면 된다. */
  slug: string
  title: string
  /** 사이드바에서 제목 아래 회색으로 붙는 한 줄. */
  hint?: string
  /** 페이지 컴포넌트. lazy 로 감싸 라우트 단위로 쪼갠다. */
  view: LazyExoticComponent<ComponentType>
}

export type SectionDef = {
  slug: string
  title: string
  /** 섹션을 한 줄로 소개한다. 섹션 인덱스 화면에서 쓴다. */
  hint?: string
  accent?: Accent
  pages: PageDef[]
}

/* ---------------------------------------------------------------------------
 * 새 확장을 붙이는 법
 *   1) src/pages/<확장>/ 아래에 페이지 컴포넌트를 만든다
 *   2) 아래 SECTIONS 에 { slug, title, accent, pages: [...] } 한 덩어리를 추가한다
 *   그게 전부다 — 사이드바·라우트·검색 대상이 전부 이 배열에서 파생된다.
 * ------------------------------------------------------------------------- */
export const SECTIONS: SectionDef[] = [
  {
    slug: 'start',
    title: '시작하기',
    hint: '무엇을 왜 재는지, 그리고 용어',
    pages: [
      { slug: 'overview', title: '개요 — 무엇을 써야 하나', hint: '결론과 한눈 비교', view: lazy(() => import('@/pages/start/Overview')) },
      { slug: 'first', title: '처음이라면', hint: '검색창에서 n-gram 까지 5단계', view: lazy(() => import('@/pages/start/FirstSteps')) },
      { slug: 'glossary', title: '용어 사전', hint: '28개 용어와 비유', view: lazy(() => import('@/pages/start/Glossary')) },
      { slug: 'map', title: '개념 지도', hint: '어떤 순서로 읽을까', view: lazy(() => import('@/pages/start/ConceptMap')) },
    ],
  },
  {
    slug: 'foundations',
    title: '기초 개념',
    hint: '확장을 보기 전에 알아야 할 것',
    pages: [
      { slug: 'btree', title: 'B-tree 는 왜 못 하나', hint: '정렬 순서와 연속 구간', view: lazy(() => import('@/pages/foundations/Btree')) },
      { slug: 'ngram', title: 'n-gram 이란', hint: '패딩 · n 의 트레이드오프', view: lazy(() => import('@/pages/foundations/Ngram')) },
      { slug: 'whitespace', title: '공백과 구두점', hint: '조각에 공백이 들어가나', view: lazy(() => import('@/pages/foundations/Whitespace')) },
      { slug: 'gin', title: 'GIN 인덱스', hint: '엔트리 트리 · 포스팅 · 펜딩', view: lazy(() => import('@/pages/foundations/Gin')) },
      { slug: 'recheck', title: 'Recheck 과 lossy', hint: '왜 인덱스만으로 못 끝내나', view: lazy(() => import('@/pages/foundations/Recheck')) },
    ],
  },
  {
    slug: 'pg-bigm',
    title: 'pg_bigm',
    hint: '2-gram · 한국어에 유리한 쪽',
    accent: 'bigm',
    pages: [
      { slug: 'about', title: '구조와 규칙', hint: '2문자 · 원본 바이트 · GIN 전용', view: lazy(() => import('@/pages/bigm/About')) },
      { slug: 'korean', title: '한국어에서 유리한 이유', hint: '알파벳 크기 · 2글자 낱말', view: lazy(() => import('@/pages/bigm/Korean')) },
      { slug: 'operators', title: '연산자 커버리지', hint: 'LIKE 만 · ILIKE 는 없다', view: lazy(() => import('@/pages/bigm/Operators')) },
    ],
  },
  {
    slug: 'pg-trgm',
    title: 'pg_trgm',
    hint: '3-gram · 유사도와 정규식',
    accent: 'trgm',
    pages: [
      { slug: 'about', title: '구조와 규칙', hint: '3문자 · CRC32 · 패딩 2/1', view: lazy(() => import('@/pages/trgm/About')) },
      { slug: 'two-char', title: '짧은 검색어 함정', hint: '1글자 · 2글자에서 무너진다', view: lazy(() => import('@/pages/trgm/TwoChar')) },
      { slug: 'similarity', title: '유사도와 KNN', hint: '임계값 · <-> · word_similarity', view: lazy(() => import('@/pages/trgm/Similarity')) },
      { slug: 'gist', title: 'GIN vs GiST', hint: 'siglen 과 서명 포화', view: lazy(() => import('@/pages/trgm/Gist')) },
    ],
  },
  {
    slug: 'fulltext',
    title: '전문검색 (코어)',
    hint: 'tsvector · tsquery',
    accent: 'tsv',
    pages: [
      { slug: 'tsvector', title: 'tsvector / tsquery', hint: '어휘소 vs 조각', view: lazy(() => import('@/pages/fulltext/Tsvector')) },
      { slug: 'korean-recall', title: '한국어 재현율', hint: '사전 없이 7~38%', view: lazy(() => import('@/pages/fulltext/KoreanRecall')) },
      { slug: 'korean-analyzer', title: '한국어 형태소 분석기는 없나', hint: 'textsearch_ko · PGroonga', view: lazy(() => import('@/pages/fulltext/KoreanAnalyzer')) },
    ],
  },
  {
    slug: 'experiments',
    title: '성능 실험',
    hint: '전부 이 저장소에서 재현된다',
    accent: 'ok',
    pages: [
      { slug: 'length-selectivity', title: '01 길이 × 선택도', view: lazy(() => import('@/pages/experiments/E01')) },
      { slug: 'build-write', title: '02 조각 통계 · 쓰기 비용', view: lazy(() => import('@/pages/experiments/E02')) },
      { slug: 'operators', title: '03 연산자 커버리지', hint: 'pg_bigm 쪽으로 이동', view: lazy(() => import('@/pages/experiments/E03')) },
      { slug: 'storage', title: '04 저장 비용 (10만~500만)', view: lazy(() => import('@/pages/experiments/E04')) },
      { slug: 'pattern-length', title: '05 패턴 × 길이 45칸', view: lazy(() => import('@/pages/experiments/E05')) },
      { slug: 'fulltext', title: '06 전문검색 vs n-gram', view: lazy(() => import('@/pages/experiments/E06')) },
      { slug: 'versions', title: '07 PostgreSQL 16~19', view: lazy(() => import('@/pages/experiments/E07')) },
      { slug: 'whitespace', title: '08 공백과 구두점', hint: '기초 개념 쪽으로 이동', view: lazy(() => import('@/pages/experiments/E08')) },
      { slug: 'ilike', title: '09 ILIKE 는 빨라지는가', hint: '대소문자와 함수 인덱스', view: lazy(() => import('@/pages/experiments/E09')) },
      { slug: 'one-char', title: '10 1글자 검색은 왜 되나', hint: 'GIN 페이지 쪽으로 이동', view: lazy(() => import('@/pages/experiments/E10')) },
      { slug: 'planner', title: '플랜 전환점', hint: '언제 인덱스를 쓰기 시작하나', view: lazy(() => import('@/pages/experiments/Planner')) },
      { slug: 'lab-server', title: '직접 돌려보기', hint: '실험 서버', view: lazy(() => import('@/pages/experiments/LabServer')) },
    ],
  },
  {
    slug: 'meta',
    title: '기록',
    hint: '측정 원칙과 정정',
    accent: 'warn',
    pages: [
      { slug: 'corrections', title: '재보니 달랐던 것들', hint: '정정 21건', view: lazy(() => import('@/pages/meta/Corrections')) },
      { slug: 'method', title: '측정 원칙과 재현', hint: '어떻게 쟀나', view: lazy(() => import('@/pages/meta/Method')) },
    ],
  },
]

export const HOME = `/${SECTIONS[0].slug}/${SECTIONS[0].pages[0].slug}`

export type Located = { section: SectionDef; page: PageDef }

export function findPage(sectionSlug?: string, pageSlug?: string): Located | null {
  const section = SECTIONS.find((s) => s.slug === sectionSlug)
  if (!section) return null
  const page = section.pages.find((p) => p.slug === pageSlug)
  return page ? { section, page } : null
}

/** 사이드바 순서 그대로 평탄화한 목록. 이전/다음 이동에 쓴다. */
export const FLAT: Located[] = SECTIONS.flatMap((section) => section.pages.map((page) => ({ section, page })))

export function neighbors(sectionSlug: string, pageSlug: string) {
  const i = FLAT.findIndex((x) => x.section.slug === sectionSlug && x.page.slug === pageSlug)
  return { prev: i > 0 ? FLAT[i - 1] : null, next: i >= 0 && i < FLAT.length - 1 ? FLAT[i + 1] : null }
}

export function href(l: Located) {
  return `/${l.section.slug}/${l.page.slug}`
}
