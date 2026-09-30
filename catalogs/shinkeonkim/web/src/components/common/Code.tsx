import { cn } from '@/lib/utils'

/** SQL·셸 블록. 하이라이터를 붙이지 않는다 — 코드가 길지 않고, 색은 주석 대비만 필요하다. */
export function CodeBlock({
  children, className, caption,
}: { children: string; className?: string; caption?: React.ReactNode }) {
  return (
    <figure className={cn('my-4', className)}>
      <pre className="overflow-x-auto rounded-xl border border-border bg-[hsl(222_60%_5%)] p-4 text-[12.5px] leading-relaxed">
        <code>{children}</code>
      </pre>
      {caption && <figcaption className="mt-2 text-[12px] text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

export function K({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
}
