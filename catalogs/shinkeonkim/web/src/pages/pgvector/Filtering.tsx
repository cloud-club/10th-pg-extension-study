import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { d, demo, envTags, fCorrect, fDup, filter, fmtNum, fmtSec, pick, r3, ratio } from './stats'
import { Deep, Goal, Next, Quiz, Summary, Term } from './guide'
import { QUIZ } from './quizzes'

const off = pick(fCorrect.configs, 'hnsw_iterative_off')
const rel = pick(fCorrect.configs, 'hnsw_iterative_relaxed_order')
const strict = pick(fCorrect.configs, 'hnsw_iterative_strict_order')
const dk = pick(fCorrect.configs, 'diskann_label_filter')
const removed = (name: 'filter_hnsw_off_plan' | 'filter_hnsw_relaxed_plan') => Number(d(name).output.match(/Rows Removed by Filter: (\d+)/)?.[1] ?? 0)
const dist = fCorrect.label10_distance
const exact = fCorrect.avg_distance_exact
/** 정답 평균(0%)과 라벨 10 중앙값(100%) 사이에서 결과가 어디쯤인가 */
const gap = (x: number | null) => (x === null ? '—' : `${Math.round(((x - exact) / (dist.median - exact)) * 100)}%`)
const names: Record<string, string> = {
  hnsw_iterative_off: 'HNSW · iterative_scan=off (기본)',
  hnsw_iterative_relaxed_order: 'HNSW · relaxed_order',
  hnsw_iterative_strict_order: 'HNSW · strict_order',
  diskann_label_filter: 'DiskANN · 라벨 인덱스',
}

export default function Filtering() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="필터가 붙은 검색: WHERE로 거르기 vs 인덱스 안에서 거르기"
      lede="'라벨 10인 것 중에서 가장 가까운 10개'처럼 조건이 붙으면 ANN 인덱스가 곤란해진다. HNSW는 WHERE로 거르고 모자라면 더 찾는다(iterative_scan). DiskANN은 라벨을 인덱스 키로 받는다. 정확도와 비용을 함께 쟀다 — 그리고 이 실험의 첫 판 결론이 데이터 버그였다는 것도 여기 남긴다."
      tags={[...envTags, { label: `${fmtNum(filter.n_labels * filter.rows_per_label)}행 · 라벨 ${filter.n_labels}개` }, { label: `질의 ${filter.n_queries}개` }]} />

    <Summary points={[
      <>HNSW + WHERE는 기본값에서 <strong>오류 없이 0행</strong>을 돌려줄 수 있다. 조건이 붙는 검색이면 <code>hnsw.iterative_scan = relaxed_order</code>를 켠다.</>,
      <>켜면 결과는 채워지지만, 조건에 맞는 행이 질문에서 멀수록 많이 읽는다. DiskANN 라벨 인덱스는 같은 10행을 {ratio(rel.ms_per_query, dk.ms_per_query)} 빠르게 찾았고, 결과는 조금 덜 가까웠다.</>,
      <>실험 데이터는 만든 직후 검증한다 — 이 실험의 첫 결론은 데이터 버그였다.</>,
    ]} />

    <Goal
      questions={['“가장 가까운 10개” 검색에 WHERE 조건을 붙이면 왜 결과가 비어 돌아올 수 있나?', '어떤 설정으로 고치고, 그 비용은 얼마인가?', 'DiskANN의 라벨 인덱스는 얼마나 다른가?']}
      assumes={<>HNSW의 후보 명단 <code>ef_search</code>(<Ref to="/pgvector/hnsw-details#search">HNSW</Ref>), 라벨 인덱스(<Ref to="/pgvector/diskann-details#labels">DiskANN 인덱스</Ref>), EXPLAIN의 <code>Filter</code>(<Ref to="/pgvector/install#explain">설치와 기본 문법</Ref>).</>} />

    <EasyFirst>
      <p>지도 앱에 “내 주변 일식집 10곳”을 물었다고 하자. 앱이 <strong>먼저 가장 가까운 식당 40곳을 고르고, 그다음에 일식만 남기는</strong> 방식이라면? 내 주변 40곳이 전부 한식이면 결과는 <strong>0곳</strong>이다. 일식집이 조금 더 멀리 분명히 있는데도. HNSW 인덱스에 <code>WHERE</code>를 붙이면 기본값에서 이 일이 그대로 일어난다. 고치는 방법은 둘이다. “모자라면 더 멀리까지 계속 찾기”(HNSW의 iterative_scan), 또는 “처음부터 일식집만 따라 찾기”(DiskANN의 라벨 인덱스).</p>
    </EasyFirst>

    <Section id="setup" title="1. 질의와 필터가 엇갈리는 상황">
      <Clotho id="pgv-filtered-search" />
      <p>실험 데이터는 이 상황을 일부러 만든다. 라벨 1~10, 라벨마다 5,000행(32차원). 라벨 L의 점은 "L번째 차원만 10" 근처에 모인다. 질의는 라벨 1 근처에 있는데, 필터는 라벨 10이다 — 질의에서 가장 가까운 점들은 전부 라벨 1이라 필터에 걸린다. 라벨 2~10의 중심은 질의에서 모두 같은 거리라, 라벨 10이 "특별히 먼" 것은 아니다.</p>
      <Deep title="데이터를 만든 SQL, 생성 검증, 정답">
      <CodeBlock language="sql">{`-- 행 × 차원 cross join: random() 이 칸마다 다시 평가된다\n${demo.docs_setup}`}</CodeBlock>
      <CodeBlock language="sql" output={d('docs_distinct').output} outputCaption="생성 검증 · 실제 실행 결과">{d('docs_distinct').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('filter_exact').output} outputCaption="정답(인덱스 없이) · 실제 실행 결과">{d('filter_exact').sql}</CodeBlock>
      </Deep>
    </Section>

    <Section id="hnsw-default" title="2. HNSW 기본값: 빈 결과">
      <CodeBlock language="sql" output={d('filter_hnsw_off').output} outputCaption="iterative_scan = off · 실제 실행 결과">{d('filter_hnsw_off').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('filter_hnsw_off_plan').output} outputCaption="실제 실행 결과">{d('filter_hnsw_off_plan').sql}</CodeBlock>
      <p>EXPLAIN의 <code>Rows Removed by Filter</code>는 “인덱스가 내준 행 중 WHERE 조건에 걸려 버린 수”다. 인덱스가 <code>ef_search</code>(40)개 후보를 가까운 순서로 내줬고, 전부 라벨 1이라 <code>Rows Removed by Filter: {removed('filter_hnsw_off_plan')}</code>으로 탈락했다. 오류 없이 <strong>0행</strong>이다. AWS 프로덕션 가이드가 "<code>hnsw.iterative_scan</code>을 켜라"고 권하는 이유가 이것이다. 질의 {filter.n_queries}개 모두 0행이었다.</p>
    </Section>

    <Section id="iterative" title="3. iterative_scan: 결과는 채워지지만 비싸다">
      <Term word="hnsw.iterative_scan">pgvector 0.8.0에 추가된 설정(기본 <code>off</code>). 켜면 WHERE에 걸려 결과가 모자랄 때 탐색을 이어서 후보를 더 꺼낸다. <code>SET hnsw.iterative_scan = relaxed_order;</code> 한 줄이다.</Term>
      <CodeBlock language="sql" output={d('filter_hnsw_relaxed_order').output} outputCaption="relaxed_order · 실제 실행 결과">{d('filter_hnsw_relaxed_order').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('filter_hnsw_relaxed_plan').output} outputCaption="실제 실행 결과">{d('filter_hnsw_relaxed_plan').sql}</CodeBlock>
      <p>결과 10행이 채워졌다. 대신 첫 탐색에서 버려 둔 후보부터 다시 이어 찾다가 라벨 10에 닿기까지 다른 라벨의 점 {fmtNum(removed('filter_hnsw_relaxed_plan'))}개를 읽고 버렸다(<code>Rows Removed by Filter</code>, 이 질의 하나 기준). <code>relaxed_order</code>는 결과 순서를 약간 느슨하게, <code>strict_order</code>는 거리 순서를 지킨다.</p>
    </Section>

    <Section id="diskann" title="4. DiskANN 라벨 인덱스: 라벨 안에서 바로">
      <p>같은 데이터에 라벨을 두 번째 컬럼으로 넣은 DiskANN 인덱스를 만든다. 실행 계획에서 라벨 조건이 <code>Filter</code>가 아니라 <code>Index Cond</code>로 들어가, 버려지는 행 없이 라벨 10 안에서 찾는다.</p>
      <CodeBlock language="sql" output={d('filter_diskann_build').output} outputCaption="실제 출력">{d('filter_diskann_build').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('filter_diskann_plan').output} outputCaption="Index Cond — 인덱스가 직접 거른다 · 실제 실행 결과">{d('filter_diskann_plan').sql}</CodeBlock>
    </Section>

    <Section id="quality" title="5. 정확도와 비용 (실험 07)">
      <p>위는 질문 하나의 모습이다. 질문 {filter.n_queries}개로 반복해 평균을 냈다. 비용(읽은 페이지)과 정확도(돌려준 행이 정답에 얼마나 가까운가)를 함께 본다.</p>
      <ChartBox type="bar" title="질의당 버퍼 (로그 축)" height={280}
        data={{
          labels: fCorrect.configs.map((c) => names[c.config]),
          datasets: [{ label: '버퍼/질의', data: fCorrect.configs.map((c) => c.buffers_per_query), backgroundColor: [C.none, C.bigm, C.tsv, C.trgm] }],
        }}
        options={{ plugins: { legend: { display: false } }, scales: axes({ log: true, yTitle: '버퍼 (log)' }) }}
        caption={`질의 ${filter.n_queries}개를 한 번에 실행한 EXPLAIN (ANALYZE, BUFFERS)의 질의당 평균, 3회 중앙값.`} />
      <table><thead><tr><th>설정</th><th>반환 행/질의</th><th>recall@10</th><th>결과 평균 거리</th><th>정답→중앙값 사이 위치</th><th>버퍼/질의</th><th>ms/질의</th></tr></thead><tbody>
        {fCorrect.configs.map((c) => <tr key={c.config}>
          <td>{names[c.config]}</td><td>{c.avg_rows_returned}</td><td>{r3(c.recall_at_10)}</td>
          <td>{c.avg_distance_returned?.toFixed(3) ?? '—'}</td><td>{gap(c.avg_distance_returned)}</td>
          <td>{fmtNum(c.buffers_per_query)}</td><td>{c.ms_per_query.toFixed(2)}</td>
        </tr>)}
      </tbody></table>
      <p>거리 기준선: 정답 top-10 평균 <strong>{exact.toFixed(3)}</strong>, 라벨 10 전체의 거리 {dist.min.toFixed(3)}(최소) · {dist.median.toFixed(3)}(중앙값) · {dist.max.toFixed(3)}(최대). 빌드: HNSW {fmtSec(fCorrect.hnsw_build_ms)}, DiskANN {fmtSec(fCorrect.diskann_build_ms)}.</p>
      <ChartNotes items={[
        { label: '기본값은 0행 (H1 채택)', note: <>버퍼 {fmtNum(off.buffers_per_query)}만 읽고 끝난다. 싸지만 답이 없다.</> },
        { label: 'iterative_scan은 채우지만 비싸다 (H2 채택)', note: <>relaxed {fmtNum(rel.buffers_per_query)} 버퍼·{rel.ms_per_query.toFixed(1)} ms, strict {fmtNum(strict.buffers_per_query)} 버퍼. 필터를 통과하는 후보가 질의 근처에 없으니 그래프를 넓게 훑는다.</> },
        { label: 'DiskANN이 같은 10행을 더 싸게 (H3 채택)', note: <>{fmtNum(dk.buffers_per_query)} 버퍼·{dk.ms_per_query.toFixed(2)} ms — relaxed 대비 버퍼 {ratio(rel.buffers_per_query, dk.buffers_per_query)}, 시간 {ratio(rel.ms_per_query, dk.ms_per_query)} 적다.</> },
        { label: '대신 결과가 조금 덜 가깝다', note: <>평균 거리 DiskANN {dk.avg_distance_returned?.toFixed(3)} vs HNSW relaxed {rel.avg_distance_returned?.toFixed(3)} (정답 {exact.toFixed(3)}). 정답과 중앙값 사이에서 HNSW는 {gap(rel.avg_distance_returned)}, DiskANN은 {gap(dk.avg_distance_returned)} 지점.</> },
      ]} />
      <Callout kind="info" title="recall이 낮은데 '찾았다'고 하는 이유">
        <p>라벨 10의 5,000개 점은 질의에서 {dist.min.toFixed(1)}~{dist.max.toFixed(1)}로 거의 같은 거리다. "정확한 top-10"은 근소한 차이의 동률 경쟁이라 recall@10(HNSW {r3(rel.recall_at_10)}, DiskANN {r3(dk.recall_at_10)})이 작게 나온다. 그래서 거리를 함께 본다 — 둘 다 무작위로 고른 라벨 10 점(중앙값)보다 훨씬 가까운 점을 돌려줬다. 실제 서비스라면 "충분히 비슷한가"를 정하는 기준이 따로 필요하다.</p>
      </Callout>
      <SourceNote path="week05/experiments/07-filtered-search-cost/bench.py" />
    </Section>

    <Section id="source" title="6. iterative scan은 언제 멈추나 — 소스로 확인">
      <p>“계속 더 찾는다”면 끝없이 찾지는 않을까? 멈추는 조건이 있다. 아래는 pgvector 소스를 직접 읽고 정리한 것이다.</p>
      <Deep title="hnswscan.c의 동작과 세 가지 멈춤 조건">
      <p>pgvector v0.8.x의 <code>src/hnswscan.c</code>를 읽었다. 첫 탐색(크기 <code>ef_search</code>)에서 결과 목록에 못 든 후보는 <code>discarded</code> 힙에 쌓인다. 결과를 다 쓰면 그 힙에서 <code>ef_search</code>개를 꺼내 진입점으로 삼아 탐색을 이어 간다(<code>ResumeScanItems</code>). 멈추는 조건은 셋이다.</p>
      <ul>
        <li>방문한 튜플이 <code>hnsw.max_scan_tuples</code>(기본 20,000)를 넘을 때</li>
        <li>스캔 메모리가 <code>work_mem × hnsw.scan_mem_multiplier</code>를 넘을 때</li>
        <li><strong><code>discarded</code> 힙이 비었을 때</strong> — 더 펼칠 후보가 없을 때(그래프에서 닿을 수 있는 곳을 다 봤을 때)</li>
      </ul>
      </Deep>
      <p>실무에서 기억할 것은 하나다. 기본 상한 <code>hnsw.max_scan_tuples = 20,000</code>을 넘도록 조건에 맞는 행이 멀리 있으면, iterative_scan을 켜도 결과가 10행보다 적을 수 있다. 세 번째 조건(더 펼칠 후보가 없음)은 아래 “첫 판의 실수”를 설명한다.</p>
    </Section>

    <Section id="first-edition" title="7. 첫 판의 실수: 서로 다른 벡터가 10개뿐이었다">
      <p>발표에서는 결론만: <strong>처음엔 “HNSW는 어떤 설정으로도 0행”이라고 결론 냈는데, 실험 데이터가 잘못 만들어져 있었다.</strong> 데이터를 고쳐 다시 재니 위 5절의 결과가 나왔다. 아래는 그 경위다.</p>
      <Callout kind="warn" title="정정">
        <p>이 실험의 첫 판은 "HNSW는 iterative_scan을 어떤 값으로 둬도(<code>max_scan_tuples</code> 10배 포함) 0행, DiskANN만 10행"이라고 결론 냈고, "튜닝으로 못 고치는 HNSW의 한계"로 해석했다. 웹 자료로 옮기며 출력을 다시 확인하다가 데이터가 잘못된 것을 발견했다.</p>
      </Callout>
      <CodeBlock language="sql">{demo.dup_setup}</CodeBlock>
      <CodeBlock language="sql" output={d('dup_distinct').output} outputCaption="첫 판의 데이터 · 실제 실행 결과">{d('dup_distinct').sql}</CodeBlock>
      <p>서브쿼리가 바깥 행을 참조하지 않아 InitPlan으로 한 번만 평가됐다 — <Ref to="/pgvector/ann-details#initplan">실험 01에서 기록해 둔 바로 그 함정</Ref>이다. 라벨마다 5,000개가 완전히 같은 벡터라, HNSW의 이웃 목록이 거리 0인 복제본으로 채워져 그래프가 군집 안에 갇힌 조각으로 끊어졌다. 필터 없이 끝까지 찾아도 닿는 행이 몇백 개뿐이다.</p>
      <CodeBlock language="sql" output={d('dup_reachable').output} outputCaption="중복 데이터 · 필터 없음 · 실제 실행 결과">{d('dup_reachable').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('docs_reachable').output} outputCaption="올바른 데이터 · 같은 질의 · 실제 실행 결과">{d('docs_reachable').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('dup_filter').output} outputCaption="중복 데이터 · relaxed_order · 실제 실행 결과">{d('dup_filter').sql}</CodeBlock>
      <p>실험 07을 두 데이터셋으로 다시 돌렸다. 중복 데이터({fmtNum(fDup.rows)}행 중 서로 다른 벡터 {fDup.distinct_vectors}개)에서 HNSW는 필터 없이 {fmtNum(fDup.hnsw_reachable_rows)}행에만 닿았고 세 설정 모두 0행, DiskANN은 10행. 올바른 데이터에서는 {fmtNum(fCorrect.hnsw_reachable_rows)}행 전부에 닿았고 결론은 위 5절과 같다.</p>
      <Callout kind="tip" title="덤으로 얻은 실무 교훈">
        <p><strong>완전히 같은 벡터가 대량으로 있으면 HNSW 그래프가 끊어질 수 있다.</strong> 같은 문서를 여러 번 넣었거나 빈 문자열·기본값 임베딩이 쌓인 테이블이라면 의심해 볼 만하다. 다만 이 자료가 확인한 것은 "군집마다 같은 벡터 5,000개"라는 극단적 조건 하나다 — 중복이 얼마나 많아야 문제가 되는지는 재지 않았다.</p>
      </Callout>
    </Section>

    <Quiz items={QUIZ['filtering']} />

    <Next to="/pgvector/when-to-use" title="언제 무엇을 쓰나" why={'지금까지 잰 것을 모아 실무 선택지로 정리한다.'} />
  </>
}
