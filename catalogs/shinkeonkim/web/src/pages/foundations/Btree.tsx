import { Link } from 'react-router-dom'
import { CodeBlock, K } from '@/components/common/Code'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'

const RANGE: [React.ReactNode, boolean, React.ReactNode][] = [
  [<K key="1">doc = '클럽하우스'</K>, true, '점 하나'],
  [<K key="2">doc {'<'} '클럽'</K>, true, '왼쪽 열린 구간'],
  [<K key="3">doc BETWEEN 'a' AND 'b'</K>, true, '닫힌 구간'],
  [<K key="4">doc LIKE '클럽%'</K>, true, <><K>'클럽' ≤ doc {'<'} '클렄'</K> 로 다시 쓸 수 있다</>],
  [<K key="5">doc LIKE '%클럽%'</K>, false, '다시 쓸 수 없다'],
  [<K key="6">doc LIKE '%클럽'</K>, false, '끝이 정렬 순서를 결정하지 않는다'],
]

export default function Btree() {
  return (
    <>
      <PageHeader
        eyebrow="기초 개념"
        title="B-tree 는 왜 %검색어% 를 못 푸나"
        lede="확장 이야기를 꺼내기 전에, B-tree 가 답할 수 있는 질문의 모양부터 본다. 못 하는 게 아니라 답할 수 있는 질문의 모양이 다르다."
      />

      <EasyFirst>
        <p>
          책 뒤 <strong>찾아보기는 가나다순</strong>입니다. “<K>클럽</K> 으로 <strong>시작</strong>하는 것”은 한 덩어리로
          모여 있어 금방 찾지만, “<K>클럽</K> 이 <strong>들어간</strong> 것”은 <K>강남클럽</K>(ㄱ)·<K>클럽하우스</K>(ㅋ)·
          <K>한국클럽</K>(ㅎ) 처럼 <strong>어디에나 흩어져</strong> 있어 어디서 시작할지 정할 수가 없습니다.
          데이터베이스의 기본 인덱스가 정확히 이 상태입니다.
        </p>
      </EasyFirst>

      <Section id="stores" title="1. B-tree 가 저장하는 것">
        <p>B-tree 인덱스는 <strong>컬럼 값 전체를 키로 삼아 정렬해서</strong> 담는다.</p>
        <CodeBlock>{`          ┌──────────────┐
          │   "클라..."   │            내부 노드는 '구분자'만 갖는다
          └──────┬───────┘
     ┌───────────┴───────────┐
┌────▼─────┐           ┌─────▼────┐
│ 강남클럽  │           │ 클럽하우스 │   리프에 (키, TID) 가 사전순으로 늘어선다
│ 개발자모임│           │ 한국클럽   │
│ 클라우드..│           │           │
└──────────┘           └──────────┘`}</CodeBlock>
        <p>여기서 <strong>두 가지 성질</strong>이 나온다.</p>
        <ol>
          <li><strong>키가 정렬돼 있다</strong> → 어떤 키보다 크거나 같은 첫 위치를 <K>O(log n)</K> 에 찾는다.</li>
          <li><strong>리프가 정렬 순서로 연결돼 있다</strong> → 그 위치부터 옆으로 훑으면 <strong>연속 구간</strong>을 전부 읽는다.</li>
        </ol>
        <p>
          <strong>B-tree 가 빠르게 답할 수 있는 질문은 이 두 성질로 표현되는 것뿐이다</strong> — 즉{' '}
          <strong>정렬 순서 위의 한 구간</strong>으로 옮겨 쓸 수 있는 조건.
        </p>
        <Table>
          <THead><TR><TH>조건</TH><TH>구간으로 되나</TH><TH>왜</TH></TR></THead>
          <TBody>
            {RANGE.map(([cond, ok, why], i) => (
              <TR key={i}>
                <TD>{cond}</TD>
                <TD className={ok ? 'text-ok' : 'text-trgm'}>{ok ? '✅' : '❌'}</TD>
                <TD>{why}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="why" title="2. 접두어는 왜 되고 부분 문자열은 왜 안 되나">
        <p>
          <strong>접두어가 되는 이유</strong>는, 사전순 정렬에서 “<K>클럽</K> 으로 시작하는 문자열”이 정확히
          한 덩어리이기 때문이다.
        </p>
        <CodeBlock>{`...
클라우드클럽      ← '클라' < '클럽'
클럽              ┐
클럽하우스         │ '클럽' 으로 시작하는 것들이
클럽활동           ┘ 여기 몰려 있다
클렄              ← 경계 (마지막 글자 +1)
클릭
...`}</CodeBlock>
        <p>그래서 플래너는 <K>LIKE '클럽%'</K> 을 내부적으로 <K>doc {'>='} '클럽' AND doc {'<'} '클렄'</K> 로 바꾼다.</p>

        <Callout kind="warn" title="콜레이션이 C 가 아니면 이 변환이 성립하지 않는다">
          <p>
            한국어 로케일 DB 에서 접두어 <K>LIKE</K> 로 B-tree 를 타려면 <K>text_pattern_ops</K> 연산자 클래스로
            인덱스를 만들어야 한다.
          </p>
          <CodeBlock>{`CREATE INDEX ON docs (doc text_pattern_ops);`}</CodeBlock>
        </Callout>

        <p><strong>부분 문자열이 안 되는 이유</strong>는 그 반대다. <K>클럽</K> 을 <strong>포함</strong>하는 문자열은 정렬 순서 어디에나 있다.</p>
        <CodeBlock>{`강남클럽          ← 'ㄱ' 구간
...
클라우드클럽      ← 'ㅋ' 구간
클럽하우스
...
한국클럽          ← 'ㅎ' 구간`}</CodeBlock>
        <p>
          <strong>시작점도 끝점도 정할 수 없다.</strong> 정렬은 문자열의 <em>앞</em> 을 기준으로만 이루어지는데,
          조건은 문자열의 <em>가운데</em> 를 말하고 있다. 인덱스가 있어도 전부 훑어야 하므로 플래너는 아예
          인덱스를 쓰지 않고 <K>Seq Scan</K> 을 고른다.
        </p>
        <Clotho id="btree-vs-inverted" caption="정렬 순서 위의 연속 구간이 되는 조건과 안 되는 조건, 그리고 저장 단위를 바꿨을 때 무엇이 달라지는지." />
      </Section>

      <Section id="flip" title="3. 그래서 문제를 뒤집는다">
        <p>해법은 <strong>“저장하는 단위”를 바꾸는 것</strong>이다.</p>
        <Table>
          <THead><TR><TH></TH><TH>B-tree</TH><TH>역인덱스 (GIN)</TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">키</TD><TD>행의 <strong>값 전체</strong></TD><TD>값을 쪼갠 <strong>조각</strong></TD></TR>
            <TR><TD className="text-muted-foreground">행 하나가 만드는 키</TD><TD><strong>1개</strong></TD><TD><strong>여러 개</strong></TD></TR>
            <TR><TD className="text-muted-foreground">값</TD><TD>그 행의 TID 하나</TD><TD>그 조각을 가진 행들의 <strong>TID 목록</strong></TD></TR>
          </TBody>
        </Table>
        <CodeBlock>{`B-tree                          역인덱스
"클라우드클럽" → 행 3           "␣클" → 행 1, 3, 4, 5
"클럽하우스"   → 행 4           "클럽" → 행 1, 3, 4, 5
"한국클럽"     → 행 5           "럽하" → 행 4
                                "클라" → 행 3`}</CodeBlock>
        <p>이렇게 두면 <K>LIKE '%클럽%'</K> 이 <strong>집합 연산</strong>이 된다.</p>
        <CodeBlock>{`'클럽' 을 조각으로 분해  →  ␣클, 클럽, 럽␣
각 조각의 행 목록을 꺼내  →  {1,3,4,5}, {1,3,4,5}, {1,4,5}
교집합                    →  {1,4,5}   ← 후보`}</CodeBlock>
        <Callout kind="tip" title="역인덱스 안쪽도 B-tree 다">
          <p>
            GIN 의 <strong>엔트리 트리</strong>가 바로 조각을 정렬해 담는 B-tree 다. B-tree 를 버린 게 아니라,
            B-tree 에 넣는 <em>키</em> 를 바꾼 것이다 — <Link to="/foundations/gin">GIN 인덱스</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="cost" title="4. 대가">
        <Table>
          <THead><TR><TH>대가</TH><TH>무슨 일이 생기나</TH><TH>어디서 다루나</TH></TR></THead>
          <TBody>
            <TR>
              <TD><strong>결과가 정확하지 않다</strong></TD>
              <TD>조각을 다 가져도 순서가 다를 수 있다 (<K>trial</K> vs <K>trivial</K>)</TD>
              <TD><Link to="/foundations/recheck">Recheck 과 lossy</Link></TD>
            </TR>
            <TR>
              <TD><strong>조각을 못 만들 수 있다</strong></TD>
              <TD>검색어가 <K>n</K> 보다 짧으면 조건이 0개다</TD>
              <TD><Link to="/pg-trgm/two-char">2글자 함정</Link></TD>
            </TR>
            <TR>
              <TD><strong>쓰기가 비싸다</strong></TD>
              <TD>행 하나가 키 수십 개를 만든다</TD>
              <TD><Link to="/experiments/build-write">쓰기 비용</Link></TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section id="alternatives" title="5. 다른 선택지는 없었나">
        <p>부분 문자열 검색을 인덱스로 푸는 방법이 n-gram 만은 아니다. 왜 PostgreSQL 에서 n-gram 이 답이 되었는지도 같이 알아두면 좋다.</p>
        <Table>
          <THead><TR><TH>방법</TH><TH>원리</TH><TH>PostgreSQL 에서</TH></TR></THead>
          <TBody>
            <TR>
              <TD><strong>역방향 인덱스</strong></TD>
              <TD><K>reverse(doc)</K> 에 B-tree → <K>%클럽</K>(접미어) 이 접두어가 된다</TD>
              <TD><strong>된다.</strong> <K>CREATE INDEX ON docs (reverse(doc) text_pattern_ops)</K> — 다만 접미어만</TD>
            </TR>
            <TR>
              <TD><strong>접미사 트리 / 배열</strong></TD>
              <TD>모든 접미사를 정렬해 담으면 부분 문자열이 접두어가 된다</TD>
              <TD>내장 구현이 없다. 색인이 원문의 수 배로 커진다</TD>
            </TR>
            <TR>
              <TD><strong>n-gram 역인덱스</strong></TD>
              <TD>고정 길이 조각으로 쪼개 역인덱스</TD>
              <TD><K>pg_bigm</K> / <K>pg_trgm</K> — 이 카탈로그의 주제</TD>
            </TR>
            <TR>
              <TD><strong>전문검색</strong></TD>
              <TD>어휘 단위로 쪼개 역인덱스</TD>
              <TD><K>tsvector</K>(코어). 단, 부분 문자열이 아니라 <em>단어</em> 를 찾는다</TD>
            </TR>
            <TR>
              <TD><strong>외부 검색엔진</strong></TD>
              <TD>별도 시스템</TD>
              <TD>Elasticsearch 등. 동기화 비용이 새 문제로 온다</TD>
            </TR>
          </TBody>
          <TCaption>
            <K>reverse()</K> + <K>text_pattern_ops</K> 는 의외로 실용적이다 — 접미어 검색만 필요하다면 확장 없이
            B-tree 로 끝난다. 다만 <K>%클럽%</K> 은 여전히 못 푼다.
          </TCaption>
        </Table>
      </Section>
    </>
  )
}
