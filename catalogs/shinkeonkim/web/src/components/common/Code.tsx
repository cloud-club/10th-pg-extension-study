import { useMemo } from 'react'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import c from 'highlight.js/lib/languages/c'
import bash from 'highlight.js/lib/languages/bash'
import ini from 'highlight.js/lib/languages/ini'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import ruby from 'highlight.js/lib/languages/ruby'
import { cn } from '@/lib/utils'

const languages = { sql, c, bash, ini, python, json, ruby }
for (const [name, grammar] of Object.entries(languages)) hljs.registerLanguage(name, grammar)
type Language = keyof typeof languages | 'text' | 'auto'

/** Source is escaped by highlight.js; query output remains plain React text. */
export function CodeBlock({
  children, className, caption, language = 'auto', output, outputCaption = '예상 출력 · ID와 시각은 실행 환경에 따라 달라짐',
}: {
  children: string; className?: string; caption?: React.ReactNode; language?: Language;
  output?: string; outputCaption?: string;
}) {
  const highlighted = useMemo(() => language === 'text' ? null : language === 'auto'
    ? hljs.highlightAuto(children, Object.keys(languages)).value
    : hljs.highlight(children, { language }).value, [children, language])
  return (
    <figure className={cn('my-4 min-w-0', className)}>
      <pre className="overflow-x-auto rounded-xl border border-border bg-[hsl(222_60%_5%)] p-4 text-[12.5px] leading-relaxed">
        {highlighted === null ? <code>{children}</code> : <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />}
      </pre>
      {caption && <figcaption className="mt-2 text-[12px] text-muted-foreground">{caption}</figcaption>}
      {output !== undefined && <div className="code-output mt-6 mb-8 border-t border-border pt-4" aria-label="SQL 실행 결과">
        <p className="text-[12px] text-muted-foreground">{outputCaption}</p>
        <pre className="overflow-x-auto border border-border"><code>{output}</code></pre>
      </div>}
    </figure>
  )
}

export function K({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
}
