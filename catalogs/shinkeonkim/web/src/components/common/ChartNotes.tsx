import { cn } from '@/lib/utils'

/**
 * 차트 바로 아래에 붙여, 막대·선 하나하나가 옆(다른 조건)보다 왜 크거나 작거나 비슷한지를
 * 짧게 설명한다. "그림만 두고 알아서 해석하라"고 하지 않기 위한 장치 — SourceNote(출처)와
 * 짝을 이루는, "해석" 쪽 장치다.
 */
export function ChartNotes({ items, className }: { items: { label: string; note: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('mt-3 grid gap-x-5 gap-y-3 rounded-xl border border-border bg-card p-4 text-[13px] sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="font-semibold text-foreground">{it.label}</dt>
          <dd className="mt-0.5 leading-relaxed text-muted-foreground">{it.note}</dd>
        </div>
      ))}
    </dl>
  )
}
