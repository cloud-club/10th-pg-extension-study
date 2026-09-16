import { CodeBlock } from '@/components/common/Code'
import source from '@/data/cron-source.json'

export function SourceExcerpt({ name }: { name: keyof typeof source.excerpts }) {
  const excerpt = source.excerpts[name]
  return <CodeBlock language="c" caption={<a href={`${source.url}#L${excerpt.start}-L${excerpt.end}`} target="_blank" rel="noreferrer">pg_cron {source.version} · src/pg_cron.c:{excerpt.start}–{excerpt.end} · 원문 열기</a>}>{excerpt.code}</CodeBlock>
}
