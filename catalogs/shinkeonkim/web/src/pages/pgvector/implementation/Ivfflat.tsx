import { CodeBlock } from '@/components/common/Code'

export default function IvfflatImplementation() {
  return <div id="implementation" className="mt-8 scroll-mt-20">
    <h3>구현을 따라가기: 학습한 중심과 실제 벡터 목록을 따로 저장합니다</h3>
    <p>IVFFlat 인덱스에는 크게 두 종류의 정보가 필요합니다. 하나는 각 동네의 <strong>대표 중심</strong>, 다른 하나는 그 동네에 배정된 <strong>벡터와 원래 테이블 행의 위치</strong>입니다. 중심은 어느 동네를 열지 고르는 데 쓰고, 동네 안에서는 개별 벡터로 거리를 계산합니다.</p>
    <h4>만들기 ① 표본으로 중심을 찾습니다</h4>
    <p>pgvector는 먼저 테이블에서 벡터 표본을 뽑습니다. 모든 행으로 매번 학습하는 대신, 이 표본에서 k-means를 수행합니다. 이해를 위한 L2 예시로는 “가장 가까운 중심에 점 배정 → 배정된 점들의 평균으로 중심 이동”을 반복해 동네를 정합니다. 다른 거리 종류에서는 중심 학습에 사용하는 거리·정규화도 달라질 수 있습니다.</p>
    <h4>만들기 ② 전체 행을 동네에 배치합니다</h4>
    <p>중심이 정해지면 전체 테이블을 읽어 각 벡터를 가장 가까운 중심의 목록에 넣습니다. 인덱스에는 압축하지 않은 해당 벡터 표현과 테이블 행의 위치인 <code>TID</code>를 저장합니다. 따라서 목록은 단순한 ID 모음이 아니라, 그 안의 벡터로 거리를 계산할 수 있는 인덱스 페이지들의 묶음입니다.</p>
    <CodeBlock language="text" caption="동작을 단순화한 의사 코드 · 실제 C 코드를 그대로 옮긴 것은 아닙니다">{`표본 = 테이블에서 벡터를 뽑기
중심들 = 표본으로 k-means 수행(lists개)

각 테이블 행에 대해:
    목록 = 벡터와 가장 가까운 중심 찾기
    목록에 (벡터, 테이블 행 위치) 저장`}</CodeBlock>
    <h4>검색 ③ 중심을 고르고, 선택한 목록 안을 비교합니다</h4>
    <p>질의가 들어오면 각 중심과 질의의 거리를 비교해 가까운 목록을 고릅니다. 그중 <code>probes</code>개 목록의 인덱스 페이지를 읽고, 그 안에 저장된 벡터와 질의의 거리를 계산합니다. 계산한 거리와 TID를 정렬해 PostgreSQL에 후보 행의 위치를 넘깁니다. PostgreSQL은 해당 행의 가시성과 <code>WHERE</code> 조건을 확인합니다.</p>
    <CodeBlock language="text" caption="일반적인 첫 탐색 배치의 흐름">{`가까운 목록들 = 질의와 중심들의 거리로 선택
후보 = []
가까운 목록 probes개에 대해:
    목록 안의 각 벡터에 대해:
        후보에 (질의와의 거리, TID) 추가
후보를 거리순으로 정렬해 행 위치를 공급
PostgreSQL이 행을 확인하고 WHERE와 LIMIT을 적용`}</CodeBlock>
    <p><strong>근사인 이유는 거리 계산을 대충 해서가 아니라 일부 목록만 열기 때문</strong>입니다. 열지 않은 동네에 더 가까운 벡터가 있으면 놓칩니다. 선택한 목록 안에서 정확히 비교해도 전체 데이터의 정답을 모두 찾았다는 뜻은 아닙니다.</p>
    <h4>추가된 행은 어떻게 처리할까요?</h4>
    <p>새 행도 기존 중심과 비교해 가장 가까운 목록에 넣습니다. 삽입할 때마다 중심을 다시 학습하지는 않습니다. 데이터 분포가 크게 달라졌다면 기존 중심이 새 데이터를 잘 나누지 못할 수 있으므로 재빌드를 검토합니다. 필터를 통과한 결과가 부족하면 iterative scan으로 다음 목록들을 탐색할 수 있지만 <code>max_probes</code> 등의 제한 안에서 동작합니다.</p>
    <details>
      <summary>실제 구현과 연결하기 · pgvector v0.8.0</summary>
      <p><a href="https://github.com/pgvector/pgvector/blob/v0.8.0/src/ivfbuild.c">ivfbuild.c</a>의 <code>ComputeCenters</code>는 표본과 k-means, <code>AddTupleToSort</code>는 목록 배정을 담당합니다. <a href="https://github.com/pgvector/pgvector/blob/v0.8.0/src/ivfscan.c">ivfscan.c</a>의 <code>GetScanLists</code>는 중심 비교, <code>GetScanItems</code>는 목록의 벡터 비교와 정렬을 담당합니다.</p>
    </details>
  </div>
}
