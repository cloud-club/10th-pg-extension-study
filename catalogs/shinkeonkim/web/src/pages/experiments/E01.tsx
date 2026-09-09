import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { VersionSwitch } from '@/components/charts/VersionSwitch'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const E1 = DATA.e01

export default function E01() {
  return (
    <>
      <PageHeader
        eyebrow="실험 01"
        title="키워드 길이 × 선택도"
        lede={
          <>
            인덱스 스캔이 돌려준 <strong>후보 행 수</strong>를 주 지표로 쓴다. 길이 축과 선택도 축을 한 실험에서
            재서, “길이 때문인가 선택도 때문인가”를 가른다.
          </>
        }
        tags={[{ label: `${nf(E1.rows)}행` }, { label: '2회 실행 동일', variant: 'ok' }]}
      />

      <Callout kind="info" title="설계 — 정답 행 수를 고정한다">
        <p>
          길이 축은 선택도를 0.1%로 고정하고 검색어 길이만 바꾼다(<K>코아</K> 는 30% 대조군). 선택도 축은 길이를
          3글자로 고정하고 선택도만 바꾼다. <strong>검색어가 서로의 부분 문자열이 되면 정답 행수가 오염된다</strong> —
          처음에 <K>클둥이오</K> 를 넣었다가 이 문제를 겪었다.
        </p>
      </Callout>

      <Section id="length" title="1. 길이 축 — 2글자에서 갈린다">
        <ChartBox
          type="bar"
          height={320}
          title="인덱스가 돌려준 후보 행 (로그 스케일)"
          data={{
            labels: E1.rowsData.map((r) => `${r.kw} (${r.len}글자)`),
            datasets: [
              { label: 'pg_bigm', data: E1.rowsData.map((r) => r.bigm.idx), backgroundColor: alpha(C.bigm, 0.8) },
              { label: 'pg_trgm', data: E1.rowsData.map((r) => r.trgm.idx), backgroundColor: alpha(C.trgm, 0.8) },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '후보 행 (로그)' } } } }}
          caption={<>정답은 전부 {nf(E1.rowsData[0].answer)}행(<K>코아</K> 만 {nf(60006)}행)이다. 2글자 두 칸에서 trgm 이 테이블 전체를 올린다.</>}
        />
        <Table>
          <THead>
            <TR><TH>검색어</TH><TH>길이</TH><TH>정답</TH><TH>bigm 후보</TH><TH>bigm 버퍼</TH><TH>bigm ms</TH><TH>trgm 후보</TH><TH>trgm 버퍼</TH><TH>trgm ms</TH></TR>
          </THead>
          <TBody>
            {E1.rowsData.map((r) => (
              <TR key={r.kw}>
                <TD><K>{r.kw}</K></TD><TD>{r.len}</TD><TD>{nf(r.answer)}</TD>
                <TD>{nf(r.bigm.idx)}</TD><TD>{nf(r.bigm.buf)}</TD><TD>{r.bigm.ms}</TD>
                <TD className={r.trgm.idx >= E1.rows ? 'text-trgm font-semibold' : ''}>{nf(r.trgm.idx)}</TD>
                <TD className={r.trgm.buf > 1000 ? 'text-warn' : ''}>{nf(r.trgm.buf)}</TD>
                <TD>{r.trgm.ms}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            3글자 칸(<K>김신건</K>)에서는 trgm 이 버퍼를 <strong>덜</strong> 읽는다(4 vs 7) — 조각이 2.4배 희귀하기
            때문이다. <strong>“bigm 이 무조건 빠르다”가 아니다.</strong>
          </TCaption>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e01}`}>실험 01</SourceNote>
      </Section>

      <Section id="selectivity" title="2. 선택도 축 — 300배를 흔들어도 순위가 안 바뀐다">
        <ChartBox
          type="line"
          height={300}
          title="3글자 고정 · 선택도만 바꿨다"
          data={{
            labels: E1.selectivity.map((r) => `${r.pct}%`),
            datasets: [
              { label: 'pg_bigm 버퍼', data: E1.selectivity.map((r) => r.bigm.buf), borderColor: C.bigm, backgroundColor: C.bigm, tension: 0.2 },
              { label: 'pg_trgm 버퍼', data: E1.selectivity.map((r) => r.trgm.buf), borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
            ],
          }}
          options={{ scales: { y: { title: { display: true, text: '버퍼' } } } }}
          caption={<><strong>모든 선택도에서 trgm 이 버퍼를 덜 읽는다.</strong> 선택도는 “인덱스가 이득인가”를 정하지만 두 확장의 <em>순위</em> 는 못 뒤집는다.</>}
        />
        <Table>
          <THead><TR><TH>검색어</TH><TH>선택도</TH><TH>정답</TH><TH>bigm 후보 / 버퍼 / ms</TH><TH>trgm 후보 / 버퍼 / ms</TH></TR></THead>
          <TBody>
            {E1.selectivity.map((r) => (
              <TR key={r.kw}>
                <TD><K>{r.kw}</K></TD><TD>{r.pct}%</TD><TD>{nf(r.answer)}</TD>
                <TD>{nf(r.bigm.idx)} / {r.bigm.buf} / {r.bigm.ms}</TD>
                <TD>{nf(r.trgm.idx)} / {r.trgm.buf} / {r.trgm.ms}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="versions" title="3. 버전을 바꿔가며">
        <p>
          같은 축을 PG 16/17/18 에서 다시 쟀다(50만 행이라 절대값이 위와 다르다). 19beta1 은 pg_bigm 이 빌드되지
          않아 <strong>잴 수 없었다</strong> — 목록에서 빼지 않고 비활성 탭으로 남겨 둔다.
        </p>
        <VersionSwitch versions={[
          { key: '16', label: '16' }, { key: '17', label: '17' }, { key: '18', label: '18' },
          { key: '19', label: '19beta1', disabled: true, reason: 'pg_bigm 1.2 가 PG19 에서 빌드되지 않는다' },
        ]}>
          {(v) => {
            const rows = DATA.verAxes.selectivity.filter((r) => r.v === v)
            const bigm = rows.filter((r) => r.eng === 'bigm')
            const trgm = rows.filter((r) => r.eng === 'trgm')
            return (
              <ChartBox
                type="bar"
                height={300}
                title={`PostgreSQL ${v} · ${nf(DATA.verAxes.rows)}행 · 인덱스가 돌려준 후보 행`}
                data={{
                  labels: bigm.map((r) => `${r.kw}`),
                  datasets: [
                    { label: 'pg_bigm', data: bigm.map((r) => r.idx), backgroundColor: alpha(C.bigm, 0.8) },
                    { label: 'pg_trgm', data: trgm.map((r) => r.idx), backgroundColor: alpha(C.trgm, 0.8) },
                  ],
                }}
                options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '후보 행 (로그)' } } } }}
                caption={<>세 버전에서 <K>클클</K> 칸의 모양이 같다 — <Link to="/experiments/versions">버전 매트릭스</Link>.</>}
              />
            )
          }}
        </VersionSwitch>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e07}`}>실험 07 · 축 재측정</SourceNote>
      </Section>
    </>
  )
}
