import type { ReactNode } from 'react'

/** Notion-ish markdown → React (headings, code, tables, lists, bold, inline code) */
export function MarkdownDoc({ source }: { source: string }) {
  const blocks = parseBlocks(source)
  return (
    <article className="md-doc space-y-4 text-[15px] leading-[1.7] text-[#37352f]">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </article>
  )
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }

function Block({ block }: { block: Block }) {
  switch (block.type) {
    case 'h1':
      return (
        <h1 className="scroll-mt-8 border-b border-line pb-3 text-3xl font-semibold tracking-tight text-ink">
          {inline(block.text)}
        </h1>
      )
    case 'h2':
      return (
        <h2
          id={slug(block.text)}
          className="scroll-mt-8 pt-4 text-xl font-semibold text-ink"
        >
          {inline(block.text)}
        </h2>
      )
    case 'h3':
      return (
        <h3 className="scroll-mt-6 pt-2 text-base font-semibold text-ink">
          {inline(block.text)}
        </h3>
      )
    case 'p':
      return <p className="whitespace-pre-line">{inline(block.text)}</p>
    case 'quote':
      return (
        <blockquote className="border-l-4 border-accent/40 bg-soft/80 px-4 py-2 text-muted">
          {inline(block.text)}
        </blockquote>
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-[#f7f6f3] px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-ink">
          <code>{block.text}</code>
        </pre>
      )
    case 'ul':
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft text-xs text-muted">
              <tr>
                {block.headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-line">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'hr':
      return <hr className="border-line" />
  }
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <code
          key={key++}
          className="rounded bg-[#ebebea] px-1 py-0.5 font-mono text-[12.5px] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : parts
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w가-힣0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }
    if (/^---+$/.test(line.trim())) {
      out.push({ type: 'hr' })
      i++
      continue
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      i++
      const buf: string[] = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++
      out.push({ type: 'code', lang, text: buf.join('\n') })
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      if (rows.length) {
        out.push({ type: 'table', headers: rows[0], rows: rows.slice(1) })
      }
      continue
    }
    if (line.startsWith('# ')) {
      out.push({ type: 'h1', text: line.slice(2).trim() })
      i++
      continue
    }
    if (line.startsWith('## ')) {
      out.push({ type: 'h2', text: line.slice(3).trim() })
      i++
      continue
    }
    if (line.startsWith('### ')) {
      out.push({ type: 'h3', text: line.slice(4).trim() })
      i++
      continue
    }
    if (line.startsWith('> ')) {
      const buf: string[] = [line.slice(2)]
      i++
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2))
        i++
      }
      out.push({ type: 'quote', text: buf.join('\n') })
      continue
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i++
      }
      out.push({ type: 'ul', items })
      continue
    }

    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('|') &&
      !lines[i].startsWith('>') &&
      !/^[-*] /.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      buf.push(lines[i])
      i++
    }
    out.push({ type: 'p', text: buf.join('\n') })
  }

  return out
}

export function markdownToc(source: string): { id: string; title: string }[] {
  return source
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => {
      const title = l.slice(3).trim()
      return { id: slug(title), title }
    })
}
