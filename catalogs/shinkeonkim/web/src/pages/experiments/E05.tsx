import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { VersionSwitch, PG_VERSIONS } from '@/components/charts/VersionSwitch'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { cn, nf } from '@/lib/utils'

const E5 = DATA.e05
const SHAPES = [
  { key: 'infix', label: '%X% 부분 일치' },
  { key: 'prefix', label: 'X% 접두어' },
  { key: 'suffix', label: '%X 접미어' },
] as const
const ENGINES = [
  { key: 'none', label: '인덱스 없음', color: C.none },
  { key: 'bigm', label: 'pg_bigm', color: C.bigm },
  { key: 'trgm', label: 'pg_trgm', color: C.trgm },
] as const

type Shape = (typeof SHAPES)[number]['key']
type Engine = (typeof ENGINES)[number]['key']

/** 2글자 칸은 이상치라 빼고, 각 엔진의 %X% 를 1.0 으로 놓은 상대값. */
const rest = (a: readonly number[]) => a.slice(1)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
const rel = (e: Engine, s: Shape) => mean(rest(E5.ms[e][s])) / mean(rest(E5.ms[e].infix))

/** 45칸 격자. 한 셀의 색 농도가 곧 느림이다 — 표를 읽지 않아도 모양이 먼저 보인다. */
function Grid({ ms }: { ms: Record<Engine, Record<Shape, readonly number[]>> }) {
  const all = ENGINES.flatMap((e) => SHAPES.flatMap((s) => [...ms[e.key][s.key]]))
  const max = Math.log10(Math.max(...all))
  const min = Math.log10(Math.min(...all))
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-muted-foreground">엔진 / 패턴</th>
            {E5.lengths.map((n) => (
              <th key={n} className="px-2 py-1.5 text-right text-muted-foreground">{n}글자</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ENGINES.map((e) =>
            SHAPES.map((s) => (
              <tr key={`${e.key}-${s.key}`} className="border-t border-border">
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span style={{ color: e.color }}>{e.label}</span>
                  <span className="ml-2 text-muted-foreground">{s.label}</span>
                </td>
                {ms[e.key][s.key].map((v, i) => {
                  const t = (Math.log10(v) - min) / (max - min)
                  return (
                    <td key={i} className="px-2 py-1.5 text-right font-mono tabular-nums"
                        style={{ background: `rgba(251, 113, 133, ${(t * 0.55).toFixed(3)})` }}>
                      {v}
                    </td>
                  )
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function E05() {
  const [shape, setShape] = useState<Shape>('infix')
  return (
    <>
      <PageHeader
        eyebrow="실험 05"
        title="패턴 × 길이 × 엔진 — 45칸"
        lede={
          <>
            길이 5개 × 패턴 3개 × 엔진 3개. <strong>45칸 전부 정답 {E5.answer}행으로 일치</strong>하도록 설계했으므로,
            보이는 차이는 전부 길이·패턴·엔진 때문이다.
          </>
        }
        tags={[{ label: `${nf(E5.rows)}행` }, { label: `정답 ${E5.answer}행 고정`, variant: 'ok' }]}
      />

      <Callout kind="info" title="설계 — 선택도를 고정한 채 길이와 패턴만 흔든다">
        <p>
          주입 행을 <K>{'<BASE20> <말뭉치 문장> <BASE20>'}</K> 형태로 만들면, 길이 <K>L</K> 을 바꿔도{' '}
          <K>%X%</K>·<K>X%</K>·<K>%X</K> 세 패턴이 <strong>같은 행 집합</strong>에 걸린다. BASE20 은 말뭉치에 없는
          문자열로 골랐고, 실제 매치 수를 매번 출력해 오염이 있으면 바로 드러나게 했다.
        </p>
      </Callout>

      <Section id="grid" title="1. 45칸 한눈에">
        <p>실행 시간(ms). 색이 진할수록 느리다.</p>
        <Grid ms={E5.ms} />
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          진한 칸은 딱 넷이다 — <strong>인덱스 없는 세 줄 전체</strong>와 <strong>trgm 의 2글자 부분 일치 한 칸</strong>.
        </p>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e05}`}>실험 05 · 결정적 지표 45칸 동일 · 버퍼 편차 {'<'}0.5%</SourceNote>
      </Section>

      <Section id="shape" title="2. 패턴 모양이 갈리는 지점">
        <p>
          <strong>인덱스가 없어도 패턴이 중요하다</strong>는 것을 세 엔진 모두에서 확인할 수 있게, 패턴별로 나눠 본다.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SHAPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setShape(s.key)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                shape === s.key ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ChartBox
          type="line"
          height={320}
          title={SHAPES.find((s) => s.key === shape)!.label}
          data={{
            labels: [...E5.lengths].map((n) => `${n}글자`),
            datasets: ENGINES.map((e) => ({
              label: e.label,
              data: [...E5.ms[e.key][shape]],
              borderColor: e.color,
              backgroundColor: e.color,
              borderDash: e.key === 'none' ? [6, 4] : undefined,
              tension: 0.2,
            })),
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } } }}
          caption={
            shape === 'infix'
              ? <><strong>2글자 trgm 한 칸만 튄다.</strong> 나머지는 세 엔진이 나란하다.</>
              : shape === 'prefix'
                ? <>접두어는 <strong>인덱스가 없어도 3~4배 빠르다</strong> — LIKE 매처가 첫 글자에서 대부분 탈락시킨다.</>
                : <>접미어가 부분 일치보다 느린 것은 <strong>패턴 모양이 아니라 매치가 문자열의 어디에 있느냐</strong>의 문제였다 — §4.</>
          }
        />
      </Section>

      <Section id="two-graphs" title="3. 두 그래프 — 원인이 다르다">
        <div className="not-prose grid gap-4 lg:grid-cols-2">
          <ChartBox
            type="bar"
            height={300}
            title="① 조각을 만들 수 있느냐 — 2글자, 세 엔진 나란히"
            data={{
              labels: ENGINES.map((e) => e.label),
              datasets: SHAPES.map((s, i) => ({
                label: s.label,
                data: ENGINES.map((e) => E5.ms[e.key][s.key][0]),
                backgroundColor: [alpha(C.none, 0.7), alpha(C.ok, 0.75), alpha(C.warn, 0.75)][i],
              })),
            }}
            options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그, 2글자)' } } } }}
            caption={
              <>
                <strong>패턴 모양에 갈리는 것은 pg_trgm 하나뿐이다.</strong> pg_bigm 은 세 패턴이{' '}
                {E5.ms.bigm.infix[0]}~{E5.ms.bigm.suffix[0]} ms 로 평평하다.
              </>
            }
          />
          <ChartBox
            type="bar"
            height={300}
            title="② 문자열 비교를 몇 번 하느냐 — 상대값"
            data={{
              labels: ENGINES.map((e) => e.label),
              datasets: SHAPES.map((s, i) => ({
                label: i === 0 ? '%X% (기준 = 1.0)' : s.label,
                data: ENGINES.map((e) => rel(e.key, s.key)),
                backgroundColor: [alpha(C.none, 0.7), alpha(C.ok, 0.75), alpha(C.warn, 0.75)][i],
              })),
            }}
            options={{ scales: { y: { beginAtZero: true, title: { display: true, text: '%X% 대비 (3~20글자 평균)' } } } }}
            caption={
              <>
                각 엔진의 <K>%X%</K> 를 1.0 으로 놓은 상대값(2글자 칸은 이상치라 뺐다). 100배 차이나는 절대
                시간을 걷어내고 패턴 효과만 본다. <strong>인덱스 없음만 접두어에서 0.25 로 떨어진다</strong> —
                인덱스가 있으면 패턴 효과가 사라진다.
              </>
            }
          />
        </div>
        <Callout kind="info" title="두 그래프는 원인이 다르다">
          <p>
            ①은 <strong>조각을 만들 수 있느냐(패딩)</strong>의 문제라 <strong>인덱스가 있을 때만</strong> 나타나고,
            ②는 <strong>문자열 비교를 몇 번 하느냐</strong>의 문제라 <strong>인덱스와 무관하다.</strong>{' '}
            <K>LIKE 'X%'</K> 는 각 행의 첫 글자만 보고 대부분 탈락시키지만 <K>LIKE '%X%'</K> 는 모든 시작
            위치에서 매칭을 시도해야 한다. 그래서 <strong>인덱스를 못 붙이는 상황에서도 검색을 접두어로 바꿀 수
            있다면 그것만으로 3~4배를 얻는다.</strong>
          </p>
        </Callout>
      </Section>

      <Section id="twochar" title="4. 2글자에서 패턴 모양이 갈리는 지점">
        <Table>
          <THead><TR><TH>패턴</TH><TH>인덱스가 돌려준 행</TH><TH>recheck 제거</TH><TH>버퍼</TH><TH>ms</TH></TR></THead>
          <TBody>
            {E5.twoChar.map((t) => (
              <TR key={t.pattern}>
                <TD><K>{t.pattern}</K></TD>
                <TD className={t.idx > 1000 ? 'text-trgm font-semibold' : ''}>{nf(t.idx)}</TD>
                <TD>{nf(t.recheck)}</TD>
                <TD className={t.buf > 1000 ? 'text-warn' : ''}>{nf(t.buf)}</TD>
                <TD>{t.ms}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            같은 검색어인데 패턴 모양만으로 500배가 갈린다 — <Link to="/pg-trgm/two-char">2글자 함정</Link>.
            인덱스 없는 <K>%X%</K> 의 버퍼는 {nf(E5.noneBuffers)} 였다.
          </TCaption>
        </Table>
      </Section>

      <Section id="corrections" title="5. 이 실험에서 철회한 것 둘">
        <Callout kind="warn" title="① “3글자 이상에서 bigm 이 1.5~2배 빠르다” — 철회했다">
          <p>
            원래 표는 각 칸 1회 측정이었다. 같은 질의를 20회씩 다시 재니 두 인덱스의 범위가 완전히 겹쳤고,
            3글자에서는 오히려 trgm 이 빨랐다. <strong>버퍼가 같은데(약 510) 시간만 2배 차이나는 것이 애초에
            이상한 신호였다</strong> — 같은 질의의 max/min 이 9배까지 벌어진다.
          </p>
        </Callout>
        <Callout kind="warn" title="② “접미어가 느린 것은 끝에서부터 비교해서다” — 틀렸다">
          <p>
            패턴 모양이 아니라 <strong>매치가 문자열의 어디에 있느냐</strong>의 문제였다. LIKE 매처는 첫 매치에서
            멈춘다. 주입 행이 <K>{'<BASE20> 문장 <BASE20>'}</K> 이라 부분 일치는 맨 앞에서 끝나고 접미어는 끝까지
            가야 했다. <strong>매치를 끝으로 몰자 부분 일치가 오히려 느려졌다</strong>(152.5 vs 139.8 ms).
          </p>
        </Callout>
        <p>
          둘 다 <Link to="/meta/corrections">정정 목록</Link>에 근거와 함께 남겼다.
        </p>
      </Section>

      <Section id="versions" title="6. 버전별 45칸">
        <VersionSwitch versions={PG_VERSIONS}>
          {(v) => {
            const ms = DATA.e05ver.ms[v as '16' | '17' | '18']
            return (
              <>
                <Grid ms={ms} />
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  PostgreSQL {v} · {nf(DATA.e05ver.rows)}행 · 45칸 전부 정답 {DATA.e05ver.answer}행 확인.
                  <strong> 세 버전에서 격자 모양이 같다</strong> — 2글자 trgm 한 칸만 진하다.
                </p>
              </>
            )
          }}
        </VersionSwitch>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e07}`}>실험 07</SourceNote>
      </Section>
    </>
  )
}
