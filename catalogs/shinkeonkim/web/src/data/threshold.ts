/* ===========================================================================
 * pg_trgm 실험 02 — 임계값 스윕 · 유사도 3형제 재현율 · KNN 비용
 * 재현: week02/pg_trgm/experiments/02-threshold-and-knn-latency
 * 측정: PostgreSQL 16 / pg_trgm 1.6 / 200,006행 / 정답 6건을 id 로 특정
 * 임계값 스윕과 재현율은 4회 실행 전부 동일. KNN LIMIT 1 만 재현되지 않는다.
 * =========================================================================== */

export const THRESHOLD_SWEEP = [
  { t: 0.6, matched: 3, idxRows: 6, buf: 38, ms: 0.31 },
  { t: 0.5, matched: 4, idxRows: 6, buf: 38, ms: 0.37 },
  { t: 0.4, matched: 5, idxRows: 7, buf: 38, ms: 0.35 },
  { t: 0.3, matched: 5, idxRows: 9, buf: 38, ms: 0.43, isDefault: true },
  { t: 0.2, matched: 6, idxRows: 29, buf: 38, ms: 0.97 },
  { t: 0.1, matched: 7, idxRows: 253, buf: 38, ms: 4.91 },
  { t: 0.05, matched: 51, idxRows: 12130, buf: 37, ms: 162.06 },
]

/** 심어둔 정답 6건의 점수 — similarity 만 문서 길이를 따라 떨어진다 */
export const THREE_SIM_RECALL = [
  { doc: '클라우드클럽 스터디', len: 10, sim: 1.0, word: 1.0, strict: 1.0 },
  { doc: '클라으드클럽 스터디 (오타)', len: 10, sim: 0.5714, word: 0.5714, strict: 0.5714 },
  { doc: '클라우드 클럽 스터디', len: 11, sim: 0.6923, word: 0.6923, strict: 0.6923 },
  { doc: '클라우드클럽 스터디 모임', len: 13, sim: 0.7857, word: 1.0, strict: 1.0 },
  { doc: '클라우드클럽 스터디 10기 참여 안내 공지입니다', len: 26, sim: 0.4074, word: 1.0, strict: 1.0 },
  { doc: '오늘 클라우드클럽 스터디 에서 인덱스 튜닝을 …', len: 45, sim: 0.25, word: 1.0, strict: 1.0 },
]

export const DEFAULT_RECALL = [
  { op: '%', name: 'similarity', threshold: 0.3, caught: 5, missed: '가장 긴 문서 (45글자, 0.2500 < 0.3)' },
  { op: '%>', name: 'word_similarity', threshold: 0.6, caught: 5, missed: '오타가 있는 문서 (0.5714 < 0.6)' },
  { op: '%>>', name: 'strict_word_similarity', threshold: 0.5, caught: 6, missed: null },
]

/** KNN — LIMIT 1 만 재현되지 않아 4회 관측을 그대로 싣는다 */
export const KNN = [
  { limit: 1, buffers: [65, 117, 144, 156], ms: 1.7, note: '3.5배 범위 — 재현되지 않는다' },
  { limit: 5, buffers: [3853, 3869, 3878, 3883], ms: 58, note: null },
  { limit: 10, buffers: [4223, 4229, 4235, 4235], ms: 60, note: null },
  { limit: 50, buffers: [4263, 4269, 4275, 4275], ms: 61, note: null },
  { limit: 100, buffers: [4313, 4319, 4325, 4325], ms: 66, note: null },
]

export const KNN_NOINDEX = { buffers: 3299, ms: 610, note: 'LIMIT 과 무관하게 정확히 3,299 — 20만 행 전부의 거리를 계산한 뒤 자른다' }

export const TH_ENV = { rows: 200006, answers: 6, repo: '../../week02/pg_trgm/experiments/02-threshold-and-knn-latency' }
