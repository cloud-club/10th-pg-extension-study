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
 *
 * 문서가 `settings.autoplay` 라 붙는 즉시 돌기 시작하고, 플레이어가 스스로
 * **화면 밖이면 멈춘다**(clotho 의 useInView). 그래서 여기서 따로 지연 마운트하지 않는다 —
 * 한 번 IntersectionObserver 로 늦게 붙이도록 만들어 봤는데, 탭이 보이지 않는 상태(자동화
 * 브라우저 등)에서는 관찰자가 아예 발화하지 않아 영영 안 붙었다.
 */
export function Clotho({ id, caption, className }: Props) {
  const doc = ANIMATIONS[id]
  return (
    <figure className={cn('rounded-xl border border-border bg-card p-3', className)}>
      <AnimationPlayer doc={doc} theme="dark" strings={koreanStrings} />
      <figcaption className="mt-3 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {caption ?? doc.description}{' '}
        <span className="text-muted-foreground/70">
          · 자동 재생 · 원본{' '}
          <code className="rounded bg-secondary px-1 py-0.5">src/animations/{id}.json</code>
        </span>
      </figcaption>
    </figure>
  )
}
