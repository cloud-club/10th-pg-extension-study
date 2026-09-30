import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { GLOSSARY, GROUPS } from '@/content/glossary'
import { cn } from '@/lib/utils'

export default function Glossary() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>('전체')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return GLOSSARY.filter((t) => {
      if (group !== '전체' && t.group !== group) return false
      if (!needle) return true
      return (t.term + t.meaning + (t.analogy ?? '')).toLowerCase().includes(needle)
    })
  }, [q, group])

  return (
    <>
      <PageHeader
        eyebrow="용어 사전"
        title={`읽다 막히면 여기로 — ${GLOSSARY.length}개 용어`}
        lede="비유 열을 같이 붙였다. 정의만으로 안 잡히는 말이 비유 한 줄로 잡히는 경우가 많아서다."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="용어 · 뜻 · 비유로 검색"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13.5px] outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        {(['전체', ...GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
              group === g ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((t) => (
          <div key={t.term} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-semibold">{t.term}</span>
              <Badge variant="outline">{t.group}</Badge>
              {t.to && (
                <Link to={t.to} className="ml-auto text-[12px] text-primary underline-offset-4 hover:underline">
                  더 읽기 →
                </Link>
              )}
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed">{t.meaning}</p>
            {t.analogy && (
              <p className="mt-1 text-[12.5px] text-muted-foreground">비유: {t.analogy}</p>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-10 text-center text-[13px] text-muted-foreground">그런 용어는 아직 없습니다.</p>
        )}
      </div>
    </>
  )
}
