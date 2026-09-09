import { Link } from 'react-router-dom'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { FragmentStrip } from '@/components/viz/FragmentStrip'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { DATA } from '@/data/measurements'
import { FRAGMENTS } from '@/data/whitespace'

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="pg_bigm"
        title="구조와 규칙 — 2문자 · 원본 바이트 · GIN 전용"
        lede={
          <>
            NTT DATA 가 만들고 지금은 pg_bigm Development Group 이 관리하는 <strong>서드파티 확장</strong>이다.
            contrib 도 PGDG 패키지도 아니라 <strong>PGXS 로 직접 빌드</strong>해야 한다.
          </>
        }
        tags={[{ label: DATA.env.bigm, variant: 'bigm' }, { label: '2-gram' }, { label: 'GIN 전용' }]}
      />

      <EasyFirst>
        <p>
          <K>pg_bigm</K> 은 문자열을 <strong>두 글자씩</strong> 잘라 색인합니다. 두 글자면 되니까{' '}
          <K>서울</K>·<K>배송</K> 같은 짧은 검색어도 조각이 나오고, 그래서 인덱스가 그대로 동작합니다.
          대신 할 수 있는 일이 <K>LIKE</K> 와 유사도 검색 둘뿐입니다.
        </p>
      </EasyFirst>

      <Section id="install" title="1. 설치 — 여기서부터 다르다">
        <CodeBlock caption="PGXS 로 빌드한다. 메이저 버전마다 .so 를 따로 만들어야 한다.">{`git clone --branch v1.2-20250903 --depth 1 https://github.com/pgbigm/pg_bigm.git
cd pg_bigm
make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config
make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config install`}</CodeBlock>
        <Callout kind="warn" title="pg_config 를 버전으로 고정할 것">
          <p>
            <K>/usr/bin/pg_config</K> 는 Debian 의 alternatives 가 고르는 것이라, 다른 메이저 버전의 헤더가
            설치돼 있으면 <strong>엉뚱한 버전으로 빌드된다</strong>(이 카탈로그도 그 함정에 걸렸다 —{' '}
            <Link to="/meta/environment">환경과 이미지</Link>). 언제나{' '}
            <K>/usr/lib/postgresql/&lt;버전&gt;/bin/pg_config</K> 로 고정한다.
          </p>
        </Callout>
        <CodeBlock>{`CREATE EXTENSION pg_bigm;
CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);`}</CodeBlock>
      </Section>

      <Section id="shape" title="2. 조각의 생김새">
        <p>
          공백 하나를 앞뒤에 덧붙인 뒤 두 글자씩 자른다. <strong>조각을 해싱하지 않고 원본 바이트 그대로</strong>{' '}
          저장하는 것이 <K>pg_trgm</K> 과의 가장 큰 구조적 차이다.
        </p>
        <div className="not-prose my-5 space-y-3">
          {FRAGMENTS.filter((f) => ['클라우드 클럽', '192.168.0.1'].includes(f.src)).map((f) => (
            <FragmentStrip key={f.src} src={f.src} note={f.note} bigm={f.bigm} trgm={f.trgm} trgmCount={f.trgmCount} />
          ))}
        </div>
        <SourceNote path="../../week02/bigm-vs-trgm/experiments/08-space-and-punctuation">실험 08</SourceNote>
        <Table>
          <THead><TR><TH></TH><TH><Badge variant="bigm">pg_bigm</Badge></TH><TH><Badge variant="trgm">pg_trgm</Badge></TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">조각 길이</TD><TD>2문자</TD><TD>3문자</TD></TR>
            <TR><TD className="text-muted-foreground">패딩</TD><TD>앞 1 · 뒤 1</TD><TD>앞 2 · 뒤 1</TD></TR>
            <TR><TD className="text-muted-foreground">저장</TD><TD className="text-ok"><strong>원본 바이트</strong></TD><TD>CRC32 해시(<K>int32</K>)</TD></TR>
            <TR><TD className="text-muted-foreground">단어 구분자</TD><TD>공백만 (<K>!t_isspace</K>)</TD><TD>영숫자가 아닌 전부 (<K>KEEPONLYALNUM</K>)</TD></TR>
            <TR><TD className="text-muted-foreground">대소문자</TD><TD>구분한다</TD><TD>소문자화한다 (<K>IGNORECASE</K>)</TD></TR>
            <TR><TD className="text-muted-foreground">인덱스</TD><TD>GIN 만</TD><TD>GIN · GiST</TD></TR>
            <TR><TD className="text-muted-foreground"><K>comparePartial</K></TD><TD className="text-ok">있다 → 1글자 검색이 인덱스를 탄다</TD><TD>해시 순서라 등록 불가</TD></TR>
          </TBody>
          <TCaption>
            왜 이 차이가 성능을 가르는지는 <Link to="/pg-bigm/korean">한국어에서 유리한 이유</Link> 와{' '}
            <Link to="/foundations/gin">GIN 인덱스</Link> 에 있다.
          </TCaption>
        </Table>
      </Section>

      <Section id="functions" title="3. 쓸 수 있는 것">
        <CodeBlock>{`-- 조각을 눈으로 확인한다
SELECT show_bigm('클라우드클럽');
--  {" 클",드클,라우,"럽 ",우드,클라,클럽}

-- 유사도 (겹친 조각 / max(조각 수))
SELECT bigm_similarity('클둥이', '클동이');   -- 0.5

-- 유사도 검색 — GIN 인덱스를 탄다
SET pg_bigm.similarity_limit = 0.3;
SELECT doc FROM docs WHERE doc =% '클라우드클럽';

-- 조각이 몇 개 나오는지
SELECT bigm_is_similar('클둥이', '클동이');`}</CodeBlock>
        <Callout kind="warn" title="pg_bigm.enable_recheck 를 끄지 말 것">
          <p>
            인덱스가 정확하다고 <em>알려주는</em> 스위치가 아니라 검증을 <em>건너뛰는</em> 스위치다 —{' '}
            <Link to="/foundations/recheck">Recheck</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="cannot" title="4. 못 하는 것">
        <p>
          <K>ILIKE</K>, 정규식, <K>=</K>, KNN 정렬, <K>word_similarity</K> 계열이 전부 없다. 자세한 실측 행렬은{' '}
          <Link to="/pg-bigm/operators">연산자 커버리지</Link> 에 있다. 그리고 <strong>PostgreSQL 19 에서는 아직
          빌드되지 않는다</strong> — <Link to="/experiments/versions">실험 07</Link>.
        </p>
      </Section>
    </>
  )
}
