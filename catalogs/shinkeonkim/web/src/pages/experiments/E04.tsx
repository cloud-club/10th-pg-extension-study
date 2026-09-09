import { Link } from 'react-router-dom'
import { Ref } from '@/components/common/Ref'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { VersionSwitch, PG_VERSIONS } from '@/components/charts/VersionSwitch'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const E4 = DATA.e04
const G = DATA.e04grow

const colorFor = (name: string) =>
  name.includes('bigm') ? C.bigm : name.includes('trgm') && name.includes('gist') ? C.warn
  : name.includes('trgm') ? C.trgm : name.includes('tsvector') ? C.tsv : C.none

export default function E04() {
  return (
    <>
      <PageHeader
        eyebrow="실험 04"
        title="저장 비용 — 10만에서 500만 행까지"
        lede={
          <>
            인덱스 용량이 <strong>고정비(엔트리 트리) + 변동비(포스팅 리스트)</strong> 로 나뉜다는 것을 규모를
            50배 키우며 확인한다. 대조군으로 <K>btree</K> 를 함께 둔다.
          </>
        }
        tags={[{ label: '1회만 실행', variant: 'warn' }]}
      />

      <Section id="ratio" title="1. 테이블 대비 배수는 행이 늘수록 떨어진다">
        <ChartBox
          type="line"
          height={320}
          title="인덱스 / 테이블 (배)"
          data={{
            labels: E4.scales.map(nf),
            datasets: E4.series.map((s) => ({
              label: s.name,
              data: [...s.ratio],
              borderColor: colorFor(s.name),
              backgroundColor: 'transparent',
              borderDash: s.name.includes('btree') ? [6, 4] : undefined,
              tension: 0.25,
            })),
          }}
          options={{ scales: { x: { title: { display: true, text: '행 수' } }, y: { title: { display: true, text: '배' } } } }}
          caption={
            <>
              <strong><K>btree</K> 만 0.98× 로 평평하다</strong> — 모든 값을 그대로 저장하니 고정비가 없다.
              이 대비가 “n-gram 인덱스에만 고정비가 있다”는 증거다.
            </>
          }
        />
        <ChartBox
          type="line"
          height={300}
          title="절대 크기 (MB)"
          data={{
            labels: E4.scales.map(nf),
            datasets: [
              ...E4.series.map((s) => ({
                label: s.name, data: [...s.mb], borderColor: colorFor(s.name),
                backgroundColor: 'transparent', borderDash: s.name.includes('btree') ? [6, 4] : undefined, tension: 0.25,
              })),
              { label: '테이블', data: [...E4.tableMB], borderColor: C.fg, backgroundColor: 'transparent', borderDash: [2, 3], tension: 0.25 },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'MB (로그)' } } } }}
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e04}`}>실험 04 · 500만 행 빌드가 길어 1회만 실행했다</SourceNote>
        <Callout kind="warn" title="이 감소폭은 과장돼 있다">
          <p>
            말뭉치를 순환 참조해 만든 데이터라 <strong>유니크 조각이 아예 안 늘었다.</strong> 실제 서비스에서는
            배수 감소가 이만큼 크지 않다. 그래서 <strong>어휘가 늘어나는 대조군</strong>을 따로 만들어 확인했다 —{' '}
            <Ref to="#grow">어휘가 늘어나면 어떻게 되나</Ref>.
          </p>
        </Callout>
      </Section>

      <Section id="build" title="2. 빌드 시간">
        <ChartBox
          type="line"
          height={280}
          title="인덱스 생성 시간 (초)"
          data={{
            labels: E4.scales.map(nf),
            datasets: Object.entries(E4.buildSec).map(([name, v]) => ({
              label: name, data: [...v], borderColor: colorFor(name), backgroundColor: 'transparent',
              borderDash: name.includes('btree') ? [6, 4] : undefined, tension: 0.25,
            })),
          }}
          options={{ scales: { y: { title: { display: true, text: '초' } } } }}
          caption={<>유니크 엔트리가 적을수록 빠르다 — tsvector {'<'} trgm ≈ bigm. <K>btree</K> 는 정렬 비용이라 성격이 다르다.</>}
        />
        <Table>
          <THead><TR><TH>인덱스</TH><TH>유니크 엔트리 (표본 20,000행)</TH></TR></THead>
          <TBody>
            <TR><TD><K>gin_bigm_ops</K></TD><TD>{nf(E4.uniqEntries.bigm)}</TD></TR>
            <TR><TD><K>gin_trgm_ops</K></TD><TD>{nf(E4.uniqEntries.trgm)}</TD></TR>
            <TR><TD><K>gin (tsvector)</K></TD><TD>{nf(E4.uniqEntries.tsv)}</TD></TR>
          </TBody>
          <TCaption>이 값이 고정비를 정한다 — <Ref to="/foundations/gin#structure">GIN 의 엔트리 트리와 포스팅 리스트</Ref>.</TCaption>
        </Table>
      </Section>

      <Section id="grow" title="3. 어휘가 늘어나면 어떻게 되나 — 예상이 틀렸다">
        <p>
          “어휘가 늘어나는 데이터에서는 n-gram 인덱스 배수도 덜 떨어질 것”이라고 예상했다.{' '}
          <strong>틀렸다. 움직인 것은 tsvector 뿐이다.</strong>
        </p>
        <ChartBox
          type="bar"
          height={300}
          title={`${nf(G.rows)}행 · 고정 어휘 vs 늘어나는 어휘`}
          data={{
            labels: Object.keys(G.ratio),
            datasets: [
              { label: '고정 어휘', data: Object.values(G.ratio).map((r) => r.fixed), backgroundColor: alpha(C.none, 0.7) },
              { label: '늘어나는 어휘', data: Object.values(G.ratio).map((r) => r.grow), backgroundColor: alpha(C.ok, 0.75) },
            ],
          }}
          options={{ scales: { y: { title: { display: true, text: '인덱스 / 테이블 (배)' } } } }}
          caption={
            <>
              <K>gin (tsvector)</K> 만 0.93× → 1.15× 로 움직였다. n-gram 은 그대로다 — 낱말 하나가 통째로 새
              어휘소가 되는 전문검색과 달리, n-gram 은 그 낱말을 <strong>이미 본 문자들의 조합</strong>으로 쪼갠다.
            </>
          }
        />
        <Table>
          <THead><TR><TH>엔진</TH><TH>고정 어휘 유니크</TH><TH>늘어나는 어휘 유니크</TH><TH>증가</TH></TR></THead>
          <TBody>
            {(['bigm', 'trgm', 'tsv'] as const).map((k) => (
              <TR key={k}>
                <TD>{k}</TD><TD>{nf(G.uniq[k].fixed)}</TD><TD>{nf(G.uniq[k].grow)}</TD>
                <TD className={k === 'bigm' ? 'text-ok' : ''}>+{Math.round((100 * (G.uniq[k].grow - G.uniq[k].fixed)) / G.uniq[k].fixed)}%</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            고정비를 정하는 것은 문서 수가 아니라 <strong>문자 조합 공간</strong>이고, <K>n</K> 이 작을수록 포화가
            빠르다(bigm +2% vs trgm +17%). <Link to="/meta/corrections">정정 목록</Link>에 기록해 두었다.
          </TCaption>
        </Table>
      </Section>

      <Section id="versions" title="4. 버전별로">
        <VersionSwitch versions={PG_VERSIONS}>
          {(v) => {
            const rows = DATA.verAxes.size[v as '16' | '17' | '18']
            return (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartBox
                  type="bar" height={260}
                  title={`PG ${v} · 인덱스 크기 (테이블 ${DATA.e07.tableMB} MB)`}
                  data={{ labels: rows.map((r) => r.name), datasets: [{ label: 'MB', data: rows.map((r) => r.mb), backgroundColor: rows.map((r) => alpha(colorFor(r.name), 0.8)) }] }}
                  options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
                />
                <ChartBox
                  type="bar" height={260}
                  title={`PG ${v} · 빌드 시간 (초)`}
                  data={{ labels: rows.map((r) => r.name), datasets: [{ label: '초', data: rows.map((r) => r.sec), backgroundColor: rows.map((r) => alpha(colorFor(r.name), 0.8)) }] }}
                  options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
                  caption="크기는 세 버전이 동일하고, 빌드 시간만 18 에서 뚜렷하게 짧아진다."
                />
              </div>
            )
          }}
        </VersionSwitch>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e07}`}>실험 07 · 축 재측정 ({nf(DATA.verAxes.rows)}행)</SourceNote>
      </Section>
    </>
  )
}
