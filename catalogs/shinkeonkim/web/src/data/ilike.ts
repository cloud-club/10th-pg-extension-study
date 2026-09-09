/* ===========================================================================
 * 실험 09 — ILIKE 는 실제로 빨라지는가
 * 재현: week02/bigm-vs-trgm/experiments/09-ilike-and-case-insensitive/bench.sh
 * 측정: PostgreSQL 16.15 / pg_bigm 1.2 / pg_trgm 1.6 / 200,000행
 * 시간은 2회차 값. 결정적 지표(정답·플랜·쓴 인덱스·후보·recheck·버퍼)는 2회 실행 전부 동일했다.
 * =========================================================================== */

export type Eng = 'none' | 'bigm' | 'trgm' | 'lbigm' | 'ltrgm' | 'tsv'

export type Row = {
  eng: Eng
  label: string
  cond: string
  answer: number
  plan: string
  used: string | null
  ok: boolean
  idxRows: number | null
  recheck: number
  buf: number
  ms: number
  /** 1회차 시간 — 시간이 얼마나 흔들리는지 보여주려고 같이 싣는다 */
  ms1: number
}

const r = (
  eng: Eng, label: string, cond: string, answer: number, plan: string, used: string | null,
  ok: boolean, idxRows: number | null, recheck: number, buf: number, ms: number, ms1: number,
): Row => ({ eng, label, cond, answer, plan, used, ok, idxRows, recheck, buf, ms, ms1 })

/** A. LIKE vs ILIKE (ASCII, 대소문자 섞인 표기) */
export const A_CASE: Row[] = [
  r('none', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Parallel Seq Scan', null, true, null, 0, 7488, 73.699, 63.659),
  r('bigm', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 222, 1.190, 0.495),
  r('trgm', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 600, 400, 622, 1.402, 7.185),
  r('none', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, true, null, 0, 7488, 298.743, 217.748),
  r('bigm', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, false, null, 0, 7488, 137.577, 698.846),
  r('trgm', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_trgm', true, 600, 0, 622, 1.707, 4.520),
]

/** B. 2글자 함정이 ILIKE 에도 오는가 */
export const B_TWOCHAR: Row[] = [
  r('none', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, true, null, 0, 7488, 155.212, 163.663),
  r('bigm', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, false, null, 0, 7488, 213.539, 178.649),
  r('trgm', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, false, null, 0, 7488, 165.867, 153.046),
]

/** C. 대소문자가 없는 한글에서도 ILIKE 값을 치르는가 */
export const C_KOREAN: Row[] = [
  r('none', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, true, null, 0, 7488, 41.100, 44.923),
  r('bigm', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 216, 0.722, 0.862),
  r('trgm', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 200, 0, 213, 0.497, 0.855),
  r('none', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, true, null, 0, 7488, 190.503, 178.471),
  r('bigm', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, false, null, 0, 7488, 182.983, 202.412),
  r('trgm', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 200, 0, 213, 0.738, 0.960),
]

/** D. pg_bigm 의 대안 — lower() 함수 인덱스 */
export const D_LOWER: Row[] = [
  r('none', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, true, null, 0, 7488, 142.807, 145.598),
  r('lbigm', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_lbigm', true, 600, 0, 622, 1.746, 1.573),
  r('ltrgm', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_ltrgm', true, 600, 0, 622, 1.580, 2.002),
]

/** E. 정규식 ~* */
export const E_REGEX: Row[] = [
  r('none', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Parallel Seq Scan', null, true, null, 0, 7488, 37.951, 79.697),
  r('bigm', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Parallel Seq Scan', null, false, null, 0, 7488, 30.820, 104.453),
  r('trgm', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Bitmap Index Scan', 'docs_trgm', true, 600, 0, 622, 1.438, 1.496),
]

/* --------------------------------------------------------------------------
 * F. 코어 전문검색(to_tsvector + GIN)과 견주면
 *
 * tsquery 는 '낱말' 을, LIKE 는 '부분 문자열' 을 찾는다. F1·F2 는 마커를 낱말로 심어
 * **정답 행 수가 우연히 같아지도록 만든 구간**이다 - 속도만 나란히 보려고 만든 조건이고,
 * 그게 성립하지 않는 경우가 F3 다.
 * ------------------------------------------------------------------------ */
export const F_ASCII: Row[] = [
  r('tsv', "tsv @@ to_tsquery('cloudclub')", "tsv @@ to_tsquery('simple','cloudclub')", 600, 'Bitmap Index Scan', 'docs_tsv', true, 600, 0, 604, 0.696, 0.720),
  r('trgm', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_trgm', true, 600, 0, 622, 1.683, 2.204),
  r('lbigm', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_lbigm', true, 600, 0, 622, 1.735, 3.605),
]

export const F_KOREAN: Row[] = [
  r('tsv', "tsv @@ to_tsquery('클라우드클럽')", "tsv @@ to_tsquery('simple','클라우드클럽')", 200, 'Bitmap Index Scan', 'docs_tsv', true, 200, 0, 204, 0.357, 0.414),
  r('bigm', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 216, 0.477, 0.468),
]

/** F3. 낱말 '가운데' 를 찾으면 — 여기서 정답이 갈린다 */
export const F_INSIDE: Row[] = [
  r('tsv', "tsv @@ to_tsquery('우드클럽')", "tsv @@ to_tsquery('simple','우드클럽')", 0, 'Bitmap Index Scan', 'docs_tsv', true, 0, 0, 4, 0.109, 0.087),
  r('bigm', "LIKE '%우드클럽%'", "doc LIKE '%우드클럽%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 210, 0.486, 0.566),
  r('none', "LIKE '%우드클럽%'", "doc LIKE '%우드클럽%'", 200, 'Parallel Seq Scan', null, true, null, 0, 7488, 56.479, 120.571),
]

export const IDX_SIZE_MB = [
  { name: 'docs_bigm', mb: 35, what: 'gin_bigm_ops (doc)' },
  { name: 'docs_lbigm', mb: 35, what: 'gin_bigm_ops (lower(doc))' },
  { name: 'docs_tsv', mb: 44, what: 'gin (tsvector) — 코어 전문검색' },
  { name: 'docs_trgm', mb: 57, what: 'gin_trgm_ops (doc)' },
  { name: 'docs_ltrgm', mb: 57, what: 'gin_trgm_ops (lower(doc))' },
]

/** 심어둔 대소문자 변형 — LIKE 와 ILIKE 의 정답 행 수가 설계로 달라진다 */
export const SEED = [
  { mod: 0, text: 'CloudClub', hit: "LIKE '%CloudClub%' (200행) · ILIKE (600행 중 하나)" },
  { mod: 250, text: 'CLOUDCLUB', hit: 'ILIKE 만' },
  { mod: 500, text: 'cloudclub', hit: 'ILIKE 만' },
  { mod: 750, text: '클라우드클럽', hit: '대소문자가 없는 대조군 (200행)' },
  { mod: 100, text: 'Zx', hit: '2글자 마커 (201행 — 말뭉치에 1건 있었다)' },
]

export const ILIKE_ENV = {
  pg: 'PostgreSQL 16.15',
  rows: 200000,
  repo: '../../week02/bigm-vs-trgm/experiments/09-ilike-and-case-insensitive',
  reproduced: true,
}
