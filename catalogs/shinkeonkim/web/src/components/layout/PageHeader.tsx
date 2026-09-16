import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  eyebrow?: string
  title: string
  lede?: React.ReactNode
  tags?: { label: string; variant?: React.ComponentProps<typeof Badge>['variant'] }[]
  className?: string
}

export function PageHeader({ eyebrow, title, lede, tags, className }: Props) {
  return (
    <header className={cn('mb-8', className)}>
      {eyebrow && <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-primary">{eyebrow}</p>}
      <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">{title}</h1>
      {lede && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{lede}</p>}
      {tags && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t.label} variant={t.variant}>{t.label}</Badge>
          ))}
        </div>
      )}
    </header>
  )
}

/** 페이지 안의 절(節). id 를 달아 사이드바 밖에서도 앵커로 걸 수 있게 한다. */
export function Section({
  id, title, kicker, children, className,
}: { id?: string; title: string; kicker?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('mt-12 scroll-mt-20 first:mt-0', className)}>
      {kicker && <p className="mb-1 text-[12px] font-medium text-primary">{kicker}</p>}
      <h2 className="border-b border-border pb-2 text-[19px] font-semibold">{title}</h2>
      <div className="prose-doc mt-4">{children}</div>
    </section>
  )
}
