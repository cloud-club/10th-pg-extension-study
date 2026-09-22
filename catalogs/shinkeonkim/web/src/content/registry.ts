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
  week: string
  slug: string
  /** 여러 학습 섹션이 기존 URL 접두사를 함께 쓸 때 지정한다. */
  routeSlug?: string
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
    week: 'week02',
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
    week: 'week02',
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
    week: 'week02',
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
    week: 'week02',
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
    week: 'week02',
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
    week: 'week02',
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
    week: 'week02',
    slug: 'meta',
    title: '기록',
    hint: '측정 원칙과 정정',
    accent: 'warn',
    pages: [
      { slug: 'corrections', title: '재보니 달랐던 것들', hint: '정정 21건', view: lazy(() => import('@/pages/meta/Corrections')) },
      { slug: 'method', title: '측정 원칙과 재현', hint: '어떻게 쟀나', view: lazy(() => import('@/pages/meta/Method')) },
    ],
  },
  {
    week: 'week03', slug: 'cron-start', routeSlug: 'pg-cron', title: '시작하기', accent: 'ok',
    hint: '왜 쓰는지와 첫 예약',
    pages: [
      { slug: 'about', title: '개요와 첫 예약', view: lazy(() => import('@/pages/cron/About')) },
      { slug: 'when-to-use', title: '이럴 때 pg_cron을 쓴다', hint: '4개 질문으로 빠르게 판단', view: lazy(() => import('@/pages/cron/WhenToUse')) },
      { slug: 'recipes', title: '활용 사례', hint: '작업 유형별 SQL과 주의점', view: lazy(() => import('@/pages/cron/Recipes')) },
    ],
  },
  {
    week: 'week03', slug: 'cron-foundations', routeSlug: 'pg-cron', title: '기초 개념',
    hint: '예약 저장과 실행에 필요한 개념',
    pages: [
      { slug: 'shared-preload-libraries', title: 'shared_preload_libraries 기초', view: lazy(() => import('@/pages/cron/SharedPreloadLibraries')) },
      { slug: 'dollar-quoting', title: '$$ 문자열 문법', view: lazy(() => import('@/pages/cron/DollarQuoting')) },
      { slug: 'storage', title: '예약 테이블 들여다보기', view: lazy(() => import('@/pages/cron/Storage')) },
      { slug: 'schedules', title: '예약 저장·수정·분산 환경', view: lazy(() => import('@/pages/cron/Schedules')) },
      { slug: 'processes', title: '프로세스 기초', view: lazy(() => import('@/pages/cron/Processes')) },
      { slug: 'background-workers', title: 'Background worker란?', view: lazy(() => import('@/pages/cron/BackgroundWorkers')) },
      { slug: 'max-worker-processes', title: 'max_worker_processes 기초', view: lazy(() => import('@/pages/cron/MaxWorkerProcesses')) },
    ],
  },
  {
    week: 'week03', slug: 'cron-runtime', routeSlug: 'pg-cron', title: 'pg_cron 실행과 운영', accent: 'ok',
    hint: '실행 방식·동시성·관찰',
    pages: [
      { slug: 'modes', title: '두 실행 모드 이해하기', view: lazy(() => import('@/pages/cron/Modes')) },
      { slug: 'downtime', title: '서버 중단과 놓친 예약', view: lazy(() => import('@/pages/cron/Downtime')) },
      { slug: 'failures', title: '실패하면 어떻게 되나', view: lazy(() => import('@/pages/cron/Failures')) },
      { slug: 'operations', title: '동시성과 운영', view: lazy(() => import('@/pages/cron/Operations')) },
      { slug: 'rds', title: 'AWS RDS에서 사용하기', view: lazy(() => import('@/pages/cron/Rds')) },
      { slug: 'limits', title: '장애·자원·분산 한계', view: lazy(() => import('@/pages/cron/Limits')) },
    ],
  },
  {
    week: 'week03', slug: 'cron-internals', routeSlug: 'pg-cron', title: '구현과 검증', accent: 'warn',
    hint: 'C 소스와 반복 실험',
    pages: [
      { slug: 'source-map', title: '소스 파일·함수 지도', view: lazy(() => import('@/pages/cron/SourceMap')) },
      { slug: 'source', title: 'pg_cron C 코드 읽기', view: lazy(() => import('@/pages/cron/Source')) },
      { slug: 'experiments', title: '실험 질문과 결과', view: lazy(() => import('@/pages/cron/Experiments')) },
    ],
  },
  {
    week: 'week04', slug: 'hstore-start', routeSlug: 'hstore', title: '시작하기', accent: 'tsv',
    hint: '무엇이고 언제 쓰나',
    pages: [
      { slug: 'about', title: '개요와 첫 사용', hint: '키-값 묶음을 한 컬럼에', view: lazy(() => import('@/pages/hstore/About')) },
      { slug: 'install-syntax', title: '설치와 기본 문법', hint: '리터럴·연산자·함수·첨자', view: lazy(() => import('@/pages/hstore/InstallSyntax')) },
      { slug: 'trusted', title: 'trusted 확장이란', hint: '슈퍼유저 없이 설치되는 이유', view: lazy(() => import('@/pages/hstore/Trusted')) },
      { slug: 'when-to-use', title: '언제 쓰고 언제 피하나', hint: '열·EAV·jsonb·Redis와 비교', view: lazy(() => import('@/pages/hstore/WhenToUse')) },
    ],
  },
  {
    week: 'week04', slug: 'hstore-model', routeSlug: 'hstore', title: '저장과 조회', accent: 'tsv',
    hint: '디스크 형식·jsonb·인덱스',
    pages: [
      { slug: 'storage', title: '저장 방식', hint: '정렬된 쌍·HEntry·TOAST·압축', view: lazy(() => import('@/pages/hstore/Storage')) },
      { slug: 'vs-jsonb', title: 'jsonb와의 차이', hint: '타입·중첩·크기·연산자', view: lazy(() => import('@/pages/hstore/VsJsonb')) },
      { slug: 'indexes', title: '인덱스', hint: 'GIN·GiST·btree 식 인덱스', view: lazy(() => import('@/pages/hstore/Indexes')) },
    ],
  },
  {
    week: 'week04', slug: 'hstore-runtime', routeSlug: 'hstore', title: '갱신·동시성·운영', accent: 'ok',
    hint: '쓰기 비용과 동시 갱신',
    pages: [
      { slug: 'updates', title: '갱신 비용', hint: '키 하나 수정 = 값 전체 재기록', view: lazy(() => import('@/pages/hstore/Updates')) },
      { slug: 'concurrency', title: '동시성', hint: '행 잠금·유실 갱신·재시도', view: lazy(() => import('@/pages/hstore/Concurrency')) },
      { slug: 'vs-redis', title: 'Redis 해시와 비교', hint: '같은 일·다른 보장', view: lazy(() => import('@/pages/hstore/VsRedis')) },
      { slug: 'operations', title: '운영과 관리형 DB', hint: '지원 현황·ORM·이전·모니터링', view: lazy(() => import('@/pages/hstore/Operations')) },
    ],
  },
  {
    week: 'week04', slug: 'hstore-internals', routeSlug: 'hstore', title: '구현과 검증', accent: 'warn',
    hint: 'C 소스·실험·참고 자료',
    pages: [
      { slug: 'source', title: '소스 파일·함수 지도', hint: 'contrib/hstore 읽기', view: lazy(() => import('@/pages/hstore/Source')) },
      { slug: 'experiments', title: '실험 질문과 결과', hint: '5개 실험·반복·한계', view: lazy(() => import('@/pages/hstore/Experiments')) },
      { slug: 'resources', title: '참고 자료', hint: '공식 문서·GitHub·글', view: lazy(() => import('@/pages/hstore/Resources')) },
    ],
  },
]

export const HOME = `/${SECTIONS[0].slug}/${SECTIONS[0].pages[0].slug}`

export type Located = { section: SectionDef; page: PageDef }

export function findPage(sectionSlug?: string, pageSlug?: string): Located | null {
  for (const section of SECTIONS) {
    if (section.slug !== sectionSlug && section.routeSlug !== sectionSlug) continue
    const page = section.pages.find((p) => p.slug === pageSlug)
    if (page) return { section, page }
  }
  return null
}

/** 사이드바 순서 그대로 평탄화한 목록. 이전/다음 이동에 쓴다. */
export const FLAT: Located[] = SECTIONS.flatMap((section) => section.pages.map((page) => ({ section, page })))

export function neighbors(sectionSlug: string, pageSlug: string) {
  const week = SECTIONS.find((s) => s.slug === sectionSlug)?.week
  const pages = FLAT.filter((x) => x.section.week === week)
  const i = pages.findIndex((x) => x.section.slug === sectionSlug && x.page.slug === pageSlug)
  return { prev: i > 0 ? pages[i - 1] : null, next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : null }
}

export function href(l: Located) {
  return `/${l.section.routeSlug ?? l.section.slug}/${l.page.slug}`
}

export const WEEKS = [
  { slug: 'week02', title: 'Week 02 · 텍스트 검색' },
  { slug: 'week03', title: 'Week 03 · 작업 예약' },
  { slug: 'week04', title: 'Week 04 · hstore' },
]
export function weekHome(week: string) {
  const section = SECTIONS.find((s) => s.week === week)
  return section ? `/${section.routeSlug ?? section.slug}/${section.pages[0].slug}` : HOME
}
