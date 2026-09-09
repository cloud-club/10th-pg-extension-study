import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { VersionSwitch } from '@/components/charts/VersionSwitch'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const R = DATA.e06.recall
const avg = (a: number[]) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10

export default function KoreanRecall() {
  return (
    <>
      <PageHeader
        eyebrow="전문검색 · 실험 06"
        title="한국어 재현율 — 사전 없이 7~38%"
        lede={
          <>
            <K>LIKE '%키워드%'</K> 의 결과를 <strong>정답</strong>으로 놓고, 같은 키워드로 <K>tsquery</K> 를 던졌을 때
            그중 몇 %가 나오는지 센다.
          </>
        }
        tags={[{ label: `${nf(DATA.e06.rows)}행` }, { label: "text search config: simple", variant: 'tsv' }]}
      />

      <EasyFirst>
        <p>
          한국어는 낱말 뒤에 조사가 붙습니다 — <K>영화</K>, <K>영화는</K>, <K>영화지만</K>. 사람은 다 같은 말로
          읽지만, 사전이 없는 <K>simple</K> 설정은 <strong>전부 다른 낱말</strong>로 봅니다. 그래서{' '}
          <K>영화</K> 로 찾으면 <K>영화는</K> 이 안 나옵니다.
        </p>
      </EasyFirst>

      <StatGrid>
        <Stat tone="tsv" value={`${avg(R.map((r) => r.tsPct))}%`} label="정확 일치 tsquery 평균 재현율" />
        <Stat tone="ok" value={`${avg(R.map((r) => r.prePct))}%`} label={<>접두어 <K>키워드:*</K> 로 바꾸면</>} />
        <Stat tone="warn" value={`${Math.min(...R.map((r) => r.tsPct))}%`} label={<>최악의 칸 — <K>{R.reduce((a, b) => (a.tsPct < b.tsPct ? a : b)).kw}</K></>} />
        <Stat tone="trgm" value={nf(Math.max(...R.map((r) => r.lexVariants)))} label="키워드 하나가 흩어진 어휘소 가짓수 (최대)" />
      </StatGrid>

      <Section id="chart" title="1. 얼마나 놓치나">
        <ChartBox
          type="bar"
          height={320}
          title="키워드별 매치 문서 수 (로그 스케일)"
          data={{
            labels: R.map((r) => r.kw),
            datasets: [
              { label: 'LIKE (정답)', data: R.map((r) => r.like), backgroundColor: alpha(C.none, 0.7) },
              { label: 'tsquery', data: R.map((r) => r.ts), backgroundColor: alpha(C.tsv, 0.85) },
              { label: "tsquery '키워드:*'", data: R.map((r) => r.pre), backgroundColor: alpha(C.tsv, 0.4) },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '문서 수 (로그)' } } } }}
        />
        <ChartBox
          type="bar"
          height={300}
          title="같은 데이터를 재현율(%)로"
          data={{
            labels: R.map((r) => r.kw),
            datasets: [
              { label: 'tsquery', data: R.map((r) => r.tsPct), backgroundColor: alpha(C.tsv, 0.85) },
              { label: "tsquery '키워드:*'", data: R.map((r) => r.prePct), backgroundColor: alpha(C.ok, 0.7) },
            ],
          }}
          options={{ scales: { y: { max: 100, title: { display: true, text: '재현율 (%)' } } } }}
          caption={<><strong>정확 일치는 7~38%</strong>, 접두어로 바꾸면 <strong>74~92%</strong> 로 회복된다.</>}
        />
        <Table>
          <THead>
            <TR>
              <TH>키워드</TH><TH>LIKE (정답)</TH><TH>tsquery</TH><TH>재현율</TH>
              <TH>tsquery <K>:*</K></TH><TH>재현율</TH><TH>어휘소 변형</TH>
            </TR>
          </THead>
          <TBody>
            {R.map((r) => (
              <TR key={r.kw}>
                <TD>{r.kw}</TD>
                <TD>{nf(r.like)}</TD>
                <TD>{nf(r.ts)}</TD>
                <TD className={r.tsPct < 20 ? 'text-trgm' : 'text-warn'}>{r.tsPct}%</TD>
                <TD>{nf(r.pre)}</TD>
                <TD className="text-ok">{r.prePct}%</TD>
                <TD>{nf(r.lexVariants)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e06}`}>실험 06 · 1회 실행 (반복 확인하지 않았다)</SourceNote>
      </Section>

      <Section id="misses" title="2. 놓치는 것의 정체">
        <p>
          <K>'영화'</K> 를 포함하지만 <K>to_tsquery('simple','영화')</K> 가 못 찾는 문서를 뽑아 보면 셋 중 하나다.
        </p>
        <Table>
          <THead><TR><TH>유형</TH><TH>예</TH><TH>어휘소</TH></TR></THead>
          <TBody>
            <TR><TD><strong>조사가 붙음</strong></TD><TD>“오래 전에 본 <strong>영화지만</strong> …”</TD><TD><K>'영화지만'</K></TD></TR>
            <TR><TD><strong>복합어 안</strong></TD><TD>“스즈키안 입장에선 <strong>이영화</strong> 안찍었으면”</TD><TD><K>'이영화'</K></TD></TR>
            <TR><TD><strong>공백이 없음</strong></TD><TD>“마음이따듯해지는영화.”</TD><TD><K>'마음이따듯해지는영화'</K></TD></TR>
          </TBody>
        </Table>
        <p>
          키워드 하나가 실제 말뭉치에서 <strong>{nf(Math.min(...R.map((r) => r.lexVariants)))}~
          {nf(Math.max(...R.map((r) => r.lexVariants)))}가지 어휘소</strong>로 흩어진다. <K>:*</K> 는{' '}
          <em>앞쪽</em>이 일치하는 변형(<K>영화는</K>, <K>영화지만</K>)을 회수하지만,{' '}
          <strong>키워드 앞에 뭔가 붙은 경우(<K>이영화</K>)는 원리상 못 잡는다.</strong> 남은 8~26%가 그것이다.
        </p>
        <CodeBlock caption="접두어 tsquery 로 바꾸는 방법 — 회복은 되지만 완전하지 않다">{`SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple', '영화');     -- 118,437
SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple', '영화:*');   -- 239,651
SELECT count(*) FROM docs WHERE doc LIKE '%영화%';                       -- 313,428  ← 정답`}</CodeBlock>
      </Section>

      <Section id="versions" title="3. 버전을 올리면 나아지나">
        <p>
          <strong>아니다.</strong> 재현율은 파서·사전이 정하는 값이라 실행 계획과 무관하다. PG 16·17·18 에서
          한 자리도 다르지 않다.
        </p>
        <VersionSwitch versions={[{ key: '16', label: '16' }, { key: '17', label: '17' }, { key: '18', label: '18' }]}>
          {(v) => {
            const rows = DATA.verAxes.recall[v as '16' | '17' | '18']
            return (
              <ChartBox
                type="bar"
                height={280}
                title={`PostgreSQL ${v} · ${nf(DATA.verAxes.rows)}행`}
                data={{
                  labels: rows.map((r) => r.kw),
                  datasets: [
                    { label: 'tsquery 재현율 (%)', data: rows.map((r) => r.tsPct), backgroundColor: alpha(C.tsv, 0.85) },
                    { label: "tsquery ':*' 재현율 (%)", data: rows.map((r) => r.prePct), backgroundColor: alpha(C.ok, 0.7) },
                  ],
                }}
                options={{ scales: { y: { max: 100, title: { display: true, text: '%' } } } }}
                caption="세 버전의 값이 소수점까지 같다 — 그래서 버전 탭을 눌러도 그림이 안 바뀐다. 그것이 결과다."
              />
            )
          }}
        </VersionSwitch>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e07}`}>실험 07 · 축 재측정</SourceNote>
      </Section>

      <Section id="fix" title="4. 그래서 어떻게 하나">
        <Callout kind="ok">
          <ul>
            <li><strong>부분 문자열 검색이 요구사항이면</strong> n-gram 을 쓴다 — 전문검색은 이 자리에 맞지 않는다.</li>
            <li><strong>단어 검색을 제대로 하고 싶으면</strong> 형태소 분석기를 붙인다(은전한닢/mecab 등). <K>simple</K> 설정으로는 조사를 못 뗀다.</li>
            <li><strong>둘 다 필요하면</strong> 둘 다 둔다. 랭킹·구절은 <K>tsvector</K>, 빠짐없이 찾기는 n-gram — <Link to="/fulltext/tsvector#choose">선택 표</Link>.</li>
          </ul>
        </Callout>
        <Callout kind="warn" title="한계">
          <p>
            키워드 6개, 말뭉치 하나(NSMC), <K>simple</K> 설정 하나로만 쟀다. 형태소 분석기를 붙인 구성은
            재보지 않았다 — <strong>“사전을 붙이면 얼마나 회복되는가”는 이 카탈로그가 답하지 못한다.</strong>
          </p>
        </Callout>
      </Section>
    </>
  )
}
