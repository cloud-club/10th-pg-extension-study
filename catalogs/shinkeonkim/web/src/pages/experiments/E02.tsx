import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const F = DATA.e02.fragments
const W = DATA.e02.write

export default function E02() {
  return (
    <>
      <PageHeader
        eyebrow="실험 02"
        title="조각 통계와 쓰기 비용"
        lede="“2-gram 이라 조각이 많아서 인덱스가 크다”가 맞는지 세어 본다. 그리고 행 하나가 키 수십 개를 만드는 인덱스의 INSERT 비용을 잰다."
        tags={[{ label: '표본 20,000행' }, { label: '2회 실행 동일', variant: 'ok' }]}
      />

      <Section id="fragments" title="1. 조각 수 — 생 조각은 비슷하고, 유니크가 다르다">
        <Callout kind="warn" title="세는 방법에 함정이 있다">
          <p>
            <K>show_bigm()</K>/<K>show_trgm()</K> 은 <strong>문서별로 중복을 제거한</strong> 조각을 돌려준다(두
            확장 모두 마지막에 <K>qsort</K> + unique 를 돌린다). 그래서 중복 제거 전 개수를 문자열 길이로 따로
            계산해 함께 낸다.
          </p>
        </Callout>
        <Table>
          <THead><TR><TH>데이터</TH><TH>n-gram</TH><TH>중복 제거 전</TH><TH>중복 제거 후</TH><TH>손실률</TH><TH>유니크 조각</TH><TH>조각당 출현</TH></TR></THead>
          <TBody>
            {F.map((r, i) => (
              <TR key={i}>
                <TD>{r.data}</TD><TD>{r.n}</TD><TD>{nf(r.raw)}</TD><TD>{nf(r.dedup)}</TD>
                <TD>{r.loss}%</TD><TD><strong>{nf(r.uniq)}</strong></TD><TD>{r.perFrag}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="not-prose grid gap-4 lg:grid-cols-2">
          <ChartBox
            type="bar"
            height={260}
            title="생 조각 수 — 거의 같다"
            data={{
              labels: F.map((r) => `${r.data.slice(0, 6)} ${r.n}`),
              datasets: [{ label: '중복 제거 전', data: F.map((r) => r.raw), backgroundColor: F.map((r) => (r.n === '2-gram' ? alpha(C.bigm, 0.8) : alpha(C.trgm, 0.8))) }],
            }}
            options={{ plugins: { legend: { display: false } } }}
          />
          <ChartBox
            type="bar"
            height={260}
            title="유니크 조각 수 — 여기서 갈린다"
            data={{
              labels: F.map((r) => `${r.data.slice(0, 6)} ${r.n}`),
              datasets: [{ label: '유니크', data: F.map((r) => r.uniq), backgroundColor: F.map((r) => (r.n === '2-gram' ? alpha(C.bigm, 0.8) : alpha(C.trgm, 0.8))) }],
            }}
            options={{ plugins: { legend: { display: false } }, scales: { y: { type: 'logarithmic' } } }}
          />
        </div>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e02}`}>실험 02</SourceNote>
        <p>
          자세한 해석 네 가지는 <Link to="/foundations/ngram#corpus">n-gram §4</Link> 에 있다. 요약하면{' '}
          <strong>“2-gram 이라 조각이 많다”는 틀렸고, 크기 차이는 유니크 조각 가짓수에서 온다.</strong>
        </p>
      </Section>

      <Section id="write" title="2. 쓰기 비용 — FASTUPDATE 가 3~4배를 만든다">
        <ChartBox
          type="bar"
          height={280}
          title="INSERT 10,000행"
          data={{
            labels: W.map((w) => w.idx),
            datasets: [{
              label: '초',
              data: W.map((w) => w.sec),
              backgroundColor: W.map((w) => (w.idx.includes('bigm') ? alpha(C.bigm, 0.8) : w.idx.includes('trgm') ? alpha(C.trgm, 0.8) : alpha(C.none, 0.6))),
            }],
          }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: '초' } } } }}
          caption={<><K>FASTUPDATE=off</K> 두 줄이 나머지와 3~4배 차이 난다 — 펜딩 리스트가 없으면 INSERT 마다 트리를 직접 건드린다.</>}
        />
        <Table>
          <THead><TR><TH>인덱스</TH><TH>10,000행 INSERT</TH><TH>행당</TH><TH>인덱스 없음 대비</TH></TR></THead>
          <TBody>
            {W.map((w) => (
              <TR key={w.idx}>
                <TD><K>{w.idx}</K></TD><TD>{w.sec} 초</TD><TD>{w.us} µs</TD>
                <TD className={w.x > 5 ? 'text-warn' : ''}>{w.x}×</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            <K>FASTUPDATE=on</K>(기본)은 쓰기가 빠른 대신 <strong>가끔 한 건이 아주 느리다</strong> — 병합을
            뒤집어쓴 세션이다. 지연의 평균이 아니라 꼬리가 중요하면 <K>off</K> 가 답일 수 있다 —{' '}
            <Link to="/foundations/gin">GIN §1-③</Link>.
          </TCaption>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e02}`}>실험 02</SourceNote>
      </Section>
    </>
  )
}
