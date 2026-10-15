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
import { envTags, fmtNum, r2, r3, ratio } from './stats'
import { EFC_SWEEP, HNSW_EF, M_SWEEP, ds, expectedAtLevel, hnsw, ix, mwm, vacuumMs } from './indexStats'
import { Deep, Goal, Next, Quiz, Summary, Term } from './guide'
import { QUIZ } from './quizzes'

const M_COLORS = [C.none, C.tsv, C.bigm, C.trgm]
const EFC_COLORS = [C.warn, C.bigm, C.ok]
const DEF_M = 16, DEF_EFC = 64
const [EF_MIN] = HNSW_EF
const EF_MAX = HNSW_EF[HNSW_EF.length - 1]
const [EFC_LOW] = EFC_SWEEP
const EFC_HIGH = EFC_SWEEP[EFC_SWEEP.length - 1]
const levels = [0, 1, 2, 3, 4]
const avgMs = (rows: { build_ms: number }[]) => rows.reduce((a, r) => a + r.build_ms, 0) / rows.length

export default function Hnsw() {
  const low = mwm('1MB'), high = mwm('1GB')
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="HNSW: 여러 층의 길을 따라 내려가며 찾는다"
      lede="HNSW는 점과 점 사이에 '이웃 길'을 놓아 그래프를 만들고, 그 길을 따라 질문 쪽으로 걸어가며 찾는다. 길은 여러 층으로 되어 있어 위층에서는 멀리, 아래층에서는 촘촘하게 움직인다. 이름의 뜻, 층이 정해지는 방식, 점을 넣는 과정, 찾는 과정, 세 손잡이(m·ef_construction·ef_search)의 효과, 그리고 지울 때와 메모리가 모자랄 때를 실측으로 본다."
      tags={[...envTags, { label: `${fmtNum(ds.rows)}행 · ${ds.dim}차원 · 무리 ${ds.clusters}개` }, { label: `질문 ${ds.queries}개 · ${ix.runs}회 빌드` }]} />

    <Summary points={[
      <>HNSW = 점들 사이에 여러 층의 이웃 길을 놓고, 위층에서 크게·아래층에서 넓게 걸으며 찾는다. 층은 확률 1/m로 정해진다.</>,
      <>m과 ef_construction은 만들 때 정하는 <strong>길의 품질</strong>, ef_search는 찾을 때 정하는 <strong>탐색 폭</strong>. 길이 엉성하면 탐색 폭을 늘려도 천장이 있다.</>,
      <>새 데이터에는 강하지만, 만들기·지우기(VACUUM)가 비싸고 만들 때 메모리가 넉넉해야 한다.</>,
    ]} />

    <Goal
      questions={['HNSW라는 이름은 무슨 뜻인가?', '층은 어떻게 정해지고, 왜 위층이 있으면 빨라지나?', '점을 넣을 때와 찾을 때 각각 무슨 일이 일어나나?', 'm, ef_construction, ef_search는 각각 무엇을 바꾸나?', '행을 지우거나 메모리가 모자라면 어떻게 되나?']}
      assumes={<>IVFFlat의 동작(<Ref to="/pgvector/ivfflat">IVFFlat</Ref>), recall과 버퍼/질의(<Ref to="/pgvector/ann">근사 검색과 recall</Ref>).</>} />

    <EasyFirst>
      <p>처음 가는 동네에서 친구 집을 찾는다고 하자. 먼저 <strong>고속도로</strong>로 그 도시 근처까지 크게 이동하고, <strong>국도</strong>로 동네 근처까지, 마지막으로 <strong>골목길</strong>을 걸으며 “이 집이 더 가까운가?”를 확인한다. HNSW의 위층은 듬성듬성한 고속도로, 맨 아래층은 모든 집이 이어진 골목길이다. 걸을 때마다 지금까지 본 집 중 가장 가까운 집들을 <strong>후보 명단</strong>으로 들고 다니는데, 명단이 길수록 덜 놓치지만 더 많이 걷는다.</p>
    </EasyFirst>

    <Section id="name" title="1. 이름 풀이: Hierarchical Navigable Small World">
      <table><thead><tr><th>부분</th><th>뜻</th></tr></thead><tbody>
        <tr><td><strong>Small World</strong></td><td>“여섯 다리만 건너면 세상 누구와도 연결된다”는 좁은 세상 현상. 대부분은 가까운 이웃과 이어져 있고 일부가 먼 곳과 이어져 있으면, 어느 두 점도 몇 걸음 안에 닿는다</td></tr>
        <tr><td><strong>Navigable</strong></td><td>지도 없이도 “지금 이웃 중 목적지에 더 가까운 쪽으로 간다”만 반복해서 길을 찾을 수 있다(탐욕적 이동)</td></tr>
        <tr><td><strong>Hierarchical</strong></td><td>그래프를 여러 층으로 쌓아, 위층에서 큰 걸음으로 먼저 다가간다</td></tr>
      </tbody></table>
      <Term word="탐욕적(greedy) 이동">앞을 멀리 내다보지 않고, 지금 갈 수 있는 곳 중 당장 가장 좋아 보이는 쪽으로 한 걸음씩 가는 방법. 단순하고 빠르지만, 주변에 더 나은 곳이 없어 보이는 자리(국소 최적)에서 멈출 수 있다.</Term>
      <p>IVFFlat이 공간을 <strong>동네로 나누는</strong> 방식이라면, HNSW는 점들 사이에 <strong>길을 놓는</strong> 방식이다. 동네 경계가 없으므로 “옆 동네에 있어서 놓치는” 문제가 없는 대신, 길을 잘못 들면 엉뚱한 곳에서 멈출 수 있다.</p>
    </Section>

    <Section id="layers" title="2. 층은 주사위로 정한다">
      <p>점이 들어올 때마다 그 점이 몇 층까지 올라갈지 무작위로 정한다. pgvector 소스(<code>hnsw.h</code>)의 규칙은 “한 층 더 올라갈 확률 = 1/m”이다. 기본 m=16이면 16개 중 1개가 1층에도, 256개 중 1개가 2층에도 올라간다. 위층일수록 점이 기하급수적으로 적어진다.</p>
      <table><thead><tr><th>층</th><th>이 층까지 있는 점 (계산값, {fmtNum(ds.rows)}행 · m={DEF_M})</th><th>점마다 이을 이웃 수</th></tr></thead><tbody>
        {levels.map((l) => <tr key={l}><td>{l}층{l === 0 ? ' (맨 아래)' : ''}</td><td>약 {fmtNum(expectedAtLevel(ds.rows, DEF_M, l))}개</td><td>{l === 0 ? `${DEF_M * 2} (= 2m)` : DEF_M}</td></tr>)}
      </tbody></table>
      <p>이 표는 측정이 아니라 확률 규칙으로 계산한 기댓값이다. 맨 아래층만 이웃을 2배(2m) 잇는 것도 소스의 규칙이다. 위층은 점이 적어 한 걸음이 멀리 가고, 아래로 내려올수록 촘촘해진다 — 정렬된 목록에 “건너뛰기 링크”를 몇 층 얹은 <strong>스킵 리스트</strong>와 같은 발상이다.</p>
    </Section>

    <Section id="insert" title="3. 점을 넣을 때 — 자기 자리를 찾아가 이웃과 길을 잇는다">
      <Diagram chart={`flowchart TB
        A["새 점: 층 L을 주사위로 정함"] --> B["맨 위층 출발점에서<br/>L층까지 탐욕적으로 내려옴"]
        B --> C["L층부터 0층까지 층마다<br/>후보 ef_construction개를 모아<br/>가장 좋은 이웃 m개(0층은 2m개)와 연결"]
        C --> D["이웃 쪽에서도 새 점으로 길을 냄<br/>이웃 수가 넘치면 일부 길을 정리"]
      `} caption="CREATE INDEX도 결국 이 삽입을 모든 행에 대해 반복한다. 그래서 빈 테이블에 먼저 만들어도 되고, 새 행이 들어올 때도 같은 일이 일어난다." />
      <p>삽입이 곧 “이웃 찾기 검색”이라서 비싸다. 행마다 그래프를 탐색하고 여러 이웃의 연결을 고쳐야 한다. 그래서 HNSW는 IVFFlat보다 만들기가 훨씬 느리다. 대신 <strong>새 점이 들어올 때마다 그 자리에서 길을 잇기 때문에</strong> 데이터 분포가 바뀌어도 다시 만들 필요가 없다(<Ref to="/pgvector/ivfflat-details#shift">IVFFlat의 함정 ②</Ref>에서 HNSW는 다시 만들기 전에도 recall이 그대로였다).</p>
      <div id="efc-error" />
      <p>pgvector는 <code>ef_construction</code>이 이을 이웃 수의 2배(2m)보다 작으면 인덱스를 만들어 주지 않는다. 고를 후보가 이을 이웃보다 적으면 말이 안 되기 때문이다.</p>
      <CodeBlock language="sql" output={ix.efc_error.output} outputCaption="실제 오류">{ix.efc_error.sql}</CodeBlock>
    </Section>

    <Section id="search" title="4. 찾을 때 — 위에서 크게, 아래에서 넓게">
      <Clotho id="pgv-hnsw-search" />
      <ol>
        <li><strong>위층:</strong> 맨 위층 출발점에서, 이웃 중 질문에 더 가까운 점으로 계속 옮긴다. 더 가까운 이웃이 없으면 한 층 내려간다.</li>
        <li><strong>맨 아래층:</strong> 후보 명단을 <code>hnsw.ef_search</code>개(기본 40) 유지하며 넓게 펼친다. 명단에서 가장 가까운 점의 이웃들을 살펴 더 가까운 점이 있으면 명단에 넣고, 명단 밖으로 밀린 점은 버린다. 더 나아질 게 없으면 멈춘다.</li>
        <li><strong>결과:</strong> 명단에서 가까운 순으로 10개를 돌려준다.</li>
      </ol>
      <Callout kind="info" title="왜 명단이 1개가 아니라 40개인가">
        <p>명단을 1개만 들고 다니면 “이웃 중에는 더 가까운 점이 없는데, 사실 두 걸음 건너에 더 가까운 점이 있는” 자리에서 멈춰 버린다(국소 최적). 명단을 넉넉히 들고 다니면 당장은 조금 먼 점도 더 펼쳐 보므로 그런 함정을 빠져나온다. 그래서 <code>ef_search</code>를 올리면 정확해지고 더 많이 읽는다. 결과는 이 명단 크기를 넘을 수 없으므로, pgvector 문서는 <code>ef_search</code>를 질의의 <code>LIMIT</code>의 <strong>2배 이상</strong>으로 두라고 권한다.</p>
      </Callout>
    </Section>

    <Section id="knobs" title="5. 세 손잡이를 실제로 돌려 보면">
      <Callout kind="info" title="이 페이지의 실험 데이터">
        <p><Ref to="/pgvector/ivfflat-details#search">IVFFlat</Ref>과 같은 데이터다({ds.dim}차원 {fmtNum(ds.rows)}행, 무리 {ds.clusters}개, 테이블에 없는 질문 {ds.queries}개). 설정마다 인덱스를 {ix.runs}번 다시 만들어 평균을 냈다. 무리가 또렷해 recall이 쉽게 1.0에 닿는 데이터라, 절대값보다 방향을 본다.</p>
      </Callout>
      <h3 className="mt-6 font-semibold">① m — 점마다 이을 길의 수 (만들 때)</h3>
      <ChartBox type="line" title="ef_search에 따른 recall@10 — m별 (ef_construction=64)" height={300}
        data={{
          labels: HNSW_EF.map(String),
          datasets: M_SWEEP.map((m, i) => ({
            label: `m=${m}`, borderColor: M_COLORS[i], backgroundColor: M_COLORS[i],
            data: HNSW_EF.map((ef) => hnsw(m, 64, ef).recall),
          })),
        }}
        options={{ scales: { ...axes({ xTitle: 'ef_search (후보 명단 길이)', yTitle: 'recall@10' }), y: { ...axes().y, min: 0, max: 1.05 } } }}
        caption="길이 적으면(m=4) 명단을 늘려도 정확도가 더디게 오른다. m을 늘리면 같은 ef_search에서 훨씬 정확하다." />
      <table><thead><tr><th>m</th><th>인덱스 크기</th><th>만드는 시간</th><th>recall@10 (ef_search={EF_MIN} / 40)</th><th>페이지/질의 (ef_search=40)</th></tr></thead><tbody>
        {M_SWEEP.map((m) => {
          const a = hnsw(m, 64, EF_MIN), b = hnsw(m, 64, 40)
          return <tr key={m}><td>{m}{m === DEF_M ? ' (기본)' : ''}</td><td>{a.mb.toFixed(1)} MB</td><td>{(a.buildMs / 1000).toFixed(2)}초</td><td>{r2(a.recall)} / {r2(b.recall)}</td><td>{fmtNum(b.buffers)}</td></tr>
        })}
      </tbody></table>
      <ChartNotes items={[
        { label: 'm을 키우면 정확해지지만 크고 느려진다', note: <>m {M_SWEEP[0]}→{M_SWEEP[M_SWEEP.length - 1]}: 크기 {hnsw(M_SWEEP[0], 64, 40).mb.toFixed(1)}→{hnsw(M_SWEEP[M_SWEEP.length - 1], 64, 40).mb.toFixed(1)} MB, 만드는 시간 {ratio(hnsw(M_SWEEP[M_SWEEP.length - 1], 64, 40).buildMs, hnsw(M_SWEEP[0], 64, 40).buildMs)}. 점마다 저장할 이웃 목록이 길어지고, 넣을 때 정리할 연결도 많아지기 때문이다.</> },
        { label: '이 데이터에서는 기본값 m=16이면 충분했다', note: <>ef_search=40에서 recall {r2(hnsw(16, 64, 40).recall)}. m=32는 크기·시간만 늘었다. 데이터가 어렵거나(무리가 흐릿하거나) 차원이 높으면 결과가 다를 수 있다.</> },
      ]} />

      <h3 className="mt-8 font-semibold">② ef_construction — 길을 놓을 때 둘러보는 후보 수 (만들 때)</h3>
      <ChartBox type="line" title="ef_search에 따른 recall@10 — ef_construction별 (m=16)" height={280}
        data={{
          labels: HNSW_EF.map(String),
          datasets: EFC_SWEEP.map((efc, i) => ({
            label: `ef_construction=${efc}`, borderColor: EFC_COLORS[i], backgroundColor: EFC_COLORS[i],
            data: HNSW_EF.map((ef) => hnsw(16, efc, ef).recall),
          })),
        }}
        options={{ scales: { ...axes({ xTitle: 'ef_search', yTitle: 'recall@10' }), y: { ...axes().y, min: 0.8, max: 1.01 } } }}
        caption="세로축을 0.8부터 그렸다. ef_construction이 낮으면 ef_search를 올려도 넘지 못하는 천장이 생긴다." />
      <ChartNotes items={[
        { label: `ef_construction=${EFC_LOW}: 질의 때 아무리 넓게 봐도 못 따라잡는다`, note: <>ef_search={EF_MAX}에서도 recall {r3(hnsw(16, EFC_LOW, EF_MAX).recall)}(실행별 {r3(hnsw(16, EFC_LOW, EF_MAX).recallLo)}~{r3(hnsw(16, EFC_LOW, EF_MAX).recallHi)}) — 기본값 {DEF_EFC}로 만든 인덱스는 ef_search=40에서 이미 {r3(hnsw(16, DEF_EFC, 40).recall)}였다. 만들 때 이웃을 대충 고르면 <strong>길 자체가 엉성해서</strong>, 찾을 때 명단을 늘려도 닿지 못하는 점이 생긴다.</> },
        { label: '크기는 그대로, 만드는 시간만 변한다', note: <>ef_construction {EFC_LOW}→{EFC_HIGH}: 크기 {hnsw(16, EFC_LOW, 40).mb.toFixed(1)}→{hnsw(16, EFC_HIGH, 40).mb.toFixed(1)} MB(이웃 수 m이 같으니), 만드는 시간 {(hnsw(16, EFC_LOW, 40).buildMs / 1000).toFixed(2)}→{(hnsw(16, EFC_HIGH, 40).buildMs / 1000).toFixed(2)}초.</> },
      ]} />

      <h3 className="mt-8 font-semibold">③ ef_search — 찾을 때 들고 다니는 명단 길이 (질의마다)</h3>
      <table><thead><tr><th>ef_search</th><th>recall@10</th><th>페이지/질의</th><th>ms/질의</th></tr></thead><tbody>
        {HNSW_EF.map((ef) => { const a = hnsw(DEF_M, DEF_EFC, ef); return <tr key={ef}><td>{ef}{ef === 40 ? ' (기본)' : ''}</td><td>{r2(a.recall)}</td><td>{fmtNum(a.buffers)}</td><td>{a.ms.toFixed(3)}</td></tr> })}
      </tbody></table>
      <p>m=16·ef_construction=64(기본) 인덱스 하나로 ef_search만 바꿨다. 인덱스를 다시 만들 필요 없이 <code>SET hnsw.ef_search = …</code>로 질의마다 바꿀 수 있는 유일한 손잡이다. 인덱스 없이 전부 비교하면 {fmtNum(ix.exact.buffers_per_query)}페이지·{ix.exact.ms_per_query.toFixed(2)} ms였다.</p>
      <Callout kind="tip" title="정리: 무엇을 먼저 돌리나">
        <p>① 기본값(m=16, ef_construction=64)으로 만들고 ② <code>ef_search</code>를 올려 가며 내 데이터로 recall을 잰다(AWS 가이드는 100부터 권한다). ③ ef_search를 크게 올려도 recall이 멈춰 있으면 <strong>그래프가 문제</strong>다 — ef_construction이나 m을 올려 다시 만든다.</p>
      </Callout>
    </Section>

    <Section id="delete" title="6. 지울 때 — VACUUM이 길을 고쳐야 한다">
      <p>행을 지우면 그 점은 바로 사라지지 않고 “지워짐” 표시만 된다. 나중에 <code>VACUUM</code>이 실제로 치우는데, HNSW에서는 그 점을 거쳐 가던 길이 끊기지 않도록 <strong>주변 점들의 이웃을 다시 찾아 이어 줘야</strong> 한다. 같은 테이블에서 행의 {Math.round(ix.vacuum.deleted_fraction * 100)}%를 지우고 VACUUM 시간을 쟀다.</p>
      <ChartBox type="bar" title="행 20%를 지운 뒤 VACUUM 시간 (ms)" height={240}
        data={{
          labels: ['인덱스 없음', 'IVFFlat', 'HNSW'],
          datasets: [{ label: 'VACUUM ms', data: [vacuumMs('없음'), vacuumMs('IVFFlat'), vacuumMs('HNSW')], backgroundColor: [C.none, C.tsv, C.bigm] }],
        }}
        options={{ plugins: { legend: { display: false } }, scales: axes({ log: true, yTitle: 'ms (log)' }) }}
        caption={`${ix.runs}회 평균. HNSW는 IVFFlat의 ${ratio(vacuumMs('HNSW'), vacuumMs('IVFFlat'))} 걸렸다.`} />
      <p>{fmtNum(ds.rows)}행이라 절대 시간은 작지만, 수백만 행에서 삭제·갱신이 잦으면 이 차이가 운영 부담이 된다. pgvector 문서는 HNSW의 VACUUM이 오래 걸리면 먼저 <code>REINDEX INDEX CONCURRENTLY</code>로 다시 만든 뒤 VACUUM하라고 권한다. 갱신(UPDATE)도 PostgreSQL에서는 “지우고 새로 넣기”라 같은 비용이 든다.</p>
    </Section>

    <Section id="memory" title="7. 만들 때 메모리가 모자라면">
      <p>HNSW는 그래프를 메모리(<code>maintenance_work_mem</code>)에 올려 놓고 만든다. 그래프가 다 들어가지 않으면 pgvector가 알려 주고, 그 뒤로는 디스크 페이지를 오가며 만들어 느려진다.</p>
      <CodeBlock language="sql" output={low[0].notice.join('\n')} outputCaption="maintenance_work_mem = 1MB · 실제 출력">{ix.mwm.sql}</CodeBlock>
      <table><thead><tr><th>maintenance_work_mem</th><th>만드는 시간 ({ix.runs}회 평균)</th><th>NOTICE</th></tr></thead><tbody>
        <tr><td>1GB</td><td>{(avgMs(high) / 1000).toFixed(2)}초</td><td>{high.every((r) => r.notice.length === 0) ? '없음' : '있음'}</td></tr>
        <tr><td>1MB</td><td>{(avgMs(low) / 1000).toFixed(2)}초 ({ratio(avgMs(low), avgMs(high))})</td><td>{fmtNum(Number(low[0].notice[0].match(/after (\d+)/)?.[1]))}행쯤에서 “더 이상 안 들어간다”</td></tr>
      </tbody></table>
      <p>병렬 빌드를 끄고(<code>max_parallel_maintenance_workers = 0</code>) 비교했다. 실서비스에서는 가장 큰 HNSW 인덱스가 들어갈 만큼 <code>maintenance_work_mem</code>을 잡고 만든다(그 세션에서만 <code>SET</code>으로 올려도 된다).</p>
      <SourceNote path="web/scripts/capture-pgvector-index-demo.py">이 페이지의 측정을 다시 만드는 스크립트</SourceNote>
    </Section>

    <Deep title="소스에서 확인한 숫자들 (pgvector v0.8.0 hnsw.h)">
      <ul>
        <li>층 배정 계수 <code>HnswGetMl(m) = 1 / log(m)</code> → 한 층 더 올라갈 확률 1/m</li>
        <li>층별 이웃 수 <code>HnswGetLayerM(m, layer) = layer == 0 ? m * 2 : m</code></li>
        <li>m: 기본 16 (2~100), ef_construction: 기본 64 (4~1000), ef_search: 기본 40 (1~1000)</li>
      </ul>
    </Deep>

    <Quiz items={QUIZ['hnsw']} />

    <Next to="/pgvector/hnsw-ivfflat" title="HNSW vs IVFFlat" why={'두 방식을 같은 데이터에 나란히 놓고, 실무에서 무엇을 기본으로 고르는지 정리한다.'} />
  </>
}
