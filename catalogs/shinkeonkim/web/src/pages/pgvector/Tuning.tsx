import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { C, axes } from '@/lib/chart'
import { avg, build, envTags, fmtMs, fmtNum, fmtSec, pick, r2, r3, recall, scale } from './stats'
import { Deep, Goal, Next, Quiz, Summary } from './guide'
import { QUIZ } from './quizzes'

const engines = [
  { key: 'hnsw', name: 'HNSW (ef_search)', color: C.bigm },
  { key: 'ivfflat', name: 'IVFFlat (probes)', color: C.tsv },
  { key: 'diskann', name: 'DiskANN (query_search_list_size)', color: C.trgm },
] as const
const rows = (k: string) => recall.configs.filter((c) => c.index === k)
const cheap51 = { hnsw: pick(recall.configs, 'hnsw_ef10'), ivfflat: pick(recall.configs, 'ivfflat_probes1'), diskann: pick(recall.configs, 'diskann_sls10') }
const cheap300 = { hnsw: pick(scale.configs, 'hnsw_ef10'), ivfflat: pick(scale.configs, 'ivfflat_probes1'), diskann: pick(scale.configs, 'diskann_sls10') }
const mid300 = { hnsw: pick(scale.configs, 'hnsw_ef100'), ivfflat: pick(scale.configs, 'ivfflat_probes30'), diskann: pick(scale.configs, 'diskann_sls100') }

export default function Tuning() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="튜닝 곡선: 정확도를 얼마에 사나"
      lede="앞 페이지들의 손잡이(ef_search, probes)를 더 크고 어려운 데이터(128차원)에서 여러 값으로 돌려 가며 '읽은 페이지 수'와 'recall'을 함께 쟀다. 그리고 데이터를 6배로 늘렸을 때 가장 싼 설정이 어떻게 되는지 다시 쟀다."
      tags={[...envTags, { label: `${fmtNum(recall.n_vectors)}행 · 2회` }, { label: `${fmtNum(scale.n_vectors)}행 · 1회` }]} />

    <Summary points={[
      <>손잡이를 올리면 recall과 읽는 양이 함께 오른다. 세 인덱스 모두 그랬다(DiskANN은 처음부터 천장).</>,
      <>가장 싼 설정은 데이터가 커지면 무너진다 — HNSW·IVFFlat 모두. 기본값을 그대로 쓰지 말고 내 데이터로 recall을 재야 하는 이유다.</>,
      <>DiskANN은 처음부터 비싸게 읽지만, 규모가 커져도 가장 싼 설정의 recall이 유지됐다.</>,
    ]} />

    <Goal
      questions={['손잡이를 올리면 recall과 비용은 얼마나 같이 오르나?', '세 인덱스 중 같은 비용에서 가장 정확한 것은?', '데이터가 커지면 “가장 싼 설정”은 버티나?']}
      assumes={<>HNSW의 <code>ef_search</code>, IVFFlat의 <code>probes</code>(<Ref to="/pgvector/ivfflat">IVFFlat</Ref>·<Ref to="/pgvector/hnsw">HNSW</Ref>), recall과 버퍼/질의(<Ref to="/pgvector/ann">근사 검색과 recall</Ref>).</>} />

    <EasyFirst>
      <p>사진 해상도를 올리면 선명해지지만 파일이 커지는 것처럼, 인덱스의 손잡이를 올리면 정확해지지만 더 많이 읽는다. 아래 그래프는 그 관계를 그린 것이다. <strong>가로 = 비용(질의 하나에 읽은 페이지 수), 세로 = 정확도(recall)</strong>. 선 위의 점 하나가 손잡이 값 하나다. 같은 가로 위치에서 더 높이 있는 선이 “같은 돈으로 더 정확한” 인덱스다.</p>
    </EasyFirst>

    <Callout kind="info" title="세 번째 선, DiskANN은 뒤에서 설명한다">
      <p>그래프에는 pgvectorscale의 인덱스 <strong>DiskANN</strong>도 함께 그렸다. 구조는 <Ref to="/pgvector/diskann">DiskANN 인덱스</Ref>에서 설명하니, 여기서는 “같은 질문을 푸는 세 번째 방식이고, 손잡이 이름이 <code>query_search_list_size</code>(HNSW의 ef_search에 해당)”라고만 알면 된다.</p>
    </Callout>

    <Section id="curve" title="1. recall과 비용은 같이 움직인다 (실험 01)">
      <p>{fmtNum(recall.n_vectors)}행·{recall.dim}차원, 질의 {recall.n_queries}개. 빌드 파라미터는 기본값 그대로 두고 질의 시점 파라미터만 바꿨다. 점 하나가 파라미터 값 하나이고, 2회 실행의 평균이다.</p>
      <ChartBox type="line" title="recall@10 vs 질의당 버퍼 (x 로그 축)" height={340}
        data={{
          datasets: engines.map((e) => ({
            label: e.name, borderColor: e.color, backgroundColor: e.color, showLine: true,
            data: rows(e.key).map((c) => ({ x: avg(c.buffers_per_query), y: avg(c.recall) })),
          })),
        }}
        options={{
          parsing: false,
          scales: { ...axes({ xTitle: '질의당 버퍼 (log)', yTitle: 'recall@10' }), x: { ...axes().x, type: 'logarithmic', title: { display: true, text: '질의당 버퍼 (log)', color: C.text } }, y: { ...axes().y, min: 0, max: 1.05 } },
          plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: recall ${r3(ctx.parsed.y ?? 0)} · 버퍼 ${fmtNum(ctx.parsed.x ?? 0)}` } } },
        }}
        caption="왼쪽 아래 = 싸고 부정확, 오른쪽 위 = 비싸고 정확. 선이 왼쪽 위에 있을수록 같은 페이지 수로 더 많은 recall을 산다." />
      <ChartNotes items={[
        { label: 'HNSW: 고르게 오른다', note: <>ef_search 10→200에서 recall {r2(avg(cheap51.hnsw.recall))}→{r2(avg(pick(recall.configs, 'hnsw_ef200').recall))}, 버퍼 {fmtNum(avg(cheap51.hnsw.buffers_per_query))}→{fmtNum(avg(pick(recall.configs, 'hnsw_ef200').buffers_per_query))}. 전형적인 트레이드오프 곡선이다.</> },
        { label: 'IVFFlat: 이 데이터에서는 같은 버퍼에 더 높은 recall', note: <>probes=10이 recall {r2(avg(pick(recall.configs, 'ivfflat_probes10').recall))}를 버퍼 {fmtNum(avg(pick(recall.configs, 'ivfflat_probes10').buffers_per_query))}로 — HNSW ef_search=200({r2(avg(pick(recall.configs, 'hnsw_ef200').recall))}, 버퍼 {fmtNum(avg(pick(recall.configs, 'hnsw_ef200').buffers_per_query))})보다 적게 읽었다. 시간은 비슷했다. 버퍼가 두 구조 사이에서 완전히 같은 잣대가 아니라는 점과 데이터가 인공적이라는 점은 <Ref to="/pgvector/hnsw-ivfflat#compare">HNSW vs IVFFlat</Ref>에 적었다.</> },
        { label: 'IVFFlat: 마지막 점은 사실상 전체 스캔', note: <>probes=50은 lists=50 전체라 recall 1.00이지만 버퍼 {fmtNum(avg(pick(recall.configs, 'ivfflat_probes50').buffers_per_query))}·{fmtMs(avg(pick(recall.configs, 'ivfflat_probes50').ms_per_query))}로 가장 비싸다. probes=10에서 이미 {r2(avg(pick(recall.configs, 'ivfflat_probes10').recall))}.</> },
        { label: 'DiskANN: 가장 싼 설정부터 천장', note: <>query_search_list_size=10에서 이미 recall 1.00. 더 올리면 버퍼만 는다 — "파라미터를 올리면 recall도 오른다"는 가설이 이 엔진에서는 기각됐다(천장 효과).</> },
        { label: '대신 DiskANN은 출발점이 비싸다', note: <>가장 싼 설정의 버퍼가 {fmtNum(avg(cheap51.diskann.buffers_per_query))}로 HNSW ef_search=200({fmtNum(avg(pick(recall.configs, 'hnsw_ef200').buffers_per_query))})보다 적지도 않다. 빌드는 {fmtSec(cheap51.diskann.build_ms[0])}로 HNSW({fmtSec(cheap51.hnsw.build_ms[0])})의 10배 이상이다.</> },
      ]} />
      <Deep title="모든 설정의 숫자 표 (2회 실행)">
      <table><thead><tr><th>설정</th><th>recall@10 (1차 / 2차)</th><th>버퍼/질의</th><th>ms/질의</th></tr></thead><tbody>
        {recall.configs.map((c) => <tr key={c.config}>
          <td>{c.index} · {c.param}={c.value}</td>
          <td>{r3(c.recall[0])} / {r3(c.recall[1])}</td>
          <td>{fmtNum(avg(c.buffers_per_query))}</td>
          <td>{avg(c.ms_per_query).toFixed(3)}</td>
        </tr>)}
      </tbody></table>
      </Deep>
      <SourceNote path="week05/experiments/01-recall-vs-tuning/bench.py" />
    </Section>

    <Section id="scale" title="2. 행 수를 6배로 (실험 06)">
      <p>위 그래프에서 DiskANN은 가장 싼 설정부터 recall 1.00이었다. 그런데 이것은 "51,000행이 너무 쉬웠을 뿐"일 수도 있다. 실제 서비스는 훨씬 크므로 데이터를 키워 확인했다. 같은 생성 방식으로 {fmtNum(scale.n_vectors)}행을 만들어 가장 싼 설정과 중간 설정만 다시 쟀다(DiskANN 빌드가 약 10분이라 1회).</p>
      <ChartBox type="bar" title="가장 싼 설정의 recall@10: 51,000행 vs 301,000행" height={300}
        data={{
          labels: ['HNSW ef_search=10', 'IVFFlat probes=1', 'DiskANN list=10'],
          datasets: [
            { label: `${fmtNum(recall.n_vectors)}행`, data: engines.map((e) => avg(cheap51[e.key].recall)), backgroundColor: C.none },
            { label: `${fmtNum(scale.n_vectors)}행`, data: engines.map((e) => cheap300[e.key].recall_at_10), backgroundColor: engines.map((e) => e.color) },
          ],
        }}
        options={{ scales: { ...axes({ yTitle: 'recall@10' }), y: { ...axes().y, min: 0, max: 1.05 } } }}
        caption="같은 '가장 싼' 설정에서 행 수만 늘렸다. HNSW·IVFFlat은 무너지고 DiskANN은 그대로다." />
      <ChartNotes items={[
        { label: 'HNSW·IVFFlat: 싼 설정은 규모에 약하다', note: <>HNSW {r2(avg(cheap51.hnsw.recall))}→{r2(cheap300.hnsw.recall_at_10)}, IVFFlat {r2(avg(cheap51.ivfflat.recall))}→{r2(cheap300.ivfflat.recall_at_10)}. 같은 탐색 폭으로 6배 넓은 공간을 보니 놓치는 것이 는다.</> },
        { label: 'DiskANN: 여전히 1.00', note: <>격차(DiskANN − HNSW 가장 싼 설정)가 {r2(1 - avg(cheap51.hnsw.recall))}에서 {r2(cheap300.diskann.recall_at_10 - cheap300.hnsw.recall_at_10)}로 두 배 넘게 벌어졌다. 이 자료에서 DiskANN의 설계 의도(규모가 클수록 유리)와 가장 잘 맞는 결과다.</> },
      ]} />
      <Deep title="301,000행의 모든 설정 숫자 표">
      <table><thead><tr><th>설정 (301,000행)</th><th>recall@10</th><th>버퍼/질의</th><th>ms/질의</th><th>빌드 · 크기</th></tr></thead><tbody>
        {scale.configs.map((c) => <tr key={c.config}>
          <td>{c.index} · {c.param}={c.value}</td><td>{r3(c.recall_at_10)}</td><td>{fmtNum(c.buffers_per_query)}</td>
          <td>{c.ms_per_query.toFixed(3)}</td><td>{fmtSec(c.build_ms)} · {c.index_mb.toFixed(1)} MB</td>
        </tr>)}
      </tbody></table>
      </Deep>
      <Callout kind="warn" title="HNSW를 올려도 따라잡기 어렵다 — 이 데이터에서는">
        <p>301,000행에서 HNSW를 ef_search=100으로 올려도 {r2(mid300.hnsw.recall_at_10)}에 그쳤다(버퍼 {fmtNum(mid300.hnsw.buffers_per_query)}). DiskANN 가장 싼 설정은 {r2(cheap300.diskann.recall_at_10)}(버퍼 {fmtNum(cheap300.diskann.buffers_per_query)}). 다만 이 데이터는 균등분포 배경에 근접점을 섞은 합성 데이터라, 실제 임베딩에서 같은 격차가 난다고 단정하지 않는다. ef_search를 얼마까지 올려야 1.0에 닿는지는 재지 않았다.</p>
      </Callout>
      <p>교차 확인: 빌드 시간·크기는 서로 다른 실행인 <Ref to="/pgvector/cost#build">실험 02</Ref>와 거의 일치했다(DiskANN {fmtSec(cheap300.diskann.build_ms)} vs 실험 02의 {fmtSec(build.rows[2].diskann_build_ms)}, 인덱스 {cheap300.diskann.index_mb.toFixed(1)} MB vs {build.rows[2].diskann_mb.toFixed(1)} MB) — 결정적 지표가 재현된다는 교차 확인이다.</p>
      <SourceNote path="week05/experiments/06-recall-at-scale/bench.py" />
    </Section>

    <Quiz items={QUIZ['tuning']} />

    <Next to="/pgvector/diskann" title="DiskANN 인덱스" why={'규모가 커져도 버틴 세 번째 선의 정체 — pgvectorscale이 무엇을 더하는지 본다.'} />
  </>
}
