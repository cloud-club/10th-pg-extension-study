import { useState } from 'react'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { hllBudget } from '@/lib/hll-model'
export default function Budget() {
  const [p, setP] = useState(11)
  const [w, setW] = useState(5)
  const result = hllBudget(p, w)
  return <>
    <PageHeader eyebrow="Week 06 · hll · 이론 계산" title="정밀도와 공간 계산기" lede="레지스터 수·상대 표준오차 모델·FULL payload를 비교합니다." />
    <Section id="inputs" title="두 파라미터의 역할">
      <label className="mb-4 flex flex-col gap-2">log2m: {p}<input aria-label="log2m" type="range" min="4" max="18" value={p} onChange={(event) => setP(Number(event.target.value))} /></label>
      <label className="flex flex-col gap-2">regwidth: {w}<input aria-label="regwidth" type="range" min="1" max="8" value={w} onChange={(event) => setW(Number(event.target.value))} /></label>
      <p>이 페이지는 학습용 범위 log2m 4–18을 제공합니다. regwidth는 레지스터 값 범위를 바꾸며 표준오차 식에 직접 들어가는 변수가 아닙니다. 작은 regwidth의 포화·해시 폭은 이 단순 모델에서 계산하지 않습니다.</p>
    </Section>
    <Section id="outputs" title="계산한 이론값">
      <div aria-live="polite"><table><tbody><tr><th>레지스터 수 m = 2^p</th><td>{result.m.toLocaleString()}</td></tr><tr><th>상대 표준오차 근사 1.04 / √m</th><td>{result.rsePercent.toFixed(3)}%</td></tr><tr><th>FULL 레지스터 payload m × w / 8</th><td>{result.payloadBytes.toLocaleString()} bytes</td></tr></tbody></table></div>
      <p>이 값은 실제 입력의 오차·최대 오류·SQL 메모리 한도를 보장하지 않습니다. 헤더·EXPLICIT·SPARSE·표 페이지·인덱스·TOAST·집계 상태·RSS를 제외한 payload 모델입니다.</p>
      <p>p를 1 늘리면 m과 payload는 두 배, 표준오차 모델은 약 0.707배가 됩니다. 오차를 절반으로 줄이려면 p를 2 늘리는 공간 비용을 비교합니다.</p>
      <p><Ref to="/hll/estimation">오차 읽기</Ref>, <Ref to="/hll/storage">실제 저장 표현</Ref>, <Ref to="/hll/results">실측 분포</Ref>를 함께 확인합니다.</p>
    </Section>
  </>
}
