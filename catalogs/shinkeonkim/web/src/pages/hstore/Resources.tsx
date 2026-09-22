import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import src from '@/data/hstore-source.json'

const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a className="text-primary underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">{children}</a>

export default function Resources() {
  return <>
    <PageHeader eyebrow="Week 04 · 참고 자료" title="공식 문서, GitHub, 글: 무엇을 어디에 썼나"
      lede="이 자료가 근거로 삼은 출처를 종류별로 모았다. 실제로 열어 읽은 것과 검색 결과 요약만 확인한 것을 구분해 적었다."
      tags={[{ label: '확인일 2026-09-21' }]} />

    <Section id="official" title="1. 공식 문서와 소스 (직접 읽음)">
      <table><thead><tr><th>자료</th><th>이 자료에서 쓴 곳</th></tr></thead><tbody>
        <tr><td><A href="https://www.postgresql.org/docs/16/hstore.html">PostgreSQL 16 문서 · hstore</A></td><td>연산자·함수·인덱스 지원표, 중복 키·NULL·공백 규칙, 첨자, trusted, 호환성(9.0 형식), transform 보안 권고 → <Ref to="/hstore/install-syntax">문법</Ref>, <Ref to="/hstore/operations">운영</Ref></td></tr>
        <tr><td><A href={`https://github.com/postgres/postgres/tree/${src.tag}/contrib/hstore`}>postgres/postgres · contrib/hstore ({src.tag})</A></td><td>HEntry·HStore 구조, 정렬·병합, GIN·GiST, 첨자 구현 → <Ref to="/hstore/source">소스 지도</Ref>, <Ref to="/hstore/storage">저장 방식</Ref></td></tr>
        <tr><td><A href={`https://github.com/postgres/postgres/blob/${src.tag}/doc/src/sgml/hstore.sgml`}>doc/src/sgml/hstore.sgml</A></td><td>공식 문서의 원문. 호환성 절(903행 부근)과 transform 절(936행 부근)을 확인</td></tr>
        <tr><td><A href={`https://github.com/postgres/postgres/blob/${src.tag}/src/include/utils/jsonb.h#L119-L128`}>src/include/utils/jsonb.h 119~128행</A></td><td>jsonb가 offset 대신 길이를 저장하는 이유(압축) → <Ref to="/hstore/storage#toast">압축 차이의 원인</Ref></td></tr>
        <tr><td><A href={`https://github.com/postgres/postgres/blob/${src.tag}/contrib/hstore/hstore--1.4.sql`}>hstore--1.4.sql</A> · <A href={`https://github.com/postgres/postgres/blob/${src.tag}/contrib/hstore/hstore--1.7--1.8.sql`}>hstore--1.7--1.8.sql</A></td><td>연산자 클래스 정의(GiST의 <code>&lt;@</code> 주석 처리), 1.8에서 첨자 추가·<code>@</code>·<code>~</code> 제거</td></tr>
        <tr><td><A href="https://www.postgresql.org/docs/16/pageinspect.html">pageinspect</A> · <A href="https://www.postgresql.org/docs/16/pgbench.html">pgbench</A></td><td>실습·실험의 도구 (힙 페이지 바이트, 동시 부하)</td></tr>
      </tbody></table>
    </Section>

    <Section id="managed" title="2. 관리형 서비스 확장 목록 (직접 읽음, 2026-09-21)">
      <table><thead><tr><th>서비스</th><th>링크</th><th>확인한 내용</th></tr></thead><tbody>
        <tr><td>AWS RDS for PostgreSQL</td><td><A href="https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html">확장 버전 표</A></td><td>PG 16~19에서 hstore 1.8</td></tr>
        <tr><td>Azure 유연 서버</td><td><A href="https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-versions">확장 목록</A></td><td>PG 14~18에서 1.8, PG 13은 1.7, 12는 1.6, 11은 1.5</td></tr>
        <tr><td>Google Cloud SQL</td><td><A href="https://docs.cloud.google.com/sql/docs/postgres/extensions">확장 문서</A></td><td>hstore 지원, PG 14 이상 1.8</td></tr>
        <tr><td>Neon</td><td><A href="https://neon.com/docs/extensions/pg-extensions">확장 문서</A></td><td>PG 16·17에서 1.8</td></tr>
        <tr><td>Supabase</td><td><A href="https://supabase.com/docs/guides/database/extensions">확장 안내</A></td><td>문서가 개별 확장 이름을 나열하지 않아 <strong>hstore를 확인하지 못함</strong></td></tr>
      </tbody></table>
    </Section>

    <Section id="redis" title="3. Redis 문서 (직접 읽음)">
      <table><thead><tr><th>자료</th><th>이 자료에서 쓴 곳</th></tr></thead><tbody>
        <tr><td><A href="https://redis.io/docs/latest/develop/data-types/hashes/">Redis hashes</A></td><td>해시 명령의 복잡도(대부분 O(1), HGETALL 등은 O(n)), 해시당 최대 필드 2<sup>32</sup>−1개, 필드 만료, compact hash(8.10) → <Ref to="/hstore/vs-redis">Redis 비교</Ref></td></tr>
        <tr><td><A href="https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/">Redis persistence</A></td><td>RDB·AOF, <code>appendfsync always/everysec/no</code>의 내구성, “PostgreSQL이 제공하는 수준의 데이터 안전성을 원하면 둘을 함께 쓰라”는 안내 → <Ref to="/hstore/vs-redis#benchmark">내구성 쌍 설계</Ref></td></tr>
      </tbody></table>
    </Section>

    <Section id="articles" title="4. 글과 사례">
      <table><thead><tr><th>자료</th><th>상태</th><th>이 자료에서 쓴 곳</th></tr></thead><tbody>
        <tr><td><A href="https://www.citusdata.com/blog/2016/07/14/choosing-nosql-hstore-json-jsonb/">Citus · When to use unstructured datatypes in Postgres — Hstore vs. JSON vs. JSONB</A></td><td>직접 읽음</td><td>hstore = 평평한 키-값·문자열만, 대부분의 경우 jsonb 권고 → <Ref to="/hstore/when-to-use">선택 기준</Ref>. 벤치마크 수치는 글에 없다</td></tr>
        <tr><td><A href="https://osm2pgsql.org/doc/manual.html">osm2pgsql 매뉴얼</A></td><td>검색 결과 발췌로 확인</td><td>별도 열이 없는 태그를 hstore 컬럼에 담는 <code>--hstore</code> 옵션 (사례)</td></tr>
        <tr><td><A href="https://rubydoc.info/docs/rails/ActiveRecord/ConnectionAdapters/PostgreSQL/OID/Hstore:accessor">Rails · ActiveRecord PostgreSQL OID::Hstore</A> (RubyDoc)</td><td>검색 결과 발췌로 확인</td><td>Rails가 hstore 값을 문자열로 캐스팅한다는 점</td></tr>
        <tr><td><A href="https://docs.djangoproject.com/en/2.2/_modules/django/contrib/postgres/fields/hstore/">Django · django.contrib.postgres.fields.hstore</A></td><td>검색 결과 발췌로 확인</td><td>값이 문자열로 저장된다는 점</td></tr>
      </tbody></table>
      <Callout kind="warn" title="읽지 않은 자료를 근거로 삼지 않았다">
        <p>검색으로 찾았지만 본문을 읽지 않은 블로그 글(예: hstore vs jsonb 비교 글 여러 편)은 근거로 쓰지 않았다. 이 자료의 수치는 전부 자체 실험에서 나온 것이고, 외부 글은 위 표의 용도(일반적 권고와 사례)로만 인용했다.</p>
      </Callout>
    </Section>

    <Section id="repo" title="5. 이 저장소 안의 자료">
      <table><thead><tr><th>위치</th><th>내용</th></tr></thead><tbody>
        <tr><td><code>week04/hstore/README.md</code></td><td>이 확장 자료의 진입점</td></tr>
        <tr><td><code>week04/hstore/labs/</code></td><td>Docker 실습 4개 (설치·문법 / 저장 구조 / 인덱스 / 동시성). 각 디렉터리에서 <code>./run.sh</code></td></tr>
        <tr><td><code>week04/hstore/experiments/</code></td><td>실험 5종과 공통 런타임. <Ref to="/hstore/experiments">실험 페이지</Ref>의 재현 명령</td></tr>
        <tr><td><code>hstore.md</code></td><td>카탈로그 한 장 요약 (템플릿 형식)</td></tr>
        <tr><td><code>etc/pg_stat_statements/</code></td><td>이전에 정리한 pg_stat_statements 자료 (week04 준비 자료에서 이동)</td></tr>
      </tbody></table>
    </Section>
  </>
}
