/* ===========================================================================
 * 실험 10 — 1글자 검색은 왜 pg_bigm 에서만 되나 (부분 일치 / comparePartial)
 * 재현: week02/bigm-vs-trgm/experiments/10-one-char-and-partial-match/bench.sh
 * 측정: PostgreSQL 16.15 / pg_bigm 1.2 / pg_trgm 1.6 / 200,000행
 * 시간은 2회차 값. 결정적 지표는 2회 실행 전부 동일했다.
 * =========================================================================== */

/** 색인하는 쪽(extractValue) — 1글자 낱말이면 양쪽 다 조각이 나온다 */
export const EXTRACT_VALUE = [
  { src: '클', bigm: [' 클', '클 '], trgmCount: 2 },
  { src: '클럽', bigm: [' 클', '럽 ', '클럽'], trgmCount: 3 },
  { src: '클라우드', bigm: [' 클', '드 ', '라우', '우드', '클라'], trgmCount: 5 },
]

/** 연산자 클래스 카탈로그를 직접 읽은 것 — 사슬의 양 끝이 여기 있다 */
export const OPCLASS = [
  {
    name: 'gin_bigm_ops',
    entryType: 'text',
    entryNote: 'opckeytype = 0 — 입력 타입 그대로',
    sorted: '사전순',
    comparePartial: 'gin_bigm_compare_partial',
  },
  {
    name: 'gin_trgm_ops',
    entryType: 'int4',
    entryNote: 'CRC32 해시',
    sorted: '해시값 순 — 원문 순서와 무관',
    comparePartial: null,
  },
]

export type OneCharRow = {
  eng: 'none' | 'bigm' | 'trgm'
  len: string
  pattern: string
  answer: number
  plan: string
  used: string | null
  idxRows: number | null
  recheck: number
  buf: number
  ms: number
}

const r = (
  eng: OneCharRow['eng'], len: string, pattern: string, answer: number,
  plan: string, used: string | null, idxRows: number | null, recheck: number, buf: number, ms: number,
): OneCharRow => ({ eng, len, pattern, answer, plan, used, idxRows, recheck, buf, ms })

export const ONE_CHAR: OneCharRow[] = [
  r('none', '1글자', '%ퟛ%', 400, 'Parallel Seq Scan', null, null, 0, 3225, 27.119),
  r('bigm', '1글자', '%ퟛ%', 400, 'Bitmap Index Scan', 'docs_bigm', 400, 0, 404, 1.421),
  r('trgm', '1글자', '%ퟛ%', 400, 'Parallel Seq Scan', null, null, 0, 3225, 26.516),
]

export const BY_LENGTH: OneCharRow[] = [
  ...ONE_CHAR,
  r('none', '2글자', '%ퟛ가%', 200, 'Parallel Seq Scan', null, null, 0, 3225, 25.445),
  r('bigm', '2글자', '%ퟛ가%', 200, 'Bitmap Index Scan', 'docs_bigm', 200, 0, 204, 0.710),
  r('trgm', '2글자', '%ퟛ가%', 200, 'Parallel Seq Scan', null, null, 0, 3225, 37.238),
  r('none', '3글자', '%ퟛ가운%', 200, 'Parallel Seq Scan', null, null, 0, 3225, 26.282),
  r('bigm', '3글자', '%ퟛ가운%', 200, 'Bitmap Index Scan', 'docs_bigm', 200, 0, 207, 0.907),
  r('trgm', '3글자', '%ퟛ가운%', 200, 'Bitmap Index Scan', 'docs_trgm', 200, 0, 204, 0.880),
]

/** 사슬을 한 줄씩 — 페이지에서 그대로 그린다 */
export const CHAIN = [
  { step: 'pg_bigm 은 조각을 해싱하지 않는다', evidence: '소스: bigm 구조체가 원본 바이트를 담는다' },
  { step: 'GIN 엔트리 타입이 text 다', evidence: 'pg_opclass.opckeytype = 0 (입력 타입 그대로)' },
  { step: '엔트리 트리가 사전순으로 정렬된다', evidence: 'GIN 엔트리 트리는 B-tree 다' },
  { step: "'클' 로 시작하는 조각이 연속 구간에 모인다", evidence: '클가 · 클나 · … · 클힣 · 클␣ 가 이웃이 된다' },
  { step: 'comparePartial 로 그 구간을 훑을 수 있다', evidence: 'pg_amproc 5번 = gin_bigm_compare_partial' },
  { step: '1글자 검색이 인덱스를 탄다', evidence: '버퍼 3,225 → 404 · 27.1 → 1.42 ms' },
]

export const ONECHAR_ENV = {
  rows: 200000,
  marker: 'ퟛ (U+D7DB)',
  repo: '../../week02/bigm-vs-trgm/experiments/10-one-char-and-partial-match',
}
