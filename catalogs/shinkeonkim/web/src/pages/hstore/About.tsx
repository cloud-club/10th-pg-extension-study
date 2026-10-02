import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Diagram } from '@/components/viz/Diagram'
import { demo, exp, fmtBytes, fmtNum, ratio, storageCell } from './stats'

const c500 = storageCell(500, 'low')
const upd = exp.update.cases['500']
const conc = exp.concurrency

export default function About() {
  return <>
    <PageHeader eyebrow="Week 04 · hstore 개요" title="한 컬럼에 키-값 묶음을 넣는 PostgreSQL 확장"
      lede="hstore는 문자열 키와 문자열 값의 평평한 집합을 컬럼 하나에 저장하는 contrib 확장이다. 컬럼을 미리 정하기 어려운 속성 묶음을 한 행에 넣고, 연산자와 GIN 인덱스로 조회한다. 이 자료는 저장 방식, jsonb와의 차이, 동시성, Redis 해시와의 비교를 소스 분석과 5개 실험으로 확인한다."
      tags={[{ label: 'PostgreSQL 16.15' }, { label: `hstore ${exp.environment.hstore_version}` }, { label: 'contrib · trusted' }, { label: '실험 5종' }]} />

    <Section title="권장 학습 순서">
      <ol>
        <li><strong>기본:</strong> <Ref to="/hstore/install-syntax">설치와 기본 문법</Ref>에서 리터럴과 연산자를 익힌다.</li>
        <li><strong>판단:</strong> <Ref to="/hstore/when-to-use">언제 쓰고 언제 피하나</Ref>에서 열·EAV·jsonb·Redis 중 무엇을 고를지 정한다.</li>
        <li><strong>원리:</strong> <Ref to="/hstore/storage">저장 방식</Ref> → <Ref to="/hstore/vs-jsonb">jsonb와의 차이</Ref> → <Ref to="/hstore/indexes">인덱스</Ref>.</li>
        <li><strong>운영:</strong> <Ref to="/hstore/updates">갱신 비용</Ref> → <Ref to="/hstore/concurrency">동시성</Ref> → <Ref to="/hstore/vs-redis">Redis 해시와 비교</Ref> → <Ref to="/hstore/operations">운영</Ref>.</li>
        <li><strong>검증:</strong> <Ref to="/hstore/source">소스 지도</Ref>, <Ref to="/hstore/experiments">실험 결과</Ref>, <Ref to="/hstore/resources">참고 자료</Ref>.</li>
      </ol>
    </Section>

    <Section id="why" title="1. 어떤 문제 때문에 필요한가?">
      <p>쇼핑몰에 티셔츠, 머그컵, 노트북이 함께 있다고 하자. 티셔츠는 색상과 사이즈, 노트북은 RAM과 SSD가 필요하다. 상품 종류가 늘 때마다 <code>ALTER TABLE</code>로 열을 더하면 대부분의 값이 <code>NULL</code>인 넓은 테이블이 된다.</p>
      <table><thead><tr><th>방법</th><th>장점</th><th>단점</th></tr></thead><tbody>
        <tr><td>속성마다 열</td><td>타입·제약·통계가 가장 정확하다</td><td>속성이 바뀔 때마다 스키마 변경이 필요하다</td></tr>
        <tr><td>EAV (속성 하나 = 행 하나)</td><td>스키마 변경이 없다</td><td>한 상품을 읽으려면 여러 행이 필요하고 저장 공간이 크다 (<Ref to="/hstore/storage#footprint">저장 크기 실험</Ref>)</td></tr>
        <tr><td><strong>hstore</strong></td><td>한 행에 묶음을 담는다. 연산자와 인덱스가 있다</td><td>값이 전부 text이고 중첩이 없다. 키 하나를 바꿔도 값 전체를 다시 쓴다</td></tr>
        <tr><td>jsonb</td><td>타입과 중첩을 표현한다</td><td>hstore보다 범용인 만큼 단순한 키-값에는 과할 수 있다</td></tr>
      </tbody></table>
      <Diagram chart={`flowchart LR
        subgraph EAV["EAV: 상품 1개 = 행 여러 개"]
          e1["(1, color, red)"]
          e2["(1, size, M)"]
          e3["(1, material, cotton)"]
        end
        subgraph HS["hstore: 상품 1개 = 행 1개"]
          h1["id=1 · attrs = color=>red, size=>M, material=>cotton"]
        end
        EAV -->|"묶어서 저장"| HS
      `} caption="hstore는 속성 여러 개를 한 행의 한 값으로 묶는다. 대신 그 값은 하나의 단위로 읽고 쓴다." />
    </Section>

    <Section id="first" title="2. 첫 사용: 상품 속성 조회">
      <p>설치는 <code>CREATE EXTENSION</code> 한 줄이다. 확장은 PostgreSQL 본체에 포함된 contrib 모듈이라 별도 패키지가 필요 없다. 자세한 설치와 문법은 <Ref to="/hstore/install-syntax">다음 페이지</Ref>에서 다룬다.</p>
      <CodeBlock language="sql">{demo.create}</CodeBlock>
      <CodeBlock language="sql">{demo.setup_product}</CodeBlock>
      <p>키 하나의 값을 꺼내는 것은 <code>-&gt;</code>, 특정 키-값 쌍을 가진 행을 찾는 것은 <code>@&gt;</code>다.</p>
      <CodeBlock language="sql" output={demo.op_fetch.output} outputCaption="실제 실행 결과">{demo.op_fetch.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.op_contains.output} outputCaption="실제 실행 결과">{demo.op_contains.sql}</CodeBlock>
      <Callout kind="info" title="값은 전부 text다">
        <p><code>ram=&gt;16GB</code>처럼 숫자로 보이는 값도 text로 저장된다. 숫자 비교가 필요하면 <code>(attrs -&gt; 'ram')::int</code>처럼 직접 캐스팅해야 한다. 정렬 결과가 달라지는 예는 <Ref to="/hstore/vs-jsonb#types">jsonb와의 차이</Ref>에 있다.</p>
      </Callout>
    </Section>

    <Section id="numbers" title="3. 실험으로 확인한 핵심 수치">
      <p>PostgreSQL {exp.environment.postgres.split(' ')[1]}에서 hstore {exp.environment.hstore_version}로 잰 값이다. 각 수치의 조건과 반복 수는 <Ref to="/hstore/experiments">실험 페이지</Ref>에 있다.</p>
      <StatGrid>
        <Stat tone="tsv" value={`${fmtBytes(c500.hs.avg_column_bytes)} vs ${fmtBytes(c500.jb.avg_column_bytes)}`} label={`키 500개(값 종류가 적은 경우) 한 행의 저장 크기: hstore vs jsonb. ${ratio(c500.hs.avg_column_bytes, c500.jb.avg_column_bytes)} 차이`} />
        <Stat tone="warn" value={`${fmtBytes(upd.hstore_concat.wal_bytes_per_update.median)}`} label={`키 500개 hstore에서 키 하나를 바꾸는 UPDATE 1건의 WAL. EAV는 ${fmtBytes(upd.eav_row.wal_bytes_per_update.median)}`} />
        <Stat tone="trgm" value={`${fmtNum(conc.key_add.rmw_autocommit.keys_present.median)} / ${fmtNum(conc.key_add.rmw_autocommit.attempted)}`} label="읽고 → 앱에서 합치고 → 통째로 쓰는 방식으로 키 400개를 넣었을 때 남은 키 (중앙값)" />
        <Stat tone="ok" value={`${fmtNum(conc.key_add.atomic_concat.keys_present.median)} / ${fmtNum(conc.key_add.atomic_concat.attempted)}`} label="같은 일을 UPDATE ... SET attrs = attrs || ... 로 한 경우. 10회 모두 유실 0" />
      </StatGrid>
      <Callout kind="tip" title="한 줄 결론">
        <p>hstore는 <strong>작고 평평한 문자열 속성 묶음을 한 행에 두고 조회할 때</strong> 좋다. 키가 많거나 자주 바뀌는 값을 담기 시작하면 값 전체를 다시 쓰는 비용이 커진다. 그때는 그 키를 열로 빼거나, jsonb·EAV, 혹은 다른 저장소를 검토한다.</p>
      </Callout>
    </Section>

    <Section id="basis" title="4. 이 자료의 근거">
      <table><thead><tr><th>구분</th><th>내용</th></tr></thead><tbody>
        <tr><td>소스</td><td>postgres/postgres <code>contrib/hstore</code> (REL_16 계열). 저장 형식·GIN·병합 함수를 <Ref to="/hstore/source">소스 페이지</Ref>에서 행 번호와 함께 읽는다.</td></tr>
        <tr><td>공식 문서</td><td>PostgreSQL 16 hstore 문서. 연산자·함수·인덱스 지원표는 실제 카탈로그(<code>pg_amop</code>)로도 조회한다.</td></tr>
        <tr><td>실험</td><td>Docker(PostgreSQL 16.15 · Redis 7.4)에서 5개 실험을 반복 측정. 회차별 원본은 로컬에 생성하고 웹에는 중앙값·범위만 게시한다.</td></tr>
        <tr><td>실습</td><td><code>week04/hstore/labs</code>의 Docker 실습 4개. 이 페이지의 SQL 출력은 실제 실행 결과를 그대로 옮긴 것이다.</td></tr>
      </tbody></table>
      <p>측정 환경은 macOS Docker Desktop 위의 Linux VM(공유 CPU {exp.environment.cpu_count}개)이다. 절대 수치는 이 환경에서만 의미가 있고, 방식 사이의 상대 비교와 원인 확인에 사용한다.</p>
    </Section>
  </>
}
