/* ===========================================================================
 * 실험 09 — ILIKE 는 실제로 빨라지는가
 * 재현: week02/bigm-vs-trgm/experiments/09-ilike-and-case-insensitive/bench.sh
 * 측정: PostgreSQL 16.15 / pg_bigm 1.2 / pg_trgm 1.6 / 200,000행
 * 시간은 2회차 값. 결정적 지표(정답·플랜·쓴 인덱스·후보·recheck·버퍼)는 2회 실행 전부 동일했다.
 * =========================================================================== */

export type Eng = 'none' | 'bigm' | 'trgm' | 'lbigm' | 'ltrgm'

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
  r('none', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Parallel Seq Scan', null, true, null, 0, 3226, 17.093, 21.286),
  r('bigm', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 222, 0.556, 0.611),
  r('trgm', "LIKE '%CloudClub%'", "doc LIKE '%CloudClub%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 600, 400, 621, 1.276, 2.326),
  r('none', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, true, null, 0, 3226, 56.038, 56.286),
  r('bigm', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, false, null, 0, 3226, 52.550, 53.717),
  r('trgm', "ILIKE '%cloudclub%'", "doc ILIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_trgm', true, 600, 0, 621, 1.459, 1.739),
]

/** B. 2글자 함정이 ILIKE 에도 오는가 */
export const B_TWOCHAR: Row[] = [
  r('none', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, true, null, 0, 3226, 79.046, 52.958),
  r('bigm', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, false, null, 0, 3226, 54.686, 50.868),
  r('trgm', "ILIKE '%zx%'", "doc ILIKE '%zx%'", 201, 'Parallel Seq Scan', null, false, null, 0, 3226, 58.153, 54.219),
]

/** C. 대소문자가 없는 한글에서도 ILIKE 값을 치르는가 */
export const C_KOREAN: Row[] = [
  r('none', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, true, null, 0, 3226, 17.206, 13.391),
  r('bigm', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_bigm', true, 200, 0, 216, 1.054, 1.540),
  r('trgm', "LIKE '%클라우드클럽%'", "doc LIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 200, 0, 213, 0.645, 0.648),
  r('none', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, true, null, 0, 3226, 61.234, 70.202),
  r('bigm', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Parallel Seq Scan', null, false, null, 0, 3226, 54.001, 64.495),
  r('trgm', "ILIKE '%클라우드클럽%'", "doc ILIKE '%클라우드클럽%'", 200, 'Bitmap Index Scan', 'docs_trgm', true, 200, 0, 213, 0.746, 0.632),
]

/** D. pg_bigm 의 대안 — lower() 함수 인덱스 */
export const D_LOWER: Row[] = [
  r('none', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Parallel Seq Scan', null, true, null, 0, 3226, 50.846, 54.876),
  r('lbigm', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_lbigm', true, 600, 0, 621, 1.509, 1.478),
  r('ltrgm', "lower(doc) LIKE '%cloudclub%'", "lower(doc) LIKE '%cloudclub%'", 600, 'Bitmap Index Scan', 'docs_ltrgm', true, 600, 0, 621, 1.505, 1.777),
]

/** E. 정규식 ~* */
export const E_REGEX: Row[] = [
  r('none', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Parallel Seq Scan', null, true, null, 0, 3226, 37.951, 29.954),
  r('bigm', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Parallel Seq Scan', null, false, null, 0, 3226, 30.820, 46.592),
  r('trgm', "~* 'cloudclub'", "doc ~* 'cloudclub'", 600, 'Bitmap Index Scan', 'docs_trgm', true, 600, 0, 621, 1.438, 1.649),
]

export const IDX_SIZE_MB = [
  { name: 'docs_bigm', mb: 32, what: 'gin_bigm_ops (doc)' },
  { name: 'docs_lbigm', mb: 32, what: 'gin_bigm_ops (lower(doc))' },
  { name: 'docs_trgm', mb: 54, what: 'gin_trgm_ops (doc)' },
  { name: 'docs_ltrgm', mb: 54, what: 'gin_trgm_ops (lower(doc))' },
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
