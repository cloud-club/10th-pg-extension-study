/**
 * pgvector·pgvectorscale 페이지가 공유하는 데이터 접근과 서식.
 * 화면에 올라가는 수치는 전부 여기서 읽은 실측값이다 — 손으로 적은 숫자를 페이지에 넣지 않는다.
 *   exp  : scripts/sync-pgvector-results.py 가 week05/experiments/<실험>/results 에서 옮긴 요약
 *   demo : scripts/capture-pgvector-demo.py 가 임시 DB에서 실행한 SQL과 실제 출력
 */
import exp from '@/data/pgvector-experiments.json'
import demo from '@/data/pgvector-demo.json'

export { exp, demo }

type Demo = { sql: string; output: string }
/** 데모 항목 하나. 없는 이름을 쓰면 빌드 시점이 아니라 화면에서 바로 드러나도록 예외를 던진다. */
export function d(name: keyof typeof demo): Demo {
  const v = demo[name] as unknown
  if (typeof v !== 'object' || v === null) throw new Error(`demo.${String(name)} 는 출력이 없는 항목이다`)
  return v as Demo
}

export const fmtNum = (n: number) => Math.round(n).toLocaleString('ko-KR')
export const fmtMs = (n: number) => (n < 10 ? `${n.toFixed(2)} ms` : `${n.toFixed(1)} ms`)
export const fmtSec = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(2)}초` : `${(ms / 1000).toFixed(1)}초`)
export const fmtMb = (n: number) => `${n.toFixed(1)} MB`
export const ratio = (a: number, b: number) => `${(a / b).toFixed(1)}배`
export const r2 = (n: number) => n.toFixed(2)
export const r3 = (n: number) => n.toFixed(3)
export const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

type Cfg = { config: string }
export function pick<T extends Cfg>(list: T[], name: string): T {
  const c = list.find((x) => x.config === name)
  if (!c) throw new Error(`설정 ${name} 이 실험 요약에 없다`)
  return c
}

export const env = exp.environment
export const recall = exp.recall
export const build = exp.build
export const scale = exp.scale
export const halfvec = exp.halfvec
export const filter = exp.filter
export const fCorrect = exp.filter.datasets.correct
export const fDup = exp.filter.datasets.duplicate_bug

export const envTags = [
  { label: env.postgres },
  { label: `pgvector ${env.vector_version}` },
  { label: `pgvectorscale ${env.vectorscale_version}` },
]
