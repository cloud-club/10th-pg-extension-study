/* ===========================================================================
 * 실험 08 — 공백과 구두점은 조각에 어떻게 들어가나
 * 재현: week02/bigm-vs-trgm/experiments/08-space-and-punctuation/bench.sh
 * 측정: PostgreSQL 16.15 / pg_bigm 1.2 / pg_trgm 1.6 / 200,000행(주입 200)
 * =========================================================================== */

export const FRAGMENTS = [
  {
    src: '클라우드 클럽',
    note: '가운데 공백 하나',
    bigm: [' 클', '드 ', '라우', '럽 ', '우드', '클라', '클럽'],
    trgm: null, // 한글은 CRC32 해시라 눈으로 못 읽는다 — 개수만 같다(7개)
    trgmCount: 7,
  },
  {
    src: '클라우드클럽',
    note: '같은 글자, 공백만 뺐다',
    bigm: [' 클', '드클', '라우', '럽 ', '우드', '클라', '클럽'],
    trgm: null,
    trgmCount: 7,
  },
  {
    src: 'ab cd',
    note: '같은 규칙을 눈으로 읽으려고 ASCII 로',
    bigm: [' a', ' c', 'ab', 'b ', 'cd', 'd '],
    trgm: ['  a', '  c', ' ab', ' cd', 'ab ', 'cd '],
    trgmCount: 6,
  },
  {
    src: 'abcd',
    note: '공백을 뺐더니 bc 가 생긴다',
    bigm: [' a', 'ab', 'bc', 'cd', 'd '],
    trgm: ['  a', ' ab', 'abc', 'bcd', 'cd '],
    trgmCount: 5,
  },
  {
    src: '192.168.0.1',
    note: '구두점 — 여기서 갈린다',
    bigm: [' 1', '.0', '.1', '0.', '1 ', '16', '19', '2.', '68', '8.', '92'],
    trgm: ['  0', '  1', ' 0 ', ' 1 ', ' 16', ' 19', '168', '192', '68 ', '92 '],
    trgmCount: 10,
  },
  {
    src: 'foo|bar',
    note: 'pg_trgm 공식 문서가 든 예시와 글자까지 같다',
    bigm: [' f', 'ar', 'ba', 'fo', 'oo', 'o|', 'r ', '|b'],
    trgm: ['  b', '  f', ' ba', ' fo', 'ar ', 'bar', 'foo', 'oo '],
    trgmCount: 8,
  },
] as const

export type Probe = {
  eng: 'none' | 'bigm' | 'trgm'
  pattern: string
  answer: number
  plan: string
  used: string | null
  idxRows: number | null
  recheck: number
  buf: number
  ms: number
}

/** B. 공백이 든 패턴 + 대조군(공백 없는 2글자) */
export const SPACE_PROBES: Probe[] = [
  { eng: 'none', pattern: '%드 클%', answer: 202, plan: 'Parallel Seq Scan', used: null, idxRows: null, recheck: 0, buf: 3226, ms: 82.595 },
  { eng: 'bigm', pattern: '%드 클%', answer: 202, plan: 'Bitmap Index Scan', used: 'docs_bigm', idxRows: 226, recheck: 24, buf: 231, ms: 1.602 },
  { eng: 'trgm', pattern: '%드 클%', answer: 202, plan: 'Bitmap Index Scan', used: 'docs_trgm', idxRows: 897, recheck: 695, buf: 806, ms: 2.164 },
  { eng: 'none', pattern: '%클럽%', answer: 250, plan: 'Parallel Seq Scan', used: null, idxRows: null, recheck: 0, buf: 3226, ms: 48.512 },
  { eng: 'bigm', pattern: '%클럽%', answer: 250, plan: 'Bitmap Index Scan', used: 'docs_bigm', idxRows: 250, recheck: 0, buf: 251, ms: 2.543 },
  { eng: 'trgm', pattern: '%클럽%', answer: 250, plan: 'Parallel Seq Scan', used: null, idxRows: null, recheck: 0, buf: 3226, ms: 26.119 },
]

/** C. 공백으로 감싸는 우회 */
export const WRAP_PROBES: Probe[] = [
  { eng: 'bigm', pattern: '% 클럽 %', answer: 203, plan: 'Bitmap Index Scan', used: 'docs_bigm', idxRows: 204, recheck: 1, buf: 214, ms: 0.716 },
  { eng: 'trgm', pattern: '% 클럽 %', answer: 203, plan: 'Bitmap Index Scan', used: 'docs_trgm', idxRows: 209, recheck: 6, buf: 219, ms: 1.272 },
]

export const WS_ENV = {
  pg: 'PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)',
  rows: 200000,
  injected: 200,
  repo: '../../week02/bigm-vs-trgm/experiments/08-space-and-punctuation',
}
