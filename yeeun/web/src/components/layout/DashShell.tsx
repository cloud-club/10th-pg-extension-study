import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV } from '../../content/registry'

export function DashShell() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen bg-[#f3f4f6]">
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col bg-white px-3 py-5 shadow-[1px_0_0_#ececec]">
        <div className="mb-7 px-3">
          <p className="text-[17px] font-bold tracking-tight text-accent">yeeun</p>
          <p className="mt-0.5 text-[11px] text-muted">PG Extension</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={() => {
                const active =
                  item.to === '/'
                    ? pathname === '/'
                    : pathname === item.to || pathname.startsWith(`${item.to}/`)
                return `rounded-xl px-3 py-2.5 text-[13px] transition ${
                  active
                    ? 'bg-[#f3f4f6] font-semibold text-ink'
                    : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-ink'
                }`
              }}
            >
              <span className="block leading-tight">{item.label}</span>
              <span className="mt-0.5 block text-[10px] text-muted">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-line px-3 pt-4">
          <p className="text-[11px] text-muted">Cloud Club study</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function Panel({
  title,
  badge,
  children,
  className = '',
}: {
  title: string
  badge?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl bg-white shadow-sm ring-1 ring-[#ececec] ${className}`}>
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {badge ? (
          <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 font-mono text-[10px] text-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="px-6 pb-5 pt-2">{children}</div>
    </section>
  )
}
