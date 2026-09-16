import { NavLink, useLocation } from 'react-router-dom'
import { SECTIONS, type Accent } from '@/content/registry'
import { cn } from '@/lib/utils'

const DOT: Record<Accent, string> = {
  bigm: 'bg-bigm', trgm: 'bg-trgm', tsv: 'bg-tsv',
  ok: 'bg-ok', warn: 'bg-warn', default: 'bg-muted-foreground/50',
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <nav className="px-3 pb-16 pt-4">
      {SECTIONS.map((s) => (
        <div key={s.slug} className="mb-5">
          <div className="mb-1.5 flex items-center gap-2 px-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', DOT[s.accent ?? 'default'])} />
            <span className="text-[11.5px] font-semibold tracking-wide text-muted-foreground">
              {s.title}
            </span>
          </div>
          <ul>
            {s.pages.map((p) => {
              const to = `/${s.slug}/${p.slug}`
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
