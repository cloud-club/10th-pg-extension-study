import { cn } from '@/lib/utils'

const TINT = {
  bigm: 'text-bigm', trgm: 'text-trgm', tsv: 'text-tsv',
  ok: 'text-ok', warn: 'text-warn', muted: 'text-foreground',
} as const

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>
}

export function Stat({
  value, label, tone = 'muted',
}: { value: React.ReactNode; label: React.ReactNode; tone?: keyof typeof TINT }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className={cn('text-[26px] font-bold leading-none tracking-tight', TINT[tone])}>{value}</div>
      <div className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{label}</div>
    </div>
  )
}
