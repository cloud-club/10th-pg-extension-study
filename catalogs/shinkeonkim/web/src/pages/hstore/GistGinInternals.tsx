import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import src from '@/data/hstore-source.json'
import { exp, fmtBytes, fmtMs, fmtNum, ratio } from './stats'

type Key = keyof typeof src.excerpts

function Excerpt({ id }: { id: Key }) {
  const e = src.excerpts[id]
  return <CodeBlock language="c" caption={<>
    <code>{e.file}</code> {e.start}~{e.end}행 · {e.note} · <a className="text-primary underline-offset-4 hover:underline" href={e.url} target="_blank" rel="noreferrer">GitHub에서 보기</a>
  </>}>{e.code}</CodeBlock>
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a className="text-primary underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">{children}</a>

const cfg = exp.index.configs

export default function GistGinInternals() {
  return <>
    <PageHeader eyebrow="Week 04 · 인덱스 내부" title="GiST와 GIN은 애초에 다른 걸 저장한다"
      lede="hstore는 GIN과 GiST 둘 다로 색인할 수 있는데 jsonb는 GIN만 된다. 그 차이는 체크박스 하나가 아니라, 두 인덱스가 '무엇을 저장하는가' 자체가 다르기 때문이다. hstore가 실제로 구현한 지원 함수(hstore_gist.c·hstore_gin.c)를 근거로 GiST·GIN의 구조를 뜯어본다."
      tags={[{ label: 'PostgreSQL 16 공식 문서' }, { label: 'contrib/hstore 실제 구현' }, { label: '실험 03 수치로 검증' }]} />

    <Section id="framework" title="1. '인덱스 종류'가 아니라 '확장 가능한 프레임워크'">
      <p>btree·hash는 서버 안에 비교 방식이 고정돼 있다. 반면 공식 문서는 GiST를 이렇게 정의한다:</p>
      <Callout kind="info" title="GiST 공식 정의">
        <p>“GiST stands for Generalized Search Tree. It is a balanced, tree-structured access method, that acts as <strong>a base template in which to implement arbitrary indexing schemes</strong>.” — <A href="https://www.postgresql.org/docs/16/gist-intro.html">PostgreSQL 16 문서 · GiST Indexes</A></p>
      </Callout>
      <p>GIN도 마찬가지다: “GIN is generalized in the sense that <strong>the GIN access method code does not need to know the specific operations that it accelerates</strong>. Instead, it uses custom strategies defined for particular data types.” (<A href="https://www.postgresql.org/docs/16/gin-intro.html">GIN Indexes</A>)</p>
      <p>즉 GiST·GIN 코어는 트리 순회·페이지 분할·동시성 제어 같은 <strong>기계 부분만</strong> 맡는다. “이 타입에서 무엇을 어떻게 비교·압축·분할할지”는 연산자 클래스(opclass)가 정해진 이름의 함수들 — <strong>지원 함수(support function)</strong> — 로 채워 넣는다. hstore는 이 지원 함수를 GIN용(<code>hstore_gin.c</code>)과 GiST용(<code>hstore_gist.c</code>) 두 벌 다 구현해 뒀다 (<Ref to="/hstore/source#gin">소스 지도</Ref>).</p>
      <table><thead><tr><th></th><th>필수 지원 함수</th><th>역할</th></tr></thead><tbody>
        <tr><td><strong>GiST</strong></td><td><code>consistent</code> · <code>union</code> · <code>penalty</code> · <code>picksplit</code> · <code>same</code></td><td>질의와 겹치는지 판단 · 자식들을 대표하는 값 만들기 · 어디에 넣을지 · 노드가 꽉 찼을 때 어떻게 둘로 나눌지 · 같은지 비교</td></tr>
        <tr><td><strong>GIN</strong></td><td><code>extractValue</code> · <code>extractQuery</code> · <code>consistent</code>/<code>triConsistent</code> · <code>compare</code></td><td>값에서 키 뽑기 · 질의에서 키 뽑기 · 후보가 진짜 일치하는지 · 키 정렬 순서</td></tr>
      </tbody></table>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">근거: <A href="https://www.postgresql.org/docs/16/gist-extensibility.html">GiST Extensibility</A> · <A href="https://www.postgresql.org/docs/16/gin-extensibility.html">GIN Extensibility</A></p>
    </Section>

    <Section id="gist" title="2. GiST: 겹칠 수 있는 '경계 술어'의 트리">
      <p>GiST는 R-tree를 일반화한 구조다. 내부 노드마다 <strong>그 아래 모든 자식을 포함하는 술어(predicate) 하나</strong>를 저장한다 — B-tree처럼 “이 범위 안”이 아니라 “이 조건을 만족할 수도 있는 것들”이다. 그래서 형제 노드끼리 겹칠 수 있다.</p>
      <Diagram chart={`flowchart TD
        root["루트<br/>술어 = union(A, B)"]
        root --> A["내부 노드 A<br/>술어 = union(리프1, 리프2)"]
        root --> B["내부 노드 B<br/>술어 = union(리프3, 리프4)"]
        A --> L1["리프: 서명 0010 1101 …<br/>(행 1의 비트 서명)"]
        A --> L2["리프: 서명 0010 1111 …<br/>(행 2의 비트 서명)"]
        B --> L3["리프: 서명 1001 0100 …<br/>(행 3의 비트 서명)"]
        B --> L4["리프: 서명 1001 1100 …<br/>(행 4의 비트 서명)"]
      `} caption="내부 노드의 술어는 union 함수가 자식들을 합쳐 만든다. hstore GiST에서 술어는 siglen바이트 비트 서명이고, union은 그 비트들을 OR로 합친 것이다(아래)." />
      <p>탐색은 루트에서 시작해 <code>consistent</code> 함수로 “이 노드 아래에 답이 있을 수 있는가”를 위에서 아래로 확인한다. 손실 압축을 허용하는 게 GiST의 핵심 특징이다 — 공식 문서: “When the result is true, a recheck flag must also be returned … This convention allows GiST to support <strong>both lossless and lossy index structures</strong>.” hstore GiST는 <code>compress</code> 단계에서 키·값을 각각 crc32로 해시해 서명 비트를 켠다:</p>
      <Excerpt id="gist_compress" />
      <p>서로 다른 키·값이라도 같은 비트에 해시될 수 있다(해시 충돌) — 이게 손실의 원인이다. 실제로 hstore GiST의 <code>consistent</code>는 <strong>진입하자마자 무조건 손실로 취급한다</strong>:</p>
      <Excerpt id="gist_consistent" />
      <p>주석이 그대로 밝히듯 “All cases served by this function are inexact” — GIN의 <code>?</code>(키 존재)는 recheck가 없지만(<Ref to="/hstore/source#gin">gin_consistent_hstore</Ref>), GiST에서는 <code>?</code>를 포함해 <strong>모든 전략이 recheck 대상</strong>이다. 인덱스가 힘들게 후보를 걸러도, 마지막 확인은 항상 힙에서 한 번 더 해야 한다는 뜻이다 — <Ref to="/foundations/recheck#lossy">Recheck과 lossy · 5절</Ref>이 구분하는 두 원인 중 “인덱스가 애초에 손실 인덱스”인 경우가 hstore GiST 전체다.</p>
      <p>새 항목을 어디에 넣을지는 <code>penalty</code>(삽입 비용)와 <code>picksplit</code>(페이지가 꽉 찼을 때 분할 방법)이 정한다. 공식 문서: “Designing suitable penalty and picksplit implementations is where <strong>the challenge of implementing well-performing GiST indexes</strong> lies.” hstore는 둘 다 <strong>해밍 거리(비트가 다른 개수)</strong>로 구현했다:</p>
      <Excerpt id="gist_union" />
      <Excerpt id="gist_penalty" />
      <p><code>ghstore_penalty</code>는 기존 노드 서명과 새 항목 서명의 해밍 거리를 비용으로 쓴다 — 비트가 많이 달라지는 쪽일수록 비용이 크다고 보고, 삽입은 비용이 가장 작은 가지를 따라간다. <code>ghstore_picksplit</code>은 노드가 꽉 찼을 때 해밍 거리가 가장 먼 두 항목을 “시드”로 고르고, 나머지를 더 가까운 시드 쪽에 나눠 붙인다. 목적은 같다 — 트리가 한쪽으로 쏠리지 않게 하는 것.</p>
      <Callout kind="warn" title="서명이 짧을수록, 혹은 값이 다양할수록 서명이 '포화'한다">
        <p><code>union</code>은 자식 서명들을 계속 OR로 합친다 — 합칠수록 켜진 비트만 늘어나고 절대 줄지 않는다. 한 노드 아래에 서로 다른 값이 많이 모이면 결국 <strong>모든 비트가 켜진 서명(<code>ALLISTRUE</code>)</strong>이 되는데, <code>ghstore_consistent</code>는 <code>ISALLTRUE(entry)</code>면 묻지도 않고 <code>true</code>를 돌려준다(위 코드 15행) — 그 노드 아래로는 <strong>어떤 질의도 걸러내지 못하고 전부 후보</strong>가 된다는 뜻이다. siglen이 짧을수록, 값의 종류가 많을수록 이 포화가 빨리 온다 — <Ref to="/hstore/indexes#benchmark">실험 03</Ref>에서 선택도가 좁아질수록 GiST(16)의 재검사 탈락이 {fmtNum(cfg.hstore_gist16.queries.contain_2keys_common.recheck_removed.median)}개 → {fmtNum(cfg.hstore_gist16.queries.contain_rare_value.recheck_removed.median)}개로 폭증한 게 바로 이 현상이다. siglen을 128로 늘리면 같은 조건에서 {fmtNum(cfg.hstore_gist128.queries.contain_rare_value.recheck_removed.median)}개로 훨씬 적다 — 포화까지 걸리는 시간을 벌어 주는 것이다.</p>
      </Callout>
    </Section>

    <Section id="gin" title="3. GIN: 값을 키 집합으로 쪼개는 역색인">
      <p>GIN(Generalized Inverted Index)은 접근이 정반대다. 공식 문서: “A GIN index stores a set of (key, posting list) pairs, where a <strong>posting list</strong> is a set of row IDs in which the key occurs … Each key value is stored only once.”</p>
      <Diagram chart={`flowchart LR
        bt["키 B-tree<br/>(서로 다른 키만, 정렬됨)"]
        bt --> k1["'K'color"]
        bt --> k2["'V'red"]
        bt --> k3["'K'brand"]
        k1 --> p1["posting list<br/>행 1, 4, 9, 102, …"]
        k2 --> p2["posting list<br/>행 1, 55, 210, …"]
        k3 --> p3["posting tree<br/>(너무 커서 B-tree로 분리)<br/>행 3, 7, 88, …"]
      `} caption={<>키가 같으면 값이 아무리 많이 반복돼도 키 자체는 한 번만 저장된다. hstore GIN은 쌍 하나를 'K'+키, 'V'+값(또는 NULL이면 'N') 두 항목으로 쪼갠다(<code>gin_extract_hstore</code>, 아래). 엔트리 트리·포스팅 리스트·포스팅 트리·펜딩 리스트라는 층 구조 자체의 일반적인 설명은 <Ref to="/foundations/gin#structure">GIN 인덱스 · 1절</Ref>에 있다.</>} />
      <p>hstore가 실제로 쪼개는 방식은 이미 <Ref to="/hstore/source#gin">소스 지도</Ref>에서 봤다 — 쌍 하나가 <code>K</code>(키)·<code>V</code>(값) 항목 두 개가 된다. GIN의 구조적 특징 두 가지가 여기서 바로 나온다.</p>
      <ol>
        <li><strong>값의 종류가 적을수록 작다.</strong> 키 값 자체는 딱 한 번만 저장되고, 그 키를 가진 행이 몇 개든 posting list에 TID만 늘어난다. <Ref to="/hstore/indexes#gist">실험 03</Ref>에서 값의 종류가 적은 데이터(색 8종·사이즈 5종 등)는 GIN이 GiST(16)보다도 작았던 이유가 이것이다 — GiST는 행마다 서명을 새로 만들어야 하니 값이 겹쳐도 이득이 없다.</li>
        <li><strong>쓰기 하나가 인덱스 항목 여러 개를 건드린다.</strong> 공식 문서: “inserting or updating one heap row can cause <strong>many inserts into the index</strong> (one for each key extracted from the indexed item).” hstore는 쌍 하나당 항목이 <strong>둘</strong>이니, 키 500개짜리 hstore 하나를 바꾸면 최대 1,000개의 인덱스 항목이 다시 등록될 수 있다 — <Ref to="/hstore/updates#gin">갱신 비용 3절</Ref>에서 GIN이 있는 UPDATE가 {ratio(exp.update.cases['500'].hstore_concat_gin.wal_bytes_per_update.median, exp.update.cases['500'].hstore_concat.wal_bytes_per_update.median)} 비싼 이유가 이 구조다.</li>
      </ol>
      <p>GIN은 이 삽입 비용을 뒤로 미루는 장치도 갖고 있다 — <strong>pending list</strong>(<code>fastupdate</code>). 공식 문서: “GIN is capable of postponing much of this work by inserting new tuples into a temporary, unsorted list of pending entries” — VACUUM·ANALYZE나 <code>gin_pending_list_limit</code> 초과 시점에 정식 구조로 옮겨진다. 비용을 없애는 게 아니라 <strong>미루는</strong>것이라, 결국은 치러야 한다.</p>
    </Section>

    <Section id="compare" title="4. 나란히 놓고 보면">
      <table><thead><tr><th></th><th>GiST</th><th>GIN</th></tr></thead><tbody>
        <tr><td>저장 단위</td><td>노드마다 “경계 술어” 하나(자식들의 union)</td><td>서로 다른 키마다 posting list/tree</td></tr>
        <tr><td>정확성</td><td>손실 가능. hstore는 <strong>모든 전략이 무조건 recheck</strong></td><td>대체로 정확. hstore는 <code>@&gt;</code>만 recheck, <code>?</code>·<code>?&amp;</code>는 정확</td></tr>
        <tr><td>크기를 좌우하는 것</td><td>행 수 × siglen (서로 다른 값의 수와 거의 무관)</td><td>서로 다른 키의 수 (같은 값이 반복될수록 작아짐)</td></tr>
        <tr><td>쓰기 비용</td><td>삽입마다 트리 한 경로만 갱신(penalty로 고른 가지)</td><td>쌍 하나가 키 항목 여러 개로 쪼개져 전부 갱신 대상</td></tr>
        <tr><td>정렬·근접 탐색(KNN)</td><td><code>distance</code> 지원 시 가능 (<code>ORDER BY … &lt;-&gt; …</code>)</td><td>지원 안 함</td></tr>
        <tr><td>잘 맞는 데이터</td><td>겹치는 범위·공간·근접도가 의미 있는 데이터</td><td>이산적인 키 집합, 같은 값이 자주 반복되는 데이터</td></tr>
      </tbody></table>
      <p>hstore의 실측(<Ref to="/hstore/indexes#benchmark">인덱스 페이지 · 실험 03</Ref>)이 이 표와 정확히 맞아떨어진다: 인덱스 크기는 GIN {fmtBytes(cfg.hstore_gin.index_bytes.median)}, GiST(16) {fmtBytes(cfg.hstore_gist16.index_bytes.median)}(값의 종류가 적은 데이터라 GIN이 posting list로 압축한 결과) — 하지만 희귀 값 조회에서는 GiST의 재검사 폭증으로 GIN {fmtMs(cfg.hstore_gin.queries.contain_rare_value.ms.median)} vs GiST(16) {fmtMs(cfg.hstore_gist16.queries.contain_rare_value.ms.median)}로 뒤집힌다.</p>
    </Section>

    <Section id="why-jsonb" title="5. 그래서 jsonb에는 왜 GiST가 없나">
      <p>여기서부터는 카탈로그로 확인한 사실과, 그 이유에 대한 추정을 구분해서 적는다.</p>
      <p><strong>확인한 사실:</strong> <code>pg_opclass</code>를 전수 조회하면 PostgreSQL 코어에 <code>jsonb</code>를 대상으로 하는 GiST 연산자 클래스가 없다. GIN은 <code>jsonb_ops</code>·<code>jsonb_path_ops</code> 두 개가 있다 (<Ref to="/hstore/vs-jsonb#query">jsonb와의 차이 · 5절</Ref>에서 실제 조회 결과). hstore는 <code>gist_hstore_ops</code>가 core에 있다.</p>
      <p><strong>추정(확실하지 않음):</strong> 이 페이지에서 본 것처럼 GiST 연산자 클래스를 만들려면 그 타입 전용의 <code>compress</code>(무엇을 서명에 찍을지)·<code>union</code>·<code>penalty</code>·<code>picksplit</code>을 새로 설계해야 하고, 공식 문서도 이 설계가 “진짜 어려운 부분”이라고 못 박는다. hstore는 문자열 키-값 쌍뿐이라 “키·값을 해시해서 비트를 켠다”는 설계가 비교적 단순했다. jsonb는 배열·객체가 임의 깊이로 중첩되므로, 그 구조 전체를 하나의 고정 길이 서명 안에 손실 압축하면서도 <code>union</code>·<code>penalty</code>가 트리를 잘 균형 잡게 만드는 설계가 더 까다로울 수 있다 — 그러나 이건 <strong>왜 아직 없는지에 대한 그럴듯한 설명이지, PostgreSQL 커뮤니티가 공식적으로 밝힌 이유는 아니다.</strong> 실제로는 “아직 아무도 구현해서 core에 올리지 않았다”는 것 이상의 근거를 찾지 못했다.</p>
      <p>확실한 것은 이것이다 — jsonb에 GiST가 없는 건 <strong>jsonb가 원천적으로 GiST를 못 쓰는 타입이라서가 아니라</strong>, 코어에 그 지원 함수 구현이 없기 때문이다. hstore가 값의 모양을 문자열 쌍으로 좁힌 대가로 GiST라는 선택지 하나를 더 갖고 있다는 것이 <Ref to="/hstore/when-to-use#bad">jsonb 대신 hstore를 쓰는 세 가지 이유</Ref> 중 첫 번째의 구조적 근거다.</p>
    </Section>

    <Section id="refs" title="6. 참고">
      <ul>
        <li><A href="https://www.postgresql.org/docs/16/gist-intro.html">PostgreSQL 16 문서 · GiST Indexes · Introduction</A></li>
        <li><A href="https://www.postgresql.org/docs/16/gist-extensibility.html">PostgreSQL 16 문서 · GiST Indexes · Extensibility</A></li>
        <li><A href="https://www.postgresql.org/docs/16/gin-intro.html">PostgreSQL 16 문서 · GIN Indexes · Introduction</A></li>
        <li><A href="https://www.postgresql.org/docs/16/gin-implementation.html">PostgreSQL 16 문서 · GIN Indexes · Implementation</A></li>
        <li><A href="https://www.postgresql.org/docs/16/gin-extensibility.html">PostgreSQL 16 문서 · GIN Indexes · Extensibility</A></li>
        <li><A href="https://github.com/postgres/postgres/blob/REL_16_15/contrib/hstore/hstore_gist.c">contrib/hstore/hstore_gist.c (REL_16_15)</A></li>
      </ul>
    </Section>
  </>
}
