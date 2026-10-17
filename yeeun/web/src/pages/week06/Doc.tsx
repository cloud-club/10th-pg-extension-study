import doc from '../../content/btree_gist.md?raw'
import { MarkdownDoc, markdownToc } from '../../components/ui/MarkdownDoc'
import { WeekTabs } from '../../components/layout/WeekTabs'

export function Week06Doc() {
  const toc = markdownToc(doc)
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <WeekTabs
        week="week06"
        title="btree_gist"
        subtitle="catalog 문서 · GiST + EXCLUDE · 예약 충돌"
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
