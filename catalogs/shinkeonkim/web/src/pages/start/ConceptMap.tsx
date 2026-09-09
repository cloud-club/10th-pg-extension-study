import { Link } from 'react-router-dom'
import { K } from '@/components/common/Code'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

type Node = { depth: number; label: React.ReactNode; to?: string; note?: string }

/** "LIKE '%x%' 를 빠르게 하고 싶다" 가 어떻게 각 페이지로 갈라지는지. */
const TREE: Node[] = [
  { depth: 0, label: <>LIKE '%x%' 를 빠르게 하고 싶다</> },
  { depth: 1, label: '왜 B-tree 로는 안 되나', to: '/foundations/btree', note: '정렬 순서 · 연속 구간 · text_pattern_ops' },
  { depth: 1, label: '그럼 무엇으로', to: '/foundations/btree', note: '역인덱스 (+ reverse(), 접미사 트리, 전문검색)' },
  { depth: 2, label: '그 역인덱스의 실제 구현', to: '/foundations/gin', note: 'GIN — 엔트리 트리 / 포스팅 / 펜딩 리스트' },
  { depth: 3, label: '왜 결과가 부정확한가', to: '/foundations/recheck', note: 'Recheck / lossy / GIN_SEARCH_MODE_ALL' },
  { depth: 2, label: '무엇을 조각으로 넣나' },
  { depth: 3, label: '문자 n-gram', to: '/foundations/ngram', note: '패딩 / n 의 트레이드오프 / 조각 통계' },
  { depth: 3, label: '어휘소', to: '/fulltext/tsvector', note: 'tsvector / 파서·사전 / 한국어 재현율' },
  { depth: 1, label: '한국어에서는 어떤 선택이 맞나', to: '/pg-bigm/korean', note: '알파벳 크기 / 검색어 길이 / 유사도 / 임계값' },
]

const NEIGHBOURS: { concept: React.ReactNode; why: React.ReactNode; where: React.ReactNode }[] = [
  {
    concept: <K>EXPLAIN (ANALYZE, BUFFERS)</K>,
    why: '이 카탈로그의 주 지표가 전부 여기서 나온다',
    where: <Link to="/meta/method">측정 원칙</Link>,
  },
  {
    concept: <><strong>Bitmap Heap Scan</strong> 과 <K>Index Scan</K> 의 차이</>,
    why: 'GIN 은 항상 비트맵 경로다 (정렬된 결과를 못 돌려주므로)',
    where: <Link to="/foundations/gin">GIN 인덱스</Link>,
  },
  {
    concept: <><strong>TID</strong>(<K>ctid</K>)</>,
    why: '포스팅 리스트에 들어가는 것이 이것이다',
    where: <Link to="/foundations/gin">GIN 인덱스</Link>,
  },
  {
    concept: <strong>선택도(selectivity)</strong>,
    why: '“인덱스가 이득인가”를 가르는 축',
    where: <Link to="/experiments/length-selectivity">실험 01</Link>,
  },
  {
    concept: <strong>연산자 클래스 / 연산자 패밀리</strong>,
    why: '확장이 인덱스에 끼어드는 지점이 여기다',
    where: <Link to="/pg-bigm/operators">연산자 커버리지</Link>,
  },
  {
    concept: <><K>work_mem</K> vs <K>maintenance_work_mem</K></>,
    why: '앞은 lossy 비트맵, 뒤는 인덱스 빌드 속도를 좌우한다',
    where: <Link to="/foundations/recheck">Recheck 과 lossy</Link>,
  },
  {
    concept: <strong>PGXS 빌드</strong>,
    why: <><K>pg_bigm</K> 은 contrib 이 아니라 소스를 직접 빌드해야 한다</>,
    where: <Link to="/meta/environment">환경과 이미지</Link>,
  },
  {
    concept: <>콜레이션과 <K>C</K> 로케일</>,
    why: '접두어 LIKE 가 B-tree 를 타느냐를 정한다',
    where: <Link to="/foundations/btree">B-tree 는 왜 못 하나</Link>,
  },
  {
    concept: <strong>지프 법칙(어휘 분포의 편향)</strong>,
    why: <>A<sup>n</sup> 으로 비용을 추정하면 왜 안 되는지의 근거</>,
    where: <Link to="/foundations/ngram">n-gram 이란</Link>,
  },
]

export default function ConceptMap() {
  return (
    <>
      <PageHeader
        eyebrow="개념 지도"
        title="어떤 순서로 읽을까"
        lede="위에서 아래로 따라가면 “LIKE '%x%' 를 빠르게 하고 싶다”가 어떻게 각 페이지로 갈라지는지 보인다."
      />

      <Section title="한 장으로 본 갈래">
        <ul className="not-prose space-y-1.5">
          {TREE.map((n, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md py-1"
              style={{ paddingLeft: `${n.depth * 1.4}rem` }}
            >
              {n.depth > 0 && <span className="text-muted-foreground/50">└</span>}
              {n.to ? (
                <Link to={n.to} className="text-[14px] font-medium text-primary underline-offset-4 hover:underline">
                  {n.label}
                </Link>
              ) : (
                <span className="text-[14px] font-semibold">{n.label}</span>
              )}
              {n.note && <span className="text-[12.5px] text-muted-foreground">{n.note}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="곁들여 알아야 하는 개념들">
        <p>이 카탈로그를 읽는 데 필요한 배경. 몰라도 읽히지만, 알면 숫자가 다르게 보인다.</p>
        <Table>
          <THead><TR><TH>개념</TH><TH>왜 필요한가</TH><TH>어디서</TH></TR></THead>
          <TBody>
            {NEIGHBOURS.map((r, i) => (
              <TR key={i}><TD>{r.concept}</TD><TD>{r.why}</TD><TD>{r.where}</TD></TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="세 갈래 읽기 경로">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              tone: 'border-ok/30 bg-ok/[0.06]', head: '🟢 당장 뭘 쓸지만 정하면 된다',
              items: [
                <Link key="a" to="/start/overview">개요의 “결론부터” 표</Link>,
                <Link key="b" to="/pg-bigm/korean">한국어에서 유리한 이유</Link>,
                <>끝. 실무 결정에 필요한 건 여기까지다.</>,
              ],
            },
            {
              tone: 'border-warn/30 bg-warn/[0.06]', head: '🟡 왜 그런지 이해하고 싶다',
              items: [
                <Link key="a" to="/foundations/ngram">n-gram — 조각을 어떻게 만드나</Link>,
                <Link key="b" to="/foundations/btree">B-tree 는 왜 못 하나</Link>,
                <Link key="c" to="/foundations/recheck">왜 답이 부정확할 수 있나</Link>,
                <Link key="d" to="/fulltext/tsvector">“단어 단위” 방식과의 차이</Link>,
              ],
            },
            {
              tone: 'border-trgm/30 bg-trgm/[0.06]', head: '🔴 내부 구현까지 보고 싶다',
              items: [
                <Link key="a" to="/foundations/gin">GIN — 찾아보기의 실제 자료구조</Link>,
                <Link key="b" to="/foundations/ngram">Aⁿ 추론 검증 · 패딩 비대칭</Link>,
                <Link key="c" to="/pg-trgm/gist">GiST siglen 과 서명 포화</Link>,
                <Link key="d" to="/experiments/versions">버전 매트릭스</Link>,
              ],
            },
          ].map((p) => (
            <div key={p.head} className={`rounded-xl border p-4 ${p.tone}`}>
              <p className="text-[13.5px] font-semibold">{p.head}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                {p.items.map((it, i) => <li key={i}>{it}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
