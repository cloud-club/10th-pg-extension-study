import doc from '../../content/pg_stat_statements.md?raw'
import { MarkdownDoc, markdownToc } from '../../components/ui/MarkdownDoc'
import { WeekTabs } from '../../components/layout/WeekTabs'

export function Week02Doc() {
  const toc = markdownToc(doc)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <WeekTabs
        week="week02"
        title="pg_stat_statements"
        subtitle="catalog 문서 · 성능 진단 Extension"
      />

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#ececec]">
        <p className="mb-2 text-xs font-semibold text-muted">Contents</p>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-[13px] text-accent">
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="hover:underline">
                {t.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-[#ececec]">
        <MarkdownDoc source={doc} />
      </div>
    </div>
  )
}
