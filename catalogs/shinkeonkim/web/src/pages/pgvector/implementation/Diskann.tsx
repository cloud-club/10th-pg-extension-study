import { CodeBlock } from '@/components/common/Code'

export default function DiskannImplementation() {
  return <div id="implementation" className="mt-8 scroll-mt-20">
    <h3>구현을 따라가기: pgvectorscale은 PostgreSQL의 인덱스로 동작합니다</h3>
    <p>DiskANN 논문의 아이디어와 pgvectorscale의 구현을 구분해서 읽으면 좋습니다. pgvectorscale은 Rust와 pgrx로 PostgreSQL에 <code>diskann</code> 인덱스 접근 방법을 등록합니다. PostgreSQL이 인덱스 생성·삽입·검색을 요청하면 확장의 해당 함수가 호출됩니다. PostgreSQL 밖에 별도 검색 서버를 띄우는 구조가 아닙니다.</p>
    <h4>만들기 ① 벡터 표현과 노드 위치를 저장합니다</h4>
    <p>SBQ 저장 방식을 선택했다면 먼저 데이터 표본으로 압축 기준을 학습합니다. 이후 벡터의 압축 표현과 그래프 정보를 인덱스 페이지에 저장합니다. 원본 테이블의 벡터를 모두 이진 비트로 바꿔 버리는 것이 아니라, 인덱스 탐색에 작은 표현을 활용하는 것입니다. 원본 벡터는 나중에 다시 거리를 계산하는 데 사용할 수 있습니다.</p>
    <h4>만들기 ② 새 노드를 찾는 검색으로 연결 후보를 모읍니다</h4>
    <p>새 벡터 P를 삽입할 때 기존 시작 노드에서 P를 질의처럼 검색합니다. <code>search_list_size</code>에 따라 탐색 폭을 정하고, 탐색한 노드들을 이웃 후보로 모읍니다. 후보가 너무 많다면 <code>num_neighbors</code> 안에 들어가도록 이웃 목록을 줄입니다. P를 연결한 뒤 기존 이웃의 목록에도 역방향 연결을 추가하고, 넘친 목록을 다시 줄입니다.</p>
    <h4>만들기 ③ RobustPrune은 “다른 이웃을 거쳐 갈 수 있나?”를 봅니다</h4>
    <p>예를 들어 P와 A의 거리가 2, P와 B의 거리가 3, A와 B의 거리가 1이라고 합시다. A를 이미 선택했다면 B는 P보다 A에 훨씬 가깝습니다. P에서 B로 가는 직접 연결 대신 P → A → B를 활용할 가능성이 있습니다. 반면 다른 방향에 있는 후보는 이런 우회 경로로 가기 어려워 직접 연결을 남길 가치가 있습니다.</p>
    <p>실제 <code>prune_neighbors</code>는 후보를 P와의 거리순으로 정렬하고, 이미 선택한 이웃과 다른 후보의 거리 비율을 비교합니다. pgvectorscale 0.9.1은 작은 alpha에서 시작해 여유가 있으면 alpha를 키우며 후보를 더 허용합니다. <code>max_alpha</code>가 그 상한입니다. 라벨이 있는 경우에는 라벨 관계도 함께 확인합니다.</p>
    <CodeBlock language="text" caption="그래프 삽입의 의사 코드 · 라벨 처리와 저장 세부 사항은 생략했습니다">{`P를 인덱스 노드로 저장
필요한 시작 노드를 등록
기존 그래프에서 P 주변을 search_list_size 폭으로 탐색
후보를 모으고 이웃 후보 사이의 거리도 비교
prune으로 num_neighbors 안에 들어갈 연결 선택
P의 이웃 목록 저장
기존 이웃에 P로 가는 연결을 추가하고 필요하면 다시 prune`}</CodeBlock>
    <h4>실제 시작 노드는 항상 medoid일까요?</h4>
    <p>앞의 medoid 그림은 원 DiskANN/Vamana를 이해하기 위한 설명입니다. <strong>pgvectorscale 0.9.1의 시작 노드 관리가 항상 전체 데이터의 medoid를 계산하는 것은 아닙니다.</strong> 구현은 처음 필요한 시작 노드를 등록하고, 라벨이 있다면 해당 라벨을 위한 시작 노드도 관리합니다. 질의의 라벨에 따라 탐색에 사용할 시작 노드를 고릅니다.</p>
    <h4>검색 ④ 탐색 상태를 남겨 다음 결과를 공급합니다</h4>
    <p>검색할 때는 후보 큐와 방문한 노드 등의 상태를 보관합니다. PostgreSQL이 다음 행을 요청하면 그 상태를 이용해 그래프 탐색과 후보 공급을 이어 갑니다. 압축 탐색 후보를 원본 거리로 재평가할 때는 <code>query_rescore</code> 크기의 재정렬 버퍼를 활용합니다. 버퍼를 채우고 가까운 후보를 하나 꺼낸 뒤, 다음 요청에서 다시 보충하는 방식입니다.</p>
    <p>이후 일반 <code>WHERE</code> 검사는 PostgreSQL이 수행합니다. 통과한 행이 부족하면 다음 후보를 요청하고, LIMIT을 채우면 더 요청하지 않습니다. 후보가 소진되면 LIMIT을 채우지 못할 수도 있습니다. 원본 거리로 재평가해도 탐색에서 놓친 벡터를 새로 발견하는 것은 아니며, 전체 데이터의 정확한 Top K를 보장하지는 않습니다.</p>
    <details>
      <summary>실제 구현과 연결하기 · pgvectorscale 0.9.1</summary>
      <p><a href="https://github.com/timescale/pgvectorscale/blob/0.9.1/pgvectorscale/src/access_method/build.rs">build.rs</a>의 <code>maybe_train_quantizer</code>와 삽입 처리, <a href="https://github.com/timescale/pgvectorscale/blob/0.9.1/pgvectorscale/src/access_method/graph/mod.rs">graph/mod.rs</a>의 <code>insert</code>·<code>prune_neighbors</code>·<code>update_start_nodes</code>, <a href="https://github.com/timescale/pgvectorscale/blob/0.9.1/pgvectorscale/src/access_method/scan.rs">scan.rs</a>의 <code>next_with_resort</code>·<code>amgettuple</code>에서 이 흐름을 확인할 수 있습니다.</p>
    </details>
  </div>
}
