import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import { CodeBlock } from '@/components/common/Code'

const ORDER = [
  ['ann', '01. 벡터 검색과 ANN'],
  ['overview', '02. pgvector 전체 구조'],
  ['ivfflat', '03. IVFFlat'],
  ['hnsw', '04. HNSW'],
  ['storage', '05. RAM, SSD와 Random Access'],
  ['diskann', '06. StreamingDiskANN'],
  ['sbq', '07. SBQ'],
  ['filtering', '08. Filtered Vector Search'],
  ['when-to-use', '09. 기술 비교와 선택 기준'],
  ['glossary', '10. 용어집과 복습'],
]

export default function About() {
  return <>
    <PageHeader eyebrow="Week 05 · pgvector · pgvectorscale" title="pgvector · pgvectorscale 벡터 검색 학습 자료"
      lede="벡터 검색을 처음 접하는 고등학생도 전체 흐름을 이해할 수 있도록 작성하되, 개발자가 실제 설계와 구현으로 이어갈 수 있을 정도의 기술 내용을 포함합니다." />
    <div className="prose-doc">
      <p>핵심 질문은 하나입니다.</p>
      <blockquote><p>수천만~수억 개의 벡터 중에서, 모든 벡터를 전부 비교하지 않고 어떻게 정답에 가까운 데이터를 빠르게 찾을까?</p></blockquote>
      <p>이를 위해 <code>pgvector</code>와 <code>pgvectorscale</code>이 사용하는 핵심 개념을 단계적으로 설명합니다.</p>
    </div>
    <Section id="order" title="권장 학습 순서">
      <ol>{ORDER.map(([slug, title]) => <li key={slug}><Ref to={`/pgvector/${slug}`}>{title}</Ref></li>)}</ol>
    </Section>
    <Section id="map" title="전체 구조">
      <Diagram chart={`flowchart TD
    A[Vector Search] --> B[Exact Search]
    A --> C[ANN]
    C --> D[IVFFlat]
    C --> E[HNSW]
    C --> F[StreamingDiskANN]
    D --> D1[Cluster/List]
    E --> E1[Multi-layer Graph]
    F --> F1[SSD-friendly Graph]
    F --> G[SBQ]
    F --> H[Filtered Search]`} />
    </Section>
    <Section id="corrections" title="가장 중요한 정정 사항">
      <h3>1. pgvector가 RAM만 사용하는 것은 아니다</h3>
      <p><code>pgvector</code>의 HNSW/IVFFlat 인덱스는 PostgreSQL 인덱스이므로 <strong>디스크/SSD에 영속적으로 저장</strong>됩니다.</p>
      <p>다만 HNSW는 그래프의 여러 노드를 랜덤하게 접근하는 특성이 있어, <strong>working set이 PostgreSQL shared buffers나 OS page cache에 잘 올라와 있을수록 빠른 경향</strong>이 있습니다.</p>
      <p>더 정확한 표현은 다음과 같습니다.</p>
      <blockquote><p>HNSW는 디스크에 저장되지만, 그래프 random access가 많기 때문에 메모리/cache hit 비율이 높을수록 유리하다.</p></blockquote>
      <h3>2. pgvector도 filtering 시 추가 탐색이 가능하다</h3>
      <p>pgvector 0.8.0부터 HNSW와 IVFFlat에는 <code>iterative_scan</code> 기능이 있습니다.</p>
      <CodeBlock language="sql">{'SET hnsw.iterative_scan = strict_order;\nSET ivfflat.iterative_scan = relaxed_order;'}</CodeBlock>
      <p>필터링 결과가 부족하면 인덱스를 추가로 탐색할 수 있습니다. 따라서 StreamingDiskANN만 결과가 부족할 때 추가 탐색할 수 있다고 단순 비교하면 안 됩니다.</p>
    </Section>
    <Section id="remember" title="기술을 한 문장씩 기억하기">
      <table><thead><tr><th>기술</th><th>한 문장</th></tr></thead><tbody>
        <tr><td>Vector Search</td><td>의미를 숫자로 표현한 벡터끼리 거리를 비교한다</td></tr>
        <tr><td>ANN</td><td>모든 벡터를 확인하지 않고 정답일 가능성이 높은 곳만 탐색한다</td></tr>
        <tr><td>IVFFlat</td><td>벡터 공간을 여러 동네로 나누고 가까운 동네만 찾는다</td></tr>
        <tr><td>HNSW</td><td>여러 층의 그래프와 지름길을 이용한다</td></tr>
        <tr><td>DiskANN</td><td>SSD에서 적은 random I/O로 이동할 수 있는 그래프를 만든다</td></tr>
        <tr><td>StreamingDiskANN</td><td>DiskANN 계열 탐색을 PostgreSQL에서 결과를 순차적으로 공급할 수 있도록 구성한다</td></tr>
        <tr><td>SBQ</td><td>벡터 분포의 통계를 이용해 작은 binary 표현으로 압축한다</td></tr>
        <tr><td>Label filtering</td><td>자주 쓰는 메타데이터 조건을 벡터 인덱스 검색 자체에 활용한다</td></tr>
      </tbody></table>
    </Section>
    <Section id="practice" title="실습과 실험 · 기본 학습을 읽은 뒤">
      <ul>
        <li><Ref to="/pgvector/labs">Lab 목록과 실행 순서</Ref> — 설치와 거리 연산자, HNSW·IVFFlat, DiskANN 실습 3개.</li>
        <li><Ref to="/pgvector/install">설치와 SQL 실습</Ref> — 실제 SQL 출력과 실행 계획을 함께 읽습니다.</li>
        <li><Ref to="/pgvector/experiments">실험 질문과 결과</Ref> — recall, 빌드 비용, 압축, 규모, 필터 검색 실험 7개와 정정 이력.</li>
      </ul>
    </Section>
    <Section id="advanced" title="심화 · 구현과 실측이 궁금하다면">
      <ul>
        <li><Ref to="/pgvector/ann-details">Recall 측정과 실행 계획</Ref></li>
        <li><Ref to="/pgvector/ivfflat-details">IVFFlat 구현과 실측</Ref> · <Ref to="/pgvector/hnsw-details">HNSW 구현과 실측</Ref></li>
        <li><Ref to="/pgvector/hnsw-ivfflat">HNSW vs IVFFlat 실측</Ref> · <Ref to="/pgvector/tuning">튜닝 곡선과 규모</Ref></li>
        <li><Ref to="/pgvector/diskann-details">DiskANN 구현과 벤치마크</Ref> · <Ref to="/pgvector/cost">빌드 비용과 크기</Ref></li>
        <li><Ref to="/pgvector/filtering-details">필터 검색 실측</Ref> · <Ref to="/pgvector/selection-details">실측으로 보는 선택 기준</Ref></li>
      </ul>
    </Section>
    <Section id="references" title="주요 참고 자료">
      <ul>
        <li><a href="https://github.com/pgvector/pgvector">pgvector</a></li>
        <li><a href="https://github.com/timescale/pgvectorscale">pgvectorscale</a></li>
        <li><a href="https://arxiv.org/abs/1603.09320">HNSW paper</a></li>
        <li><a href="https://proceedings.neurips.cc/paper/2019/hash/09853c7fb1d3f8ee67a61b6bf4a7f8e6-Abstract.html">DiskANN paper</a></li>
        <li><a href="https://www.microsoft.com/en-us/research/project/project-akupara-approximate-nearest-neighbor-search-for-large-scale-semantic-search/">Microsoft DiskANN</a></li>
      </ul>
      <p><Ref to="/pgvector/resources">참고 자료 전체 목록</Ref></p>
    </Section>
  </>
}
