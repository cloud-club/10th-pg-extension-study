import { AnimationPlayer, koreanStrings } from '@kokoa/clotho/react'
import '@kokoa/clotho/styles.css'
import { ANIMATIONS, type AnimationId } from '@/animations'
import { cn } from '@/lib/utils'

type Props = {
  id: AnimationId
  /** 그림 아래 한 줄 해설. 애니메이션만 두고 지나가지 않는다. */
  caption?: React.ReactNode
  className?: string
}

/**
 * clotho 애니메이션 하나를 재생한다.
 * 문서는 build.py 가 만든 JSON 이고, animations/index.ts 에서 파싱까지 끝난 상태로 온다.
 */
export function Clotho({ id, caption, className }: Props) {
  const doc = ANIMATIONS[id]
  return (
    <figure className={cn('rounded-xl border border-border bg-card p-3', className)}>
      <AnimationPlayer doc={doc} theme="dark" strings={koreanStrings} />
      <figcaption className="mt-3 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {caption ?? doc.description}{' '}
        <span className="text-muted-foreground/70">
          · 원본 <code className="rounded bg-secondary px-1 py-0.5">src/animations/{id}.json</code>
        </span>
      </figcaption>
    </figure>
  )
}
