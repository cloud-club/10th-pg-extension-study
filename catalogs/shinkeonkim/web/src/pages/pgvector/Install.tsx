import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { d, demo, envTags } from './stats'
import { Deep, Goal, Next, Quiz, Summary, Term } from './guide'
import { QUIZ } from './quizzes'

const ef10 = d('hnsw_ef_10')

export default function Install() {
  return <>
    <PageHeader eyebrow="Week 05 · 실습과 실험" title="설치, 타입, 거리 연산자, 그리고 실행 계획 읽기"
      lede="pgvector를 설치하고, 벡터를 테이블에 넣고, 거리를 재는 데까지를 실제 출력으로 따라간다. 마지막으로 이후 모든 페이지에서 쓰는 도구인 EXPLAIN(실행 계획) 읽는 법을 익힌다."
      tags={envTags} />

    <Summary points={[
      <>설치는 슈퍼유저만 할 수 있다(클라우드에서는 서비스가 허용 목록으로 대신 해 준다). pgvectorscale은 pgvector 위에 얹힌다.</>,
      <>기본 타입은 <code>vector(n)</code>, 기본 거리는 <code>&lt;-&gt;</code>. 인덱스를 만들 때 고른 거리와 질의의 연산자가 같아야 한다.</>,
      <>EXPLAIN에서 <code>Index Scan</code>인지, <code>Buffers</code>가 몇인지를 본다. 이 주차의 비용 지표는 “질의당 읽은 페이지 수”다.</>,
    ]} />

    <Goal
      questions={['pgvector는 누가, 어떻게 설치하나?', '벡터는 어떤 타입으로 저장하나?', '“거리”는 몇 가지가 있고 무엇을 고르나?', 'PostgreSQL이 인덱스를 썼는지 어떻게 확인하나?']}
      assumes={<>벡터 = 숫자 목록, 비슷하다 = 가깝다(<Ref to="/pgvector/first">처음이라면</Ref>).</>} />

    <EasyFirst>
      <p>PostgreSQL은 기본으로 벡터를 모른다. pgvector를 설치하면 세 가지가 생긴다. ① <code>vector</code>라는 <strong>새 컬럼 타입</strong>(숫자 목록을 담는 칸), ② <code>&lt;-&gt;</code> 같은 <strong>거리 연산자</strong>(두 벡터가 얼마나 먼지 계산), ③ 그 계산을 빠르게 해 주는 <strong>인덱스</strong>. 이 페이지는 ①②와, 인덱스가 실제로 쓰였는지 확인하는 방법(EXPLAIN)을 다룬다. ③은 다음 장부터다.</p>
    </EasyFirst>

    <Section id="trusted" title="1. 설치 — 운영자(슈퍼유저)만 할 수 있다">
      <Term word="확장(extension)">PostgreSQL에 새 타입·함수·인덱스를 덧붙이는 플러그인. 서버에 파일을 깔아 두고, DB마다 <code>CREATE EXTENSION 이름;</code> 한 줄로 켠다.</Term>
      <p>설치 가능한 확장과 권한 조건은 시스템 표 <code>pg_available_extension_versions</code>에서 볼 수 있다. 여기서 볼 열은 둘이다. <code>superuser = t</code>는 “슈퍼유저만 설치 가능”, <code>trusted = f</code>는 “일반 사용자에게 설치를 허락하지 않음”이다.</p>
      <CodeBlock language="sql" output={d('available').output} outputCaption="실제 실행 결과">{d('available').sql}</CodeBlock>
      <Term word="슈퍼유저">DB 서버 안의 모든 권한을 가진 계정(건물 마스터키). 서비스가 쓰는 일반 계정은 보통 슈퍼유저가 아니다.</Term>
      <p>확인을 위해 일반 계정(<code>app_user</code>)으로 바꿔서 설치를 시도했다. 거절된다. pgvectorscale을 먼저 시도해도, 그것이 기대는 pgvector에서 똑같이 막힌다.</p>
      <CodeBlock language="sql" output={d('nonsuper').output} outputCaption="일반 계정 · 실제 오류">{d('nonsuper').sql}</CodeBlock>
      <Deep title="pgvectorscale을 먼저 설치해도 같은 이유로 막힌다">
        <CodeBlock language="sql" output={d('nonsuper_cascade').output} outputCaption="실제 오류">{d('nonsuper_cascade').sql}</CodeBlock>
        <p>week02의 pg_trgm, week04의 hstore는 trusted라서 DB에 대한 CREATE 권한만 있으면 설치됐다(<Ref to="/hstore/trusted">trusted 확장이란</Ref>). pgvector와 pgvectorscale은 제어 파일에 trusted로 표시되어 있지 않아서, 슈퍼유저가 아니면 설치할 수 없다.</p>
      </Deep>
      <p>슈퍼유저로 설치한다. pgvectorscale은 pgvector가 있어야 동작하므로(<code>requires = {'{vector}'}</code>) <code>CASCADE</code>를 붙이면 필요한 것을 함께 설치한다.</p>
      <CodeBlock language="sql">{demo.create}</CodeBlock>
      <CodeBlock language="sql" output={d('installed').output} outputCaption="실제 실행 결과">{d('installed').sql}</CodeBlock>
      <Callout kind="info" title="클라우드 PostgreSQL(매니지드 DB)에서는">
        <p>AWS RDS·Supabase 같은 서비스에서는 우리가 슈퍼유저가 아니지만, 서비스가 허락한 확장 목록에 pgvector가 있어서 그냥 <code>CREATE EXTENSION vector;</code>가 된다. pgvectorscale은 2026-10 기준 제작사의 Timescale Cloud 외에는 그 목록에 없다 — <Ref to="/pgvector/selection-details#managed">언제 무엇을 쓰나</Ref>.</p>
      </Callout>
    </Section>

    <Section id="types" title="2. 벡터를 담는 타입">
      <p>가장 많이 쓰는 것은 <code>vector(n)</code> 하나다. <code>n</code>은 차원(숫자 개수)이고, 임베딩 모델이 내놓는 길이와 같게 정한다.</p>
      <CodeBlock language="sql" output={d('types').output} outputCaption="실제 실행 결과">{d('types').sql}</CodeBlock>
      <table><thead><tr><th>타입</th><th>숫자 하나의 크기</th><th>언제</th></tr></thead><tbody>
        <tr><td><code>vector(n)</code></td><td>4바이트(float4)</td><td><strong>기본</strong>. 인덱스는 2,000차원까지</td></tr>
        <tr><td><code>halfvec(n)</code></td><td>2바이트(float2)</td><td>저장 공간을 절반으로. 정밀도는 조금 떨어진다. <Ref to="/pgvector/cost#halfvec">빌드 비용과 크기</Ref>에서 실측</td></tr>
        <tr><td><code>sparsevec</code></td><td>0이 아닌 칸만</td><td>대부분이 0인 벡터. <code>{'{1:1,3:2}/5'}</code> = 5칸 중 1·3번 칸만 값이 있음</td></tr>
        <tr><td><code>bit(n)</code></td><td>1비트</td><td>0/1로 크게 줄인 벡터</td></tr>
      </tbody></table>
      <p>차원이 맞지 않는 값은 몰래 자르거나 채우지 않고 거절한다. 임베딩 모델을 바꿨는데 컬럼을 그대로 두면 여기서 바로 드러난다.</p>
      <CodeBlock language="sql" output={d('dim_error').output} outputCaption="실제 오류">{d('dim_error').sql}</CodeBlock>
    </Section>

    <Section id="operators" title="3. 거리를 재는 연산자">
      <p>앞 페이지의 3차원 예제를 다시 쓴다.</p>
      <CodeBlock language="sql">{demo.items}</CodeBlock>
      <CodeBlock language="sql" output={d('distances').output} outputCaption="실제 실행 결과">{d('distances').sql}</CodeBlock>
      <table><thead><tr><th>연산자</th><th>무엇을 재나</th><th>쉽게 말하면</th></tr></thead><tbody>
        <tr><td><code>&lt;-&gt;</code></td><td>L2(유클리드) 거리</td><td>자로 잰 직선거리. <strong>이 주차 실험은 전부 이것</strong></td></tr>
        <tr><td><code>&lt;=&gt;</code></td><td>코사인 거리</td><td>두 화살표가 같은 쪽을 가리키나. 길이는 무시. 텍스트 임베딩에서 흔히 쓴다</td></tr>
        <tr><td><code>&lt;#&gt;</code></td><td>내적에 마이너스를 붙인 값</td><td>“작을수록 가깝다”로 정렬 방향을 맞추려고 부호를 뒤집었다(위 출력의 -14, -17, -32)</td></tr>
        <tr><td><code>&lt;+&gt;</code></td><td>L1 거리</td><td>바둑판 길을 따라 걷는 거리(칸마다 차이의 합)</td></tr>
      </tbody></table>
      <Callout kind="tip" title="무엇을 고르나">
        <p>임베딩 모델 문서가 권하는 거리를 쓴다. 모델이 벡터 길이를 1로 맞춰서(정규화) 내놓는다면 코사인·내적·L2가 같은 순서를 낸다. 중요한 것은 <strong>인덱스를 만들 때 고른 거리와 질의에 쓴 연산자가 같아야</strong> 인덱스가 쓰인다는 점이다(<code>vector_l2_ops</code>로 만들었으면 <code>&lt;-&gt;</code>로 질의).</p>
      </Callout>
      <Deep title="bit 타입의 거리와, 인덱스별로 지원하는 거리 목록">
        <CodeBlock language="sql" output={d('bit_distances').output} outputCaption="실제 실행 결과">{d('bit_distances').sql}</CodeBlock>
        <p>어떤 인덱스가 어떤 거리를 지원하는지는 시스템 카탈로그에서 직접 읽을 수 있다. DiskANN에는 L1이 없다.</p>
        <CodeBlock language="sql" output={d('opclasses').output} outputCaption="실제 실행 결과">{d('opclasses').sql}</CodeBlock>
      </Deep>
    </Section>

    <Section id="explain" title="4. 실행 계획(EXPLAIN) 읽는 법 — 이후 모든 페이지의 도구">
      <p>SQL을 쓰면 PostgreSQL의 <strong>플래너</strong>가 “어떻게 실행할지”를 고른다. 테이블을 처음부터 다 읽을지, 인덱스를 따라갈지 같은 것이다. <code>EXPLAIN</code>은 그 선택을 보여 주고, <code>ANALYZE</code>를 붙이면 실제로 실행한 뒤 결과를 적는다. <code>BUFFERS</code>를 붙이면 몇 페이지를 읽었는지도 나온다.</p>
      <p>아래는 <Ref to="/pgvector/hnsw-ivfflat#knobs">HNSW vs IVFFlat</Ref>에서 쓰는 5,000행(8차원) 테이블 <code>proper</code>에 HNSW 인덱스를 만든 뒤, 한 점에서 가장 가까운 10개를 찾은 계획이다.</p>
      <CodeBlock language="sql" output={ef10.output} outputCaption="실제 실행 결과">{ef10.sql}</CodeBlock>
      <table><thead><tr><th>줄</th><th>뜻</th></tr></thead><tbody>
        <tr><td><code>Index Scan using proper_hnsw</code></td><td>HNSW 인덱스를 따라갔다. 이게 <code>Seq Scan</code>(처음부터 끝까지 읽기)이면 인덱스를 안 쓴 것이다</td></tr>
        <tr><td><code>Order By: (embedding &lt;-&gt; $0)</code></td><td>“거리 순서”를 인덱스가 직접 내준다 — 전체 정렬이 없다</td></tr>
        <tr><td><code>Buffers: shared hit=…</code></td><td>읽은 페이지 수. PostgreSQL은 데이터를 <strong>8KB 페이지</strong> 단위로 읽는다. <code>hit</code>는 메모리에서, <code>read</code>는 디스크에서 읽은 것</td></tr>
        <tr><td><code>InitPlan 1</code></td><td>질문 벡터(<code>id = 1</code>인 행의 벡터)를 먼저 한 번 구해 둔 부분</td></tr>
        <tr><td><code>actual rows=10</code></td><td>실제로 돌려준 행 수</td></tr>
      </tbody></table>
      <Callout kind="info" title="왜 시간보다 버퍼 수를 보나">
        <p>실행 시간은 같은 질의도 실행할 때마다, 노트북 상태에 따라 흔들린다. 읽은 페이지 수는 같은 데이터·같은 인덱스면 거의 같다. 그래서 이 주차의 실험은 <strong>“질의 하나에 몇 페이지를 읽었나(버퍼/질의)”</strong>를 비용의 주 지표로 쓰고 시간은 보조로 본다.</p>
      </Callout>
    </Section>

    <Section id="tiny" title="5. 인덱스가 있다고 항상 쓰이지는 않는다">
      <p>3행짜리 테이블에 HNSW 인덱스를 만들고 같은 질의를 실행해 보면, 플래너는 인덱스를 무시한다.</p>
      <CodeBlock language="sql">{d('hnsw_tiny').sql}</CodeBlock>
      <CodeBlock language="sql" output={d('explain_tiny').output} outputCaption="3행 테이블 · 실제 실행 결과">{d('explain_tiny').sql}</CodeBlock>
      <p><code>Seq Scan</code> → <code>Sort</code> → <code>Limit</code>: 전부 읽고, 정렬하고, 앞에서 자른다. 3행이면 이쪽이 더 싸다고 계산했기 때문이다. 플래너는 비용을 계산해 고르므로 <strong>작은 테이블로 인덱스를 시험하면 오해하기 쉽다</strong>. 실험할 때는 충분히 큰 데이터를 쓰거나 <code>SET enable_seqscan = off</code>로 확인한다.</p>
      <SourceNote path="week05/pgvector/labs/01-install-and-distance-ops/run.sh">같은 내용을 Docker 실습으로</SourceNote>
    </Section>

    <Section id="gucs" title="6. 설정값(GUC) — 인덱스의 손잡이">
      <Term word="GUC">PostgreSQL의 설정값. <code>SET 이름 = 값;</code>으로 지금 연결에서만 바꿀 수 있다. pgvector는 <code>hnsw.ef_search</code>(얼마나 넓게 찾을지) 같은 손잡이를 추가하고, 이후 페이지에서 이 값들을 바꿔 가며 잰다.</Term>
      <CodeBlock language="sql" output={d('gucs').output} outputCaption="실제 실행 결과">{d('gucs').sql}</CodeBlock>
      <p>당장은 <code>hnsw.ef_search = 40</code>, <code>ivfflat.probes = 1</code>, <code>hnsw.iterative_scan = off</code>가 기본값이라는 것만 기억하면 된다. 각각 <Ref to="/pgvector/tuning">튜닝 곡선</Ref>과 <Ref to="/pgvector/filtering">필터가 붙은 검색</Ref>에서 다시 나온다.</p>
      <Deep title="새 연결에서는 이 설정들이 안 보인다">
        <p>이 설정들은 서버가 켜질 때가 아니라 확장 라이브러리가 그 연결에 처음 로드될 때 등록된다. 새 연결에서 바로 찾으면 0개다.</p>
        <CodeBlock language="sql" output={d('gucs_before_load').output} outputCaption="새 연결 · 실제 실행 결과">{d('gucs_before_load').sql}</CodeBlock>
        <p>위 결과는 <code>LOAD 'vector'; LOAD 'vectorscale-0.9.1';</code> 이후에 조회한 것이다. 인덱스를 한 번 쓰거나 <code>SET hnsw.ef_search = …</code>를 실행하면 자동으로 로드되므로 평소에는 신경 쓸 일이 없다. pgvectorscale은 Rust(pgrx)로 빌드돼 파일 이름에 버전이 붙는다.</p>
      </Deep>
    </Section>

    <Quiz items={QUIZ['install']} />

    <Next to="/pgvector/ann" title="근사 검색과 recall" why={'인덱스를 쓰면 빨라지지만 “가끔 놓친다”. 그 놓친 정도를 어떻게 재는지부터 정한다.'} />
  </>
}
