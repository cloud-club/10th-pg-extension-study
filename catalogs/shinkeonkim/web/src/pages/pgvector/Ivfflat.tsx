import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { Diagram } from '@/components/viz/Diagram'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { d, envTags, fmtNum, r2 } from './stats'
import { IVF_LISTS, IVF_PROBES, ds, ix, ivf, ivfHas, shift } from './indexStats'
import { Deep, Goal, Next, Quiz, Summary, Term } from './guide'
import { QUIZ } from './quizzes'

const COLORS = [C.tsv, C.ok, C.trgm]
const [L_SMALL, L_MID, L_BIG] = IVF_LISTS
const sIvf = shift('ivfflat')
const sHnsw = shift('hnsw')

export default function Ivfflat() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="IVFFlat: 동네로 나눠 두고 가까운 동네만 뒤진다"
      lede="IVFFlat은 pgvector의 두 인덱스 중 원리가 더 단순한 쪽이다. 만들 때 점들을 동네(list)로 나눠 두고, 찾을 때는 질문과 가까운 동네 몇 곳만 뒤진다. 이름의 뜻, 만드는 과정, 찾는 과정, 두 손잡이(lists·probes)가 실제로 무엇을 바꾸는지, 그리고 데이터가 바뀔 때 생기는 일을 실측으로 따라간다."
      tags={[...envTags, { label: `${fmtNum(ds.rows)}행 · ${ds.dim}차원 · 무리 ${ds.clusters}개` }, { label: `질문 ${ds.queries}개 · ${ix.runs}회 빌드` }]} />

    <Summary points={[
      <>IVFFlat = 만들 때 k-means로 동네(lists)를 나누고, 찾을 때 가까운 동네 probes곳만 원본 벡터로 전부 비교한다.</>,
      <>lists를 키우면 동네가 작아져 싸지지만 놓치기 쉬워진다 → probes로 보완. 너무 키우면 중심 비교 비용이 커진다.</>,
      <>중심은 만드는 순간 고정된다. 데이터를 다 넣고 만들고, 분포가 바뀌면 다시 만든다.</>,
    ]} />

    <Goal
      questions={['IVFFlat이라는 이름은 무슨 뜻인가?', '인덱스를 만들 때와 찾을 때 각각 무슨 일이 일어나나?', 'lists와 probes를 바꾸면 정확도·비용이 어떻게 바뀌나?', '데이터를 계속 넣으면 왜 다시 만들어야 하나?']}
      assumes={<>recall@10과 버퍼/질의(<Ref to="/pgvector/ann">근사 검색과 recall</Ref>).</>} />

    <EasyFirst>
      <p>도서관에 책이 2만 권 있다. 사서가 미리 책들을 비슷한 것끼리 <strong>서가 몇 개</strong>로 나눠 꽂고, 서가마다 “이 서가의 대표 책”을 정해 둔다. 손님이 책 한 권을 들고 와 “이것과 비슷한 책”을 찾으면, 사서는 먼저 <strong>대표 책들과만</strong> 비교해 가장 비슷한 서가를 고르고, <strong>그 서가의 책만</strong> 한 권씩 비교한다. 서가를 잘게 나눌수록 한 서가는 작아지지만, 비슷한 책이 옆 서가에 꽂혀 있을 가능성도 커진다. 그래서 서가 몇 곳을 뒤질지(probes) 정하는 손잡이가 있다.</p>
    </EasyFirst>

    <Section id="name" title="1. 이름 풀이: IVF + Flat">
      <table><thead><tr><th>부분</th><th>뜻</th><th>도서관 비유</th></tr></thead><tbody>
        <tr><td><strong>IVF</strong> (Inverted File)</td><td>“동네 번호 → 그 동네에 속한 행 목록”을 저장하는 구조. 책 뒤 찾아보기(역색인)와 같은 모양이다</td><td>서가 번호 → 꽂힌 책 목록</td></tr>
        <tr><td><strong>Flat</strong></td><td>목록 안의 벡터를 <strong>압축하지 않고 원본 그대로</strong> 저장한다. 그래서 목록 안에서는 정확한 거리를 잰다</td><td>서가의 책을 요약본이 아니라 실물로 꽂아 둠</td></tr>
      </tbody></table>
      <p>벡터 검색 라이브러리(예: FAISS)에는 목록 안의 벡터를 압축하는 IVF-PQ 같은 변형도 있다. pgvector는 압축하지 않는 Flat만 제공한다. 압축이 필요하면 <code>halfvec</code>을 쓰거나 pgvectorscale(DiskANN)을 본다.</p>
    </Section>

    <Section id="build" title="2. 만들 때 — 무리 나누기(k-means)와 목록 채우기">
      <Term word="k-means">점들을 k개 무리로 나누는 방법. ① 중심 k개를 임의로 정하고 ② 모든 점을 가장 가까운 중심에 배정하고 ③ 무리마다 평균 위치로 중심을 옮기는 것을 반복한다. 중심이 더 이상 크게 움직이지 않으면 멈춘다.</Term>
      <Diagram chart={`flowchart LR
        A["테이블의 행들"] --> B["표본 추출<br/>max(lists × 50, 10,000)행"]
        B --> C["k-means로<br/>중심 lists개 학습"]
        C --> D["모든 행을<br/>가장 가까운 중심에 배정"]
        D --> E["인덱스에 저장<br/>① 중심 목록<br/>② 중심별 행 목록(원본 벡터)"]
      `} caption="pgvector 소스(ivfbuild.c)의 순서. 표본 수는 lists × 50, 단 최소 10,000행이다. 표본을 쓰므로 같은 데이터로 다시 만들어도 중심이 조금씩 달라진다." />
      <p>여기서 중요한 사실 두 가지:</p>
      <ul>
        <li><strong>중심은 만드는 순간의 데이터로 정해지고, 그 뒤로 바뀌지 않는다.</strong> 나중에 들어온 행은 그때 있는 중심 중 가장 가까운 목록 끝에 붙을 뿐이다.</li>
        <li>lists가 클수록 k-means가 할 일이 많아 <strong>만드는 시간이 길어진다</strong>(아래 4절 표).</li>
      </ul>
    </Section>

    <Section id="search" title="3. 찾을 때 — 중심과 비교 → 가까운 동네만 전부 비교">
      <Clotho id="pgv-ivfflat-probes" />
      <ol>
        <li><strong>중심과 비교:</strong> 질문 벡터와 중심 lists개 전부의 거리를 잰다.</li>
        <li><strong>동네 고르기:</strong> 가장 가까운 중심 <code>ivfflat.probes</code>개(기본 <strong>1</strong>)를 고른다.</li>
        <li><strong>동네 안 전수 비교:</strong> 고른 동네의 행들과 모두 거리를 재고 가까운 순으로 정렬해 10개를 돌려준다.</li>
      </ol>
      <p>그래서 질문 하나의 비용은 대략 <strong>(중심 lists개와 비교) + (probes개 동네 × 동네 크기)</strong>다. 동네 크기는 평균 <code>행 수 ÷ lists</code>다. 정확도를 잃는 지점은 하나다 — <strong>진짜 가까운 점이 고르지 않은 옆 동네에 있을 때</strong>. 질문이 동네 경계 근처에 있으면 이런 일이 생긴다.</p>
      <Callout kind="info" title="이 페이지의 실험 데이터">
        <p>{ds.dim}차원 점 {fmtNum(ds.rows)}개를 무리 {ds.clusters}개로 만들었다(무리 중심 주변 ±0.2). 질문 {ds.queries}개는 테이블에 없는 같은 분포의 점이다. 같은 설정의 인덱스를 {ix.runs}번 다시 만들어 평균을 냈다. 인덱스 없이 전부 비교하면 질문 하나에 {fmtNum(ix.exact.buffers_per_query)}페이지·{ix.exact.ms_per_query.toFixed(2)} ms가 든다 — 이것이 비교 기준이다.</p>
      </Callout>
      <Deep title="데이터를 만든 SQL">
        <CodeBlock language="sql">{ds.generate_sql}</CodeBlock>
        <p>서로 다른 벡터 수 {fmtNum(ds.distinct_vectors)}개(= 행 수)를 확인했다. 실제 임베딩보다 무리가 훨씬 또렷한 데이터라 recall이 쉽게 1.0에 닿는다. 숫자의 절대값보다 <strong>손잡이를 돌렸을 때 어느 방향으로 움직이는지</strong>를 본다.</p>
      </Deep>
    </Section>

    <Section id="lists-probes" title="4. lists와 probes — 동네를 몇 개로 나누고, 몇 곳을 뒤지나">
      <p>lists를 {IVF_LISTS.join(', ')}로 바꿔 만들고(각각 행 수/1000, √행 수, 그보다 훨씬 잘게), probes를 1부터 늘리며 쟀다.</p>
      <ChartBox type="line" title="probes에 따른 recall@10" height={300}
        data={{
          labels: IVF_PROBES.map(String),
          datasets: IVF_LISTS.map((l, i) => ({
            label: `lists=${l}`, borderColor: COLORS[i], backgroundColor: COLORS[i],
            data: IVF_PROBES.map((p) => (ivfHas(l, p) ? ivf(l, p).recall : null)),
          })),
        }}
        options={{ spanGaps: true, scales: { ...axes({ xTitle: 'probes (뒤지는 동네 수)', yTitle: 'recall@10' }), y: { ...axes().y, min: 0, max: 1.05 } } }}
        caption="동네를 잘게 나눌수록(lists↑) probes=1의 recall이 떨어진다 — 진짜 이웃이 옆 동네로 갈라지기 때문이다. probes를 늘리면 회복된다." />
      <ChartBox type="line" title="probes에 따른 질의당 읽은 페이지" height={300}
        data={{
          labels: IVF_PROBES.map(String),
          datasets: [
            ...IVF_LISTS.map((l, i) => ({
              label: `lists=${l}`, borderColor: COLORS[i], backgroundColor: COLORS[i],
              data: IVF_PROBES.map((p) => (ivfHas(l, p) ? ivf(l, p).buffers : null)),
            })),
            { label: '인덱스 없음(전부 비교)', borderColor: C.none, backgroundColor: C.none, borderDash: [6, 4], pointRadius: 0,
              data: IVF_PROBES.map(() => ix.exact.buffers_per_query) },
          ],
        }}
        options={{ spanGaps: true, scales: axes({ log: true, xTitle: 'probes', yTitle: '페이지/질의 (log)' }) }}
        caption="동네 하나가 클수록(lists↓) probes 하나를 늘릴 때마다 많이 읽는다. lists가 너무 크면 이번엔 '중심 전부와 비교'하는 몫이 커진다." />
      <ChartNotes items={[
        { label: `lists=${L_SMALL}: 동네가 커서 놓치지 않지만 한 곳이 비싸다`, note: <>probes=1에서 이미 recall {r2(ivf(L_SMALL, 1).recall)}, 대신 페이지 {fmtNum(ivf(L_SMALL, 1).buffers)}. probes=16이면 {fmtNum(ivf(L_SMALL, 16).buffers)}페이지로, 인덱스 없이 전부 보는 것({fmtNum(ix.exact.buffers_per_query)})에 가까워진다.</> },
        { label: `lists=${L_MID}: 균형점`, note: <>probes=1 recall {r2(ivf(L_MID, 1).recall)}·{fmtNum(ivf(L_MID, 1).buffers)}페이지, probes=2면 {r2(ivf(L_MID, 2).recall)}·{fmtNum(ivf(L_MID, 2).buffers)}페이지.</> },
        { label: `lists=${L_BIG}: 너무 잘게 나누면`, note: <>probes=1 recall이 {r2(ivf(L_BIG, 1).recall)}까지 떨어지고, 페이지는 오히려 lists={L_MID}보다 많다({fmtNum(ivf(L_BIG, 1).buffers)}) — 중심 {L_BIG}개와 먼저 다 비교해야 하기 때문이다. probes={IVF_PROBES.find((p) => ivfHas(L_BIG, p) && ivf(L_BIG, p).recall >= 0.99)}에서야 0.99를 넘었다.</> },
      ]} />
      <table><thead><tr><th>lists</th><th>동네 평균 크기</th><th>만드는 시간</th><th>인덱스 크기</th><th>probes=1 recall (범위)</th></tr></thead><tbody>
        {IVF_LISTS.map((l) => {
          const a = ivf(l, 1)
          return <tr key={l}><td>{l}</td><td>{fmtNum(ds.rows / l)}행</td><td>{(a.buildMs / 1000).toFixed(2)}초</td><td>{a.mb.toFixed(2)} MB</td><td>{r2(a.recall)} ({r2(a.recallLo)}~{r2(a.recallHi)})</td></tr>
        })}
      </tbody></table>
      <Callout kind="tip" title="고르는 법 (pgvector 권장 시작값)">
        <p><strong>lists</strong> = 행 수 / 1000 (100만 행까지), 그보다 크면 √행 수. <strong>probes</strong> = √lists부터 시작해 내 데이터로 recall을 재며 조정. probes는 질의마다 <code>SET ivfflat.probes = …</code>로 바꿀 수 있지만 lists는 인덱스를 다시 만들어야 바뀐다.</p>
      </Callout>
    </Section>

    <Section id="build-order" title="5. 함정 ①: 빈 테이블에 먼저 만들면">
      <p>중심을 정할 데이터가 없으니 pgvector가 직접 경고한다. 표본 수가 lists보다 적을 때 나오는 경고다.</p>
      <CodeBlock language="sql" output={d('ivf_empty_notice').output} outputCaption="실제 출력">{d('ivf_empty_notice').sql}</CodeBlock>
      <Deep title="같은 데이터를 '인덱스 먼저' vs '데이터 먼저'로 만들어 비교">
        <p>5,000행·8차원 무작위 데이터를 한 테이블은 “인덱스 먼저 → 데이터”, 다른 테이블은 “데이터 먼저 → 인덱스” 순서로 만들었다. 크기로는 차이가 안 보인다.</p>
        <CodeBlock language="sql" output={d('ivf_sizes').output} outputCaption="실제 실행 결과">{d('ivf_sizes').sql}</CodeBlock>
        <CodeBlock language="sql" output={d('ivf_recall').output} outputCaption="lists=10 · probes=1 · 질문 100개 · 실제 실행 결과">{d('ivf_recall').sql}</CodeBlock>
        <p>빈 테이블에 먼저 만든 쪽이 낮았지만 차이는 작았다. 무리가 없는 무작위 데이터라 “잘 학습된 중심”의 이점이 작았을 수 있다. 아래 6절이 무리가 있는 데이터에서 같은 문제를 더 분명히 보여 준다.</p>
      </Deep>
    </Section>

    <Section id="shift" title="6. 함정 ②: 다른 종류의 데이터가 계속 들어오면">
      <p>무리 0~49의 행만 넣고 IVFFlat(lists=20)을 만든 뒤, 무리 50~99의 행을 나중에 넣었다. 새 무리에 대한 질문 {ix.shift.queries}개로 recall을 재고, <code>REINDEX</code>로 다시 만든 뒤 또 쟀다. 같은 일을 HNSW에도 했다.</p>
      <ChartBox type="bar" title="나중에 들어온 무리에 대한 recall@10" height={260}
        data={{
          labels: [`IVFFlat (${sIvf.setting.replace('SET ', '').replace(';', '')})`, `HNSW (${sHnsw.setting.replace('SET ', '').replace(';', '')})`],
          datasets: [
            { label: 'REINDEX 전', data: [sIvf.before, sHnsw.before], backgroundColor: C.warn },
            { label: 'REINDEX 후', data: [sIvf.after, sHnsw.after], backgroundColor: C.ok },
          ],
        }}
        options={{ scales: { ...axes({ yTitle: 'recall@10' }), y: { ...axes().y, min: 0, max: 1.05 } } }}
        caption={`${ix.runs}회 평균. IVFFlat REINDEX 전 각 회: ${sIvf.beforeAll.map(r2).join(', ')}.`} />
      <p>IVFFlat의 중심 20개는 무리 0~49만 보고 학습됐다. 새 무리 50~99의 점들은 “그나마 가까운” 옛 중심의 목록에 섞여 들어가고, 질문도 그 어색한 중심을 기준으로 동네를 고르므로 진짜 이웃을 놓친다. 다시 만들면 새 데이터까지 보고 중심을 정하므로 회복된다. HNSW는 새 점이 들어올 때마다 그 자리에서 이웃을 찾아 길을 잇기 때문에 이런 문제가 없었다.</p>
      <Callout kind="warn" title="실무 규칙">
        <p>IVFFlat은 <strong>데이터를 다 넣은 뒤에 만들고</strong>, 데이터의 종류(분포)가 바뀔 만큼 새 데이터가 쌓이면 <strong>다시 만든다</strong>(<code>REINDEX INDEX CONCURRENTLY</code>는 서비스를 멈추지 않고 다시 만든다). 그래서 AWS 가이드는 IVFFlat을 “정적인 데이터 + 주기적으로 통째 재빌드”하는 경우에 권한다.</p>
      </Callout>
    </Section>

    <Section id="ops" title="7. 그 밖에 알아 둘 것">
      <ul>
        <li><strong>지우기는 가볍다.</strong> 목록에서 해당 행을 빼면 끝이라, 행을 지운 뒤 <code>VACUUM</code>이 빨리 끝난다(HNSW와의 비교는 <Ref to="/pgvector/hnsw-details#delete">HNSW</Ref>).</li>
        <li><strong>조건이 붙은 검색</strong>에서 고른 동네의 행이 WHERE에 다 걸리면 결과가 모자랄 수 있다. pgvector 0.8.0부터 <code>ivfflat.iterative_scan</code>으로 동네를 더 뒤지게 할 수 있다(HNSW 쪽은 <Ref to="/pgvector/filtering">필터가 붙은 검색</Ref>).</li>
        <li><strong>인덱스 크기</strong>는 원본 벡터 + 중심이라 테이블보다 약간 작거나 비슷하다(<Ref to="/pgvector/cost#size">빌드 비용과 크기</Ref>).</li>
      </ul>
      <SourceNote path="web/scripts/capture-pgvector-index-demo.py">이 페이지의 측정을 다시 만드는 스크립트</SourceNote>
    </Section>

    <Quiz items={QUIZ['ivfflat']} />

    <Next to="/pgvector/hnsw" title="HNSW" why={'동네를 나누는 대신 점과 점 사이에 길을 놓는 방식. 새 데이터에 강했던 이유를 본다.'} />
  </>
}
