import mermaid from 'mermaid'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

let initialized = false

/** 다이어그램 색은 앱 팔레트와 같은 값을 쓴다 — 그림만 다른 테마로 튀면 안 된다. */
function init() {
  if (initialized) return
  initialized = true
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", system-ui, sans-serif',
    themeVariables: {
      darkMode: true,
      background: '#0b1120',
      primaryColor: '#1e293b',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#475569',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a',
      lineColor: '#94a3b8',
      textColor: '#cbd5e1',
      mainBkg: '#1e293b',
      nodeBorder: '#475569',
      clusterBkg: 'rgba(148,163,184,0.06)',
      clusterBorder: '#334155',
      edgeLabelBackground: '#0b1120',
      fontSize: '14px',
    },
    flowchart: { curve: 'basis', padding: 14, nodeSpacing: 40, rankSpacing: 46, htmlLabels: false },
  })
}

/**
 * mermaid 다이어그램.
 *
 * 예전에는 상자 그림을 아스키 아트로 그렸는데, 줄맞춤이 폰트에 의존하고 화면이 좁아지면
 * 형태가 무너진다. 구조를 보여주려는 그림은 전부 이걸로 옮긴다.
 * (움직임이 필요한 설명은 clotho 쪽이다 — 여기는 정지된 구조도용이다.)
 */
export function Diagram({
  chart, caption, className, maxWidth,
}: { chart: string; caption?: React.ReactNode; className?: string; maxWidth?: number }) {
  const id = useId().replace(/:/g, '_')
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    init()
    mermaid
      .render(`d${id}`, chart.trim())
      .then(({ svg: out }) => { if (alive.current) setSvg(out) })
      .catch((e: unknown) => { if (alive.current) setErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive.current = false }
  }, [chart, id])

  return (
    <figure className={cn('my-5 rounded-xl border border-border bg-card p-4', className)}>
      {err ? (
        // 렌더에 실패하면 원본을 그대로 보여준다 — 아무것도 안 보이는 것보다 낫다
        <pre className="overflow-x-auto text-[12px] text-warn">{chart.trim()}</pre>
      ) : (
        <div
          className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full overflow-x-auto"
          style={maxWidth ? { maxWidth, marginInline: 'auto' } : undefined}
          // mermaid 가 만든 SVG 다. chart 는 전부 이 저장소 안에서 온 상수 문자열이고,
          // securityLevel:'strict' 로 렌더한다.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {caption && (
        <figcaption className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  )
}
