import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { FragmentStrip } from '@/components/viz/FragmentStrip'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { FRAGMENTS, SPACE_PROBES, WRAP_PROBES, WS_ENV, type Probe } from '@/data/whitespace'
import { C, alpha } from '@/lib/chart'
import { nf } from '@/lib/utils'

const ENG_BADGE = { none: 'outline', bigm: 'bigm', trgm: 'trgm' } as const

function ProbeTable({ rows, caption }: { rows: Probe[]; caption?: React.ReactNode }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>엔진</TH><TH>패턴</TH><TH>정답</TH><TH>플랜</TH><TH>쓴 인덱스</TH>
          <TH>인덱스행</TH><TH>recheck 제거</TH><TH>버퍼</TH><TH>ms</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r, i) => (
          <TR key={i}>
            <TD><Badge variant={ENG_BADGE[r.eng]}>{r.eng}</Badge></TD>
            <TD><K>{r.pattern}</K></TD>
            <TD>{nf(r.answer)}</TD>
            <TD className={r.plan.includes('Seq') ? 'text-warn' : ''}>{r.plan}</TD>
            <TD>{r.used ? <><code className="text-[12px]">{r.used}</code> <span className="text-ok">✔</span></> : <span className="text-muted-foreground">—</span>}</TD>
            <TD>{nf(r.idxRows)}</TD>
            <TD>{nf(r.recheck)}</TD>
            <TD className={r.buf > 3000 ? 'text-warn' : ''}>{nf(r.buf)}</TD>
            <TD>{r.ms}</TD>
          </TR>
        ))}
      </TBody>
      {caption && <TCaption>{caption}</TCaption>}
    </Table>
  )
}

export default function Whitespace() {
  return (
    <>
      <PageHeader
        eyebrow="기초 개념 · 실험 08"
        title="공백과 구두점은 조각에 어떻게 들어가나"
        lede={
          <>
            “중간에 공백이 들어간 문장이면 공백을 포함한 조각이 생기나?”에서 출발했다. <strong>생긴다</strong> — 다만
            낱말의 시작/끝 표시 자리로만 들어가고, <strong>공백을 가로지르는 조각은 어느 쪽에서도 안 생긴다.</strong>{' '}
            정작 두 확장이 갈리는 지점은 공백이 아니라 <strong>구두점</strong>이다.
          </>
        }
        tags={[{ label: WS_ENV.pg }, { label: `${nf(WS_ENV.rows)}행` }, { label: '실험 08', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          조각을 만들 때 두 확장 모두 <strong>낱말 앞뒤에 가짜 공백을 붙인 뒤</strong> 자릅니다. 그래서 <K>ab cd</K> 를
          자르면 <K>"b␣"</K> 같은 조각이 나옵니다 — <strong>공백이 조각 안에 실제로 들어 있습니다.</strong> 하지만 그
          공백은 “여기서 낱말이 끝난다”는 표시이지 두 낱말을 이어붙인 것이 아닙니다. 그래서 <K>"b␣c"</K> 같은 조각은{' '}
          <strong>안 생깁니다.</strong>
        </p>
      </EasyFirst>

      <Section id="fragments" title="1. 그대로 찍어본 조각들">
        <p>
          <K>show_bigm()</K>/<K>show_trgm()</K> 의 출력을 손대지 않고 옮겼다. 공백은 눈에 안 보이므로 <K>␣</K> 로
          바꿔 그렸고, 공백이 든 조각에는 테두리를 둘렀다.
        </p>
        <div className="not-prose my-5 space-y-3">
          {FRAGMENTS.map((f) => (
            <FragmentStrip key={f.src} src={f.src} note={f.note} bigm={f.bigm} trgm={f.trgm} trgmCount={f.trgmCount} />
          ))}
        </div>
        <SourceNote path={WS_ENV.repo}>실험 08 · A절 (결정적 — 2회 실행 동일)</SourceNote>

        <p><strong>세 가지를 읽는다.</strong></p>
        <ol>
          <li>
            <strong>공백은 조각 안에 실제로 들어간다.</strong> <K>"b␣"</K>·<K>"d␣"</K>·<K>"␣c"</K> 가 그 증거다.
            다만 전부 낱말의 시작/끝 자리다.
          </li>
          <li>
            <strong>공백을 가로지르는 조각은 없다.</strong> <K>ab cd</K> 에 <K>b␣c</K> 가 없고,{' '}
            <K>클라우드 클럽</K> 에 <K>드클</K> 이 없다 — 공백을 뺀 <K>클라우드클럽</K> 에는 <K>드클</K> 이 있다.
            <strong> 공백 하나가 조각 구성을 바꾼다.</strong>
          </li>
          <li>
            <strong>구두점에서 갈린다.</strong> <K>pg_bigm</K> 은 공백만 구분자로 쓰므로(<K>!t_isspace</K>){' '}
            <K>192.168.0.1</K> 을 <strong>한 낱말로 보고 점을 조각 안에 남긴다</strong>(<K>0.</K>, <K>.1</K>).{' '}
            <K>pg_trgm</K> 은 영숫자가 아니면 전부 구분자로 쓰므로(<K>KEEPONLYALNUM</K>){' '}
            <strong>네 낱말로 쪼개고 점을 버린다.</strong>
          </li>
        </ol>

        <Callout kind="ok" title="공식 문서와 글자까지 같다">
          <p>
            <K>foo|bar</K> 의 <K>pg_trgm</K> 결과는 PostgreSQL 공식 문서가 예시로 든 것과 일치한다 —{' '}
            <em>“The set of trigrams in the string <K>foo|bar</K> is <K>" f"</K>, <K>" fo"</K>, <K>"foo"</K>,{' '}
            <K>"oo "</K>, <K>" b"</K>, <K>" ba"</K>, <K>"bar"</K>, and <K>"ar "</K>.”</em>{' '}
            측정이 문서와 어긋나지 않는지 확인하는 대조군으로 넣었다.
          </p>
        </Callout>
      </Section>

      <Section id="probe" title="2. 공백이 든 패턴은 인덱스를 타는가">
        <p><strong>탄다 — 양쪽 다.</strong> 다만 후보를 좁히는 힘이 다르다.</p>
        <ProbeTable
          rows={SPACE_PROBES.slice(0, 3)}
          caption={
            <>
              <K>%드 클%</K> 는 세 글자(<K>드</K>·공백·<K>클</K>)라 3-gram 도 조각을 만들 수 있다. 그런데{' '}
              <strong><K>pg_trgm</K> 은 그 공백을 구분자로 써서 버리므로</strong> 남는 조건이 흩어진다 — 후보가 4배
              늘고(897 vs 226) 그중 695행을 Recheck 이 걷어낸다.
            </>
          }
        />
        <ChartBox
          type="bar"
          height={260}
          title="공백이 든 패턴 — 후보 행과 버퍼"
          data={{
            labels: ['인덱스 없음', 'pg_bigm', 'pg_trgm'],
            datasets: [
              { label: '읽은 버퍼', data: SPACE_PROBES.slice(0, 3).map((r) => r.buf), backgroundColor: [alpha(C.none, 0.7), alpha(C.bigm, 0.8), alpha(C.trgm, 0.8)] },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '버퍼 (로그)' } } }, plugins: { legend: { display: false } } }}
          caption={<><K>%드 클%</K> · 정답 202행. 공백이 있는 덕에 trgm 도 인덱스를 타지만 bigm 의 3.5배를 읽는다.</>}
        />

        <p className="mt-8">대조군으로 <strong>공백 없는 2글자</strong>를 같이 쟀다. 여기서 trgm 이 무너진다.</p>
        <ProbeTable rows={SPACE_PROBES.slice(3)} />

        <Callout kind="warn" title="문서와 다른 점 하나">
          <p>
            pg_trgm 공식 문서는 <em>“a pattern with no extractable trigrams will degenerate to a{' '}
            <strong>full-index scan</strong>”</em> 이라고 적는다. 이 규모(20만 행)에서는 플래너가 전체 인덱스 스캔보다{' '}
            <strong>Seq Scan 이 싸다고 판단</strong>해 인덱스를 아예 안 썼다. 100만 행{' '}
            <Link to="/experiments/pattern-length">실험 05</Link> 에서는 문서대로 전체 인덱스 스캔이 나와 후보
            1,000,000행을 올렸다. <strong>둘 다 나타난다</strong> — 어느 쪽이든 결론은 “인덱스가 필터로 동작하지
            않는다”로 같다.
          </p>
        </Callout>
      </Section>

      <Section id="wrap" title="3. 2글자를 공백으로 감싸면 trgm 이 살아나는가">
        <p><strong>살아난다.</strong> 대신 <strong>묻는 질문이 바뀐다.</strong></p>
        <ProbeTable rows={WRAP_PROBES} />
        <Callout kind="warn" title="47행이 사라졌다">
          <p>
            <K>%클럽%</K> 이 250행, <K>% 클럽 %</K> 이 203행이다. 사라진 47행은 <K>클럽하우스</K>·<K>클라우드클럽</K>{' '}
            처럼 다른 글자에 붙어 있던 것들이다. 즉 이 우회는 <strong>“부분 문자열 검색”을 “낱말 검색”으로
            바꿔치기해서</strong> 인덱스를 살린 것이고, 요구사항이 “빠짐없이 찾기”라면 쓸 수 없다.
          </p>
        </Callout>
        <SourceNote path={WS_ENV.repo}>실험 08 · B·C절 · 상대 인덱스를 트랜잭션 안에서 치우고 쟀다</SourceNote>
      </Section>

      <Section id="summary" title="정리">
        <ol>
          <li><strong>공백은 조각에 들어간다 — 낱말 경계 표시로만.</strong> 조각이 공백을 가로지르는 일은 없다.</li>
          <li><strong>두 확장이 갈리는 지점은 공백이 아니라 구두점이다.</strong> <K>pg_bigm</K> 은 남기고 <K>pg_trgm</K> 은 버린다. <K>192.168.0.1</K> 검색이 필요하면 이 차이가 결정적이다.</li>
          <li><strong>공백이 든 패턴은 양쪽 다 인덱스를 탄다.</strong> 다만 <K>pg_trgm</K> 은 공백을 버리는 만큼 조건이 흩어져 후보가 4배 넓다.</li>
          <li><strong><K>% X %</K> 우회는 동작하지만 의미가 바뀐다.</strong> 250 → 203행.</li>
        </ol>
      </Section>
    </>
  )
}
