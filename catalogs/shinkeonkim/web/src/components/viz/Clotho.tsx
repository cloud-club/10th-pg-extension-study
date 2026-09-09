import { AnimationPlayer, koreanStrings } from '@kokoa/clotho/react'
import '@kokoa/clotho/styles.css'
import { useEffect, useRef, useState } from 'react'
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
 * **화면에 들어온 뒤에 플레이어를 붙인다.** 문서가 autoplay 라도 마운트 시점에 화면 밖이면
 * 플레이어가 "재생 중" 상태로 표시되면서 시간은 0 에 멈춰 있다(스케줄러가 안 돈다).
 * 늦게 붙이면 그 자리에서 자동으로 시작하고, 스크롤해서 도달한 순간 재생되는 편이 읽기에도 맞다.
 */
export function Clotho({ id, caption, className }: Props) {
  const doc = ANIMATIONS[id]
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  // 화면에 들어오면 붙인다. 다만 IntersectionObserver 가 아예 발화하지 않는 환경이 있어서
  // (자동화 브라우저에서 실제로 겪었다) 짧은 지연 뒤에는 무조건 붙인다 -
  // 안 붙는 것보다는 일찍 붙는 편이 낫다.
  useEffect(() => {
    const el = hostRef.current
    let io: IntersectionObserver | null = null
    const timer = window.setTimeout(() => setReady(true), 1200)
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            window.clearTimeout(timer)
            setReady(true)
            io?.disconnect()
          }
        },
        { rootMargin: '200px', threshold: 0 },
      )
      io.observe(el)
    }
    return () => {
      window.clearTimeout(timer)
      io?.disconnect()
    }
  }, [])

  const ratio = doc.canvas.height / doc.canvas.width

  return (
    <figure className={cn('rounded-xl border border-border bg-card p-3', className)}>
      <div ref={hostRef}>
        {ready ? (
          <AnimationPlayer doc={doc} theme="dark" strings={koreanStrings} />
        ) : (
          // 자리를 미리 잡아 둔다 — 붙는 순간 페이지가 튀지 않게
          <div
            className="w-full rounded-lg bg-[hsl(222_60%_5%)]"
            style={{ aspectRatio: `${doc.canvas.width} / ${doc.canvas.height}`, maxHeight: 720 }}
            aria-label={`${doc.title} — 화면에 들어오면 재생됩니다`}
            data-ratio={ratio.toFixed(2)}
          />
        )}
      </div>
      <figcaption className="mt-3 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {caption ?? doc.description}{' '}
        <span className="text-muted-foreground/70">
          · 화면에 들어오면 자동 재생 · 원본{' '}
          <code className="rounded bg-secondary px-1 py-0.5">src/animations/{id}.json</code>
        </span>
      </figcaption>
    </figure>
  )
}
