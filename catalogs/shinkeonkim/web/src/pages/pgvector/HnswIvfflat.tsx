import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { avg, build, d, envTags, fmtNum, pick, r2, recall } from './stats'
import { ds, hnsw, ivf, ix, shift, vacuumMs } from './indexStats'
import { Deep, Goal, Next, Quiz, Summary } from './guide'
import { QUIZ } from './quizzes'

const buf = (name: Parameters<typeof d>[0]) => d(name).output.match(/Buffers: shared hit=(\d+)/)?.[1] ?? '?'
const lastBuild = build.rows[build.rows.length - 1]
const ivf10 = pick(recall.configs, 'ivfflat_probes10')
const h200 = pick(recall.configs, 'hnsw_ef200')
const sIvf = shift('ivfflat'), sHnsw = shift('hnsw')
const iMid = ivf(141, 2), hDef = hnsw(16, 64, 40)

export default function HnswIvfflat() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="HNSW vs IVFFlat: 무엇을 기본으로 고르나"
      lede="앞의 두 페이지에서 각각의 구조를 봤다. 이 페이지는 둘을 나란히 놓는다 — 구조의 차이가 만드는 장단점, 두 데이터셋에서의 실측, 그리고 실무에서 HNSW를 기본으로 권하는 진짜 이유."
      tags={envTags} />

    <Summary points={[
      <>IVFFlat은 “나눠 두고 일부만 전부 보기”, HNSW는 “길을 따라 걷기”. 그 차이가 빌드·삽입·삭제 비용과 데이터 변화에 대한 강약을 가른다.</>,
      <>이 자료의 인공 데이터에서는 IVFFlat이 같은 recall을 더 적은 페이지로 냈다 — 일반론과 다르다. 내 데이터로 재 보는 것이 답이다.</>,
      <>HNSW를 기본으로 권하는 이유는 운영(순서·재빌드·손잡이 하나)이다. 데이터가 정적이고 통째 재빌드한다면 IVFFlat도 좋은 선택이다.</>,
    ]} />

    <Goal
      questions={['두 인덱스는 구조가 어떻게 다르고, 그 차이가 어디서 드러나나?', '같은 데이터에서 실제로 어느 쪽이 싸고 정확했나?', '그런데도 왜 HNSW를 기본으로 권하나?']}
      assumes={<><Ref to="/pgvector/ivfflat">IVFFlat</Ref>과 <Ref to="/pgvector/hnsw">HNSW</Ref> 페이지.</>} />

    <Section id="side-by-side" title="1. 구조를 나란히">
      <table><thead><tr><th></th><th>IVFFlat</th><th>HNSW</th></tr></thead><tbody>
        <tr><td>한 줄 요약</td><td>동네(list)로 나누고 가까운 동네만 전부 비교</td><td>점 사이에 여러 층의 길을 놓고 따라 걸음</td></tr>
        <tr><td>만들 때 하는 일</td><td>표본으로 k-means 한 번 + 행마다 가장 가까운 중심 찾기</td><td>행마다 그래프를 탐색해 이웃을 찾고 길을 이음</td></tr>
        <tr><td>만들 때 정하는 손잡이</td><td><code>lists</code></td><td><code>m</code>, <code>ef_construction</code></td></tr>
        <tr><td>찾을 때 손잡이(<code>SET</code>)</td><td><code>ivfflat.probes</code> (기본 1)</td><td><code>hnsw.ef_search</code> (기본 40)</td></tr>
        <tr><td>무엇을 놓치나</td><td>진짜 이웃이 고르지 않은 옆 동네에 있을 때</td><td>길을 따라가다 엉뚱한 곳에서 멈출 때(국소 최적)</td></tr>
        <tr><td>빈 테이블에 먼저 만들기</td><td>안 된다 — 중심을 배울 데이터가 없다</td><td>된다 — 넣을 때마다 길을 잇는다</td></tr>
        <tr><td>다른 종류의 데이터가 계속 들어오면</td><td>중심이 낡아 정확도가 떨어진다 → REINDEX</td><td>그 자리에서 길을 이어 영향이 없다</td></tr>
        <tr><td>지우기(VACUUM)</td><td>목록에서 빼면 끝</td><td>끊긴 길을 이어 줘야 해서 비싸다</td></tr>
        <tr><td>만들 때 메모리</td><td>적게 든다</td><td>그래프가 <code>maintenance_work_mem</code>에 들어가야 빠르다</td></tr>
      </tbody></table>
    </Section>

    <Section id="compare" title="2. 같은 데이터에서 잰 것">
      <h3 className="font-semibold">무리가 또렷한 데이터 ({fmtNum(ds.rows)}행 · {ds.dim}차원 · 무리 {ds.clusters}개, {ix.runs}회 빌드 평균)</h3>
      <table><thead><tr><th></th><th>IVFFlat (lists=141, probes=2)</th><th>HNSW (기본: m=16, ef_construction=64, ef_search=40)</th></tr></thead><tbody>
        <tr><td>recall@10</td><td>{r2(iMid.recall)}</td><td>{r2(hDef.recall)}</td></tr>
        <tr><td>페이지/질의</td><td>{fmtNum(iMid.buffers)}</td><td>{fmtNum(hDef.buffers)}</td></tr>
        <tr><td>ms/질의</td><td>{iMid.ms.toFixed(3)}</td><td>{hDef.ms.toFixed(3)}</td></tr>
        <tr><td>만드는 시간 · 크기</td><td>{(iMid.buildMs / 1000).toFixed(2)}초 · {iMid.mb.toFixed(1)} MB</td><td>{(hDef.buildMs / 1000).toFixed(2)}초 · {hDef.mb.toFixed(1)} MB</td></tr>
        <tr><td>나중에 다른 무리가 들어온 뒤 recall</td><td>{r2(sIvf.before)} → REINDEX 후 {r2(sIvf.after)}</td><td>{r2(sHnsw.before)} → REINDEX 후 {r2(sHnsw.after)}</td></tr>
        <tr><td>행 20% 삭제 후 VACUUM</td><td>{vacuumMs('IVFFlat').toFixed(1)} ms</td><td>{vacuumMs('HNSW').toFixed(1)} ms</td></tr>
      </tbody></table>
      <h3 className="mt-6 font-semibold">실험 01의 데이터 (무작위 배경 + 질문 주변 근접점, {fmtNum(recall.n_vectors)}행 · {recall.dim}차원)</h3>
      <table><thead><tr><th></th><th>IVFFlat (lists=50, probes=10)</th><th>HNSW (ef_search=200)</th></tr></thead><tbody>
        <tr><td>recall@10</td><td>{r2(avg(ivf10.recall))}</td><td>{r2(avg(h200.recall))}</td></tr>
        <tr><td>페이지/질의</td><td>{fmtNum(avg(ivf10.buffers_per_query))}</td><td>{fmtNum(avg(h200.buffers_per_query))}</td></tr>
        <tr><td>ms/질의</td><td>{avg(ivf10.ms_per_query).toFixed(2)}</td><td>{avg(h200.ms_per_query).toFixed(2)}</td></tr>
        <tr><td>인덱스 크기 (실험 02, 테이블 = 1)</td><td>약 {r2(lastBuild.ivfflat_ratio_to_table)}배</td><td>약 {r2(lastBuild.hnsw_ratio_to_table)}배</td></tr>
      </tbody></table>
      <Callout kind="warn" title="'HNSW가 같은 비용에서 더 정확하다'는 이 자료에서 재현되지 않았다">
        <p>pgvector 문서와 흔한 설명은 HNSW가 속도 대비 정확도에서 낫다고 한다. 이 자료의 두 데이터셋에서는 IVFFlat이 비슷하거나 높은 recall을 <strong>더 적은 페이지</strong>로 냈다(첫 판의 비교표도 “HNSW 대체로 높다”라고 적었다가 실측과 대조해 고쳤다). 해석할 때 기억할 것:</p>
        <ul>
          <li>IVFFlat은 동네 목록을 페이지째 연속으로 읽고, HNSW는 점마다 다른 페이지를 건너다닌다. 페이지 수는 두 구조 사이에서 완전히 같은 잣대가 아니다.</li>
          <li>두 데이터 모두 “가까운 점들이 한 덩어리로 모인” 인공 데이터다. 덩어리가 동네 하나에 쏙 들어가 IVFFlat에 유리했을 수 있다. 실제 임베딩은 경계가 훨씬 흐릿하다.</li>
          <li>둘 다 노트북 Docker, 수만 행 규모다.</li>
        </ul>
      </Callout>
    </Section>

    <Section id="why-hnsw" title="3. 그래도 HNSW를 기본으로 권하는 이유 — 운영">
      <ul>
        <li><strong>순서를 신경 쓸 필요가 없다.</strong> 테이블을 만들자마자 인덱스를 걸어 두고 데이터를 넣어도 된다.</li>
        <li><strong>데이터가 바뀌어도 다시 만들 필요가 없다.</strong> 서비스 데이터는 계속 늘고 성격도 바뀐다. IVFFlat은 그때마다 REINDEX 시점을 관리해야 한다.</li>
        <li><strong>찾을 때 손잡이 하나(ef_search)로 대부분 해결된다.</strong> IVFFlat은 lists를 잘못 고르면 다시 만들어야 한다.</li>
      </ul>
      <p>그 대가는 만드는 시간·메모리, 큰 인덱스, 비싼 VACUUM이다. 반대로 데이터가 거의 바뀌지 않고 주기적으로 통째 다시 만드는 환경(예: 매일 밤 전체 재적재)이라면 IVFFlat이 빌드가 빠르고 작아서 합리적이다. AWS 가이드도 같은 기준을 제시한다: HNSW는 “대부분의 실서비스 RAG” 기본값, IVFFlat은 “정적인 대형 데이터 + 배치 재빌드 주기가 있을 때”.</p>
    </Section>

    <Section id="knobs" title="4. EXPLAIN으로 직접 보기">
      <p>5,000행·8차원 테이블 <code>proper</code>에 같은 질문을 던지고 읽은 페이지 수(<code>Buffers</code>)를 비교했다. EXPLAIN 읽는 법은 <Ref to="/pgvector/install#explain">설치와 기본 문법</Ref>에 있다. 캡션의 숫자만 비교하면 된다.</p>
      <CodeBlock language="sql" output={d('ivf_probes_1').output} outputCaption={`IVFFlat probes=1 → 버퍼 ${buf('ivf_probes_1')} · 실제 실행 결과`}>{d('ivf_probes_1').sql}</CodeBlock>
      <Deep title="IVFFlat probes=10, HNSW ef_search=10 · 200의 실행 계획">
        <CodeBlock language="sql" output={d('ivf_probes_10').output} outputCaption={`IVFFlat probes=10(동네 전부) → 버퍼 ${buf('ivf_probes_10')} · 실제 실행 결과`}>{d('ivf_probes_10').sql}</CodeBlock>
        <CodeBlock language="sql" output={d('hnsw_ef_10').output} outputCaption={`HNSW ef_search=10 → 버퍼 ${buf('hnsw_ef_10')} · 실제 실행 결과`}>{d('hnsw_ef_10').sql}</CodeBlock>
        <CodeBlock language="sql" output={d('hnsw_ef_200').output} outputCaption={`HNSW ef_search=200 → 버퍼 ${buf('hnsw_ef_200')} · 실제 실행 결과`}>{d('hnsw_ef_200').sql}</CodeBlock>
      </Deep>
      <p>IVFFlat은 probes 1→10에 버퍼 {buf('ivf_probes_1')}→{buf('ivf_probes_10')}, HNSW는 ef_search 10→200에 {buf('hnsw_ef_10')}→{buf('hnsw_ef_200')}. 넓게 볼수록 많이 읽는다는 방향은 같다.</p>
      <SourceNote path="week05/pgvector/labs/02-hnsw-vs-ivfflat/run.sh">같은 내용을 Docker 실습으로</SourceNote>
    </Section>

    <Quiz items={QUIZ['hnsw-ivfflat']} />

    <Next to="/pgvector/tuning" title="튜닝 곡선" why={'128차원·5만~30만 행에서 손잡이를 돌린 곡선과, 데이터가 커질 때 가장 싼 설정이 어떻게 무너지는지 본다.'} />
  </>
}
