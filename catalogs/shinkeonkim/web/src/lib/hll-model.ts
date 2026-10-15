/** 8비트 교육 모형. 실제 확장의 해시·비트 배치·추정기가 아니다. */
export function toyStep(bits: string) {
  if (!/^[01]{8}$/.test(bits)) throw new Error('8자리 이진 패턴이 필요합니다.')
  const bucket = Number.parseInt(bits.slice(0, 2), 2)
  const suffix = bits.slice(2)
  const firstOne = suffix.indexOf('1')
  const rank = (firstOne < 0 ? suffix.length : firstOne) + 1
  return { bucket, rank, suffix }
}
export function toyRegisters(hashes: string[]) {
  const registers = [0, 0, 0, 0]
  return hashes.map((bits) => {
    const step = toyStep(bits)
    const before = registers[step.bucket]
    registers[step.bucket] = Math.max(before, step.rank)
    return { bits, ...step, before, changed: registers[step.bucket] > before, registers: [...registers] }
  })
}
export function hllBudget(log2m: number, regwidth: number) {
  const m = 2 ** log2m
  return { m, rsePercent: 104 / Math.sqrt(m), payloadBytes: m * regwidth / 8 }
}
