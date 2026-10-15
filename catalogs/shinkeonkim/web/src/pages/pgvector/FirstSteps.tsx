import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock, K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import { Clotho } from '@/components/viz/Clotho'
import { d, demo } from './stats'
import { Next, Quiz, Summary } from './guide'
import { QUIZ } from './quizzes'

const STEPS: { title: React.ReactNode; body: React.ReactNode }[] = [
  {
    title: <>“환불 받고 싶어요”라고 물으면 “반품 절차 안내” 문서가 나와야 합니다.</>,
    body: <>두 문장에는 겹치는 낱말이 하나도 없습니다. <K>WHERE body LIKE '%환불%'</K>로는 못 찾습니다. 필요한 것은 <strong>글자가 같은 것</strong>이 아니라 <strong>뜻이 비슷한 것</strong>을 찾는 검색입니다.</>,
  },
  {
    title: <>그래서 문장을 숫자 목록으로 바꿉니다. 이것이 <strong>임베딩</strong>입니다.</>,
    body: <>임베딩 모델(OpenAI·Cohere 같은 API나 오픈소스 모델)에 문장을 넣으면 <K>[0.12, -0.03, 0.88, …]</K> 같은 실수 목록이 나옵니다. 목록의 길이를 <strong>차원</strong>이라 하고, 모델에 따라 수백~수천입니다. 모델은 뜻이 비슷한 문장일수록 비슷한 숫자가 나오도록 학습되어 있습니다. 이 숫자 목록을 <strong>벡터</strong>라고 부릅니다.</>,
  },
  {
    title: <>벡터는 공간 위의 <strong>점</strong>입니다. 비슷하다 = <strong>가깝다</strong>.</>,
    body: <>숫자 2개짜리 벡터는 지도 위의 좌표(위도, 경도)와 같습니다. 1,536개짜리도 원리는 같고 머릿속에 그릴 수 없을 뿐입니다. 그래서 “뜻이 비슷한 문서 찾기”는 <strong>“질문의 점에서 가장 가까운 점 찾기”</strong>가 됩니다.</>,
  },
  {
    title: <>SQL로는 <K>ORDER BY 거리 LIMIT 10</K> 한 줄입니다.</>,
    body: <>pgvector가 거리를 계산하는 연산자 <K>{'<->'}</K>를 추가합니다. “거리가 가까운 순으로 정렬해 10개”가 곧 “가장 비슷한 10개”입니다. 문제는 이걸 그냥 실행하면 PostgreSQL이 <strong>모든 행과 거리를 계산한 뒤 정렬</strong>한다는 것입니다. 100만 행이면 질문 하나에 거리 계산 100만 번입니다.</>,
  },
  {
    title: <>평소 쓰던 인덱스(B-tree)로는 해결이 안 됩니다.</>,
    body: <>B-tree는 값을 <strong>미리 한 줄로 정렬</strong>해 두는 “책 뒤 찾아보기”입니다. 그런데 “가까운 순서”는 <strong>질문이 어디 있느냐에 따라 매번 달라집니다</strong>. 서울에서 가까운 순서와 부산에서 가까운 순서가 다른 것처럼요. 미리 정해 둘 하나의 순서가 없습니다.</>,
  },
  {
    title: <>그래서 <strong>“거의 정확하게, 대신 훨씬 빨리”</strong>로 타협합니다. 이것이 <strong>ANN</strong>(근사 최근접 이웃) 인덱스입니다.</>,
    body: <>점들 사이에 길(그래프)을 놓거나(HNSW), 점들을 동네로 나눠 두고(IVFFlat) 질문 근처만 둘러봅니다. 전부 보지 않으니 빠르지만, 가끔 진짜 가장 가까운 점을 <strong>놓칩니다</strong>. 놓친 정도를 재는 점수가 <strong>recall</strong>(10개 중 몇 개가 진짜 정답이었나)입니다.</>,
  },
  {
    title: <>pgvector는 이 전부를 PostgreSQL 안에 넣고, pgvectorscale은 큰 규모용 인덱스를 하나 더합니다.</>,
    body: <>벡터 타입·거리 연산자·ANN 인덱스가 같은 테이블, 같은 트랜잭션, 같은 <K>WHERE</K> 안에 있습니다. 벡터만 따로 담는 전용 DB를 하나 더 운영하지 않아도 됩니다. pgvectorscale은 <strong>DiskANN</strong>이라는 인덱스를 추가해 수천만 행 규모와 “조건이 붙은 검색”을 노립니다. 이 주차는 그 대가(정확도, 빌드 시간, 크기)를 직접 잰 기록입니다.</>,
  },
]

export default function FirstSteps() {
  return <>
    <PageHeader eyebrow="Week 05 · 처음이라면" title="벡터 검색을 일곱 단계로"
      lede="PostgreSQL을 처음 보고, SQL의 SELECT · WHERE · ORDER BY · LIMIT 정도를 안다고 가정합니다. 용어는 나올 때마다 풉니다. 여기까지 읽으면 이 주차의 나머지 페이지는 '그게 실제로 얼마인가'를 재는 이야기입니다." />

    <Summary points={[
      <>임베딩 = 문장을 숫자 목록(벡터)으로 바꾼 것. 뜻이 비슷하면 숫자도 비슷하다.</>,
      <>비슷한 문서 찾기 = 가장 가까운 점 찾기 = <K>ORDER BY embedding {'<->'} 질문 LIMIT k</K>.</>,
      <>그냥 실행하면 모든 행을 계산한다. ANN 인덱스는 일부만 봐서 빠르지만 가끔 놓치고, 놓친 정도가 recall이다.</>,
    ]} />

    <ol className="space-y-4">
      {STEPS.map((s, i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">{i + 1}</span>
          <div className="prose-doc min-w-0 flex-1 text-[14.5px]">
            <p className="mt-0 font-semibold text-foreground">{s.title}</p>
            <p className="mb-0">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>

    <Section id="by-sql" title="2~4단계를 SQL로 — 3차원 벡터 세 개">
      <p>실제 임베딩은 수백 차원이지만 원리는 3차원으로도 똑같습니다. 숫자 세 개짜리 벡터를 저장하는 테이블을 만들고 점 세 개를 넣습니다. <K>vector(3)</K>은 “숫자 3개짜리 벡터” 타입입니다.</p>
      <CodeBlock language="sql">{demo.items}</CodeBlock>
      <p>질문 벡터 <K>[1,2,3]</K>에서 각 점까지의 거리를 재고 가까운 순으로 정렬합니다. 지금은 첫 열 <K>l2</K>(보통 말하는 직선거리)만 보면 됩니다. 나머지 열은 다른 방식으로 잰 거리이고 <Ref to="/pgvector/install#operators">설치와 기본 문법</Ref>에서 설명합니다.</p>
      <CodeBlock language="sql" output={d('distances').output} outputCaption="실제 실행 결과">{d('distances').sql}</CodeBlock>
      <p><K>[1,2,4]</K>는 질문과 한 칸만 달라 거리 1, <K>[4,5,6]</K>은 세 칸 모두 3씩 달라 거리 √27 ≈ 5.196입니다. 여기에 <K>LIMIT 1</K>을 붙이면 “가장 비슷한 1개”가 됩니다.</p>
    </Section>

    <Section id="picture" title="5~6단계를 그림으로">
      <Diagram chart={`flowchart LR
        q(("질문"))
        subgraph exact["정확한 검색"]
          e1["모든 행과 거리 계산"] --> e2["전부 정렬"] --> e3["앞에서 10개<br/>항상 정답"]
        end
        subgraph ann["ANN 인덱스"]
          a1["질문 근처만 둘러봄"] --> a2["후보 몇백 개만 정렬"] --> a3["10개<br/>대부분 정답, 가끔 놓침"]
        end
        q --> e1
        q --> a1
      `} caption="정확한 검색은 행 수만큼 일하고, ANN은 행 수와 거의 상관없이 일정한 양만 일한다. 대신 recall이 1보다 작아질 수 있다." />
      <Clotho id="pgv-exact-vs-ann" />
    </Section>

    <Callout kind="tip" title="이 주차의 질문을 한 줄로">
      <p>“전부 보지 않으면 얼마나 빨라지고, 얼마나 놓치며, 그 대가로 무엇(빌드 시간·저장 공간·설정)을 치르나?” — 모든 페이지가 이 질문의 한 조각에 답합니다.</p>
    </Callout>

    <Quiz items={QUIZ['first']} />

    <Next to="/pgvector/glossary" title="용어 사전" why={'이후 페이지에 나오는 말을 한곳에 모았다. 발표 중 막히면 돌아올 자리다. 바로 따라가려면 설치와 기본 문법으로 가도 된다.'} />
  </>
}
