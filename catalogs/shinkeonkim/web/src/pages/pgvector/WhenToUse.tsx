import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import { avg, build, envTags, fCorrect, fmtMs, fmtNum, halfvec, pick, r2, ratio, recall, scale } from './stats'
import { Goal, Recap } from './guide'

const last = build.rows[build.rows.length - 1]
const hv = pick(halfvec.configs, 'halfvec(float2)+HNSW')
const f4 = pick(halfvec.configs, 'vector(float4)+HNSW')
const rel = pick(fCorrect.configs, 'hnsw_iterative_relaxed_order')
const dk = pick(fCorrect.configs, 'diskann_label_filter')
const e10 = pick(recall.configs, 'hnsw_ef10')
const h10 = pick(scale.configs, 'hnsw_ef10')
const dk10 = pick(scale.configs, 'diskann_sls10')

export default function WhenToUse() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="언제 무엇을 쓰나"
      lede="pgvector HNSW, IVFFlat, halfvec, pgvectorscale(DiskANN), 전용 벡터 DB 중 무엇을 고를지. AWS 공식 가이드와 TigerData 벤치마크(1차 출처), 그리고 이 자료의 실험을 합쳐 정리했다. 추정이 섞인 곳은 그렇다고 적는다."
      tags={envTags} />

    <Goal
      questions={['지금까지 잰 것 중 꼭 기억할 숫자는?', '내 상황에서는 무엇을 고르나?', '클라우드 PostgreSQL에서도 쓸 수 있나?']}
      assumes={<>앞의 모든 페이지. 처음 이 페이지부터 본다면 <Ref to="/pgvector/first">처음이라면</Ref>을 먼저 본다.</>} />

    <Section id="numbers" title="1. 실험이 말해 준 것 — 네 개의 숫자">
      <StatGrid>
        <Stat tone="bigm" value={`${r2(avg(e10.recall))} → ${r2(h10.recall_at_10)}`} label={`HNSW를 가장 싸게 설정했을 때의 recall. 데이터를 ${fmtNum(recall.n_vectors)}행에서 ${fmtNum(scale.n_vectors)}행으로 늘리자 무너졌다. 같은 조건 DiskANN은 ${r2(dk10.recall_at_10)}`} />
        <Stat tone="warn" value={ratio(last.diskann_build_ms, last.hnsw_build_ms)} label={`${fmtNum(last.n)}행에서 DiskANN 인덱스를 만드는 데 HNSW보다 더 걸린 배수 (${Math.round(last.diskann_build_ms / 1000)}초 vs ${Math.round(last.hnsw_build_ms / 1000)}초)`} />
        <Stat tone="ok" value={`${Math.round((1 - hv.index_mb / f4.index_mb) * 100)}%`} label="숫자를 2바이트로 저장하는 halfvec만으로 줄어든 HNSW 인덱스 크기 — 확장 추가 없이" />
        <Stat tone="trgm" value={`${fmtMs(rel.ms_per_query)} vs ${fmtMs(dk.ms_per_query)}`} label="“라벨 10 중에서 가장 가까운 10개” 질문 하나: HNSW+iterative_scan vs DiskANN 라벨 인덱스 (HNSW 기본값은 0행)" />
      </StatGrid>
      <p>노트북 Docker에서 잰 값이다. 시간의 절대값보다 방식 사이의 차이로 읽는다.</p>
    </Section>

    <Section id="flow" title="2. 결정 순서">
      <Diagram chart={`flowchart TD
        a["이미 PostgreSQL에 데이터가 있다?"] -->|아니오| z["전용 벡터 DB도 같은 선상에서 검토"]
        a -->|예| b["pgvector HNSW 로 시작<br/>ef_search 는 100 부터"]
        b --> c{"필터 조건이 자주 붙는다?"}
        c -->|예| d["hnsw.iterative_scan = relaxed_order<br/>(기본값은 빈 결과 가능)"]
        c -->|아니오| e{"메모리·인덱스 크기가 문제?"}
        d --> e
        e -->|예| f["halfvec 로 바꿔 본다"]
        e -->|아니오| g{"수천만 행 · 저렴한 설정의 recall 이 무너진다?<br/>또는 필터 검색이 너무 비싸다?"}
        f --> g
        g -->|예| h{"Timescale Cloud 이거나<br/>직접 운영하는 PostgreSQL?"}
        h -->|예| i["pgvectorscale DiskANN<br/>(빌드 시간 감당 가능할 때)"]
        h -->|아니오| j["파티셔닝 · 전용 벡터 DB"]
        g -->|아니오| k["그대로 HNSW"]
      `} caption="왼쪽 위에서 시작한다. 대부분은 'pgvector HNSW + iterative_scan(+ halfvec)'에서 끝난다." />
    </Section>

    <Section id="cases" title="3. 상황별 선택">
      <table><thead><tr><th>상황</th><th>선택</th><th>근거</th></tr></thead><tbody>
        <tr><td>Postgres를 이미 쓰고 수십만~수백만 행</td><td><strong>pgvector HNSW</strong></td><td>메타데이터·벡터를 한 트랜잭션·JOIN으로. 매니지드 지원이 가장 넓다. AWS 가이드의 기본 권장</td></tr>
        <tr><td>정적인 대형 코퍼스, 주기적으로 통째 재빌드</td><td>IVFFlat</td><td>빌드가 가장 빠르다(<Ref to="/pgvector/cost#build">실험 02</Ref>). 데이터를 먼저 넣고 만든다</td></tr>
        <tr><td>테넌트·카테고리 필터가 섞인 검색</td><td>HNSW + <code>iterative_scan</code></td><td>기본값은 0행이 나올 수 있다. 켜면 채워지지만 필터를 통과하는 후보가 드물수록 비싸다 — 실험 07에서 질의당 {rel.ms_per_query.toFixed(1)} ms</td></tr>
        <tr><td>위의 필터 검색이 지연시간 예산을 넘는다</td><td>DiskANN 라벨 인덱스 · 라벨별 파티셔닝</td><td>같은 10행을 {ratio(rel.ms_per_query, dk.ms_per_query)} 빠르게(결과는 조금 덜 가깝다). 파티셔닝은 확장 없이 가능</td></tr>
        <tr><td>인덱스가 메모리에 안 들어간다</td><td><strong>halfvec 먼저</strong></td><td>확장 없이 {Math.round((1 - hv.index_mb / f4.index_mb) * 100)}% 감소(<Ref to="/pgvector/cost#halfvec">실험 05</Ref>). AWS: "메모리 절반, recall 손실 최소"</td></tr>
        <tr><td>수천만 행, 저렴한 설정으로도 높은 recall이 필요</td><td>pgvectorscale DiskANN</td><td>30만 행에서도 가장 싼 설정 recall 1.00(<Ref to="/pgvector/tuning#scale">실험 06</Ref>). 대신 빌드가 HNSW의 {ratio(last.diskann_build_ms, last.hnsw_build_ms)}</td></tr>
        <tr><td>수평 확장·운영 위임·테넌트 완전 격리</td><td>전용 벡터 DB</td><td>Postgres 안에 머무는 이점(트랜잭션·JOIN·운영 단순화)과 맞바꾸는 선택</td></tr>
      </tbody></table>
    </Section>

    <Section id="managed" title="4. 클라우드 PostgreSQL(매니지드 DB) 지원 — 2026-10 웹 검색 기준">
      <table><thead><tr><th>서비스</th><th>pgvector</th><th>pgvectorscale</th></tr></thead><tbody>
        <tr><td>AWS RDS for PostgreSQL</td><td>○ (15.2+, 최근 0.8.2대)</td><td>× 확장 목록에 없음</td></tr>
        <tr><td>Amazon Aurora PostgreSQL</td><td>○ (0.5.0+부터 HNSW)</td><td>×</td></tr>
        <tr><td>Supabase</td><td>○ 모든 플랜</td><td>× 커뮤니티 요청만 있음</td></tr>
        <tr><td>Neon</td><td>○ 모든 플랜</td><td>×</td></tr>
        <tr><td>GCP Cloud SQL</td><td>○</td><td>×</td></tr>
        <tr><td>Timescale Cloud (TigerData)</td><td>○</td><td>○ 제작사 서비스</td></tr>
      </tbody></table>
      <p>콘솔에서 직접 설치해 보지는 않았다. 쓰는 서비스·엔진 버전에서 <code>SELECT * FROM pg_available_extension_versions WHERE name IN ('vector','vectorscale')</code>로 재확인한다. pgvectorscale이 거의 지원되지 않는 이유는 Rust/pgrx 빌드와 슈퍼유저 요구가 관리형 서비스의 허용 정책과 맞지 않기 때문으로 보인다 — 공식 근거는 찾지 못한 추정이다.</p>
    </Section>

    <Section id="production" title="5. 실서비스 체크리스트 (AWS 공식 블로그 요약)">
      <ul>
        <li>HNSW를 기본으로. <code>m = 16</code>, <code>ef_construction = 128</code>을 시작점으로, <code>hnsw.ef_search</code>는 기본 40이 아니라 <strong>100부터</strong>.</li>
        <li>대량 적재는 데이터를 먼저 넣고 인덱스를 마지막에. HNSW는 병렬로 만들 수 있다(<code>max_parallel_maintenance_workers</code>).</li>
        <li><code>maintenance_work_mem</code>은 가장 큰 인덱스 빌드를 덮을 만큼. 모자라면 <code>CREATE INDEX</code>·<code>REINDEX</code>가 디스크로 넘쳐 느려진다.</li>
        <li>필터 검색은 <code>hnsw.iterative_scan = relaxed_order</code>. <code>hnsw.max_scan_tuples</code>(기본 20,000)가 스캔 범위의 상한이다.</li>
        <li>삭제·갱신이 많으면 그래프에 무효 항목이 쌓여 recall이 서서히 떨어진다 — <code>REINDEX CONCURRENTLY</code>, 파티션별 재빌드, 추가 전용 + 주기적 정리 중 하나를 처음부터 계획.</li>
        <li>정규화된 임베딩이면 <code>&lt;#&gt;</code>(내적)가 코사인과 같은 순위를 낸다 — 블로그는 Titan V2 기본 출력에 내적을 권한다.</li>
        <li>알려진 정답 세트로 recall을 주기적으로 잰다. 버퍼 캐시 적중률(99% 이상)과 p99 지연을 본다.</li>
      </ul>
      <Callout kind="info" title="이 자료에서 직접 확인한 것과 아닌 것">
        <p>위 목록은 AWS 블로그의 권고다. 이 자료가 실측으로 확인한 것은 기본 ef_search의 recall 수준(<Ref to="/pgvector/tuning">튜닝</Ref>), iterative_scan의 효과와 비용(<Ref to="/pgvector/filtering">필터</Ref>), 빌드 비용과 크기(<Ref to="/pgvector/cost">비용</Ref>)까지다. 삭제 누적에 따른 recall 저하, 병렬 빌드의 효과, 내적 연산자의 속도 이점은 재지 않았다.</p>
      </Callout>
    </Section>

    <Section id="use-cases" title="6. 실무 사용처">
      <table><thead><tr><th>용도</th><th>왜 Postgres 안에서</th></tr></thead><tbody>
        <tr><td>RAG(검색 증강 생성)의 문서 조각 검색</td><td>문서 메타데이터·권한·버전이 이미 Postgres에 있다. 벡터를 같은 행에 두면 권한 필터와 검색이 한 쿼리다</td></tr>
        <tr><td>상품·콘텐츠 의미 검색, 추천</td><td>재고·가격·카테고리 조건과 유사도 정렬을 함께</td></tr>
        <tr><td>중복 탐지(비슷한 문서·티켓)</td><td>새 행을 넣을 때 같은 트랜잭션에서 가까운 기존 행을 찾는다</td></tr>
        <tr><td>멀티테넌트 SaaS의 테넌트별 검색</td><td>Row Level Security와 결합. 다만 필터 검색 비용에 주의(<Ref to="/pgvector/filtering">필터</Ref>)</td></tr>
      </tbody></table>
      <p>AWS 블로그는 1만~5만 행 수준이면 인덱스 없이 병렬 순차 스캔으로도 충분하다고 적는다 — 정확하고 운영할 것이 없다. 인덱스는 그보다 클 때부터 의미가 있다.</p>
      <Callout kind="warn" title="출처를 고른 기준">
        <p>"어느 회사가 수천억 개 임베딩을 pgvector로 운영한다"류의 구체적 수치를 내세운 SEO 집계 블로그가 검색에 많이 나오지만, 원 출처를 확인할 수 없어 인용하지 않았다. 수치는 AWS 공식 블로그와 제작사 블로그(한계 명시)에서만 가져왔다.</p>
      </Callout>
    </Section>

    <Recap
      points={[
        <>PostgreSQL을 이미 쓰고 있다면 pgvector HNSW로 시작한다. <code>ef_search</code>는 100부터, 조건이 붙는 검색이면 <code>iterative_scan</code>을 켠다.</>,
        <>기본값을 믿지 말고 내 데이터로 recall을 잰다 — 가장 싼 설정은 규모가 커지면 무너졌다.</>,
        <>크기가 문제면 halfvec, 규모·조건 검색 비용이 문제고 빌드 시간을 감당할 수 있으면 pgvectorscale.</>,
      ]}
      next={{ to: '/pgvector/experiments', title: '실험 질문과 결과', why: '이 숫자들을 어떻게 쟀고, 어디서 틀렸다가 고쳤는지 본다.' }} />
  </>
}
