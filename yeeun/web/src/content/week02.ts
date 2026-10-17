/** week02 — Notion / 공식문서 톤 */

export const week02Meta = {
  week: 'week02',
  extension: 'pg_stat_statements',
  category: '운영 · 성능 진단',
  person: '김예은',
  oneLiner:
    '실행된 SQL을 Query 단위로 누적 집계해, DB 시간을 많이 쓰는 패턴을 찾는 성능 진단 Extension',
  summary: `Slow Query Log나 EXPLAIN만으로는 “무엇을 먼저 볼지”를 정하기 어렵습니다.
pg_stat_statements는 Query Pattern별 calls · mean_exec_time · total_exec_time을
DB View로 제공해 튜닝 우선순위를 잡는 데 사용합니다.`,
  env: {
    postgres: '16.15 (Docker)',
    extversion: '1.10',
    preload: 'pg_stat_statements',
    computeQueryId: 'on',
  },
}

export const week02Sections = [
  {
    id: 'overview',
    title: 'Overview',
    blocks: [
      {
        heading: '정의',
        body: `PostgreSQL contrib Extension. 실행 SQL을 Query Identifier 기준으로 정규화·집계하고,
calls / total_exec_time / mean_exec_time / rows 등을 pg_stat_statements View로 조회합니다.
라이선스: PostgreSQL License. 공식 문서: postgresql.org → pgstatstatements.`,
      },
      {
        heading: '이 노트가 다루는 범위',
        body: `설치(preload + CREATE EXTENSION), 정규화, mean vs total, Managed 지원, lab 실측.
내부 jumble 구현 세부는 선택 절에만 요약합니다.`,
      },
    ],
  },
  {
    id: 'motivation',
    title: 'Motivation',
    blocks: [
      {
        heading: '기존 수단의 한계',
        body: `· Slow Query Log (log_min_duration_statement): 임계값을 넘는 개별 실행만 기록. 짧고 잦은 SQL은 누락되기 쉬움.
· EXPLAIN ANALYZE: 지정한 SQL의 실행 계획에는 강함. “후보 SQL 선정”은 별도 문제.
· pg_stat_activity: 현재 세션 스냅샷. 누적 집계 없음.`,
      },
      {
        heading: 'After',
        body: `Pattern별 통계를 ORDER BY total_exec_time 등으로 조회해 우선순위를 정합니다.
정규화로 상수만 다른 SQL은 동일 패턴의 calls / total에 합산됩니다.`,
      },
      {
        heading: '직관 (한 단락)',
        body: `평균이 큰 SQL과 누적 시간이 큰 SQL은 다를 수 있습니다.
“한 번에 8초 / 하루 1회”와 “한 번에 80ms / 하루 20만 회”를 나란히 두면,
total 관점에서 후자가 DB를 더 오래 붙잡을 수 있습니다. 이 Extension은 그 축을 숫자로 보여 줍니다.`,
      },
    ],
  },
  {
    id: 'normalize',
    title: 'Query normalization',
    blocks: [
      {
        heading: '동작',
        body: `리터럴 상수는 파라미터 자리($1 등)로 치환되고, Query ID로 구조가 식별됩니다.
예: genre = '소설' 과 genre = '과학' → genre = $1 로 동일 row에 누적.`,
      },
      {
        heading: 'Lab 실측',
        body: `books에서 genre만 바꿔 count(*)를 총 6회 실행 → 한 row, calls=6, total_ms≈49.25.
재현: yeeun/week02/lab · ./run.sh 02`,
      },
    ],
  },
  {
    id: 'mean-total',
    title: 'mean_exec_time vs total_exec_time',
    blocks: [
      {
        heading: '정의',
        body: `· mean_exec_time — 1회 평균 실행 시간
· total_exec_time — 누적 실행 시간 (대략 mean × calls)
튜닝 우선순위는 보통 total 쪽을 먼저 봅니다.`,
      },
      {
        heading: 'Lab 실측',
        body: `pg_sleep(소수·느림)과 genre count×50(다수·짧음)을 함께 실행.
mean 정렬 1등 = pg_sleep (avg≈53.58ms), total 정렬 1등 = genre 패턴 (total≈399.84ms).
재현: ./run.sh 03`,
      },
    ],
  },
  {
    id: 'install',
    title: 'Installation',
    blocks: [
      {
        heading: '요구사항',
        body: `Shared Memory에 통계를 쌓으므로 shared_preload_libraries에 모듈을 넣고 재시작해야 합니다.
CREATE EXTENSION은 해당 DB에 View/함수를 등록하는 단계입니다. 둘 다 필요합니다.
compute_query_id = on 권장(환경에 따라 기본값 확인).`,
      },
    ],
  },
  {
    id: 'tradeoff',
    title: 'Trade-offs',
    blocks: [
      {
        heading: '사용',
        body: `반복적으로 자원을 쓰는 SQL 후보 탐색, Slow Query에 안 잡히는 누적 비용, 튜닝 전후 비교.`,
      },
      {
        heading: '비사용 · 대안',
        body: `단일 SQL plan 분석 → EXPLAIN ANALYZE.
역할: pg_stat_statements = “무엇부터?”, EXPLAIN = “왜 느린가?”`,
      },
      {
        heading: '비용',
        body: `Tracking overhead, pg_stat_statements.max에 비례한 메모리, preload 변경 시 재시작.
track_planning 활성 시 고동시성에서 추가 부하 가능(공식 문서 경고).`,
      },
    ],
  },
  {
    id: 'internals',
    title: 'Internals (optional)',
    blocks: [
      {
        heading: '요약 흐름',
        body: `SQL 실행 → Parser/Planner/Executor → Query ID(jumble, 상수 제외 구조 해시)
→ Shared Hash Table 누적 → View 조회 시 Query Text 파일과 조인.`,
      },
    ],
  },
]

export const week02Terms = [
  { term: '정규화', meaning: '리터럴을 파라미터화해 동일 SQL 구조로 집계하는 과정' },
  { term: 'calls', meaning: '해당 패턴 실행 횟수' },
  { term: 'mean_exec_time', meaning: '1회 평균 실행 시간' },
  { term: 'total_exec_time', meaning: '누적 실행 시간. 우선순위 정렬에 자주 사용' },
  { term: 'Slow Query Log', meaning: '임계값 초과 실행만 기록. 누적(total) 관점과 역할이 다름' },
  {
    term: 'shared_preload_libraries',
    meaning: '서버 기동 시 로드할 공유 라이브러리. 본 Extension은 preload + 재시작 필요',
  },
]

export const week02Normalize = {
  title: '실측 · 정규화',
  story: `genre = '소설' / '과학' / '기술' count를 각각 2회(총 6회).`,
  rows: [
    {
      queryid: '6096163514989826317',
      query: 'SELECT count(*) FROM books WHERE genre = $1',
      calls: 6,
      totalMs: 49.25,
      avgMs: 8.208,
    },
  ],
  takeaway: '리터럴이 달라도 한 row · calls=6으로 합쳐짐.',
  sampleSql: `SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '과학';
SELECT count(*) FROM books WHERE genre = '기술';
-- → genre = $1 , calls = 6`,
}

export const week02MeanVsTotal = {
  title: '실측 · mean vs total',
  story: `느린 소수(pg_sleep) vs 잦은 다수(genre count×50).`,
  rows: [
    {
      sort: 'mean_exec_time',
      winner: 'SELECT pg_sleep($1)',
      calls: 2,
      avgMs: 53.58,
      totalMs: 107.16,
      meaning: '1회 평균이 큼',
    },
    {
      sort: 'total_exec_time',
      winner: '… WHERE genre = $1',
      calls: 50,
      avgMs: 8.0,
      totalMs: 399.84,
      meaning: '누적 부하가 큼',
    },
  ],
  takeaway: 'mean 1등 ≠ total 1등. 우선순위는 보통 total.',
}

export const week02Managed = [
  { service: 'AWS RDS PostgreSQL', support: '○', note: 'PG10+ 기본 preload인 경우 많음' },
  { service: 'AWS Aurora', support: '○', note: '지원 목록 포함' },
  { service: 'Supabase', support: '○', note: 'Dashboard / SQL' },
  { service: 'Neon', support: '○', note: '공식 지원' },
  { service: 'GCP Cloud SQL', support: '○', note: '지원 목록 포함' },
]

export const week02Install = {
  conf: `shared_preload_libraries = 'pg_stat_statements'
compute_query_id = on`,
  sql: `SHOW shared_preload_libraries;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT extname, extversion FROM pg_extension
WHERE extname = 'pg_stat_statements';`,
}

export const week02LabCommands = [
  { cmd: './run.sh', meaning: '전체 실측' },
  { cmd: './run.sh 02', meaning: '정규화' },
  { cmd: './run.sh 03', meaning: 'mean vs total' },
  { cmd: './run.sh down', meaning: '초기화' },
]

export const week02Roles = `pg_stat_statements  →  무엇부터 튜닝할지
EXPLAIN ANALYZE     →  왜 느린지`

export const week02Extra = 'PG18 사용 시 Minor 확인. 보안 수정 18.6+ 권장 (2026-08).'
