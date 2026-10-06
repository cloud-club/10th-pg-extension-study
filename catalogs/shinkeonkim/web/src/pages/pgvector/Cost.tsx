import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { C, axes } from '@/lib/chart'
import { build, envTags, exp, fmtNum, fmtSec, halfvec, pick, r3, ratio } from './stats'
import { Deep, Goal, Next, Quiz, Summary } from './guide'
import { QUIZ } from './quizzes'

const rows = build.rows
const first = rows[0], last = rows[rows.length - 1]
const sbq = exp.sbq.configs[0]
const repro = exp.plain_repro
const f4 = pick(halfvec.configs, 'vector(float4)+HNSW')
const hv = pick(halfvec.configs, 'halfvec(float2)+HNSW')
const dk = pick(halfvec.configs, 'vector(SBQ)+DiskANN')
const label = (n: number) => `${fmtNum(n)}행`

export default function Cost() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="빌드 비용과 크기: DiskANN은 무엇을 치르나"
      lede="DiskANN은 인덱스를 작게 만들고 규모가 커져도 recall을 지켰다. 그 대가는 인덱스를 만드는 시간이다. 행 수를 바꿔 가며 만드는 시간과 크기를 쟀고, 확장 없이 크기를 줄이는 pgvector의 halfvec과도 비교했다. 중간에 '압축을 끄면 서버가 죽는다'고 잘못 결론 냈다가 철회한 과정도 남겼다."
      tags={[...envTags, { label: `${build.dim}차원` }]} />

    <Summary points={[
      <>DiskANN 빌드는 다른 둘과 자릿수가 다르게 느리고, 행이 늘수록 격차가 벌어졌다({fmtNum(last.n)}행에서 HNSW의 {ratio(last.diskann_build_ms, last.hnsw_build_ms)}).</>,
      <>크기는 DiskANN이 가장 작다. 다만 halfvec만으로도 그 차이의 대부분을 줄일 수 있다.</>,
      <>한 번의 극적인 실패를 일반화하지 않는다 — 반복해서 재현되는지 먼저 확인한다.</>,
    ]} />

    <Goal
      questions={['인덱스를 만드는 데 얼마나 걸리나? 행이 늘면?', '인덱스는 디스크를 얼마나 차지하나?', '확장 없이 크기를 줄이는 방법(halfvec)과 비교하면?']}
      assumes={<>DiskANN이 압축본으로 먼저 비교한다는 것(<Ref to="/pgvector/diskann">DiskANN 인덱스</Ref>).</>} />

    <EasyFirst>
      <p>인덱스는 한 번 만들고 오래 쓰지만, 만드는 동안 시간과 메모리를 쓰고, 다 만들면 디스크와 메모리를 차지한다. 데이터를 통째로 다시 넣거나 임베딩 모델을 바꾸면 <strong>다시 만들어야</strong> 하므로 “만드는 시간”은 운영 비용이다. 이 페이지의 그래프는 <strong>로그 축</strong>을 쓴다 — 눈금 한 칸이 10배라서, 선 사이의 간격이 곧 “몇 배 차이”다.</p>
    </EasyFirst>

    <Section id="build" title="1. 행 수에 따른 빌드 시간 (실험 02)">
      <ChartBox type="line" title="인덱스 빌드 시간 (초, 로그 축)" height={320}
        data={{
          labels: rows.map((r) => label(r.n)),
          datasets: [
            { label: 'IVFFlat', data: rows.map((r) => r.ivfflat_build_ms / 1000), borderColor: C.tsv, backgroundColor: C.tsv },
            { label: 'HNSW', data: rows.map((r) => r.hnsw_build_ms / 1000), borderColor: C.bigm, backgroundColor: C.bigm },
            { label: 'DiskANN', data: rows.map((r) => r.diskann_build_ms / 1000), borderColor: C.trgm, backgroundColor: C.trgm },
          ],
        }}
        options={{ scales: axes({ log: true, yTitle: '초 (log)' }) }}
        caption="빌드 파라미터는 전부 기본값(IVFFlat lists = 행 수/1000). 1회 측정 — 절대 시간보다 세 줄 사이의 간격으로 읽는다." />
      <ChartNotes items={[
        { label: 'DiskANN: 다른 둘과 자릿수가 다르다', note: <>{label(last.n)}에서 {fmtSec(last.diskann_build_ms)}. HNSW의 {ratio(last.diskann_build_ms, last.hnsw_build_ms)}, IVFFlat의 {ratio(last.diskann_build_ms, last.ivfflat_build_ms)}다.</> },
        { label: '격차가 행 수와 함께 벌어진다', note: <>HNSW 대비 {ratio(first.diskann_build_ms, first.hnsw_build_ms)}({label(first.n)}) → {ratio(last.diskann_build_ms, last.hnsw_build_ms)}({label(last.n)}). 65,536행부터 병렬 빌드가 켜지는데도 줄지 않았다 — 원인은 확인하지 못했다(<code>max_parallel_maintenance_workers=2</code> 환경).</> },
        { label: 'IVFFlat: 가장 싸다', note: <>k-means 한 번과 배정뿐이라 {label(last.n)}도 {fmtSec(last.ivfflat_build_ms)}. 대신 recall을 올리려면 probes를 많이 올려야 한다(<Ref to="/pgvector/tuning">튜닝</Ref>).</> },
        { label: '제작사도 인정한 지점', note: <>TigerData의 5천만 행 벤치마크도 DiskANN 빌드가 Qdrant의 약 3배 걸렸고 "현재 단일 스레드 구현"이라고 적었다(<Ref to="/pgvector/diskann-details#vendor">DiskANN</Ref>).</> },
      ]} />
      <SourceNote path="week05/experiments/02-build-cost-and-size/bench.py" />
    </Section>

    <Section id="size" title="2. 인덱스 크기 — 테이블 대비 비율이 일정하다">
      <p>인덱스 크기를 테이블(원본 데이터) 크기로 나눈 비율이다. 1보다 크면 원본보다 큰 인덱스, 작으면 원본보다 작은 인덱스다. HNSW는 점마다 이웃 목록(길)까지 저장하니 원본보다 크고, DiskANN은 압축본을 저장하니 원본보다 작다.</p>
      <ChartBox type="bar" title="인덱스 크기 / 테이블 크기" height={280}
        data={{
          labels: rows.map((r) => label(r.n)),
          datasets: [
            { label: 'HNSW', data: rows.map((r) => r.hnsw_ratio_to_table), backgroundColor: C.bigm },
            { label: 'IVFFlat', data: rows.map((r) => r.ivfflat_ratio_to_table), backgroundColor: C.tsv },
            { label: 'DiskANN (SBQ)', data: rows.map((r) => r.diskann_ratio_to_table), backgroundColor: C.trgm },
          ],
        }}
        options={{ scales: axes({ yTitle: '배 (테이블 = 1)' }) }}
        caption="행 수가 15배 늘어도 세 비율이 소수 둘째 자리까지 거의 그대로다." />
      <Deep title="행 수별 실제 크기(MB)">
      <table><thead><tr><th>행 수</th><th>테이블</th><th>HNSW</th><th>IVFFlat</th><th>DiskANN</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.n}>
          <td>{fmtNum(r.n)}</td><td>{r.table_mb.toFixed(1)} MB</td>
          <td>{r.hnsw_mb.toFixed(1)} MB ({r.hnsw_ratio_to_table.toFixed(2)}×)</td>
          <td>{r.ivfflat_mb.toFixed(1)} MB ({r.ivfflat_ratio_to_table.toFixed(2)}×)</td>
          <td>{r.diskann_mb.toFixed(1)} MB ({r.diskann_ratio_to_table.toFixed(2)}×)</td>
        </tr>)}
      </tbody></table>
      </Deep>
      <p>DiskANN이 항상 가장 작다(SBQ 압축). 다만 "규모가 커질수록 격차가 더 벌어진다"는 강한 주장은 이 범위에서 지지되지도 반박되지도 않았다 — 비율이 처음부터 일정했다.</p>
    </Section>

    <Section id="plain" title="3. 압축을 끄면 서버가 죽는가 — 철회한 결론 (실험 03·04)">
      <p>발표에서는 결론만: <strong>한 번 서버가 죽은 것을 보고 “압축 없이는 못 만든다”고 일반화했다가, {repro.attempts}번 다시 해 보니 한 번도 안 죽어서 철회했다.</strong> 극적인 결과 하나를 바로 결론으로 삼지 않아야 한다는 교훈이다.</p>
      <p>압축(SBQ)의 효과를 보려고 같은 51,000행에 <code>storage_layout = plain</code>으로 다시 만들었다. 첫 시도에서 빌드 도중 서버 프로세스가 죽었다(<code>FATAL: terminating connection due to administrator command</code>). 바로 직전 같은 규모의 기본값 빌드는 정상이었다. 처음에는 이것을 "압축이 없으면 이 메모리로는 빌드가 안 된다"로 해석했다.</p>
      <p>그 해석을 좁히려고 행 수를 나눠 가며, <code>maintenance_work_mem</code>을 올려 가며, 실험 03과 같은 빌드 순서까지 재현했다.</p>
      <Deep title="재현 시도 전체 기록">
      <table><thead><tr><th>시도</th><th>결과</th><th>피크 컨테이너 메모리</th></tr></thead><tbody>
        {repro.bisection.map((r) => <tr key={`b${r.n}`}><td>{fmtNum(r.n)}행 · mwm {r.maintenance_work_mem}</td><td>{r.ok ? '완주' : '실패'}</td><td>{r.peak_container_mem_mb.toFixed(1)} MB</td></tr>)}
        {repro.mwm_sweep.map((r) => <tr key={`m${r.maintenance_work_mem}`}><td>{fmtNum(r.n)}행 · mwm {r.maintenance_work_mem}</td><td>{r.ok ? '완주' : '실패'}</td><td>{r.peak_container_mem_mb.toFixed(1)} MB</td></tr>)}
        <tr><td>실험 03과 같은 순서(memory_optimized → 드롭 → plain)</td><td>{repro.sequence_replication.crash_reproduced ? '실패' : '완주'}</td><td>—</td></tr>
      </tbody></table>
      </Deep>
      <Callout kind="warn" title={`${repro.attempts}번 중 ${repro.crashes}번 — 결론 철회`}>
        <p>같은 조건을 {repro.attempts}번 재현해 한 번도 죽지 않았고, 피크 메모리도 한도(1~3GB, 컨테이너 3.8GiB)에 전혀 가깝지 않았다. "plain은 구조적으로 메모리를 못 버틴다"는 해석은 근거를 잃었다. 남는 사실은 "그때 한 번은 죽었다"뿐이고, 같은 시기에 호스트 디스크가 100%까지 차 Docker 데몬이 죽는 일이 있었으므로 <strong>호스트 수준의 일시적 압박</strong>이 가장 그럴듯한 설명이지만 확인하지 못한 추정이다.</p>
      </Callout>
      <p>그래서 압축을 켰을 때와 껐을 때의 recall·버퍼 비교는 아직 없다. 압축 켬(기본값) 쪽만 측정됐다: 빌드 {fmtSec(sbq.build_ms ?? 0)}, 인덱스 {sbq.index_mb?.toFixed(1)} MB, recall@10 {r3(sbq.recall_at_10 ?? 0)}.</p>
      <SourceNote path="week05/experiments/04-plain-build-memory-threshold/bench.py" />
    </Section>

    <Section id="halfvec" title="4. 메모리를 아끼는 다른 길: halfvec (실험 05)">
      <p>pgvector 자체의 <code>halfvec</code>은 숫자 하나를 4바이트 대신 2바이트로 저장한다. 사진의 해상도를 조금 낮추는 것과 비슷하다. 확장을 하나 더 들이지 않아도 된다. 같은 데이터·같은 정답으로 세 가지를 비교했다(질의 파라미터는 100으로 고정).</p>
      <ChartBox type="bar" title="인덱스 크기 (MB)" height={260}
        data={{
          labels: ['vector(float4) + HNSW', 'halfvec(float2) + HNSW', 'vector(SBQ) + DiskANN'],
          datasets: [{ label: '인덱스 MB', data: [f4.index_mb, hv.index_mb, dk.index_mb], backgroundColor: [C.bigm, C.ok, C.trgm] }],
        }}
        options={{ plugins: { legend: { display: false } }, scales: axes({ yTitle: 'MB' }) }}
        caption={`halfvec만으로 ${Math.round((1 - hv.index_mb / f4.index_mb) * 100)}% 줄었다. DiskANN은 ${Math.round((1 - dk.index_mb / f4.index_mb) * 100)}% — 격차의 대부분을 halfvec이 이미 가져간다.`} />
      <table><thead><tr><th>설정</th><th>빌드</th><th>인덱스</th><th>recall@10</th><th>버퍼/질의</th><th>ms/질의</th></tr></thead><tbody>
        {halfvec.configs.map((c) => <tr key={c.config}>
          <td>{c.config}</td><td>{fmtSec(c.build_ms)}</td><td>{c.index_mb.toFixed(1)} MB</td><td>{r3(c.recall_at_10)}</td>
          <td>{fmtNum(c.buffers_per_query)}</td><td>{c.ms_per_query.toFixed(3)}</td>
        </tr>)}
      </tbody></table>
      <ChartNotes items={[
        { label: '크기: SBQ < halfvec < float4 (가설 채택)', note: <>DiskANN {dk.index_mb.toFixed(1)} MB, halfvec {hv.index_mb.toFixed(1)} MB, float4 {f4.index_mb.toFixed(1)} MB.</> },
        { label: 'recall 비교는 설계가 깨졌다', note: <>float4 {r3(f4.recall_at_10)}, halfvec {r3(hv.recall_at_10)}, DiskANN {r3(dk.recall_at_10)}. 압축 안 한 float4가 가장 낮다 — HNSW 빌드가 실행마다 다르고 DiskANN은 이 규모에서 천장이라, 정밀도의 효과를 분리하지 못했다.</> },
        { label: 'halfvec 빌드가 오히려 느렸다 (가설 기각)', note: <>{fmtSec(hv.build_ms)} vs {fmtSec(f4.build_ms)}. "단순 캐스팅이니 비슷할 것"이 틀렸다. 반복 측정을 하지 않아 원인은 모른다.</> },
        { label: '질의 비용은 DiskANN이 더 컸다', note: <>버퍼 {fmtNum(dk.buffers_per_query)} vs halfvec {fmtNum(hv.buffers_per_query)}. 인덱스가 작다고 질의가 싸지는 것은 아니다 — 압축 표현을 원본으로 다시 재는 rescore 단계도 있다.</> },
      ]} />
      <Callout kind="tip" title="실무 순서">
        <p>메모리를 줄여야 한다면 <strong>halfvec부터</strong> 시도한다. 추가 확장·슈퍼유저 빌드 없이 크기의 대부분을 줄인다. 그래도 부족하고 빌드 시간을 감당할 수 있을 때 DiskANN을 검토한다.</p>
      </Callout>
      <SourceNote path="week05/experiments/05-halfvec-vs-sbq/bench.py" />
    </Section>

    <Quiz items={QUIZ['cost']} />

    <Next to="/pgvector/filtering" title="필터가 붙은 검색" why={'“라벨 10인 것 중에서” 같은 조건이 붙으면 HNSW는 결과가 비어 돌아올 수 있다. DiskANN의 라벨 인덱스가 실제로 차이를 낸 장면이다.'} />
  </>
}
