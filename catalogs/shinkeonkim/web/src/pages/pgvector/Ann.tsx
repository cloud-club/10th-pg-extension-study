import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Clotho } from '@/components/viz/Clotho'
import { d, envTags, fmtNum, recall } from './stats'
import { Deep, Goal, Next, Quiz, Summary } from './guide'
import { QUIZ } from './quizzes'

/** concentration 출력의 마지막 열(가장 가까운 거리 / 가장 먼 거리)을 차원별로 읽는다. */
const nearOverFar = (dims: number) => {
  const row = d('concentration').output.split('\n').find((l) => l.trim().startsWith(`${dims} `))
  return Number(row?.split('|').pop()?.trim() ?? NaN)
}
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`

export default function Ann() {
  return <>
    <PageHeader eyebrow="Week 05 · 심화 · 구현과 실측" title="근사 검색과 recall: '거의 정확하다'를 숫자로"
      lede="ANN 인덱스는 일부만 보고 답하므로 가끔 진짜 정답을 놓친다. 그래서 인덱스를 비교하려면 '얼마나 빠른가'와 함께 '얼마나 놓쳤나'를 재야 한다. 이 페이지는 그 잣대(recall)와, 잣대를 만들다가 실제로 빠졌던 함정 두 가지를 다룬다."
      tags={envTags} />

    <Summary points={[
      <>ANN은 일부만 보고 답한다. 놓친 정도는 recall@10 = (인덱스 결과 ∩ 정답) / 10으로 잰다.</>,
      <>정답은 인덱스를 끄고 전부 계산해서 구한다. 비용은 질의당 읽은 페이지 수(버퍼/질의)로 본다.</>,
      <>잣대가 의미 있으려면 데이터가 의미 있어야 한다 — 데이터를 만든 뒤 반드시 확인한다.</>,
    ]} />

    <Goal
      questions={['“정확한 검색”과 “근사 검색”은 무엇이 다른가?', 'recall@10은 어떻게 계산하나?', '비용은 무엇으로 재나?']}
      assumes={<>EXPLAIN의 <code>Index Scan</code>과 <code>Buffers</code>(<Ref to="/pgvector/install#explain">설치와 기본 문법</Ref>).</>} />

    <EasyFirst>
      <p>도서관에서 “이 책과 비슷한 책 10권”을 찾는다고 하자. 모든 책을 한 권씩 비교하면 정확하지만 오래 걸린다(<strong>정확한 검색</strong>). 서가 분류를 보고 비슷한 칸 몇 개만 훑으면 빠르지만, 다른 칸에 꽂힌 좋은 책을 놓칠 수 있다(<strong>근사 검색, ANN</strong>). 고른 10권 중 진짜 “가장 비슷한 10권”에 든 책이 몇 권인지 센 것이 <strong>recall</strong>이다.</p>
    </EasyFirst>

    <Section id="recall" title="1. recall@10 — 10개 중 몇 개가 진짜였나">
      <Clotho id="pgv-exact-vs-ann" />
      <p>계산은 세 단계다.</p>
      <ol>
        <li><strong>정답 만들기:</strong> 인덱스를 끄고(<code>SET enable_indexscan = off</code>) 모든 행과 거리를 계산해 진짜 가장 가까운 10개를 구한다. 느리지만 확실하다.</li>
        <li><strong>인덱스로 찾기:</strong> 인덱스를 켜고 같은 질문으로 10개를 받는다.</li>
        <li><strong>겹친 개수 세기:</strong> 두 목록에 모두 있는 행이 7개면 recall@10 = 7 / 10 = <strong>0.7</strong>.</li>
      </ol>
      <p>질문 하나로는 운이 섞이므로, 이 주차의 실험은 질문 여러 개의 평균을 낸다(실험 01은 {recall.n_queries}개).</p>
      <table><thead><tr><th>recall@10</th><th>뜻</th></tr></thead><tbody>
        <tr><td>1.0</td><td>정답과 완전히 같은 10개</td></tr>
        <tr><td>0.9</td><td>10개 중 1개는 정답 밖의 행</td></tr>
        <tr><td>0.6</td><td>10개 중 4개가 정답 밖</td></tr>
      </tbody></table>
      <Callout kind="info" title="'정답 밖'은 '틀린 행'이 아니다">
        <p>정답 밖의 행은 대개 11번째, 12번째로 가까운 행이다. 사용자 입장에서는 거의 차이가 없을 수도 있다. 그래서 후보들의 거리가 서로 비슷한 경우에는 <strong>돌려준 행들의 평균 거리</strong>도 함께 본다(<Ref to="/pgvector/filtering-details#quality">필터가 붙은 검색</Ref>에서 쓴다).</p>
      </Callout>
    </Section>

    <Section id="cost" title="2. 비용은 '질의당 읽은 페이지 수'로">
      <p>빠르기는 실행 시간으로도 볼 수 있지만, 시간은 노트북 상태에 따라 흔들린다. 그래서 EXPLAIN의 <code>Buffers</code>(읽은 8KB 페이지 수)를 질문 수로 나눈 <strong>버퍼/질의</strong>를 주 지표로 쓴다. 이 주차의 그래프는 거의 다 “가로축 = 버퍼/질의(비용), 세로축 = recall(정확도)”다. 왼쪽 위로 갈수록 “싸고 정확한” 좋은 지점이다.</p>
    </Section>

    <Section id="pitfalls" title="3. 잣대를 만들다 빠진 함정 두 가지">
      <p>recall은 “정답”이 의미 있어야 의미가 있다. 실험 데이터를 만들면서 이 전제가 두 번 깨졌다. 발표에서는 결론만 말하고 넘어가도 된다.</p>
      <ul>
        <li><strong>무작위 데이터에는 '가장 가까운 것'이 사실상 없다.</strong> 128차원 무작위 점들은 서로 거의 같은 거리에 있다. 그래서 진짜 가까운 점을 일부러 섞어 넣었다.</li>
        <li><strong>행마다 다르게 만든 줄 알았던 무작위 벡터가 전부 같았다.</strong> SQL 서브쿼리가 한 번만 계산됐기 때문이다. 이 실수는 한 번 더 반복되어 결론 하나를 틀리게 만들었다.</li>
      </ul>
      <div id="concentration" />
      <Deep title="함정 ① 128차원 무작위 점은 모두 비슷하게 멀다 (거리 집중)">
        <p>처음 실험 01은 128차원 무작위 벡터 {fmtNum(recall.n_vectors - 1000)}개로 recall을 쟀는데, 결과가 엔진별로 정확히 0.0 또는 1.0으로 너무 깔끔했다. 한 점에서 다른 모든 점까지의 거리를 직접 재 보면 이유가 보인다.</p>
        <CodeBlock language="sql" output={d('concentration').output} outputCaption="점 2,000개 · 실제 실행 결과">{d('concentration').sql}</CodeBlock>
        <p>2차원에서는 가장 가까운 점이 가장 먼 점의 {pct(nearOverFar(2))} 거리지만, 128차원에서는 <strong>{pct(nearOverFar(128))}</strong>다. 모든 점이 거의 같은 거리에 있어서 “가장 가까운 10개”가 우연에 좌우된다. 이것을 고차원의 <strong>거리 집중</strong>이라 한다.</p>
        <p>그래서 배경은 무작위로 두되, 질문마다 “진짜 가까운 점” 20개(질문 + 칸마다 ±0.5 흔들기)를 섞어 넣었다. 정답은 여전히 전체 계산으로 구한다. 실제 임베딩은 뜻에 따라 무리를 이루므로 완전한 무작위보다 이쪽에 가깝다.</p>
      </Deep>
      <div id="initplan" />
      <Deep title="함정 ② 서브쿼리가 한 번만 계산돼 모든 행이 같은 벡터가 됐다 (InitPlan)">
        <p>행마다 서브쿼리로 무작위 배열을 만들었는데, 결과가 전부 같은 벡터였다.</p>
        <CodeBlock language="sql" output={d('initplan_wrong').output} outputCaption="2,000행 · 실제 실행 결과">{d('initplan_wrong').sql}</CodeBlock>
        <CodeBlock language="sql" output={d('initplan_plan').output} outputCaption="InitPlan = 한 번만 계산 · 실제 실행 결과">{d('initplan_plan').sql}</CodeBlock>
        <p>서브쿼리가 바깥 행(<code>v</code>)을 전혀 참조하지 않으니, PostgreSQL은 “행마다 다시 계산할 필요가 없는 상수”로 보고 <strong>InitPlan</strong>으로 한 번만 계산해 재사용한다. 안에 <code>random()</code>이 있어도 마찬가지다. 행 × 칸을 실제로 곱해(cross join) 묶으면 칸마다 다시 계산된다.</p>
        <CodeBlock language="sql">{`SELECT v AS id, array_agg(random() ORDER BY d)::vector AS e
FROM generate_series(1, 2000) v, generate_series(1, 128) d
GROUP BY v;`}</CodeBlock>
        <CodeBlock language="sql" output={d('initplan_right').output} outputCaption="cross join + GROUP BY · 실제 실행 결과">{d('initplan_right').sql}</CodeBlock>
        <Callout kind="warn" title="이 함정은 한 번 더 밟았다">
          <p>실험 01에서 이 버그를 기록해 두고도, 실험 07의 라벨 데이터에서 <strong>같은 패턴을 다시 썼다</strong>. 5만 행 중 서로 다른 벡터가 10개뿐이었고, 그 때문에 잘못된 결론이 나왔다(<Ref to="/pgvector/filtering-details#first-edition">필터가 붙은 검색 · 첫 판의 실수</Ref>). 지금은 데이터를 만든 직후 <code>count(DISTINCT embedding)</code>을 확인한다.</p>
        </Callout>
      </Deep>
    </Section>

    <Quiz items={QUIZ['ann']} />

    <Next to="/pgvector/ivfflat" title="IVFFlat" why={'잣대가 생겼으니, “일부만 보는” 방법 중 원리가 더 단순한 쪽부터 본다.'} />
  </>
}
