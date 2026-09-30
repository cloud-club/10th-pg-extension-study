import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

const KIND = {
  info: { icon: Info, ring: 'border-primary/30 bg-primary/[0.07]', tint: 'text-primary' },
  ok: { icon: CheckCircle2, ring: 'border-ok/30 bg-ok/[0.07]', tint: 'text-ok' },
  warn: { icon: AlertTriangle, ring: 'border-warn/35 bg-warn/[0.07]', tint: 'text-warn' },
  tip: { icon: Lightbulb, ring: 'border-tsv/30 bg-tsv/[0.07]', tint: 'text-tsv' },
} as const

export function Callout({
  kind = 'info', title, children, className,
}: { kind?: keyof typeof KIND; title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const { icon: Icon, ring, tint } = KIND[kind]
  return (
    <div className={cn('my-5 flex gap-3 rounded-xl border px-4 py-3.5', ring, className)}>
      <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', tint)} />
      <div className="prose-doc min-w-0 flex-1 text-[14px] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {title && <p className={cn('mb-1 font-semibold', tint)}>{title}</p>}
        {children}
      </div>
    </div>
  )
}

/** 초심자용 한 문단 — 어려운 절 앞에 "쉽게 먼저" 를 붙일 때 쓴다. */
export function EasyFirst({ children }: { children: React.ReactNode }) {
  return (
    <Callout kind="tip" title="쉽게 먼저 — 한 문단">
      {children}
    </Callout>
  )
}
