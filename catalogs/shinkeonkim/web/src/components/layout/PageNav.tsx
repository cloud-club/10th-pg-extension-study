import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { href, neighbors } from '@/content/registry'

/** 페이지 아래 이전/다음. 사이드바 순서가 곧 읽는 순서다. */
export function PageNav({ section, page }: { section: string; page: string }) {
  const { prev, next } = neighbors(section, page)
  if (!prev && !next) return null
  return (
    <nav className="mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
      {prev ? (
        <Link to={href(prev)} className="group rounded-xl border border-border p-4 hover:border-primary/40">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> 이전
          </span>
          <span className="mt-1 block text-[14px] font-medium group-hover:text-primary">{prev.page.title}</span>
        </Link>
      ) : <span />}
      {next && (
        <Link to={href(next)} className="group rounded-xl border border-border p-4 text-right hover:border-primary/40 sm:col-start-2">
          <span className="flex items-center justify-end gap-1.5 text-[12px] text-muted-foreground">
            다음 <ArrowRight className="h-3.5 w-3.5" />
          </span>
          <span className="mt-1 block text-[14px] font-medium group-hover:text-primary">{next.page.title}</span>
        </Link>
      )}
    </nav>
  )
}
