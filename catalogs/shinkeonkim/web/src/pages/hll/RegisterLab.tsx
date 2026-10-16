import { useState } from 'react'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { toyRegisters, toyStep } from '@/lib/hll-model'

const example = ['00100000', '01001000', '01010000', '10000100', '01001000']
const tenValues = ['00101100','01010011','10011010','11100001','00010110','01110000','10001011','11011001','00111010','10101010']
const other = toyRegisters(['00010000', '10100000', '11001000']).at(-1)!.registers
export default function RegisterLab() {
  const [input, setInput] = useState('01001000')
  const [hashes, setHashes] = useState<string[]>([])
  const rows = toyRegisters(hashes)
  const current = rows.at(-1)?.registers ?? [0, 0, 0, 0]
  const valid = /^[01]{8}$/.test(input)
  const candidate = valid ? toyStep(input) : null
  function add() { if (valid) setHashes((values) => [...values, input]) }
  return <>
    <PageHeader eyebrow="Week 06 · hll · 손계산" title="레지스터 실험실" lede="패턴 하나씩 적용하며 max 갱신·중복·합집합을 확인합니다." />
    <Section id="model" title="8비트 교육 모형">
      <p>앞 2비트는 버킷 0–3, 뒤 6비트는 앞쪽 연속된 0의 개수 + 1을 rank로 읽습니다. 실제 hll은 64비트 해시와 다른 비트 방향을 사용합니다. 이 페이지는 해시 함수·실제 추정값·개인 수를 계산하지 않습니다.</p>
      <form onSubmit={(event) => { event.preventDefault(); add() }} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">설명용 8비트 패턴<input aria-label="설명용 8비트 패턴" value={input} onChange={(event) => setInput(event.target.value)} maxLength={8} className="rounded border bg-background p-2 font-mono" /></label>
        <button type="submit" disabled={!valid} className="rounded border px-3 py-2 disabled:opacity-40">패턴 적용</button>
        <button type="button" onClick={() => setHashes(example)} className="rounded border px-3 py-2">교재 예제 불러오기</button>
        <button type="button" onClick={() => setHashes(tenValues)} className="rounded border px-3 py-2">A–J 10개 예제</button>
        <button type="button" onClick={() => setHashes([])} className="rounded border px-3 py-2">초기화</button>
      </form>
      <p aria-live="polite">{candidate ? `다음 입력: 버킷 ${candidate.bucket}, 나머지 ${candidate.suffix}, rank ${candidate.rank}` : '0과 1로 정확히 8자리를 입력하세요.'}</p>
      <div className="grid grid-cols-4 gap-2" aria-label="현재 레지스터">{current.map((value, index) => <div key={index} className="rounded border p-3 text-center"><span className="text-xs">버킷 {index}</span><div className="font-mono text-2xl">{value}</div></div>)}</div>
      <p aria-live="polite" data-testid="register-state">현재 레지스터: [{current.join(', ')}]</p>
    </Section>
    <Section id="history" title="입력별 변화">
      {rows.length ? <div className="overflow-x-auto"><table><thead><tr><th>입력</th><th>버킷</th><th>rank</th><th>기존 값</th><th>결과</th><th>전체 레지스터</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><code>{row.bits.slice(0, 2)} / {row.suffix}</code></td><td>{row.bucket}</td><td>{row.rank}</td><td>{row.before}</td><td>{row.changed ? '최댓값 갱신' : '유지'}</td><td>[{row.registers.join(', ')}]</td></tr>)}</tbody></table></div> : <p>패턴을 적용하거나 예제를 불러오세요.</p>}
      <p>A–J 예제는 최종 [2, 2, 3, 2]가 됩니다. 같은 패턴을 다시 넣거나 더 작은 rank를 넣으면 값이 유지됩니다. 이 4칸 모형은 갱신·병합 학습용이며 실제 확장의 최소 레지스터 수 16보다 작습니다. 16칸용 상수를 넣어 추정 숫자를 만들지 않습니다. 이 작은 상태만으로 원본 명단이나 정확한 개수를 복원할 수는 없습니다.</p>
    </Section>
    <Section id="merge" title="다른 스케치와 합치기">
      <p>호환되는 또 다른 모형 B는 [{other.join(', ')}]입니다. 각 버킷의 max로 병합합니다.</p>
      <p data-testid="merged-state">A ∪ B = [{current.map((value, index) => Math.max(value, other[index])).join(', ')}]</p>
      <p><Ref to="/hll/registers">버킷·레지스터 설명</Ref>과 <Ref to="/hll/union">일별 스케치 병합</Ref>으로 돌아가 원리를 SQL에 연결합니다.</p>
    </Section>
  </>
}
