import { useState } from 'react'
import { cn } from '@/lib/utils'

export type VersionOpt = { key: string; label: string; disabled?: boolean; reason?: string }

/**
 * PostgreSQL 버전을 변인으로 두고 같은 그림을 갈아끼운다.
 *
 * 잴 수 없었던 버전(19 처럼 pg_bigm 이 빌드되지 않는)은 목록에서 빼지 않고
 * 비활성 탭으로 남긴다 — 빼버리면 "재보지 않았다"와 "잴 수 없었다"를 구분할 수 없다.
 */
export function VersionSwitch({
  versions, children, className, label = 'PostgreSQL',
}: {
  versions: VersionOpt[]
  children: (key: string) => React.ReactNode
  className?: string
  label?: string
}) {
  const first = versions.find((v) => !v.disabled) ?? versions[0]
  const [cur, setCur] = useState(first.key)
  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-muted-foreground">{label}</span>
        {versions.map((v) => (
          <button
            key={v.key}
            type="button"
            disabled={v.disabled}
            title={v.reason}
            onClick={() => setCur(v.key)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
              v.key === cur
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
              v.disabled && 'cursor-not-allowed border-dashed opacity-45 hover:text-muted-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {children(cur)}
    </div>
  )
}

/** 실험 07 이 실제로 잰 버전들. 19 는 잴 수 없었다는 사실까지 데이터에 담는다. */
export const PG_VERSIONS: VersionOpt[] = [
  { key: '16', label: '16' },
  { key: '17', label: '17' },
  { key: '18', label: '18' },
  { key: '19', label: '19beta1', disabled: true, reason: 'pg_bigm 1.2 가 PG19 에서 빌드되지 않아 측정 자체가 불가능했다' },
]
