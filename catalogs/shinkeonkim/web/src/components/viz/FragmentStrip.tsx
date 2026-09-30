import { cn } from '@/lib/utils'

/**
 * 조각 하나를 칩으로 그린다. 공백은 눈에 안 보이므로 ␣ 로 바꿔 보여준다 —
 * "공백이 조각 안에 들어간다"가 이 페이지의 논점이라 안 보이면 아무 말도 못 한다.
 */
function Chip({ frag, tone }: { frag: string; tone: 'bigm' | 'trgm' }) {
  const hasSpace = frag.includes(' ')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 font-mono text-[13px]',
        tone === 'bigm' ? 'border-bigm/35 bg-bigm/10 text-bigm' : 'border-trgm/35 bg-trgm/10 text-trgm',
        hasSpace && 'ring-1 ring-inset ring-warn/50',
      )}
      title={hasSpace ? '공백(패딩)이 들어간 조각' : undefined}
    >
      {frag.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i} className="text-warn/80">␣</span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </span>
  )
}

export function FragmentStrip({
  src, note, bigm, trgm, trgmCount,
}: {
  src: string
  note?: string
  bigm: readonly string[]
  trgm: readonly string[] | null
  trgmCount: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <code className="rounded bg-secondary px-2 py-1 font-mono text-[14px] font-semibold">
          {src.replace(/ /g, '␣')}
        </code>
        {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
      </div>
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-[52px] shrink-0 text-[12px] font-medium text-bigm">bigm</span>
          {bigm.map((f) => <Chip key={f} frag={f} tone="bigm" />)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-[52px] shrink-0 text-[12px] font-medium text-trgm">trgm</span>
          {trgm
            ? trgm.map((f) => <Chip key={f} frag={f} tone="trgm" />)
            : (
              <span className="text-[12.5px] text-muted-foreground">
                한글은 CRC32 해시로 저장돼 눈으로 못 읽는다 — 조각 <strong>{trgmCount}개</strong>
              </span>
            )}
        </div>
      </div>
    </div>
  )
}
