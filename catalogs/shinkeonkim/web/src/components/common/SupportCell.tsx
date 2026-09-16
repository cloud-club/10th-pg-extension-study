import { Check, Minus, X } from 'lucide-react'
import type { Support } from '@/data/operators'
import { nf } from '@/lib/utils'

/**
 * "인덱스를 쓰는가"만 보면 안 된다 — 후보 행 수를 같이 보여준다.
 * 후보가 테이블 전체면 Index Cond 가 붙어 있어도 필터로는 동작하지 않는 것이다.
 */
export function SupportCell({ s, rows }: { s: Support; rows: number }) {
  if (s.kind === 'none')
    return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="h-3.5 w-3.5" />연산자 없음</span>
  if (s.kind === 'seq')
    return <span className="inline-flex items-center gap-1 text-trgm"><X className="h-3.5 w-3.5" />Seq Scan</span>
  if (s.kind === 'knn')
    return <span className="inline-flex items-center gap-1 text-ok"><Check className="h-3.5 w-3.5" />Index Scan … Order By</span>
  if (s.kind === 'nosort')
    return <span className="inline-flex items-center gap-1 text-warn"><X className="h-3.5 w-3.5" />정렬 불가</span>

  const useless = s.candidates >= rows
  return (
    <span className={useless ? 'text-warn' : 'text-ok'}>
      <span className="inline-flex items-center gap-1">
        {useless ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        인덱스
      </span>
      <span className="ml-1 text-[12px]">
        후보 <strong>{nf(s.candidates)}</strong>
        {useless && <span className="ml-1">— 테이블 전체다</span>}
      </span>
    </span>
  )
}
