import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { demo } from './stats'

const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a className="text-primary underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">{children}</a>

export default function UseCases() {
  return <>
    <PageHeader eyebrow="Week 04 · 실무 사용처" title="hstore는 실제로 어디에 쓰이나"
      lede="블로그 글의 일반론이 아니라, 프레임워크 코어와 실제로 쓰이는 도구·라이브러리가 hstore를 어떻게 썼는지 찾아 확인했다. 세 가지는 서드파티 gem이 아니라 프레임워크·도구 자체의 코드/문서에서 직접 확인한 것이다."
      tags={[{ label: 'Rails ActiveRecord 코어' }, { label: 'Django contrib.postgres 코어' }, { label: 'osm2pgsql 공식 도구' }]} />

    <Section id="frameworks" title="1. 프레임워크가 직접 지원한다">
      <p>hstore는 서드파티가 흉내 낸 게 아니라, 두 주요 ORM의 <strong>코어</strong>에 타입 캐스팅이 내장돼 있다.</p>
      <table><thead><tr><th>프레임워크</th><th>무엇이 코어에 있나</th><th>쓰는 법</th></tr></thead><tbody>
        <tr><td>Ruby on Rails</td><td><code>ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Hstore</code> — hstore ↔ Ruby Hash 직렬화가 어댑터에 내장</td><td><code>store_accessor :settings, :theme, :locale</code> 한 줄로 hstore 컬럼의 키를 모델 속성처럼 쓴다</td></tr>
        <tr><td>Django</td><td><code>django.contrib.postgres.fields.HStoreField</code> — <code>django.contrib.postgres</code>에 내장(별도 설치 불필요)</td><td>모델 필드로 선언하면 dict ↔ hstore 변환을 ORM이 처리한다</td></tr>
      </tbody></table>
      <p>Rails 공식 문서(<code>ActiveRecord::Store</code>)는 이렇게 적는다: “구조화된 DB 데이터 타입(PostgreSQL hstore/json, MySQL 5.7+ json 등)을 쓴다면 <code>.store</code>가 제공하는 직렬화가 필요 없다” — 즉 hstore·jsonb를 <strong>진짜 컬럼 타입으로</strong> 취급하고, 그 외의 경우에만 일반 컬럼에 직렬화해 욱여넣는다는 뜻이다.</p>
      <CodeBlock language="ruby">{`# Rails: 마이그레이션과 모델
add_column :users, :settings, :hstore
class User < ApplicationRecord
  store_accessor :settings, :theme, :locale   # user.theme, user.theme = "dark" 처럼 접근
end`}</CodeBlock>
      <p>출처: <A href="https://api.rubyonrails.org/classes/ActiveRecord/Store.html">Rails API 문서 · ActiveRecord::Store</A>, <A href="https://github.com/rails/rails/blob/main/activerecord/lib/active_record/connection_adapters/postgresql/oid/hstore.rb">Rails 소스 · postgresql/oid/hstore.rb</A>, <A href="https://docs.djangoproject.com/en/stable/ref/contrib/postgres/fields/#hstorefield">Django 문서 · HStoreField</A>.</p>
    </Section>

    <Section id="osm" title="2. 지도 데이터의 비정형 태그: OpenStreetMap">
      <p>OpenStreetMap 데이터를 PostgreSQL/PostGIS로 옮기는 표준 도구 <strong>osm2pgsql</strong>은 <code>-k</code>/<code>--hstore</code> 옵션으로 “정해진 열에 없는 모든 태그”를 hstore 컬럼 하나(<code>tags</code>)에 담는다. OSM의 태그는 <code>amenity=restaurant</code>, <code>cuisine=korean</code>처럼 사실상 끝이 없는 키 집합이라, 열을 미리 정의할 수 없는 대표적인 사례다.</p>
      <CodeBlock language="bash">{`osm2pgsql --hstore --create --database gis planet.osm.pbf
# 정해진 열(name, highway, ...)에 없는 태그가 전부 tags hstore 컬럼에 들어간다`}</CodeBlock>
      <p>공식 매뉴얼은 “<code>hstore</code> 확장을 켜는 건 선택이고 osm2pgsql 자체에는 필요 없지만, 널리 쓰이는 구성에서 쓰인다”고 적는다 — 즉 osm2pgsql이 hstore를 강제하지는 않지만, 실제 배포 사례 다수가 이 옵션을 쓴다는 뜻이다. <code>--hstore-column</code>으로 특정 접두사의 태그만 별도 hstore 컬럼에 모을 수도 있다(<Ref to="#multi">4절</Ref>의 “여러 hstore 컬럼” 패턴과 같은 발상이다).</p>
      <p>출처: <A href="https://osm2pgsql.org/doc/manual.html">osm2pgsql 공식 매뉴얼</A>.</p>
    </Section>

    <Section id="i18n" title="3. 필드별 다국어 번역 (여러 hstore 컬럼)">
      <p>Globalize처럼 언어별로 별도 테이블을 두는 대신, <strong>번역이 필요한 필드마다 hstore 컬럼 하나</strong>를 두고 그 안에 <code>{`locale => 번역문`}</code>을 담는 방식이 Rails 생태계에 여러 gem으로 나와 있다(<code>hstore_translate</code>와 그 포크들 — cfabianski, Leadformance, mirego, 그리고 jsonb로 옮긴 LunarLogic의 <code>jsonb_translate</code>까지, 여러 팀이 독립적으로 유지보수할 만큼 실제로 쓰인 패턴이다).</p>
      <CodeBlock language="ruby">{`create_table :posts do |t|
  t.column :title_translations, 'hstore'
  t.column :body_translations,  'hstore'
end

class Post < ActiveRecord::Base
  translates :title, :body
end`}</CodeBlock>
      <p>실제로 만들어 확인한다: <code>post(title_translations hstore, body_translations hstore)</code> — 한 테이블에 hstore 컬럼이 <strong>둘</strong>이다.</p>
      <CodeBlock language="sql">{demo.multi_translate_setup}</CodeBlock>
      <CodeBlock language="sql" output={demo.multi_translate_read.output} outputCaption="실제 실행 결과">{demo.multi_translate_read.sql}</CodeBlock>
      <p>출처: <A href="https://github.com/cfabianski/hstore_translate">GitHub · hstore_translate</A>.</p>
    </Section>

    <Section id="patterns" title="4. 그 밖에 자주 꼽히는 패턴">
      <p>아래는 특정 회사·제품을 지목할 근거는 못 찾았지만, 여러 출처(공식 문서·튜토리얼·Q&amp;A)가 공통으로 꼽는 일반적인 패턴이다. 이 카탈로그의 실험·실습에서 실제로 다룬 부분과 연결했다.</p>
      <table><thead><tr><th>패턴</th><th>왜 hstore인가</th><th>이 카탈로그의 관련 자료</th></tr></thead><tbody>
        <tr><td>상품·엔티티의 가변 속성 (색상, 소재, 전압 등 종류마다 다른 스펙)</td><td>속성 종류가 상품 카테고리마다 달라 고정 열로 두면 대부분 NULL인 넓은 테이블이 된다</td><td><Ref to="/hstore/about#why">개요 · Before/After</Ref>, <Ref to="/hstore/indexes">인덱스로 속성 조회</Ref></td></tr>
        <tr><td>사용자 설정·환경설정(theme, locale, 알림 on/off)</td><td>사용자가 자유롭게 추가할 수 있는 토글류라 스키마 변경 없이 키를 늘린다</td><td><Ref to="/hstore/actions">실전 액션 · app_user 예제</Ref></td></tr>
        <tr><td>변경 이력·감사(무엇이 바뀌었는지)</td><td><code>hstore(row)</code>로 행 전체를 스냅샷 떠 두면 <code>-</code> 연산자로 바뀐 필드만 뽑아낼 수 있다</td><td><Ref to="#multi">4절 · 변경 감사</Ref></td></tr>
        <tr><td>요청/응답 헤더, 외부 API 원본 메타데이터 로깅</td><td>헤더 키 집합이 호출마다 다르고, 굳이 타입을 나눌 이유가 없는 문자열 모음이다</td><td>—</td></tr>
      </tbody></table>
    </Section>

    <Section id="multi" title="5. 결론: 한 테이블에 hstore를 여러 개 둬도 되는가">
      <Callout kind="ok" title="된다 — 그리고 실제로 이렇게 쓴다">
        <p>hstore 자체에는 “테이블당 하나”라는 제약이 없다. 3절의 번역 패턴(<code>title_translations</code> + <code>body_translations</code>)처럼 <strong>서로 다른 관심사(필드별 번역, 공개/내부 속성, 현재/이전 스냅샷)를 컬럼으로 분리</strong>하는 것이 실제로 쓰이는 이유다. 컬럼을 나누면 각 hstore의 키 집합이 좁고 의미가 분명해지고, 인덱스도 필요한 컬럼에만 걸 수 있다.</p>
      </Callout>
      <p>변경 감사도 같은 발상이다 — 같은 행 안에 <strong>현재값</strong>과 <strong>이전값</strong>을 각각 hstore로 두면, hstore끼리의 <code>-</code> 연산자로 “무엇이 바뀌었는지”를 SQL 한 줄로 얻는다 (<Ref to="/hstore/source#op">소스: hstore_delete_hstore</Ref>).</p>
      <CodeBlock language="sql">{demo.multi_audit_setup}</CodeBlock>
      <CodeBlock language="sql">{demo.multi_audit_update}</CodeBlock>
      <CodeBlock language="sql" output={demo.multi_audit_diff.output} outputCaption="실제 실행 결과 · attrs - attrs_prev = 바뀐 뒤의 값, attrs_prev - attrs = 바뀌기 전의 값">{demo.multi_audit_diff.sql}</CodeBlock>
      <Callout kind="warn" title="공짜는 아니다: 인덱스는 컬럼마다 따로 든다">
        <p>hstore 컬럼을 쪼갠다고 저장 공간이나 인덱스 비용이 줄지는 않는다 — GIN을 걸면 <strong>컬럼 수만큼</strong> 인덱스가 생긴다. 3절의 <code>post</code> 테이블에 두 컬럼 모두 GIN을 걸면:</p>
        <CodeBlock language="sql" output={demo.multi_translate_index.output} outputCaption="실제 실행 결과 · 인덱스 2개가 따로 생긴다">{demo.multi_translate_index.sql}</CodeBlock>
        <p>쓰기 비용도 컬럼마다 <Ref to="/hstore/updates">값 전체 재기록</Ref> 규칙을 각자 따른다 — 한 컬럼만 바뀌어도 그 컬럼만 다시 쓰이는 건 맞지만, 두 컬럼을 같은 UPDATE에서 같이 바꾸면 두 배가 된다. 컬럼을 나누는 기준은 “같이 바뀌고 같이 조회되는 키인가”로 잡는다 — 그렇지 않다면 나누는 쪽이 유리하다.</p>
      </Callout>
    </Section>
  </>
}
