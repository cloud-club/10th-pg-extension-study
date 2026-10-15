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
      { slug: 'join-comparison', title: '비교 Lab · JOIN·전처리·staging', view: lazy(() => import('@/pages/fdw/reading/JoinComparison')) },
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
      { slug: 'use-cases', title: '실무 사용처', hint: 'Rails·Django·osm2pgsql이 실제로 쓴 패턴', view: lazy(() => import('@/pages/hstore/UseCases')) },
      { slug: 'actions', title: '실전 액션', hint: '조회·조작·삭제 전부 실제 실행 결과로', view: lazy(() => import('@/pages/hstore/Actions')) },
    ],
  },
  {
    week: 'week04', slug: 'hstore-model', routeSlug: 'hstore', title: '저장과 조회', accent: 'tsv',
    hint: '디스크 형식·jsonb·인덱스',
    pages: [
      { slug: 'storage', title: '저장 방식', hint: '정렬된 쌍·HEntry·TOAST·압축', view: lazy(() => import('@/pages/hstore/Storage')) },
      { slug: 'vs-jsonb', title: 'jsonb와의 차이', hint: '타입·중첩·크기·연산자', view: lazy(() => import('@/pages/hstore/VsJsonb')) },
      { slug: 'gist-gin-internals', title: 'GiST·GIN 내부 구조', hint: '왜 hstore에만 GiST가 있는가', view: lazy(() => import('@/pages/hstore/GistGinInternals')) },
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
      { slug: 'join-comparison', title: '비교 Lab · JOIN·전처리·staging', view: lazy(() => import('@/pages/fdw/reading/JoinComparison')) },
    { slug: 'experiments', title: '실험 질문과 결과', hint: '5개 실험·반복·한계', view: lazy(() => import('@/pages/hstore/Experiments')) },
      { slug: 'resources', title: '참고 자료', hint: '공식 문서·GitHub·글', view: lazy(() => import('@/pages/hstore/Resources')) },
    ],
  },
  {
    week: 'week05', slug: 'pgv-start', routeSlug: 'pgvector', title: '학습 안내', accent: 'tsv',
    pages: [
      { slug: 'about', title: '개요와 학습 순서', hint: '기본 학습 10장 · 실습 · 심화', view: lazy(() => import('@/pages/pgvector/About')) },
    ],
  },
  {
    week: 'week05', slug: 'pgv-reading', routeSlug: 'pgvector', title: '기본 학습 · 01–10', accent: 'ok',
    pages: [
      { slug: 'ann', title: '01. 벡터 검색과 ANN', hint: '의미를 숫자로 · 정확도와 속도', view: lazy(() => import('@/pages/pgvector/reading/Ann')) },
      { slug: 'overview', title: '02. pgvector 전체 구조', hint: '벡터 저장 · 인덱스 · 확장의 관계', view: lazy(() => import('@/pages/pgvector/reading/Overview')) },
      { slug: 'ivfflat', title: '03. IVFFlat', hint: '동네를 나누고 가까운 동네만', view: lazy(() => import('@/pages/pgvector/reading/Ivfflat')) },
      { slug: 'hnsw', title: '04. HNSW', hint: '여러 층의 도로망과 지름길', view: lazy(() => import('@/pages/pgvector/reading/Hnsw')) },
      { slug: 'storage', title: '05. RAM, SSD와 Random Access', hint: '캐시 · working set · I/O', view: lazy(() => import('@/pages/pgvector/reading/Storage')) },
      { slug: 'diskann', title: '06. StreamingDiskANN', hint: 'SSD를 고려한 그래프 · 후보 공급', view: lazy(() => import('@/pages/pgvector/reading/Diskann')) },
      { slug: 'sbq', title: '07. SBQ', hint: '통계로 벡터를 작게 표현하기', view: lazy(() => import('@/pages/pgvector/reading/Sbq')) },
      { slug: 'filtering', title: '08. Filtered Vector Search', hint: '일반 WHERE · 라벨 필터링', view: lazy(() => import('@/pages/pgvector/reading/Filtering')) },
      { slug: 'when-to-use', title: '09. 기술 비교와 선택 기준', hint: '규모 · 정확도 · 비용을 함께', view: lazy(() => import('@/pages/pgvector/reading/Comparison')) },
      { slug: 'glossary', title: '10. 용어집과 복습', hint: '핵심 용어와 열 가지 질문', view: lazy(() => import('@/pages/pgvector/reading/Glossary')) },
    ],
  },
  {
    week: 'week05', slug: 'pgv-practice', routeSlug: 'pgvector', title: '실습과 실험 · 더 해보기', accent: 'warn',
    pages: [
      { slug: 'labs', title: 'Lab 목록과 실행 순서', hint: '설치 · 거리 연산자 · 인덱스', view: lazy(() => import('@/pages/pgvector/Labs')) },
      { slug: 'install', title: '설치와 SQL 실습', hint: '권한 · 타입 · 실제 출력 · EXPLAIN', view: lazy(() => import('@/pages/pgvector/Install')) },
      { slug: 'join-comparison', title: '비교 Lab · JOIN·전처리·staging', view: lazy(() => import('@/pages/fdw/reading/JoinComparison')) },
    { slug: 'experiments', title: '실험 질문과 결과', hint: '7개 실험 · 재현 절차 · 정정 이력', view: lazy(() => import('@/pages/pgvector/Experiments')) },
    ],
  },
  {
    week: 'week05', slug: 'pgv-advanced', routeSlug: 'pgvector', title: '심화 · 구현과 실측', accent: 'bigm',
    pages: [
      { slug: 'ann-details', title: 'Recall 측정과 실행 계획', hint: '정답 집합 · 버퍼 · 퀴즈', view: lazy(() => import('@/pages/pgvector/Ann')) },
      { slug: 'ivfflat-details', title: 'IVFFlat 구현과 실측', hint: 'lists × probes · 분포 변화', view: lazy(() => import('@/pages/pgvector/Ivfflat')) },
      { slug: 'hnsw-details', title: 'HNSW 구현과 실측', hint: '연결 수 · 빌드 메모리 · VACUUM', view: lazy(() => import('@/pages/pgvector/Hnsw')) },
      { slug: 'hnsw-ivfflat', title: 'HNSW vs IVFFlat 실측', hint: '같은 환경에서 인덱스 비교', view: lazy(() => import('@/pages/pgvector/HnswIvfflat')) },
      { slug: 'tuning', title: '튜닝 곡선과 규모', hint: 'recall · 지연시간 · 데이터 크기', view: lazy(() => import('@/pages/pgvector/Tuning')) },
      { slug: 'diskann-details', title: 'DiskANN 구현과 벤치마크', hint: '파라미터 · 압축 · 외부 벤치마크', view: lazy(() => import('@/pages/pgvector/Diskann')) },
      { slug: 'cost', title: '빌드 비용과 크기', hint: 'halfvec · SBQ · 압축 해제', view: lazy(() => import('@/pages/pgvector/Cost')) },
      { slug: 'filtering-details', title: '필터 검색 실측', hint: 'iterative_scan · 라벨 인덱스', view: lazy(() => import('@/pages/pgvector/Filtering')) },
      { slug: 'selection-details', title: '실측으로 보는 선택 기준', hint: '이 저장소의 수치와 환경 한계', view: lazy(() => import('@/pages/pgvector/WhenToUse')) },
      { slug: 'resources', title: '참고 자료', hint: '공식 문서 · 논문 · 저장소', view: lazy(() => import('@/pages/pgvector/Resources')) },
    ],
  },
  { week: 'week06', slug: 'hll-start', routeSlug: 'hll', title: 'hll · 시작하기', accent: 'ok', pages: [
    { slug: 'about', title: 'hll은 어디에 쓰는가? · 고유 방문자 수를 작게 저장하기', view: lazy(() => import('@/pages/hll/reading/About')) },
  ] },
  { week: 'week06', slug: 'hll-basic', routeSlug: 'hll', title: 'hll · 기본 학습', accent: 'ok', pages: [
    { slug: 'counting', title: '기본 01 · 방문 횟수와 실제 사람 수', view: lazy(() => import('@/pages/hll/reading/Counting')) },
    { slug: 'exact-cost', title: '기본 02 · 정확한 계산은 무엇을 기억할까?', view: lazy(() => import('@/pages/hll/reading/ExactCost')) },
    { slug: 'hashing', title: '기본 03 · hll_hash 함수는 무엇을 하는가?', view: lazy(() => import('@/pages/hll/reading/Hashing')) },
    { slug: 'bits', title: '기본 04 · 동전 던지기에서 HLL의 개수 추정까지', view: lazy(() => import('@/pages/hll/reading/Bits')) },
    { slug: 'probability', title: '기본 05 · 동전 비유를 확률식으로 연결하기', view: lazy(() => import('@/pages/hll/reading/Probability')) },
    { slug: 'registers', title: '기본 06 · HLL 안에 무엇이 저장되는가?', view: lazy(() => import('@/pages/hll/reading/Registers')) },
    { slug: 'estimation', title: '기본 07 · 추정값과 오차를 읽는 법', view: lazy(() => import('@/pages/hll/reading/Estimation')) },
    { slug: 'sql', title: '기본 08 · 설치와 첫 hll 집계', view: lazy(() => import('@/pages/hll/reading/Sql')) },
    { slug: 'union', title: '기본 09 · 숫자를 더하지 말고 스케치를 합치기', view: lazy(() => import('@/pages/hll/reading/Union')) },
    { slug: 'limits', title: '기본 10 · 할 수 없는 질문과 선택 기준', view: lazy(() => import('@/pages/hll/reading/Limits')) },
  ] },
  { week: 'week06', slug: 'hll-explore', routeSlug: 'hll', title: 'hll · 직접 움직여 보기', accent: 'ok', pages: [
    { slug: 'register-lab', title: '레지스터 실험실', view: lazy(() => import('@/pages/hll/RegisterLab')) },
    { slug: 'budget', title: '정밀도와 공간 계산기', view: lazy(() => import('@/pages/hll/Budget')) },
  ] },
  { week: 'week06', slug: 'hll-advanced', routeSlug: 'hll', title: 'hll · 심화', accent: 'ok', pages: [
    { slug: 'math', title: '심화 01 · 최고 rank에서 조화평균과 추정식까지', view: lazy(() => import('@/pages/hll/reading/Math')) },
    { slug: 'storage', title: '심화 02 · EMPTY·EXPLICIT·SPARSE·FULL', view: lazy(() => import('@/pages/hll/reading/Storage')) },
    { slug: 'compatibility', title: '심화 03 · 합칠 수 있는 스케치의 계약', view: lazy(() => import('@/pages/hll/reading/Compatibility')) },
    { slug: 'operations', title: '심화 04 · 공간, 실행 계획, 갱신과 운영', view: lazy(() => import('@/pages/hll/reading/Operations')) },
  ] },
  { week: 'week06', slug: 'hll-labs', routeSlug: 'hll', title: 'hll · 실습과 근거', accent: 'ok', pages: [
    { slug: 'lab-basics', title: 'Lab 01 · 설치·중복·NULL·빈 입력·표현 전이', view: lazy(() => import('@/pages/hll/reading/LabBasics')) },
    { slug: 'lab-union', title: 'Lab 02 · 일별 숫자와 주간 합집합', view: lazy(() => import('@/pages/hll/reading/LabUnion')) },
    { slug: 'lab-precision', title: 'Lab 03 · 정밀도·공간·오차 분포', view: lazy(() => import('@/pages/hll/reading/LabPrecision')) },
    { slug: 'lab-performance', title: 'Lab 04 · 초기 집계와 저장된 스케치 재사용', view: lazy(() => import('@/pages/hll/reading/LabPerformance')) },
    { slug: 'results', title: '실제 결과 · 기능·공간·오차·실행 시간', view: lazy(() => import('@/pages/hll/reading/Results')) },
    { slug: 'resources', title: '용어·근거·검증 범위', view: lazy(() => import('@/pages/hll/reading/Resources')) },
  ] },
  { week: 'week07', slug: 'postgres-fdw', routeSlug: 'postgres-fdw', title: '시작하기', hint: '기본 → 실습 → 심화의 학습 지도', accent: 'ok', pages: [
    { slug: 'about', title: '전체 학습 순서', view: lazy(() => import('@/pages/fdw/About')) },
    { slug: 'industry-cases', title: '국내 기업 사례와 조사 질문', view: lazy(() => import('@/pages/fdw/reading/IndustryCases')) },
    { slug: 'blog-review', title: '블로그 주의사항 검토와 실험', view: lazy(() => import('@/pages/fdw/reading/BlogReview')) },
  ] },
  { week: 'week07', slug: 'fdw-basic', routeSlug: 'postgres-fdw', title: '기본 학습', hint: 'SQL·원격 데이터부터 정확성과 선택까지', accent: 'ok', pages: [
    { slug: 'databases', title: '01. DB 두 개를 함께 읽는다는 것', view: lazy(() => import('@/pages/fdw/reading/Databases')) },
    { slug: 'objects', title: '02. FDW와 네 가지 객체', view: lazy(() => import('@/pages/fdw/reading/Objects')) },
    { slug: 'install', title: '03. 연결·권한·첫 조회', view: lazy(() => import('@/pages/fdw/reading/Connect')) },
    { slug: 'select-joins', title: '04. SELECT와 JOIN의 데이터 흐름', view: lazy(() => import('@/pages/fdw/reading/Queries')) },
    { slug: 'plans', title: '05. 실행 계획과 pushdown', view: lazy(() => import('@/pages/fdw/reading/Explain')) },
    { slug: 'network-basics', title: '06. RTT·대역폭·fetch', view: lazy(() => import('@/pages/fdw/reading/NetworkBasics')) },
    { slug: 'load', title: '07. 연결·세션·동시 부하', view: lazy(() => import('@/pages/fdw/reading/Connections')) },
    { slug: 'transactions', title: '08. 트랜잭션·스냅샷·장애', view: lazy(() => import('@/pages/fdw/reading/Transactions')) },
    { slug: 'related', title: '09. 관련 확장과 설계 선택', view: lazy(() => import('@/pages/fdw/reading/Related')) },
    { slug: 'glossary', title: '10. 용어집과 진단 순서', view: lazy(() => import('@/pages/fdw/reading/Review')) },
  ] },
  { week: 'week07', slug: 'fdw-related', routeSlug: 'postgres-fdw', title: '관련 확장 · 선택과 운영', hint: '대안·검색·관측·캐시의 책임과 제약', accent: 'ok', pages: [
    { slug: 'related-dblink', title: 'dblink · 명시적 원격 SQL과 세션', view: lazy(() => import('@/pages/fdw/reading/RelatedDblink')) },
    { slug: 'related-file-fdw', title: 'file_fdw · 파일 읽기와 적재 선택', view: lazy(() => import('@/pages/fdw/reading/RelatedFile')) },
    { slug: 'related-remote-search', title: 'pg_trgm · 전송과 인덱스의 두 조건', view: lazy(() => import('@/pages/fdw/reading/RelatedSearch')) },
    { slug: 'related-observability', title: 'pg_stat_statements·auto_explain · 관측', view: lazy(() => import('@/pages/fdw/reading/RelatedObserve')) },
    { slug: 'related-cache-cron', title: 'pg_cron · 캐시 갱신과 실패 운영', view: lazy(() => import('@/pages/fdw/reading/RelatedCron')) },
  ] },
  { week: 'week07', slug: 'fdw-labs', routeSlug: 'postgres-fdw', title: '실습과 검증', hint: '자동·수동 Lab 5개와 실제 결과', accent: 'ok', pages: [
    { slug: 'labs', title: 'Week 07 · postgres_fdw Labs', view: lazy(() => import('@/pages/fdw/reading/Labs')) },
    { slug: 'lab-connect', title: 'Lab 01 · 연결과 메타데이터', view: lazy(() => import('@/pages/fdw/reading/LabConnect')) },
    { slug: 'lab-pushdown', title: 'Lab 02 · pushdown·JOIN·원격 검색', view: lazy(() => import('@/pages/fdw/reading/LabPushdown')) },
    { slug: 'lab-fetch', title: 'Lab 03 · FETCH 횟수와 네트워크 모델', view: lazy(() => import('@/pages/fdw/reading/LabFetch')) },
    { slug: 'lab-transactions', title: 'Lab 04 · 스냅샷·롤백·원격 잠금', view: lazy(() => import('@/pages/fdw/reading/LabTransactions')) },
    { slug: 'lab-connections', title: 'Lab 05 · 세션별 연결·관측·관련 확장', view: lazy(() => import('@/pages/fdw/reading/LabConnections')) },
    { slug: 'network', title: '네트워크 가정 계산기', view: lazy(() => import('@/pages/fdw/Network')) },
    { slug: 'join-comparison', title: '비교 Lab · JOIN·전처리·staging', view: lazy(() => import('@/pages/fdw/reading/JoinComparison')) },
    { slug: 'experiments', title: '실험 질문과 결과', view: lazy(() => import('@/pages/fdw/Experiments')) },
  ] },
  { week: 'week07', slug: 'fdw-advanced', routeSlug: 'postgres-fdw', title: '심화 · 구현과 운영', hint: 'planner·cursor·연결·쓰기의 내부 동작', accent: 'ok', pages: [
    { slug: 'planner', title: '심화 01. planner와 shippability', view: lazy(() => import('@/pages/fdw/reading/Planner')) },
    { slug: 'costs', title: '심화 02. 비용·통계·JOIN', view: lazy(() => import('@/pages/fdw/reading/Costs')) },
    { slug: 'cursors', title: '심화 03. cursor·fetch·메모리', view: lazy(() => import('@/pages/fdw/reading/Cursors')) },
    { slug: 'observability', title: '심화 04. 연결·관측·부하', view: lazy(() => import('@/pages/fdw/reading/Observability')) },
    { slug: 'writes', title: '심화 05. 쓰기·잠금·재시도', view: lazy(() => import('@/pages/fdw/reading/Writes')) },
    { slug: 'source', title: '심화 06. 소스 읽기와 운영 설계', view: lazy(() => import('@/pages/fdw/reading/Source')) },
  ] },

  { week: 'extra-joins', slug: 'pg-joins', title: '번외 · PostgreSQL JOIN', hint: '기본 → 심화 → 실행 계획 Lab', accent: 'ok', pages: [
    { slug: 'about', title: '번외 · PostgreSQL JOIN 학습 지도', view: lazy(() => import('@/pages/joins/About')) },
    { slug: 'semantics', title: '기본 01 · JOIN은 어떤 결과를 만드는가?', view: lazy(() => import('@/pages/joins/Semantics')) },
    { slug: 'nested-loop', title: '기본 02 · Nested Loop: 한 명씩 찾아가기', view: lazy(() => import('@/pages/joins/NestedLoop')) },
    { slug: 'hash', title: '기본 03 · Hash Join: 번호별 상자 만들기', view: lazy(() => import('@/pages/joins/Hash')) },
    { slug: 'merge', title: '기본 04 · Merge Join: 정렬된 명단 함께 읽기', view: lazy(() => import('@/pages/joins/Merge')) },
    { slug: 'bitmap', title: '기본 05 · Bitmap은 JOIN 방식인가?', view: lazy(() => import('@/pages/joins/Bitmap')) },
    { slug: 'planning', title: '심화 · 계획 선택, 메모리와 동시 부하', view: lazy(() => import('@/pages/joins/Planning')) },
    { slug: 'labs', title: 'Lab · 같은 결과, 다른 실행 계획', view: lazy(() => import('@/pages/joins/Labs')) },
  ] },

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
  { slug: 'week05', title: 'Week 05 · pgvector · pgvectorscale' },
  { slug: 'week06', title: 'Week 06 · hll' },
  { slug: 'week07', title: 'Week 07 · postgres_fdw' },
  { slug: 'extra-joins', title: '번외 · PostgreSQL JOIN' },
]
export function weekHome(week: string) {
  const section = SECTIONS.find((s) => s.week === week)
  return section ? `/${section.routeSlug ?? section.slug}/${section.pages[0].slug}` : HOME
}
