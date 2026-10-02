/**
 * hstore 페이지가 공유하는 데이터 접근과 서식.
 * 화면에 올라가는 수치는 전부 여기서 읽은 실측값이다 — 손으로 적은 숫자를 페이지에 넣지 않는다.
 */
import exp from '@/data/hstore-experiments.json'
import demo from '@/data/hstore-demo.json'

export { exp, demo }

/** 바이트를 읽기 좋게: 1000 미만은 B, 그 위는 KB/MB (10진 단위). */
export function fmtBytes(n: number) {
  if (n < 1000) return `${Math.round(n).toLocaleString('ko-KR')} B`
  if (n < 1e6) return `${(n / 1e3).toFixed(1)} KB`
  return `${(n / 1e6).toFixed(1)} MB`
}

export const fmtMs = (n: number) => (n < 10 ? `${n.toFixed(2)} ms` : `${n.toFixed(1)} ms`)
export const fmtNum = (n: number) => Math.round(n).toLocaleString('ko-KR')
export const fmtTps = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}/s`
export const ratio = (a: number, b: number) => `${(a / b).toFixed(1)}배`

/** 중앙값과 관측 범위를 한 문자열로. */
export function range(s: { median: number; min: number; max: number }, f: (n: number) => string = fmtNum) {
  return `${f(s.median)} (${f(s.min)}~${f(s.max)})`
}

export const storageCell = (keys: number, profile: 'low' | 'high') =>
  exp.storage.cells.find((c) => c.keys === keys && c.profile === profile)!
