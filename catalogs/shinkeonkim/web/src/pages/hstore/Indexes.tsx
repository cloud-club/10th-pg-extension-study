import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { demo, exp, fmtBytes, fmtMs, fmtNum, ratio } from './stats'

const cfg = exp.index.configs
const q = exp.index.queries
const names = {
  none: '인덱스 없음', hstore_gin: 'GIN', hstore_gist16: 'GiST (siglen 16)', hstore_gist128: 'GiST (siglen 128)',
  btree_brand: "btree 식 ((attrs->'brand'))",
} as const
const order = ['none', 'hstore_gin', 'hstore_gist16', 'hstore_gist128', 'btree_brand'] as const
const queryKeys = ['contain_2keys_common', 'contain_2keys_narrow', 'contain_rare_value', 'key_exists_rare', 'equal_expression'] as const
const shortPlan = (p: string) => (p.includes('Bitmap') ? '인덱스' : p.includes('Seq') ? '순차' : p)

export default function Indexes() {
  return <>
    <PageHeader eyebrow="Week 04 · 인덱스" title="hstore 인덱스: GIN, GiST, 그리고 식 인덱스"
      lede="hstore는 포함(@>)과 키 존재(?, ?&, ?|)를 GIN·GiST로 색인한다. -> 로 값을 꺼내 비교하는 식은 이 인덱스가 도와주지 않아서 식 인덱스가 필요하다. 카탈로그에서 실제 지원 연산자를 조회하고, 20만 행에서 크기·조회·삽입 비용을 재봤다."
      tags={[{ label: `20만 행 · ${exp.index.runs}회 반복` }, { label: 'gin_hstore_ops' }, { label: 'gist_hstore_ops(siglen)' }]} />

    <Section id="matrix" title="1. 어떤 인덱스가 어떤 연산자를 지원하나">
      <p>공식 문서의 표를 그대로 믿지 않고 <code>pg_opclass</code>·<code>pg_amop</code>에서 hstore를 대상으로 하는 연산자 클래스를 조회했다.</p>
      <CodeBlock language="sql" output={demo.ix_opclasses.output} outputCaption="실제 실행 결과">{demo.ix_opclasses.sql}</CodeBlock>
      <table><thead><tr><th>인덱스</th><th>지원 연산자</th><th>특징</th></tr></thead><tbody>
        <tr><td><strong>GIN</strong> (기본, <code>gin_hstore_ops</code>)</td><td><code>@&gt;</code> <code>?</code> <code>?&amp;</code> <code>?|</code></td><td>키와 값을 항목으로 색인. 크지만 정확하고 빠르다</td></tr>
        <tr><td><strong>GiST</strong> (<code>gist_hstore_ops</code>)</td><td><code>@&gt;</code> <code>?</code> <code>?&amp;</code> <code>?|</code></td><td>비트 서명. 작지만 손실이 있어 재검사가 많다. <code>siglen</code>(1~2024바이트)으로 조절</td></tr>
        <tr><td><strong>btree</strong> · <strong>hash</strong></td><td>btree: <code>=</code>와 순서 연산자 <code>#&lt;#</code> <code>#&lt;=#</code> <code>#&gt;#</code> <code>#&gt;=#</code> · hash: <code>=</code></td><td>hstore 값 <strong>전체</strong>의 비교. 키 하나의 조회에는 쓰지 못한다. 공식 문서 표에는 <code>=</code>만 적혀 있지만 카탈로그에는 순서 연산자가 더 있다</td></tr>
        <tr><td><strong>식 인덱스</strong> <code>((attrs -&gt; 'k'))</code></td><td>그 식의 <code>=</code> <code>&lt;</code> <code>&gt;</code> …</td><td>자주 쓰는 키 하나의 동등·범위 조회. 통계도 그 식에 쌓인다</td></tr>
      </tbody></table>
      <p><code>&lt;@</code>(포함됨)는 어느 인덱스 클래스에도 없다. 소스의 <code>hstore--1.4.sql</code>에서도 GiST 클래스의 <code>&lt;@</code> 항목은 주석 처리돼 있다. <code>@</code>·<code>~</code> 연산자는 hstore 1.8에서 제거됐다 (<code>hstore--1.7--1.8.sql</code>). 인덱스로 ‘~를 포함하는 행’을 찾으려면 항상 <code>attrs @&gt; ...</code> 형태로 쓴다.</p>
      <Callout kind="info" title="jsonb와 비교하면: GiST가 hstore에만 있다">
        <p>같은 조회를 <code>jsonb</code> 컬럼에 걸고 싶다면 GIN(<code>jsonb_ops</code>·<code>jsonb_path_ops</code>)만 고를 수 있다. jsonb는 GiST 연산자 클래스가 PostgreSQL 코어에 없기 때문이다 — <code>pg_opclass</code> 전수 조회로 직접 확인한 결과는 <Ref to="/hstore/vs-jsonb#query">jsonb와의 차이 · 5절</Ref>에 있다. hstore가 jsonb보다 나은 거의 유일하고 뚜렷한 지점이 이 GiST 옵션이다.</p>
      </Callout>
    </Section>

    <Section id="gin" title="2. GIN은 키와 값을 따로 색인한다">
      <Clotho id="hstore-gin-lookup" />
      <p><code>gin_extract_hstore</code>는 쌍마다 항목 두 개를 만든다. 키는 <code>K</code>, 값은 <code>V</code>, NULL 값은 <code>N</code>을 앞에 붙인 text다 (<Ref to="/hstore/source#gin">소스 지도</Ref>). 어느 키의 값인지는 항목에 들어 있지 않다. 그래서 <code>@&gt;</code> 질의는 <strong>recheck = true</strong>다. 후보를 뽑은 뒤 힙에서 쌍을 다시 확인한다. 반대로 <code>?</code>는 키 항목 하나가 곧 답이라 recheck가 없다.</p>
      <p>이 동작을 decoy 행으로 직접 보자. 키 <code>color</code>도 있고 값 <code>red</code>도 있지만 <code>red</code>가 <code>shade</code>의 값인 행 500개를 넣어 두었다.</p>
      <CodeBlock language="sql">{demo.ix_setup}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_seq.output} outputCaption="인덱스가 없을 때 · 실제 실행 결과">{demo.ix_seq.sql}</CodeBlock>
      <CodeBlock language="sql">{demo.ix_gin_create}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_gin_contains.output} outputCaption="GIN이 @> 를 처리한다 · 실제 실행 결과">{demo.ix_gin_contains.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_gin_exists.output} outputCaption="? 와 ?& 도 GIN을 쓴다 · 실제 실행 결과">{demo.ix_gin_exists.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_recheck.output} outputCaption="Rows Removed by Index Recheck = 탈락한 decoy 행 · 실제 실행 결과">{demo.ix_recheck.sql}</CodeBlock>
      <Callout kind="info" title="Recheck 숫자 읽기">
        <p>위 결과에서 <code>Bitmap Index Scan</code>은 후보 500행을 돌려줬고, <code>Rows Removed by Index Recheck: 500</code>으로 힙에서 <strong>전부 탈락</strong>했다(<code>actual rows=0</code>). 진짜 일치 행은 없고 후보가 전부 decoy였다는 뜻이다. <code>gin_consistent_hstore</code>가 포함(<code>@&gt;</code>)에서 <code>recheck = true</code>를 돌려주는 코드와 맞아떨어진다.</p>
      </Callout>
    </Section>

    <Section id="expression" title="3. -> 로 꺼낸 값의 비교에는 식 인덱스">
      <CodeBlock language="sql" output={demo.ix_arrow_seq.output} outputCaption="GIN이 있어도 -> 비교는 순차 스캔 · 실제 실행 결과">{demo.ix_arrow_seq.sql}</CodeBlock>
      <p>GIN의 연산자 클래스에는 <code>-&gt;</code>가 없다. 자주 쓰는 키의 동등 비교는 그 식에 btree를 만든다.</p>
      <CodeBlock language="sql">{demo.ix_expr_create}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_expr.output} outputCaption="식과 정확히 같은 모양의 조건이어야 쓴다 · 실제 실행 결과">{demo.ix_expr.sql}</CodeBlock>
      <p>조건이 <code>(attrs -&gt; 'brand') = 'brand07'</code>과 <strong>같은 식</strong>이어야 한다. <code>attrs['brand']</code> 첨자로 쓰면 다른 식이므로 인덱스를 못 쓸 수 있다. 쓰는 형태를 하나로 통일한다.</p>
    </Section>

    <Section id="gist" title="4. GiST와 siglen">
      <CodeBlock language="sql">{demo.ix_gist_create}</CodeBlock>
      <CodeBlock language="sql" output={demo.ix_sizes.output} outputCaption="같은 10만 5백 행의 인덱스 크기 · 실제 실행 결과">{demo.ix_sizes.sql}</CodeBlock>
      <p>이 데이터는 <strong>값의 종류가 적어서</strong>(색 8종, 사이즈 5종 등, 무작위 값 없음) GIN이 가장 작다: 같은 값을 가진 행들이 하나의 포스팅 리스트로 묶이기 때문이다. 반면 GiST는 행마다 서명(siglen 바이트)을 두므로 크기가 siglen과 행 수를 따라간다. 무작위 값이 6개 들어 있는 <Ref to="#benchmark">실험 03의 데이터</Ref>에서는 GIN이 GiST(siglen 16)의 7배였다. <strong>GIN의 크기는 서로 다른 값의 수에 크게 좌우된다</strong>는 관찰이다.</p>
    </Section>

    <Section id="benchmark" title="5. 20만 행 실험 (실험 03)">
      <p>행당 속성 12개(색·사이즈·브랜드·소재·SKU 그룹과 무작위 6개, 0.1%의 행에만 <code>promo</code>)를 가진 20만 행. 인덱스 설정마다 같은 데이터를 복사해 만들고, 쿼리 5종은 모든 설정에서 <strong>결과 행 수가 같은지 먼저 검사</strong>한 뒤 시간을 쟀다. 표의 값은 {exp.index.runs}회 반복의 중앙값이다.</p>
      <table><thead><tr><th>인덱스</th><th>크기</th><th>생성</th><th>2만 행 삽입</th><th>삽입 WAL</th></tr></thead><tbody>
        {order.map((n) => <tr key={n}>
          <td>{names[n]}</td>
          <td>{n === 'none' ? '—' : fmtBytes(cfg[n].index_bytes.median)}</td>
          <td>{n === 'none' ? '—' : `${cfg[n].build_seconds.median.toFixed(1)} 초`}</td>
          <td>{cfg[n].insert_seconds.median.toFixed(2)} 초 ({ratio(cfg[n].insert_seconds.median, cfg.none.insert_seconds.median)})</td>
          <td>{fmtBytes(cfg[n].insert_wal_bytes.median)}</td>
        </tr>)}
      </tbody></table>
      <p>테이블 자체(힙)는 {fmtBytes(exp.index.base.heap)}이고 행당 hstore는 평균 {fmtBytes(exp.index.base.hstore_col)}다.</p>
      <ChartBox type="bar" title="쿼리 시간 (ms, 로그 축)" height={340}
        data={{
          labels: queryKeys.map((k) => q[k]),
          datasets: order.map((n, i) => ({
            label: names[n], data: queryKeys.map((k) => cfg[n].queries[k].ms.median),
            backgroundColor: [C.none, C.tsv, C.trgm, C.warn, C.ok][i],
          })),
        }}
        options={{ scales: axes({ log: true, yTitle: 'ms (log)' }) }}
        caption="같은 조건에서 인덱스 종류별 중앙값. 순차 스캔이 선택된 조합은 ‘인덱스 없음’과 비슷한 높이다." />
      <table><thead><tr><th>쿼리 (결과 행 수)</th>{order.map((n) => <th key={n}>{names[n]}</th>)}</tr></thead><tbody>
        {queryKeys.map((k) => <tr key={k}>
          <td>{q[k]} ({fmtNum(cfg.none.queries[k].rows)}행)</td>
          {order.map((n) => <td key={n}>{fmtMs(cfg[n].queries[k].ms.median)} · {shortPlan(cfg[n].queries[k].plans[0])}{cfg[n].queries[k].recheck_removed.median > 0 ? ` · 재검사 탈락 ${fmtNum(cfg[n].queries[k].recheck_removed.median)}` : ''}</td>)}
        </tr>)}
      </tbody></table>
      <ul>
        <li><strong>GIN은 선택도가 높을수록 이득이 커진다.</strong> 0.1%짜리 조건에서 순차 스캔 {fmtMs(cfg.none.queries.contain_rare_value.ms.median)} → GIN {fmtMs(cfg.hstore_gin.queries.contain_rare_value.ms.median)}. 2.5%짜리는 {fmtMs(cfg.none.queries.contain_2keys_common.ms.median)} → {fmtMs(cfg.hstore_gin.queries.contain_2keys_common.ms.median)}로 이득이 작다.</li>
        <li><strong>GiST(siglen 16)는 작지만 손실이 크다.</strong> 인덱스 {fmtBytes(cfg.hstore_gist16.index_bytes.median)}로 GIN({fmtBytes(cfg.hstore_gin.index_bytes.median)})의 일부지만, 희귀 값 조건에서 힙 재검사로 탈락한 행이 {fmtNum(cfg.hstore_gist16.queries.contain_rare_value.recheck_removed.median)}개라 순차 스캔과 비슷하거나 더 느렸다. siglen을 128로 키우면 크기와 정밀도가 그 중간이 된다.</li>
        <li><strong>btree 식 인덱스</strong>는 {fmtBytes(cfg.btree_brand.index_bytes.median)}로 아주 작고, 그 식의 동등 조회만 빠르다. 다른 연산자 쿼리는 도와주지 않는다(순차 스캔).</li>
        <li><strong>쓰기 비용:</strong> GIN이 있으면 2만 행 삽입이 인덱스 없음 대비 {ratio(cfg.hstore_gin.insert_seconds.median, cfg.none.insert_seconds.median)}, WAL은 {ratio(cfg.hstore_gin.insert_wal_bytes.median, cfg.none.insert_wal_bytes.median)}였다.</li>
      </ul>
      <Callout kind="warn" title="읽는 법 — 이 측정의 한계">
        <p>시간은 Docker VM의 공유 CPU 3개에서 잰 밀리초 단위 값이라 절대값이 아닌 <strong>인덱스 간 상대 비교</strong>로 읽는다. 데이터가 캐시에 올라 있는 상태(첫 실행은 버리고 7회 중앙값)이며, 디스크에서 읽는 상황이나 더 큰 데이터는 재지 않았다. 20만 행보다 훨씬 크면 GIN의 이득은 커진다.</p>
      </Callout>
      <SourceNote path="week04/hstore/experiments/03-index-and-query/bench.py" />
    </Section>

    <Section id="guide" title="6. 고르는 법">
      <table><thead><tr><th>주로 하는 조회</th><th>선택</th></tr></thead><tbody>
        <tr><td>속성 조합으로 필터 (<code>@&gt;</code>), 키 존재 (<code>?</code>)</td><td><strong>GIN</strong>. 쓰기가 많고 값이 큰 hstore면 <Ref to="/hstore/updates#gin">갱신 비용</Ref>을 먼저 본다.</td></tr>
        <tr><td>특정 키의 동등·범위 조회 한두 개</td><td><strong>btree 식 인덱스</strong>. GIN보다 훨씬 작다.</td></tr>
        <tr><td>공간이 빠듯하고 정확도는 덜 중요</td><td>GiST + 큰 siglen. 재검사 탈락 수를 <code>EXPLAIN ANALYZE</code>로 본다.</td></tr>
        <tr><td>같은 hstore를 통째로 동등 비교·유일성</td><td>btree/hash (<code>=</code>).</td></tr>
      </tbody></table>
    </Section>
  </>
}
