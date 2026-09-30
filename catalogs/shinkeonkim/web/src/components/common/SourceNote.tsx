import { FlaskConical } from 'lucide-react'

/**
 * "이 숫자는 어디서 나왔나" 를 매 그림 옆에 붙인다.
 * 카탈로그의 측정 원칙 — 출처 없는 수치는 싣지 않는다 — 을 UI 로 강제하는 장치다.
 */
export function SourceNote({ path, children }: { path: string; children?: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
      <FlaskConical className="mt-[2px] h-3.5 w-3.5 shrink-0 text-ok" />
      <span>
        {children ? <>{children} · </> : null}
        재현: <code className="rounded bg-secondary px-1 py-0.5">{path}</code>
      </span>
    </p>
  )
}
