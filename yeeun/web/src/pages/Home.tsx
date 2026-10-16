import { Link } from 'react-router-dom'
import { Panel } from '../components/layout/DashShell'
import { WEEK_INDEX } from '../content/registry'

const statusLabel = {
  done: 'Done',
  draft: 'Draft',
  planned: 'Planned',
} as const

export function HomeDashboard() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-ink">Home</h1>
        <p className="mt-1 text-sm text-muted">
          주차마다 <strong className="font-medium text-ink">문서</strong>(catalog)와{' '}
          <strong className="font-medium text-ink">실습</strong>(HANDS-ON · lab)을 나눠 둡니다.
        </p>
      </header>

      <Panel title="Weeks">
        <ul className="divide-y divide-line">
          {WEEK_INDEX.map((w) => (
            <li key={w.week} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] text-muted">{w.week}</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink">{w.extension}</p>
                  <p className="mt-1 text-sm text-muted">{w.category}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{w.oneLiner}</p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={w.to}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                    >
                      문서
                    </Link>
                    <Link
                      to={w.labTo}
                      className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-medium text-ink"
                    >
                      실습
                    </Link>
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-[#f3f4f6] px-2 py-1 font-mono text-[10px] text-muted">
                  {statusLabel[w.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
