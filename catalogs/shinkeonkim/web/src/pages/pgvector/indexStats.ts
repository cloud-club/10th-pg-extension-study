/**
 * IVFFlat·HNSW 설명 페이지의 실측값. scripts/capture-pgvector-index-demo.py 가 임시 DB에서 만든
 * src/data/pgvector-index-demo.json 만 읽는다. 같은 설정을 RUNS 번 다시 만들어 쟀으므로 평균과 범위를 함께 쓴다.
 */
import ix from '@/data/pgvector-index-demo.json'
import { avg } from './stats'

export { ix }
export const ds = ix.dataset

type Measured = { recall: number; buffers_per_query: number; ms_per_query: number; build_ms: number; index_mb: number }
/** 같은 설정의 여러 실행을 평균한다. lo/hi 는 recall 의 최솟값·최댓값. */
function summarize<T extends Measured>(rows: T[]) {
  if (rows.length === 0) throw new Error('해당 설정의 측정값이 없다')
  const r = rows.map((x) => x.recall)
  return {
    recall: avg(r), recallLo: Math.min(...r), recallHi: Math.max(...r),
    buffers: avg(rows.map((x) => x.buffers_per_query)),
    ms: avg(rows.map((x) => x.ms_per_query)),
    buildMs: avg(rows.map((x) => x.build_ms)),
    mb: avg(rows.map((x) => x.index_mb)),
    runs: rows.length,
  }
}

export const IVF_LISTS = [...new Set(ix.ivfflat.map((r) => r.lists))]
export const IVF_PROBES = [...new Set(ix.ivfflat.map((r) => r.probes))]
export const ivf = (lists: number, probes: number) => summarize(ix.ivfflat.filter((r) => r.lists === lists && r.probes === probes))
export const ivfHas = (lists: number, probes: number) => ix.ivfflat.some((r) => r.lists === lists && r.probes === probes)

export const HNSW_EF = [...new Set(ix.hnsw.map((r) => r.ef_search))]
export const hnsw = (m: number, efc: number, ef: number) =>
  summarize(ix.hnsw.filter((r) => r.m === m && r.ef_construction === efc && r.ef_search === ef))
/** 빌드 파라미터 조합. ef_construction=64 로 m 만 바꾼 것과, m=16 으로 ef_construction 만 바꾼 것. */
export const M_SWEEP = [...new Set(ix.hnsw.filter((r) => r.ef_construction === 64).map((r) => r.m))]
export const EFC_SWEEP = [...new Set(ix.hnsw.filter((r) => r.m === 16).map((r) => r.ef_construction))].sort((a, b) => a - b)

export const shift = (index: 'ivfflat' | 'hnsw') => {
  const rows = ix.shift.results.filter((r) => r.index === index)
  return {
    setting: rows[0].setting,
    before: avg(rows.map((r) => r.before_reindex.recall)), beforeAll: rows.map((r) => r.before_reindex.recall),
    after: avg(rows.map((r) => r.after_reindex.recall)), afterAll: rows.map((r) => r.after_reindex.recall),
  }
}
export const vacuumMs = (index: string) => avg(ix.vacuum.results.filter((r) => r.index === index).map((r) => r.vacuum_ms))
export const mwm = (setting: '1GB' | '1MB') => ix.mwm.results.filter((r) => r.maintenance_work_mem === setting)

/** pgvector 의 층 배정: level = floor(-ln(U) · mL), mL = 1/ln(m) → P(level ≥ L) = (1/m)^L. 측정이 아니라 계산값이다. */
export const expectedAtLevel = (rows: number, m: number, level: number) => rows * Math.pow(1 / m, level)
