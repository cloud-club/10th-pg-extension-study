import { useMemo, useState } from 'react'
import { K } from '@/components/common/Code'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DATA } from '@/data/measurements'
import { cn } from '@/lib/utils'

type Row = (typeof DATA.corrections)[number]

const TAGS = ['전체', '실측', '소스', '재현성', '검증'] as const
const TAG_VARIANT: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  실측: 'ok', 소스: 'bigm', 재현성: 'warn', 검증: 'tsv',
}

/** "이 카탈로그가 스스로 적었다가 철회한 것" 인지 표시한다. 남 탓만 적으면 안 된다. */
const isSelf = (r: Row) => r.claim.includes('이 카탈로그') || r.where.startsWith('references/')

export default function Corrections() {
  const [tag, setTag] = useState<string>('전체')
  const rows = useMemo(
    () => (tag === '전체' ? DATA.corrections : DATA.corrections.filter((r) => r.tag === tag)),
    [tag],
  )
  const selfCount = DATA.corrections.filter(isSelf).length

  return (
    <>
      <PageHeader
        eyebrow="기록"
        title={`재보니 달랐던 것들 — ${DATA.corrections.length}건`}
        lede={
          <>
            널리 인용되는 서술 중 <strong>실측이 다르게 나온 것</strong>들이다. 그중 {selfCount}건은{' '}
            <strong>이 카탈로그가 스스로 적었다가 철회한 것</strong>이다. 각 항목에 근거와 재현 위치가 붙어 있다.
          </>
        }
        tags={[{ label: `자기 정정 ${selfCount}건`, variant: 'warn' }]}
      />

      <Callout kind="info" title="왜 이런 목록을 두나">
        <p>
          측정이 통념과 다르면 <strong>둘 중 하나가 틀린 것</strong>이고, 어느 쪽인지 밝히지 않으면 다음 사람이 같은
          함정에 다시 빠진다. 그래서 “무엇이 틀렸나 / 실제로는 어땠나 / 왜 그런가 / 어디서 재현하나” 네 칸을
          강제한다. <strong>근거가 없는 항목은 넣지 않는다.</strong>
        </p>
      </Callout>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
              tag === t ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            <span className="ml-1.5 text-[11px] opacity-70">
              {t === '전체' ? DATA.corrections.length : DATA.corrections.filter((r) => r.tag === t).length}
            </span>
          </button>
        ))}
      </div>

      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={TAG_VARIANT[r.tag] ?? 'default'}>{r.tag}</Badge>
              {isSelf(r) && <Badge variant="warn">자기 정정</Badge>}
              <code className="ml-auto text-[11.5px] text-muted-foreground">{r.where}</code>
            </div>
            <p className="text-[14px] leading-relaxed">
              <span className="text-muted-foreground line-through decoration-trgm/60 decoration-2">{r.claim}</span>
            </p>
            <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-ok">→ {r.found}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.why}</p>
          </li>
        ))}
      </ol>

      <Section id="how" title="이 목록이 만들어진 방식">
        <p>네 종류가 섞여 있다.</p>
        <ul>
          <li><Badge variant="ok">실측</Badge> <K>bench.sh</K> 를 돌려 숫자가 다르게 나온 것</li>
          <li><Badge variant="bigm">소스</Badge> 실제 소스 코드를 열어보니 서술과 다른 것</li>
          <li><Badge variant="warn">재현성</Badge> 두 번 돌려보니 재현되지 않아 <strong>이 카탈로그가 스스로 철회한 것</strong></li>
          <li><Badge variant="tsv">검증</Badge> 널리 쓰이는 예시가 실제로는 성립하지 않는 것</li>
        </ul>
        <Callout kind="warn" title="이 카탈로그도 틀렸었다">
          <p>
            합성 데이터로 재고 “차이는 5~13% 수준”이라고 적었던 것이 실제 말뭉치에서는 25% 였고,{' '}
            “3글자 이상에서 bigm 이 1.5~2배 빠르다”는 20회 재측정에서 사라져 철회했다. 그래서 이 카탈로그의{' '}
            <Link to="/meta/method">측정 원칙 7번</Link>이 <strong>“결론을 적기 전에 두 번 돌린다”</strong> 이다 —
            원칙 자체가 재현성 검증에서 나왔다.
          </p>
        </Callout>
      </Section>

      <Section id="unknowns" title="아직 확인하지 못한 것">
        <p>
          <strong>“모른다”도 결과다.</strong> 관측만 하고 원인을 규명하지 못한 것들이다. 미완성이 아니라{' '}
          <strong>의도된 표시</strong>다.
        </p>
        <div className="not-prose mt-4 space-y-2">
          {DATA.unknowns.map((u, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[13.5px] font-medium">{u.seen}</p>
              <p className="mt-1 flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <span className="shrink-0 text-warn">모르는 것</span>
                <span>{u.unknown}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="repro" title="재현성 검증">
        <p>
          같은 실험을 두 번씩 돌려 값이 재현되는지 확인했다. <strong>확인하지 않은 것은 확인하지 않았다고 적는다.</strong>
        </p>
        <ul className="not-prose mt-3 space-y-1.5">
          {DATA.repro.map((r) => (
            <li key={r.exp} className="flex flex-wrap items-baseline gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13.5px]">
              <span className={cn('font-mono text-[13px]', r.ok === true ? 'text-ok' : r.ok === false ? 'text-warn' : 'text-muted-foreground')}>
                {r.ok === true ? '✔' : r.ok === false ? '△' : '—'}
              </span>
              <span className="font-medium">{r.exp}</span>
              <span className="text-[12.5px] text-muted-foreground">{r.detail}</span>
            </li>
          ))}
        </ul>
        <Callout kind="warn" title="GiST 지표는 범위로만 적는다">
          <p>
            같은 데이터로 세 번 빌드하니 <strong>트리 구조 자체가 매번 달랐다</strong>. GIN 지표는 전부 완전히
            재현됐다 — <K>pg_trgm</K> 의 GiST 수치에서 몇 % 차이를 해석하면 안 된다.
          </p>
        </Callout>
      </Section>
    </>
  )
}
