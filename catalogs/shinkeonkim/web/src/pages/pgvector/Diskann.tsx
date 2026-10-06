import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { Diagram } from '@/components/viz/Diagram'
import { d, envTags } from './stats'
import { Deep, Goal, Next, Quiz, Summary, Term } from './guide'
import { QUIZ } from './quizzes'

export default function Diskann() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="pgvectorscale: pgvector 위에 얹는 DiskANN 인덱스"
      lede="pgvectorscale은 pgvector를 대체하지 않는다. vector 타입과 거리 연산자는 그대로 쓰고, diskann이라는 인덱스 종류 하나를 더한다. 이 인덱스는 벡터를 압축해서 먼저 비교하고, 라벨(분류 번호)을 인덱스 안에 함께 넣을 수 있다. TimescaleDB를 만든 회사(현 TigerData)가 Rust로 만들었다."
      tags={[...envTags, { label: 'Rust · pgrx' }, { label: 'Timescale(TigerData)' }]} />

    <Summary points={[
      <>pgvectorscale = pgvector의 타입·연산자는 그대로 두고 <code>USING diskann</code> 인덱스 하나를 더한다.</>,
      <>DiskANN은 한 층 그래프 + 압축본으로 먼저 비교 + 원본으로 다시 확인. 손잡이는 <code>query_search_list_size</code>.</>,
      <>라벨을 인덱스에 넣으면 조건을 인덱스가 찾는 중에 직접 거른다(<code>Index Cond</code>).</>,
    ]} />

    <Goal
      questions={['pgvectorscale은 pgvector에 무엇을 더하나?', 'DiskANN은 HNSW와 무엇이 다른가?', '“압축해서 먼저 비교한다”는 무슨 뜻인가?', '“라벨을 인덱스에 넣는다”는 무슨 뜻인가?']}
      assumes={<>HNSW의 구조(<Ref to="/pgvector/hnsw">HNSW</Ref>)와 튜닝 곡선의 세 번째 선(<Ref to="/pgvector/tuning">튜닝 곡선</Ref>).</>} />

    <EasyFirst>
      <p>사진 수백만 장 중에서 비슷한 사진을 찾는다고 하자. 원본 사진을 전부 꺼내 비교하면 무겁다. 그래서 먼저 <strong>작은 흑백 썸네일</strong>로 빠르게 후보를 추리고, 남은 후보만 <strong>원본으로 다시 비교</strong>한다. DiskANN의 압축(SBQ)이 이 썸네일이다. 또 “풍경 사진 중에서만”처럼 분류가 붙으면, 분류 표시를 아예 인덱스에 함께 적어 두고 찾는 중에 바로 거른다. 이것이 라벨 인덱스다.</p>
    </EasyFirst>

    <Section id="what" title="1. 무엇을 더하나">
      <Diagram chart={`flowchart TB
        subgraph PGV["pgvector"]
          t["vector · halfvec · sparsevec · bit 타입"]
          o["거리 연산자 <-> <#> <=> <+>"]
          h["인덱스: hnsw · ivfflat"]
        end
        subgraph PGVS["pgvectorscale (requires = 'vector')"]
          k["인덱스: diskann<br/>(StreamingDiskANN · SBQ · 라벨)"]
        end
        t --> k
        o --> k
      `} caption="pgvectorscale은 타입도 연산자도 새로 만들지 않는다. pgvector의 것을 받아 인덱스 하나를 붙인다 — 그래서 질의 SQL은 그대로고 CREATE INDEX의 USING만 바뀐다." />
      <table><thead><tr><th></th><th>HNSW (pgvector)</th><th>DiskANN (pgvectorscale)</th></tr></thead><tbody>
        <tr><td>그래프</td><td>여러 층. 위층은 긴 간선</td><td>한 층(Vamana 계열). 가지치기 계수 <code>max_alpha</code>로 일부러 먼 간선을 남겨 지름길을 만든다</td></tr>
        <tr><td>저장</td><td>원본 float4(또는 halfvec)</td><td>기본 SBQ — 각 차원을 비트로 압축해 1차 비교, 상위 후보만 원본으로 다시 잰다(<code>diskann.query_rescore</code>)</td></tr>
        <tr><td>설계 목표</td><td>메모리에 올라간 그래프</td><td>디스크에 있어도 버티는 그래프 — 수천만 행</td></tr>
        <tr><td>2차 컬럼</td><td>없음</td><td><code>smallint[]</code> 라벨(<code>vector_smallint_label_ops</code>)</td></tr>
        <tr><td>거리</td><td>L2·내적·코사인·L1·해밍·자카드</td><td>L2·내적·코사인 (L1 없음)</td></tr>
      </tbody></table>
      <Term word="양자화 · SBQ">숫자를 더 적은 비트로 거칠게 줄이는 것을 양자화라 한다. SBQ(통계적 이진 양자화)는 pgvectorscale이 쓰는 방식으로, 각 칸의 값을 데이터 분포에 맞춰 비트로 줄인다. 압축본으로 후보를 고른 뒤 상위 후보만 원본 벡터로 다시 잰다(<code>diskann.query_rescore</code>, 기본 50개).</Term>
      <p>알고리즘 설명은 공식 문서와 DiskANN 논문을 기준으로 한 것이다. 이 자료가 직접 확인한 것은 빌드 NOTICE의 파라미터, 연산자 클래스, 그리고 실험 결과다.</p>
    </Section>

    <Section id="build" title="2. 만들어 보기 — NOTICE가 기본값을 알려 준다">
      <p>설치와 권한은 pgvector와 같다(<Ref to="/pgvector/install#trusted">둘 다 슈퍼유저 전용</Ref>). 질의 SQL은 바뀌지 않고, <code>CREATE INDEX</code>의 <code>USING hnsw</code>가 <code>USING diskann</code>으로 바뀔 뿐이다. 만들면 사용한 설정이 NOTICE(안내 메시지)로 찍힌다.</p>
      <CodeBlock language="sql" output={d('diskann_build').output} outputCaption="실제 출력">{d('diskann_build').sql}</CodeBlock>
      <table><thead><tr><th>파라미터</th><th>기본</th><th>의미</th></tr></thead><tbody>
        <tr><td><code>num_neighbors</code></td><td>-1(자동)</td><td>점마다 이을 이웃 수</td></tr>
        <tr><td><code>search_list_size</code></td><td>100</td><td>빌드 중 이웃을 찾을 때의 후보 목록 크기</td></tr>
        <tr><td><code>max_alpha</code></td><td>1.2</td><td>가지치기 계수. 1보다 크면 먼 간선을 일부 남긴다</td></tr>
        <tr><td><code>storage_layout</code></td><td>memory_optimized (로그엔 SbqCompression)</td><td>SBQ 압축. <code>plain</code>이면 원본 그대로</td></tr>
      </tbody></table>
      <p>찾을 때의 손잡이는 <code>diskann.query_search_list_size</code>(HNSW의 ef_search에 해당, 기본 100)와 <code>diskann.query_rescore</code>(원본으로 다시 잴 후보 수, 기본 50)다.</p>
      <Deep title="압축 끄기, 옵션 이름의 함정, 설정값 목록">
      <Callout kind="warn" title="옵션 이름과 로그 이름이 다르다">
        <p>로그에 찍힌 <code>SbqCompression</code>을 그대로 옵션에 쓰면 거절된다. 옵션 값은 <code>memory_optimized</code> / <code>plain</code>이다.</p>
      </Callout>
      <CodeBlock language="sql" output={d('diskann_layout_error').output} outputCaption="실제 오류">{d('diskann_layout_error').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('diskann_plain').output} outputCaption="압축 끄기 · 실제 출력">{d('diskann_plain').sql}</CodeBlock>
      <p>병렬 빌드는 <code>diskann.min_vectors_for_parallel_build</code>(65,536행) 이상에서만 켜진다.</p>
      <CodeBlock language="sql" output={d('diskann_gucs').output} outputCaption={"LOAD 'vectorscale-0.9.1' 이후 · 실제 실행 결과"}>{d('diskann_gucs').sql}</CodeBlock>
      <p>참고: 같은 GUC를 <code>short_desc</code>까지 조회하면 일부가 <code>\x13</code> 같은 깨진 문자열로 나온다(0.9.1). 설명 문자열 등록의 사소한 버그로 보이며 동작에는 영향이 없었다.</p>
      </Deep>
    </Section>

    <Section id="labels" title="3. 라벨을 인덱스에 넣는다">
      <p>문서마다 분류 번호(테넌트, 카테고리 등)를 <code>smallint[]</code>(작은 정수 배열) 컬럼에 넣고, 인덱스의 두 번째 컬럼으로 함께 넣는다. 그러면 <code>WHERE labels &amp;&amp; ARRAY[…]</code>(“이 라벨 중 하나라도 가진”) 조건을 인덱스가 찾는 도중에 직접 거른다. 실행 계획에서는 결과를 받은 뒤 버리는 <code>Filter</code>가 아니라, 인덱스 단계의 조건인 <code>Index Cond</code>로 나타난다.</p>
      <CodeBlock language="sql">{`CREATE INDEX ON docs USING diskann (embedding vector_l2_ops, labels);

SELECT id FROM docs
WHERE labels && ARRAY[10]::smallint[]          -- 여러 개면 OR (배열 겹침)
ORDER BY embedding <-> :q LIMIT 10;`}</CodeBlock>
      <CodeBlock language="sql" output={d('filter_diskann_plan').output} outputCaption="5만 행 · 라벨 10개 · 실제 실행 결과">{d('filter_diskann_plan').sql}</CodeBlock>
      <p>같은 질의를 HNSW + <code>WHERE</code>로 하면 무슨 일이 생기는지, 정확도·비용은 어떻게 다른지는 <Ref to="/pgvector/filtering">필터가 섞인 검색</Ref>에서 비교한다.</p>
      <SourceNote path="week05/pgvectorscale/labs/01-install-and-diskann/run.sh">설치·NOTICE·라벨 필터링을 Docker 실습으로</SourceNote>
    </Section>

    <Section id="vendor" title="4. 제작사가 발표한 숫자 (이 자료에서 재현하지 않음)">
      <p>우리 실험은 노트북에서 30만 행까지였다. 제작사는 훨씬 큰 규모에서 전용 벡터 DB인 Qdrant와 비교한 결과를 발표했다. 아래 숫자는 그 발표를 옮긴 것이고, 이 자료가 잰 것이 아니다.</p>
      <p>조건: 5천만 행·768차원 Cohere 임베딩, AWS r6id.4xlarge 한 대, recall 0.99를 맞춘 상태. p50은 “질의 절반이 이보다 빨랐다”, p99는 “질의 99%가 이보다 빨랐다”(느린 꼬리)는 뜻이다.</p>
      <table><thead><tr><th>지표</th><th>pgvector + pgvectorscale</th><th>Qdrant</th></tr></thead><tbody>
        <tr><td>p50 지연</td><td>31.07 ms</td><td>30.75 ms</td></tr>
        <tr><td>p95 / p99 지연</td><td>60.42 / 74.60 ms</td><td>36.73 / 38.71 ms</td></tr>
        <tr><td>처리량(QPS)</td><td>471.57</td><td>41.47</td></tr>
        <tr><td>인덱스 빌드</td><td>약 11.1시간</td><td>약 3.3시간</td></tr>
      </tbody></table>
      <Callout kind="warn" title="읽는 법">
        <p>벤더 자체 벤치마크다. 단일 노드만 비교했고(Qdrant의 수평 확장은 범위 밖), Qdrant는 배치 모드를 끄고 쟀으며, 저자가 "Qdrant 파라미터를 몇 주간 시행착오로 찾았지만 더 나은 설정을 놓쳤을 수 있다"고 적었다. 그래도 <strong>"빌드가 느리다, 현재 단일 스레드 구현"</strong>을 자사가 인정한 점은 이 자료의 <Ref to="/pgvector/cost#build">실험 02</Ref>와 방향이 같다.</p>
      </Callout>
    </Section>

    <Quiz items={QUIZ['diskann']} />

    <Next to="/pgvector/cost" title="빌드 비용과 크기" why={'규모가 커져도 버틴 대가는 무엇인가 — 만드는 시간과 저장 크기를 잰다.'} />
  </>
}
