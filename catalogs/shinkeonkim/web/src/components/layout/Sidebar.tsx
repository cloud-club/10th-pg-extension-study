import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { SECTIONS, WEEKS, weekHome, type Accent } from '@/content/registry'
import { cn } from '@/lib/utils'

const DOT: Record<Accent, string> = {
  bigm: 'bg-bigm', trgm: 'bg-trgm', tsv: 'bg-tsv',
  ok: 'bg-ok', warn: 'bg-warn', default: 'bg-muted-foreground/50',
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const routeSection = pathname.split('/')[1]
  const week = SECTIONS.find((s) => s.slug === routeSection || s.routeSlug === routeSection)?.week ?? WEEKS[0].slug
  return (
    <nav className="px-3 pb-16 pt-4">
      <label className="mb-5 block px-2 text-xs text-muted-foreground">
        학습 주차
        <select aria-label="학습 주차" value={week} onChange={(e) => { navigate(weekHome(e.target.value)); onNavigate?.() }} className="mt-2 w-full rounded border border-border bg-background p-2 text-foreground">
          {WEEKS.map((w) => <option key={w.slug} value={w.slug}>{w.title}</option>)}
        </select>
      </label>
      {SECTIONS.filter((s) => s.week === week).map((s) => (
        <div key={s.slug} className="mb-5">
          <div className="mb-1.5 flex items-center gap-2 px-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', DOT[s.accent ?? 'default'])} />
            <span className="text-[11.5px] font-semibold tracking-wide text-muted-foreground">
              {s.title}
            </span>
          </div>
          <ul>
            {s.pages.map((p) => {
              const to = `/${s.routeSlug ?? s.slug}/${p.slug}`
              const active = pathname === to
              return (
                <li key={p.slug}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    className={cn(
                      'block rounded-md px-2 py-1.5 text-[13.5px] leading-snug transition-colors',
                      active
                        ? 'bg-secondary font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    {p.title}
                    {p.hint && (
                      <span className="mt-0.5 block text-[11.5px] font-normal text-muted-foreground/70">
                        {p.hint}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
