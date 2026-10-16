import { NavLink } from 'react-router-dom'

export function WeekTabs({
  week,
  title,
  subtitle,
}: {
  week: string
  title: string
  subtitle: string
}) {
  const base = `/${week}`
  const tabs = [
    { to: base, label: '문서', end: true },
    { to: `${base}/lab`, label: '실습', end: false },
  ]

  return (
    <header className="space-y-4">
      <div>
        <p className="font-mono text-xs text-muted">{week}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-[#ececec]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-accent text-white' : 'text-muted hover:bg-[#f3f4f6] hover:text-ink'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </header>
  )
}
