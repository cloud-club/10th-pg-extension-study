import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { demo } from './stats'

export default function Trusted() {
  return <>
    <PageHeader eyebrow="Week 04 · 권한 모델" title="trusted 확장이란: 왜 슈퍼유저 없이 hstore를 설치할 수 있나"
      lede="hstore는 CREATE EXTENSION만으로 설치된다. 그게 가능한 건 hstore의 제어 파일에 trusted = true가 적혀 있기 때문이다. trusted가 정확히 무엇을 바꾸는지, 무엇은 바꾸지 않는지를 공식 문서와 실제 권한 테스트로 확인한다."
      tags={[{ label: 'PostgreSQL 13+' }, { label: 'contrib/hstore/hstore.control' }, { label: '실제 권한 테스트' }]} />

    <Section id="what" title="1. 제어 파일의 두 스위치: superuser와 trusted">
      <p>확장은 <code>.control</code> 파일에 <code>superuser</code>와 <code>trusted</code> 두 불리언을 적는다. 공식 문서(<code>doc/src/sgml/extend.sgml</code>)의 정의를 그대로 옮긴다.</p>
      <table><thead><tr><th>파라미터</th><th>기본값</th><th>뜻</th></tr></thead><tbody>
        <tr><td><code>superuser</code></td><td><code>true</code></td><td>true면 슈퍼유저만 설치·업데이트할 수 있다(단, 아래 <code>trusted</code>가 예외를 만든다). false면 스크립트를 실행하는 데 필요한 권한만 있으면 된다.</td></tr>
        <tr><td><code>trusted</code></td><td><code>false</code></td><td>true면 <code>superuser = true</code>인 확장도 <strong>현재 데이터베이스에 CREATE 권한이 있는 사람은 누구나</strong> 설치할 수 있게 한다. 이때 설치·업데이트 스크립트는 호출한 사용자가 아니라 <strong>부트스트랩 슈퍼유저 권한으로</strong> 실행된다.</td></tr>
      </tbody></table>
      <CodeBlock language="ini">{`# contrib/hstore/hstore.control
comment = 'data type for storing sets of (key, value) pairs'
default_version = '1.8'
module_pathname = '$libdir/hstore'
relocatable = true
trusted = true`}</CodeBlock>
      <p>hstore는 <code>superuser</code> 줄이 없으므로 기본값 <code>true</code>다 — 즉 hstore도 원래는 슈퍼유저 전용이다. <code>trusted = true</code>가 그 요건을 우회하는 예외를 연다.</p>
      <Callout kind="warn" title="trusted는 “스크립트를 덜 위험하게 만든다”는 뜻이 아니다">
        <p>trusted는 <strong>실행 권한을 낮추지 않는다</strong>. 설치 스크립트는 여전히 부트스트랩 슈퍼유저로, 즉 전체 권한으로 실행된다. trusted가 바꾸는 것은 <strong>“누가 그 실행을 트리거할 수 있는가”</strong>뿐이다. 그래서 공식 문서는 “확장을 trusted로 표시하려면 설치·업데이트 스크립트를 안전하게 작성하는 데 상당한 추가 노력이 필요하다”고 명시한다.</p>
      </Callout>
    </Section>

    <Section id="catalog" title="2. 이 이미지에 있는 확장 중 무엇이 trusted인가">
      <p><code>pg_available_extension_versions</code>는 서버에 있는 모든 확장의 <code>trusted</code>·<code>superuser</code> 플래그를 보여준다. 이 카탈로그가 다루는 확장 중 일부를 추렸다.</p>
      <CodeBlock language="sql" output={demo.trust_catalog.output} outputCaption="실제 실행 결과 · postgres:16-trixie 이미지 기준">{demo.trust_catalog.sql}</CodeBlock>
      <ul>
        <li><strong>trusted:</strong> hstore, pg_trgm, pgcrypto, citext, ltree, uuid-ossp — 전부 값 하나를 다루는 데이터 타입이거나 순수 함수 확장이다. 파일시스템·네트워크·서버 프로세스에 접근하지 않는다.</li>
        <li><strong>trusted가 아님:</strong> <Ref to="/hstore/storage#bytes">pageinspect</Ref>(디스크 페이지 원문을 직접 읽는다), <Ref to="/hstore/updates">pg_stat_statements</Ref>(서버 전역 상태에 접근한다), dblink·postgres_fdw(외부 네트워크 연결), adminpack(서버 파일시스템). 공통점은 “DB 한 개 안에서 값 하나만 다루는 것”을 넘어서는 접근이 필요하다는 것이다.</li>
      </ul>
      <p>공식 문서도 같은 기준을 명시한다: “<em>superuser=true</em>인 확장이 <em>trusted</em>가 될 수 있어도, 파일시스템 접근처럼 슈퍼유저 전용 능력을 열어 주는 확장은 일반적으로 trusted로 표시하면 안 된다.”</p>
    </Section>

    <Section id="demo" title="3. 실제로 되는지 확인: DB CREATE 권한이 있는 일반 사용자로">
      <p>슈퍼유저가 아닌 역할을 만들고, hstore와 pageinspect를 각각 설치해 본다. <code>study</code>가 아닌 별도 임시 DB에서 실행했다.</p>
      <CodeBlock language="sql">{`CREATE DATABASE trust_demo;
CREATE ROLE app_owner LOGIN;`}</CodeBlock>
      <p><strong>아직 DB에 CREATE 권한을 주지 않은 상태</strong>에서 시도하면 — trusted인 hstore도 거절된다.</p>
      <CodeBlock language="sql" output={demo.trust_no_create.output} outputCaption="app_owner로 실행 · 실제 오류">{demo.trust_no_create.sql}</CodeBlock>
      <p>오류 메시지 자체가 정확하다: “<strong>Must have CREATE privilege on current database</strong>”. trusted는 슈퍼유저 요건을 없앨 뿐, DB에 대한 CREATE 권한까지 대신 주지는 않는다.</p>
      <CodeBlock language="sql">{demo.trust_grant}</CodeBlock>
      <p>이제 <strong>같은 사용자, 같은 권한</strong>으로 hstore(trusted)와 pageinspect(not trusted)를 각각 설치해 본다.</p>
      <CodeBlock language="sql" output={demo.trust_ok.output} outputCaption="app_owner로 실행 · 실제 실행 결과">{demo.trust_ok.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.trust_pageinspect_denied.output} outputCaption="같은 app_owner, 같은 DB — pageinspect는 여전히 거절된다 · 실제 오류">{demo.trust_pageinspect_denied.sql}</CodeBlock>
      <p>이번에는 힌트가 “<strong>Must be superuser</strong>”로 다르다. <strong>trusted는 확장마다 따로 매겨진 표시이지, 한 번 권한을 얻으면 전부 되는 만능 스위치가 아니다.</strong></p>
    </Section>

    <Section id="ownership" title="4. 소유권이 갈린다: 확장은 내 것, 안의 함수는 아니다">
      <p>공식 문서: “설치를 실행한 사용자가 확장 객체 자체의 소유자가 되지만, 그 안에 담긴 객체들은 (스크립트가 명시적으로 넘기지 않는 한) 부트스트랩 슈퍼유저 소유가 된다. 이 구성은 호출한 사용자에게 확장을 지울 권리는 주지만, 안의 개별 객체를 고칠 권리는 주지 않는다.” 실제로 확인해 본다.</p>
      <CodeBlock language="sql" output={demo.trust_ownership_split.output} outputCaption="실제 실행 결과">{demo.trust_ownership_split.sql}</CodeBlock>
      <p><code>hstore</code> 확장 자체의 소유자는 <code>app_owner</code>지만, 그 안의 함수 <code>hstore_in</code>은 <code>postgres</code>(부트스트랩 슈퍼유저) 소유다. 그래서:</p>
      <CodeBlock language="sql" output={demo.trust_cannot_alter.output} outputCaption="app_owner가 안의 함수를 고치려 하면 · 실제 오류">{demo.trust_cannot_alter.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.trust_can_drop.output} outputCaption="하지만 확장 전체를 지우는 건 된다(확장 자체의 소유자이므로) · 실제 실행 결과">{demo.trust_can_drop.sql}</CodeBlock>
      <p>“설치할 수 있다”와 “안의 객체를 마음대로 바꿀 수 있다”는 다른 권한이다. trusted 확장을 설치한 앱 계정도 그 안의 함수·연산자를 <code>ALTER</code>하거나 소유권을 옮길 수 없다.</p>
    </Section>

    <Section id="default-acl" title="5. CREATE 권한은 기본으로 누구에게도 없다">
      <p>2절의 “아직 권한을 안 줬을 때” 실패는 우연이 아니다. 공식 문서(<Ref to="#refs">GRANT</Ref>)는 새로 만든 데이터베이스에서 <code>PUBLIC</code>(모든 역할)이 기본으로 받는 권한을 이렇게 정리한다: “데이터베이스에는 CONNECT와 TEMPORARY만. 스키마·테이블·시퀀스에는 아무 권한도 기본으로 주지 않는다.” <strong>CREATE는 이 목록에 없다</strong> — 즉 <code>CREATE EXTENSION</code>이 필요로 하는 DB 수준 CREATE 권한은 어떤 버전에서도 기본으로 PUBLIC에 주어진 적이 없다.</p>
      <CodeBlock language="sql" output={demo.trust_public_database_acl.output} outputCaption="새 DB에서 PUBLIC의 실제 권한 · 실제 실행 결과">{demo.trust_public_database_acl.sql}</CodeBlock>
      <p>그래서 관리형 PostgreSQL(RDS 등)에서 애플리케이션 계정이 <code>CREATE EXTENSION hstore</code>를 실행하려면, trusted 여부와 별개로 <strong>그 DB에 CREATE 권한이 있어야</strong> 한다 — 보통 그 DB를 만든 소유자 계정이거나, 소유자가 명시적으로 <code>GRANT CREATE ON DATABASE ...</code>를 실행해 둔 계정이다. (PostgreSQL 15부터는 <code>public</code> 스키마의 CREATE도 기본으로 비어 있다 — 별개의, 스키마 단위 제한이다.)</p>
    </Section>

    <Section id="risk" title="6. 왜 &ldquo;노출돼 있다&rdquo;고 표현하나">
      <p>trusted 확장은 설치자가 <strong>설치 스키마를 고를 수 있다</strong>는 점이 핵심 위험이다. 공식 문서: “확장이 trusted로 표시되어 있으면, 그 설치 스키마는 설치하는 사용자가 고를 수 있다 — 그 사용자가 슈퍼유저 권한을 얻으려는 의도로 일부러 안전하지 않은 스키마를 고를 수도 있다. 그래서 trusted 확장은 보안 관점에서 매우 노출돼 있으며, 모든 스크립트 명령을 손상 가능성이 없는지 꼼꼼히 검토해야 한다.”</p>
      <p>스크립트가 부트스트랩 슈퍼유저 권한으로 실행되므로(1절), 만약 스크립트 안의 명령이 <code>search_path</code>에 의존하는 형태로 부주의하게 쓰여 있다면 — 설치자가 그 search_path에 자신이 만든 “가짜” 객체를 먼저 끼워 넣어, 슈퍼유저 권한으로 자기 코드를 실행시킬 수 있다. hstore·pg_trgm처럼 PostgreSQL 코어와 함께 배포되는 확장은 이런 공격에 대해 검토된 것으로 간주되지만(문서의 표현), 서드파티 trusted 확장을 쓸 때는 스크립트를 신뢰할 수 있는지 직접 판단해야 한다.</p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">근거: <code>doc/src/sgml/extend.sgml</code>의 “Security Considerations for Extensions” 절 (아래 참고 목록의 링크).</p>
    </Section>

    <Section id="why-13" title="7. hstore가 trusted가 된 시점">
      <p>이 파라미터 자체가 PostgreSQL 13에서 도입됐다. 실제로 hstore.control을 버전별로 비교하면 그 경계가 그대로 보인다.</p>
      <CodeBlock language="ini" caption={<>PostgreSQL 12 — <a className="text-primary underline-offset-4 hover:underline" href="https://github.com/postgres/postgres/blob/REL_12_0/contrib/hstore/hstore.control" target="_blank" rel="noreferrer">REL_12_0/contrib/hstore/hstore.control</a></>}>{`comment = 'data type for storing sets of (key, value) pairs'
default_version = '1.6'
module_pathname = '$libdir/hstore'
relocatable = true`}</CodeBlock>
      <CodeBlock language="ini" caption={<>PostgreSQL 13 — <a className="text-primary underline-offset-4 hover:underline" href="https://github.com/postgres/postgres/blob/REL_13_0/contrib/hstore/hstore.control" target="_blank" rel="noreferrer">REL_13_0/contrib/hstore/hstore.control</a></>}>{`comment = 'data type for storing sets of (key, value) pairs'
default_version = '1.7'
module_pathname = '$libdir/hstore'
relocatable = true
trusted = true`}</CodeBlock>
      <p>PostgreSQL 12 이하에서는 <code>trusted</code> 줄 자체가 없다(=false, 슈퍼유저 전용). 13에서 <code>trusted = true</code>가 추가됐고, 그 전까지는 DBA가 아니라면 hstore도 슈퍼유저에게 설치를 요청해야 했다. 관리형 DB가 hstore·pg_trgm 같은 확장을 “셀프서비스로” 열어 줄 수 있게 된 것도 이 변화 이후다 (<Ref to="/hstore/operations#managed">관리형 DB 지원 현황</Ref>).</p>
    </Section>

    <Section id="refs" title="참고">
      <ul>
        <li><a className="text-primary underline-offset-4 hover:underline" href="https://www.postgresql.org/docs/16/extend-extensions.html#EXTEND-EXTENSIONS-FILES" target="_blank" rel="noreferrer">PostgreSQL 16 문서 · Extension Files (trusted·superuser 파라미터)</a></li>
        <li><a className="text-primary underline-offset-4 hover:underline" href="https://www.postgresql.org/docs/16/sql-createextension.html" target="_blank" rel="noreferrer">PostgreSQL 16 문서 · CREATE EXTENSION</a></li>
        <li><a className="text-primary underline-offset-4 hover:underline" href="https://www.postgresql.org/docs/16/extend-extensions.html#EXTEND-EXTENSIONS-SECURITY" target="_blank" rel="noreferrer">PostgreSQL 16 문서 · Security Considerations for Extensions</a></li>
        <li><a className="text-primary underline-offset-4 hover:underline" href="https://www.postgresql.org/docs/16/ddl-priv.html" target="_blank" rel="noreferrer">PostgreSQL 16 문서 · Privileges (PUBLIC 기본 권한)</a></li>
      </ul>
    </Section>
  </>
}
