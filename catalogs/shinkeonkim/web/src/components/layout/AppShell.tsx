import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SidebarNav } from './Sidebar'
import { Button } from '@/components/ui/button'
import { HOME } from '@/content/registry'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()

  // 라우트가 바뀌면 모바일 서랍을 닫고, 절 앵커가 있으면 그 절로 간다.
  // 페이지가 lazy 라 마운트가 한 틱 늦으므로 잠깐 재시도한다.
  useEffect(() => {
    setOpen(false)
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    let tries = 0
    const tick = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
      if (tries++ < 20) window.setTimeout(tick, 50)
    }
    tick()
  }, [pathname, hash])

  return (
    <div className="min-h-screen">
      {/* 상단 바 — 모바일에서만 서랍 버튼을 노출한다 */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:pl-[19rem]">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)}
                aria-label="메뉴">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link to={HOME} className="text-[14px] font-semibold lg:hidden">PG 확장 스터디</Link>
        <div className="ml-auto text-[12px] text-muted-foreground">
          측정 환경 · PostgreSQL 16~18 · Docker
        </div>
      </header>

      {/* 사이드바 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[17rem] overflow-y-auto border-r border-border bg-card transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <Link to={HOME} className="text-[14.5px] font-bold tracking-tight">
            PG 확장 스터디
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <main className="px-5 pb-24 pt-8 lg:pl-[19rem] lg:pr-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
