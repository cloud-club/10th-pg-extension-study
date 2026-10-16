import { Link } from 'react-router-dom'
import { Ref } from '@/components/common/Ref'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { FragmentStrip } from '@/components/viz/FragmentStrip'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { DATA } from '@/data/measurements'
import { FRAGMENTS } from '@/data/whitespace'

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="pg_trgm"
        title="구조와 규칙 — 3문자 · CRC32 · 패딩 2/1"
        lede={
          <>
            PostgreSQL <strong>contrib</strong> 에 들어 있는 공식 확장이다. 설치가 쉽고(<K>trusted</K> 라 수퍼유저도
            불필요), 지원하는 기능이 많다 — <K>ILIKE</K>·정규식·유사도·KNN. 약점은 <strong>딱 한 칸</strong>이다.
          </>
        }
        tags={[{ label: DATA.env.trgm, variant: 'trgm' }, { label: '3-gram' }, { label: 'GIN · GiST' }]}
      />

      <EasyFirst>
        <p>
          <K>pg_trgm</K> 은 문자열을 <strong>세 글자씩</strong> 잘라 색인합니다. 세 글자 조각은 두 글자보다 훨씬
          희귀해서 후보를 잘 좁혀줍니다 — 대신 <strong>검색어가 두 글자면 조각을 하나도 못 만듭니다.</strong>{' '}
          그 한 칸이 이 카탈로그에서 가장 크게 갈리는 지점입니다.
        </p>
      </EasyFirst>

      <Section id="install" title="1. 설치">
        <CodeBlock>{`CREATE EXTENSION pg_trgm;                                  -- contrib. 빌드 불필요
CREATE INDEX docs_trgm ON docs USING gin  (doc gin_trgm_ops);
CREATE INDEX docs_gist ON docs USING gist (doc gist_trgm_ops(siglen=256));`}</CodeBlock>
        <p>
          두 번째 줄과 세 번째 줄은 성질이 아주 다르다 — <Link to="/pg-trgm/gist">GIN vs GiST</Link>.
        </p>
      </Section>

      <Section id="shape" title="2. 조각의 생김새">
        <p>
          <strong>앞에 공백 2개, 뒤에 1개</strong>를 붙인 뒤 세 글자씩 자른다. 비대칭인 이유는{' '}
          <Ref to="/foundations/ngram#rpadding">왜 뒤에는 공백을 하나만 붙이나</Ref> 에 있다. 조각은 <strong>CRC32 로 해싱</strong>해{' '}
          <K>int32</K> 로 저장하므로, <K>show_trgm()</K> 이 한글에서 해시값을 돌려준다.
        </p>
        <div className="not-prose my-5 space-y-3">
          {FRAGMENTS.filter((f) => ['ab cd', '192.168.0.1', 'foo|bar'].includes(f.src)).map((f) => (
            <FragmentStrip key={f.src} src={f.src} note={f.note} bigm={f.bigm} trgm={f.trgm} trgmCount={f.trgmCount} />
          ))}
        </div>
        <SourceNote path="../../week02/bigm-vs-trgm/experiments/08-space-and-punctuation">실험 08</SourceNote>
        <Clotho id="ngram-slice" />

        <Table>
          <THead><TR><TH>설정 매크로</TH><TH>값</TH><TH>효과</TH></TR></THead>
          <TBody>
            <TR><TD><K>LPADDING</K> / <K>RPADDING</K></TD><TD>2 / 1</TD><TD>조각 개수가 <K>L+1</K> 로 떨어진다</TD></TR>
            <TR><TD><K>KEEPONLYALNUM</K></TD><TD>정의됨</TD><TD>영숫자가 아닌 문자를 <strong>단어 구분자로 쓰고 버린다</strong></TD></TR>
            <TR><TD><K>IGNORECASE</K></TD><TD>정의됨</TD><TD>소문자화한다 — <K>CloudClub</K> = <K>cloudclub</K></TD></TR>
            <TR><TD><K>DIVUNION</K></TD><TD>정의됨</TD><TD>유사도 분모가 자카드(합집합)가 된다</TD></TR>
          </TBody>
          <TCaption>
            <K>pg_bigm</K> 은 같은 이름의 <K>DIVUNION</K> 매크로를 <strong>정의하지 않아</strong> 반대쪽 가지가
            컴파일된다 — 그래서 분모가 <K>max(조각 수)</K> 다.
          </TCaption>
        </Table>

        <Callout kind="warn" title="널리 퍼진 오해 하나">
          <p>
            “<K>KEEPONLYALNUM</K> 때문에 <K>pg_trgm</K> 이 한글을 걸러낸다”는 <strong>틀렸다.</strong>{' '}
            <K>show_trgm('가나다라')</K> 는 조각 5개를 정상 생성한다 — <K>ISWORDCHR</K> 가 쓰는{' '}
            <K>t_isalnum_with_len()</K> 은 멀티바이트를 인식한다. 구두점 처리도 확인해야 한다.
          </p>
        </Callout>
      </Section>

      <Section id="can" title="3. 할 수 있는 것 — 여기가 강점이다">
        <Table>
          <THead><TR><TH>연산자</TH><TH>뜻</TH><TH>인덱스</TH></TR></THead>
          <TBody>
            <TR><TD><K>~~</K> <K>~~*</K></TD><TD>LIKE · <strong>ILIKE</strong> — <Link to="/experiments/ilike">ILIKE 가 오히려 인덱스에 잘 맞는다</Link></TD><TD className="text-ok">GIN · GiST</TD></TR>
            <TR><TD><K>~</K> <K>~*</K></TD><TD>정규식 — <strong>단, ASCII 만</strong></TD><TD className="text-warn">한글은 가속되지 않는다</TD></TR>
            <TR><TD><K>=</K></TD><TD>동등 비교 (pg_trgm 1.6+)</TD><TD className="text-ok">GIN · GiST</TD></TR>
            <TR><TD><K>%</K></TD><TD><K>similarity</K> ≥ 임계값</TD><TD className="text-ok">GIN · GiST</TD></TR>
            <TR><TD><K>%{'>'}</K> <K>%{'>>'}</K></TD><TD><K>word_similarity</K> · <K>strict_word_similarity</K></TD><TD className="text-ok">방향에 주의</TD></TR>
            <TR><TD><K>{'<->'}</K></TD><TD>거리 — <K>ORDER BY</K> KNN</TD><TD className="text-warn"><strong>GiST 만</strong></TD></TR>
          </TBody>
          <TCaption>
            실제로 돌려본 후보 행 수까지 붙은 표는 <Link to="/pg-bigm/operators">연산자 커버리지</Link> 에 있다 —
            “Index Cond 가 붙었다”와 “필터로 동작한다”가 다르다는 것이 거기서 드러난다.
          </TCaption>
        </Table>
        <Callout kind="warn" title="한글 정규식은 가속되지 않는다">
          <p>
            정규식 엔진의 <K>MAX_SIMPLE_CHR</K> 이 <K>0x7FF</K> 라, U+07FF 를 넘는 문자는 컬러를 펼칠 수 없어
            트라이그램을 못 뽑는다. <K>Index Cond</K> 는 붙지만 후보로 테이블 전체가 올라온다.
          </p>
        </Callout>
      </Section>

      <Section id="weak" title="4. 약점 한 칸">
        <p>
          <Link to="/pg-trgm/two-char">2글자 함정</Link> — 검색어가 3글자 미만이면 조각이 0개가 되고, GIN 은{' '}
          <K>GIN_SEARCH_MODE_ALL</K> 로 떨어진다. 이것이 <K>pg_bigm</K> 을 쓸 유일하지만 결정적인 이유다.
        </p>
      </Section>
    </>
  )
}
