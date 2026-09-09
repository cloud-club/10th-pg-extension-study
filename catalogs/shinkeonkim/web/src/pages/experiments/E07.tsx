import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const E7 = DATA.e07
const VS = ['16', '17', '18'] as const

export default function E07() {
  return (
    <>
      <PageHeader
        eyebrow="실험 07"
        title="PostgreSQL 16 · 17 · 18 · 19beta1"
        lede={
          <>
            “버전이 올라가면 나아지지 않을까”를 잰다. 답은 <strong>대체로 아니다</strong> — 그리고 19 는 잴 수도
            없었다.
          </>
        }
        tags={[{ label: `${nf(E7.rows)}행` }, { label: '19beta1: 빌드 실패', variant: 'warn' }]}
      />

      <Section id="servers" title="1. 무엇을 띄웠나">
        <Table>
          <THead><TR><TH>메이저</TH><TH>서버 버전</TH><TH>pg_bigm 빌드</TH></TR></THead>
          <TBody>
            {Object.entries(E7.server).map(([v, s]) => (
              <TR key={v}>
                <TD>PostgreSQL {v}</TD>
                <TD>{s === 'BUILD_FAILED' ? <span className="text-trgm">—</span> : s}</TD>
                <TD>{s === 'BUILD_FAILED' ? <Badge variant="warn">실패</Badge> : <Badge variant="ok">성공</Badge>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="pg19" title="2. PostgreSQL 19 — 측정 자체가 불가능했다">
        <Callout kind="warn" title="pg_bigm 1.2 가 PG19 에서 빌드되지 않는다">
          <CodeBlock>{E7.pg19.error}</CodeBlock>
          <p>{E7.pg19.cause}</p>
        </Callout>
        <p>
          그래서 이 카탈로그의 차트에서 <strong>19 탭은 비활성으로 남겨 둔다.</strong> 목록에서 빼버리면{' '}
          <strong>“재보지 않았다”와 “잴 수 없었다”를 구분할 수 없기 때문이다.</strong> 이것은 pg_bigm 공식 문서가
          “PostgreSQL 16~19 지원”이라고 적은 것과 어긋나는 관측이라 <Link to="/meta/corrections">정정 목록</Link>에도
          올렸다.
        </p>
      </Section>

      <Section id="query" title="3. 질의 성능 — 세 버전이 사실상 같다">
        <div className="not-prose grid gap-4 lg:grid-cols-2">
          {(['클클', '클라우드클럽'] as const).map((kw) => (
            <ChartBox
              key={kw}
              type="bar"
              height={260}
              title={`%${kw}% · 실행 시간 (ms, 로그)`}
              data={{
                labels: [...VS].map((v) => `PG ${v}`),
                datasets: [
                  { label: '인덱스 없음', data: VS.map((v) => E7.q[v].find((r) => r.kw === kw)!.none.ms), backgroundColor: alpha(C.none, 0.65) },
                  { label: 'pg_bigm', data: VS.map((v) => E7.q[v].find((r) => r.kw === kw)!.bigm.ms), backgroundColor: alpha(C.bigm, 0.8) },
                  { label: 'pg_trgm', data: VS.map((v) => E7.q[v].find((r) => r.kw === kw)!.trgm.ms), backgroundColor: alpha(C.trgm, 0.8) },
                ],
              }}
              options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } } }}
            />
          ))}
        </div>
        <Table>
          <THead><TR><TH>PG</TH><TH>검색어</TH><TH>bigm 후보 / recheck / 버퍼</TH><TH>trgm 후보 / recheck / 버퍼</TH></TR></THead>
          <TBody>
            {VS.flatMap((v) =>
              E7.q[v].map((r) => (
                <TR key={`${v}-${r.kw}`}>
                  <TD>{v}</TD><TD><K>{r.kw}</K></TD>
                  <TD>{nf(r.bigm.idx)} / {nf(r.bigm.recheck)} / {nf(r.bigm.buf)}</TD>
                  <TD className={r.trgm.idx > 10000 ? 'text-trgm' : ''}>{nf(r.trgm.idx)} / {nf(r.trgm.recheck)} / {nf(r.trgm.buf)}</TD>
                </TR>
              )),
            )}
          </TBody>
          <TCaption>
            <strong><K>클클</K> 줄의 후보·recheck·버퍼가 세 버전에서 한 자리도 다르지 않다.</strong>{' '}
            <K>GIN_SEARCH_MODE_ALL</K> 은 플래너의 선택이 아니라 <K>extractQuery()</K> 가 조건을 못 만든 결과라,
            코어가 할 수 있는 일이 없다.
          </TCaption>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e07}`}>실험 07</SourceNote>
      </Section>

      <Section id="build" title="4. 달라지는 것 하나 — 빌드 시간">
        <ChartBox
          type="bar"
          height={280}
          title="인덱스 생성 시간 (초)"
          data={{
            labels: [...VS].map((v) => `PG ${v}`),
            datasets: [
              { label: 'pg_bigm', data: VS.map((v) => E7.buildSec[v].bigm), backgroundColor: alpha(C.bigm, 0.8) },
              { label: 'pg_trgm', data: VS.map((v) => E7.buildSec[v].trgm), backgroundColor: alpha(C.trgm, 0.8) },
            ],
          }}
          options={{ scales: { y: { title: { display: true, text: '초' } } } }}
          caption={<>PG 18 에서 <strong>절반 이하로 줄었다</strong>(bigm {E7.buildSec['16'].bigm}s → {E7.buildSec['18'].bigm}s). 이 실험에서 버전 차이가 뚜렷하게 나타난 유일한 축이다.</>}
        />
        <Table>
          <THead><TR><TH>PG</TH><TH>bigm 조각 / 크기</TH><TH>trgm 조각 / 크기</TH></TR></THead>
          <TBody>
            {VS.map((v) => (
              <TR key={v}>
                <TD>{v}</TD>
                <TD>{nf(E7.frag[v].bigm)} / {E7.sizeMB[v].bigm} MB</TD>
                <TD>{nf(E7.frag[v].trgm)} / {E7.sizeMB[v].trgm} MB</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            조각 수와 인덱스 크기는 세 버전에서 완전히 같다 — <strong>확장의 동작 자체는 안 바뀌었다</strong>는
            확인용 값이다.
          </TCaption>
        </Table>
      </Section>

      <Section id="pg18-explain" title="5. PG18 에서 EXPLAIN 출력이 바뀌었다">
        <Callout kind="info">
          <p>
            PostgreSQL 18 부터 <K>EXPLAIN ANALYZE</K> 의 <K>actual rows</K> 가 <strong>소수로 출력된다</strong>
            (<K>rows=500.00</K>). 벤치 스크립트가 <K>rows=[0-9]+</K> 로 파싱하고 있으면 조용히 잘린 값을 읽는다 —
            이 카탈로그의 파서도 그래서 고쳤다.
          </p>
        </Callout>
      </Section>

      <Section id="verdict" title="6. 결론">
        <ul>
          <li><strong>질의 성능은 버전에 거의 의존하지 않는다.</strong> 2글자 함정은 버전을 올려도 그대로다.</li>
          <li><strong>인덱스 빌드는 18 에서 뚜렷하게 빨라졌다.</strong></li>
          <li><strong>19 는 아직 pg_bigm 을 못 쓴다.</strong> 확장이 코어를 따라가야 하는 문제이고, 이 카탈로그가 할 수 있는 일은 그 사실을 정확히 적어두는 것뿐이다.</li>
        </ul>
      </Section>
    </>
  )
}
