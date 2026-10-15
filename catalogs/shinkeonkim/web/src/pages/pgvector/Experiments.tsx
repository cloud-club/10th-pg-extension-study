import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Goal, Recap, Term } from './guide'
import { avg, build, env, envTags, exp, fCorrect, fDup, filter, fmtNum, halfvec, pick, r2, recall, scale } from './stats'

const last = build.rows[build.rows.length - 1]
const rel = pick(fCorrect.configs, 'hnsw_iterative_relaxed_order')
const dk = pick(fCorrect.configs, 'diskann_label_filter')

export default function Experiments() {
  return <>
    <PageHeader eyebrow="Week 05 · 실습과 실험" title="일곱 개 실험: 왜, 가설, 결과, 정정"
      lede="모든 실험은 '카탈로그 문서가 인용만 하고 재지 않은 주장'이나 '앞선 실험이 남긴 공백'에서 출발했다. 각 실험의 README에 가설(H1·H2…)과 채택·기각을 명시했고, 틀린 결론은 지우지 않고 정정으로 남겼다."
      tags={[...envTags, { label: `Docker · CPU ${env.cpu_count}개 · RAM 3.8GiB` }]} />

    <Goal
      questions={['각 실험은 어떤 질문에서 시작했나?', '예상(가설)은 맞았나?', '무엇이 틀렸고 어떻게 알았나?']} />

    <Term word="가설 · 채택 · 기각">가설(H1, H2…)은 실험 전에 적어 둔 예상이다. 결과가 예상대로면 <strong>채택</strong>, 예상과 다르면 <strong>기각</strong>. 기각도 실패가 아니라 “몰랐던 것을 알게 된” 결과다. 실험마다 README에 가설을 먼저 적고 결과를 나중에 붙였다.</Term>

    <Section id="overview" title="1. 한눈에 보기">
      <table><thead><tr><th>실험</th><th>질문</th><th>반복</th><th>가설 검증</th></tr></thead><tbody>
        <tr><td><Ref to="/pgvector/tuning#curve">01 · recall vs 튜닝</Ref></td><td>질의 파라미터를 올리면 recall·비용이 같이 오르나?</td><td>{recall.runs}회</td><td>HNSW·IVFFlat 채택. DiskANN 기각(가장 싼 설정부터 1.00 — 천장)</td></tr>
        <tr><td><Ref to="/pgvector/cost#build">02 · 빌드 비용·크기</Ref></td><td>규모가 커져도 DiskANN 인덱스가 작게 유지되나? 빌드는?</td><td>{build.runs}회</td><td>크기가 테이블의 {r2(Math.min(...build.rows.map((r) => r.diskann_ratio_to_table)))}~{r2(Math.max(...build.rows.map((r) => r.diskann_ratio_to_table)))}배로 일정(채택). 빌드는 {fmtNum(last.n)}행에서 HNSW의 {r2(last.diskann_build_ms / last.hnsw_build_ms)}배, 병렬 빌드로 격차가 준다는 기대는 기각</td></tr>
        <tr><td><Ref to="/pgvector/cost#plain">03 · SBQ 압축</Ref></td><td>압축을 끄면 크기·recall·버퍼가 어떻게 다른가?</td><td>1회</td><td>검증 불가 — 압축을 끈 빌드가 서버를 죽였다(→ 04에서 철회)</td></tr>
        <tr><td><Ref to="/pgvector/cost#plain">04 · plain 재현성</Ref></td><td>03의 크래시 경계는 어디인가?</td><td>{exp.plain_repro.attempts}회</td><td>{exp.plain_repro.attempts}번 모두 완주 — 03의 해석 철회</td></tr>
        <tr><td><Ref to="/pgvector/cost#halfvec">05 · halfvec vs SBQ</Ref></td><td>메모리를 아끼는 두 방법의 크기·recall·속도</td><td>{halfvec.runs}회</td><td>크기 SBQ &lt; halfvec 채택. recall 비교는 설계가 깨짐, halfvec 빌드가 빠르다는 기대 기각</td></tr>
        <tr><td><Ref to="/pgvector/tuning#scale">06 · 30만 행 recall</Ref></td><td>01의 DiskANN 천장은 작은 규모의 착시인가?</td><td>{scale.runs}회</td><td>아니다 — HNSW 가장 싼 설정 {r2(avg(pick(recall.configs, 'hnsw_ef10').recall))}→{r2(pick(scale.configs, 'hnsw_ef10').recall_at_10)}, DiskANN 1.00 유지</td></tr>
        <tr><td><Ref to="/pgvector/filtering">07 · 필터 검색</Ref></td><td>HNSW+iterative_scan과 DiskANN 라벨 인덱스의 정확도·비용</td><td>{filter.runs}회</td><td>기본값 0행 · relaxed {rel.ms_per_query.toFixed(1)} ms · DiskANN {dk.ms_per_query.toFixed(2)} ms(결과는 HNSW가 조금 더 가까움). 첫 판 결론은 데이터 버그로 정정</td></tr>
      </tbody></table>
    </Section>

    <Section id="method" title="2. 공통 방법">
      <ul>
        <li><strong>격리:</strong> 실험마다 새 컨테이너·새 볼륨(<code>runtime/compose.yaml</code>, <code>timescale/timescaledb-ha:pg16</code> digest 고정). 같은 Compose 프로젝트를 쓰므로 동시에 실행하지 않는다.</li>
        <li><strong>설정:</strong> <code>shared_buffers={env.shared_buffers}</code>, <code>maintenance_work_mem={env.maintenance_work_mem}</code>, <code>max_parallel_maintenance_workers=2</code>.</li>
        <li><strong>정답:</strong> 인덱스를 만들기 전 순차 스캔으로 질의마다 정확한 top-k를 구한다.</li>
        <li><strong>인덱스는 한 번에 하나:</strong> 두 인덱스가 공존하면 플래너가 다른 쪽을 고를 수 있다(week02에서 실제로 겪은 문제).</li>
        <li><strong>결정적 지표 우선:</strong> recall과 버퍼를 먼저 보고, 시간은 3회 중앙값을 보조로.</li>
        <li><strong>생성 검증:</strong> 데이터를 만든 직후 <code>count(DISTINCT embedding)</code>을 기록한다(07부터 assert).</li>
      </ul>
      <CodeBlock language="bash">{`cd catalogs/shinkeonkim/week05/experiments
python3 01-recall-vs-tuning/bench.py            # 2회 돌려 results/run1.json · run.json
python3 02-build-cost-and-size/bench.py         # 30만 행 DiskANN 빌드 약 10분
python3 03-sbq-compression/bench.py
python3 04-plain-build-memory-threshold/bench.py
python3 05-halfvec-vs-sbq/bench.py
python3 06-recall-at-scale/bench.py
python3 07-filtered-search-cost/bench.py
cd ../../web
python3 scripts/sync-pgvector-results.py        # 웹 요약 게시 (src/data/pgvector-experiments.json)
python3 scripts/capture-pgvector-demo.py        # 페이지의 SQL 출력 (src/data/pgvector-demo.json)`}</CodeBlock>
    </Section>

    <Section id="corrections" title="3. 측정 중에 바로잡은 것">
      <table><thead><tr><th>처음 판단</th><th>실제</th><th>어떻게 알았나</th></tr></thead><tbody>
        <tr><td>128차원 균등분포 난수로 recall을 잴 수 있다</td><td>모든 점이 거의 같은 거리라 최근접 이웃이 사실상 정의되지 않는다</td><td>recall이 엔진별로 정확히 0.0·1.0으로 "너무 깔끔하게" 나왔다(<Ref to="/pgvector/ann-details#concentration">ANN</Ref>)</td></tr>
        <tr><td>행마다 스칼라 서브쿼리로 난수 벡터를 만들 수 있다</td><td>InitPlan으로 한 번만 평가돼 모든 행이 같은 벡터</td><td>HNSW로 자기 자신을 질의해도 거리 0인 점을 못 찾았다(<Ref to="/pgvector/ann-details#initplan">ANN</Ref>)</td></tr>
        <tr><td>id를 명시해 넣어도 bigserial이 이어진다</td><td>시퀀스가 전진하지 않아 다음 기본값이 1부터 — PK 충돌</td><td>근접점 주입 INSERT가 실패. <code>setval()</code>로 해결</td></tr>
        <tr><td>압축을 끄면 이 메모리로는 빌드가 안 된다(실험 03)</td><td>같은 조건 {exp.plain_repro.attempts}번 모두 완주, 피크 메모리 400MB 안쪽</td><td>실험 04의 반복 재현. 철회(<Ref to="/pgvector/cost#plain">비용</Ref>)</td></tr>
        <tr><td><strong>HNSW는 iterative_scan을 어떻게 켜도 필터 검색 0행(실험 07 첫 판)</strong></td><td>데이터가 {fmtNum(fDup.rows)}행 중 서로 다른 벡터 {fDup.distinct_vectors}개였다 — 위 InitPlan 함정을 다시 밟음. 올바른 데이터에선 relaxed_order가 10행을 채운다</td><td>웹 자료로 옮기며 출력을 보니 같은 데이터로 HNSW가 필터 없이도 몇백 행에만 닿았다. 생성 방식을 대조해 확인(<Ref to="/pgvector/filtering-details#first-edition">필터</Ref>)</td></tr>
        <tr><td>IVFFlat을 빈 테이블에 만들면 recall이 나빠진다(직접 재현)</td><td>크기만 확인했고 recall은 재지 않았었다. 재 보니 질의 100개에서 0.655 vs 0.712 — 방향은 맞지만 차이가 작다</td><td>문서 검수 중 "직접 재현"의 근거를 찾다가(<Ref to="/pgvector/ivfflat-details#build-order">IVFFlat</Ref>)</td></tr>
        <tr><td>같은 비용이면 HNSW가 IVFFlat보다 정확하다(문서의 일반론)</td><td>이 합성 데이터에서는 IVFFlat이 비슷한 recall을 더 적은 페이지·비슷한 시간에 냈다</td><td>웹 자료를 초심자용으로 다시 쓰며 비교표 문장을 실측 숫자와 대조하다가(<Ref to="/pgvector/hnsw-ivfflat#compare">HNSW vs IVFFlat</Ref>)</td></tr>
        <tr><td>로그의 <code>SbqCompression</code>이 옵션 값이다</td><td>옵션은 <code>memory_optimized</code> / <code>plain</code></td><td><code>ERROR: Invalid storage type</code></td></tr>
      </tbody></table>
    </Section>

    <Section id="limits" title="4. 이 실험들이 확인하지 않은 것">
      <table><thead><tr><th>한계</th><th>영향</th></tr></thead><tbody>
        <tr><td>Docker Desktop(macOS) VM, 공유 CPU 3개·RAM 3.8GiB</td><td>절대 시간은 일반화하지 않는다. 방식 사이의 상대 비교와 결정적 지표(recall·버퍼·크기)로 읽는다</td></tr>
        <tr><td>합성 데이터(균등분포 배경 + 주입한 근접점, 또는 인위적 군집)</td><td>실제 임베딩의 분포와 다르다. 특히 07의 필터 시나리오는 군집 사이가 매우 먼 극단적 설정이다</td></tr>
        <tr><td>최대 30만 행 · 128차원</td><td>DiskANN의 설계 목표(수천만 행·고차원)는 시도하지 못했다</td></tr>
        <tr><td>02·03·05·06·07은 1회</td><td>HNSW 빌드가 비결정적이라 recall이 실행마다 흔들린다(07의 relaxed recall이 두 실행에서 0.305·0.385)</td></tr>
        <tr><td>plain(압축 끔)의 recall·버퍼</td><td>아직 없다</td></tr>
        <tr><td>삭제·갱신 누적, 동시 질의 처리량, 병렬 빌드 효과</td><td>재지 않았다</td></tr>
      </tbody></table>
    </Section>

    <Recap
      points={[
        <>실험은 모두 “문서가 인용만 하고 재지 않은 주장”이나 “앞 실험이 남긴 공백”에서 출발했다.</>,
        <>결론 두 개와 문서의 설명 두 개를 실측으로 고쳤다. 고친 기록도 결과의 일부로 남긴다.</>,
        <>재지 않은 것(실제 임베딩, 수천만 행, 삭제 누적)은 그렇다고 적었다.</>,
      ]}
      next={{ to: '/pgvector/resources', title: '참고 자료', why: '인용한 1차 출처와 저장소 안의 실습·실험 경로.' }} />
  </>
}
