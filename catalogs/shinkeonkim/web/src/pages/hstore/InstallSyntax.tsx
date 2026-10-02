import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { demo } from './stats'

export default function InstallSyntax() {
  return <>
    <PageHeader eyebrow="Week 04 · 설치와 문법" title="hstore 설치와 기본 문법"
      lede="hstore는 PostgreSQL 본체에 들어 있는 contrib 확장이다. 서버 재시작이나 shared_preload_libraries 설정이 필요 없고, 데이터베이스마다 CREATE EXTENSION 한 번이면 된다." />

    <Section id="install" title="1. 설치">
      <h3>서버가 hstore를 갖고 있는지 확인</h3>
      <p>확장 파일이 서버에 있는지는 <code>pg_available_extensions</code>로 확인한다. <code>installed_version</code>이 비어 있으면 파일은 있고 이 DB에는 아직 만들지 않은 상태다.</p>
      <CodeBlock language="sql" output={demo.available.output} outputCaption="실제 실행 결과 · CREATE EXTENSION 이전">{demo.available.sql}</CodeBlock>
      <table><thead><tr><th>환경</th><th>준비</th></tr></thead><tbody>
        <tr><td>공식 Docker 이미지 (<code>postgres:16</code>)</td><td>contrib 모듈이 이미 들어 있다. 이 자료의 실습이 이 방식이다.</td></tr>
        <tr><td>배포판 패키지·소스 빌드</td><td>패키지 구성이 배포판마다 다르다. 위 쿼리로 확인하고, 없으면 contrib 패키지를 추가하거나 <code>contrib/hstore</code>를 빌드한다.</td></tr>
        <tr><td>관리형 DB</td><td>대부분 <code>CREATE EXTENSION hstore</code>만 허용한다. <Ref to="/hstore/operations#managed">지원 현황</Ref> 참고.</td></tr>
      </tbody></table>
      <h3>trusted 확장이다</h3>
      <CodeBlock language="sql" output={demo.trusted.output} outputCaption="실제 실행 결과">{demo.trusted.sql}</CodeBlock>
      <p><code>trusted = t</code>이면 슈퍼유저가 아니어도 해당 DB에 <code>CREATE</code> 권한이 있으면 설치할 수 있다. <code>relocatable = t</code>이므로 원하는 스키마에 설치할 수 있지만, 연산자를 찾지 못하는 일을 줄이려면 <code>public</code>이나 검색 경로에 있는 스키마에 둔다. trusted가 정확히 무엇을 허용하고 무엇은 여전히 막는지는 <Ref to="/hstore/trusted">trusted 확장이란</Ref>에서 실제 권한 테스트로 확인한다.</p>
      <CodeBlock language="sql">{demo.create}</CodeBlock>
      <p>설치되는 객체는 타입 하나와 연산자·함수·연산자 클래스다. 종류별 개수는 다음과 같다.</p>
      <CodeBlock language="sql" output={demo.objects.output} outputCaption="실제 실행 결과">{demo.objects.sql}</CodeBlock>
      <SourceNote path="week04/hstore/labs/01-install-and-syntax/sql/01-install-and-literals.sql" />
    </Section>

    <Section id="literal" title="2. 리터럴: 문자열을 hstore로">
      <p>hstore 리터럴은 <code>키=&gt;값</code> 쌍을 쉼표로 이은 문자열이다. 쌍 앞뒤의 공백은 무시하고, 공백이나 쉼표가 들어간 키·값은 큰따옴표로 감싼다.</p>
      <CodeBlock language="sql" output={demo.literal_basic.output} outputCaption="실제 실행 결과">{demo.literal_basic.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.literal_quoted.output} outputCaption="실제 실행 결과">{demo.literal_quoted.sql}</CodeBlock>
      <h3>출력 순서는 입력 순서가 아니다</h3>
      <p>hstore는 쌍을 <strong>키 길이 → 같은 길이면 바이트 순</strong>으로 정렬해 저장한다. 출력도 그 순서다. 사전순이 아니므로 <code>b</code>가 <code>aa</code>보다 앞에 온다. 이 정렬이 이진 탐색 조회의 바탕이다 (<Ref to="/hstore/storage">저장 방식</Ref>).</p>
      <CodeBlock language="sql" output={demo.literal_sorted.output} outputCaption="실제 실행 결과">{demo.literal_sorted.sql}</CodeBlock>
      <h3>중복 키는 하나만 남는다</h3>
      <CodeBlock language="sql" output={demo.literal_duplicate.output} outputCaption="실제 실행 결과 · 이번 실행에서는 앞의 값이 남았다">{demo.literal_duplicate.sql}</CodeBlock>
      <Callout kind="warn" title="어느 값이 남는지에 기대지 않는다">
        <p>공식 문서는 중복 키 중 <strong>어느 것이 남는지 보장하지 않는다</strong>고 적는다. 위 결과는 이 버전에서 관찰한 값이다. 합치려는 의도가 있으면 <code>||</code>(오른쪽이 이긴다)를 쓴다.</p>
      </Callout>
      <h3>NULL 값과 "NULL" 문자열, 빈 문자열</h3>
      <p>값은 <code>NULL</code>일 수 있지만 키는 안 된다. 큰따옴표로 감싼 <code>"NULL"</code>은 문자열이다.</p>
      <CodeBlock language="sql" output={demo.literal_nulls.output} outputCaption="입력: a=>NULL, b=>&quot;NULL&quot;, c=>&quot;&quot; · 실제 실행 결과">{demo.literal_nulls.sql}</CodeBlock>
      <p><code>exist</code>는 키가 있으면 true이고, <code>defined</code>는 키가 있으면서 값이 NULL이 아닐 때 true다. <code>-&gt;</code>는 키가 없을 때도, 값이 NULL일 때도 NULL을 돌려주므로 두 경우를 구분하려면 <code>exist</code>나 <code>?</code>를 쓴다.</p>
      <h3>값은 전부 text다</h3>
      <CodeBlock language="sql" output={demo.text_type.output} outputCaption="실제 실행 결과">{demo.text_type.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.text_type_error.output} outputCaption="캐스팅 없이 더했을 때의 오류 (실제 출력)">{demo.text_type_error.sql}</CodeBlock>
    </Section>

    <Section id="operators" title="3. 연산자">
      <table><thead><tr><th>연산자</th><th>뜻</th><th>인덱스</th></tr></thead><tbody>
        <tr><td><code>h -&gt; 'k'</code> · <code>h -&gt; ARRAY[...]</code></td><td>키의 값 / 여러 키의 값 배열. 없으면 NULL</td><td>식 인덱스</td></tr>
        <tr><td><code>h ? 'k'</code></td><td>키가 있는가</td><td>GIN · GiST</td></tr>
        <tr><td><code>h ?&amp; ARRAY[...]</code> · <code>h ?| ARRAY[...]</code></td><td>키가 모두 / 하나라도 있는가</td><td>GIN · GiST</td></tr>
        <tr><td><code>h @&gt; h2</code> · <code>h2 &lt;@ h</code></td><td>h가 h2의 키-값 쌍을 모두 갖는가 (포함). <code>&lt;@</code>는 인덱스 미지원</td><td><code>@&gt;</code>만 GIN · GiST</td></tr>
        <tr><td><code>h || h2</code></td><td>합치기. 같은 키는 오른쪽이 이긴다</td><td>—</td></tr>
        <tr><td><code>h - 'k'</code> · <code>h - ARRAY[...]</code> · <code>h - h2</code></td><td>키 / 키 배열 / 같은 쌍 삭제</td><td>—</td></tr>
        <tr><td><code>h #= record</code></td><td>레코드의 필드를 h의 값으로 교체</td><td>—</td></tr>
        <tr><td><code>%% h</code> · <code>%# h</code></td><td>평평한 배열 / 2차원 배열로 변환</td><td>—</td></tr>
        <tr><td><code>h = h2</code></td><td>동등 비교 (전체)</td><td>btree · hash</td></tr>
      </tbody></table>
      <p>인덱스 열은 공식 문서의 표를 실제 카탈로그로 다시 확인한 것이다 (<Ref to="/hstore/indexes#matrix">인덱스 페이지</Ref>).</p>
      <h3>값 꺼내기</h3>
      <CodeBlock language="sql" output={demo.op_fetch.output} outputCaption="실제 실행 결과 · 상품 예제 테이블">{demo.op_fetch.sql}</CodeBlock>
      <h3>키 존재 · 포함</h3>
      <CodeBlock language="sql" output={demo.op_exists.output} outputCaption="실제 실행 결과">{demo.op_exists.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.op_contains.output} outputCaption="실제 실행 결과">{demo.op_contains.sql}</CodeBlock>
      <h3>합치기와 지우기</h3>
      <CodeBlock language="sql" output={demo.op_merge.output} outputCaption="실제 실행 결과 · 같은 키(color)는 오른쪽 값, 없는 키(stock)는 추가">{demo.op_merge.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.op_delete.output} outputCaption="실제 실행 결과">{demo.op_delete.sql}</CodeBlock>
      <Callout kind="warn" title="함정: h - 'key' 는 오류가 난다">
        <p><code>-</code>는 오른쪽이 text, text[], hstore인 세 가지가 있다. 따옴표만 있는 리터럴은 타입이 정해지지 않아 <strong>hstore로 해석</strong>되고, <code>material</code>이 hstore 문법(<code>키=&gt;값</code>)이 아니므로 오류가 난다. 키를 지울 때는 <code>::text</code>를 붙이거나 <code>delete(h, 'key')</code>를 쓴다. 파라미터로 전달하는 값은 드라이버가 타입을 정하므로 문제없는 경우가 많다.</p>
      </Callout>
      <CodeBlock language="sql" output={demo.op_delete_error.output} outputCaption="::text 없이 실행하면 (실제 출력)">{demo.op_delete_error.sql}</CodeBlock>
    </Section>

    <Section id="functions" title="4. 자주 쓰는 함수">
      <table><thead><tr><th>함수</th><th>하는 일</th></tr></thead><tbody>
        <tr><td><code>hstore(text[], text[])</code> · <code>hstore(text, text)</code> · <code>hstore(record)</code></td><td>두 배열 / 한 쌍 / 행 전체를 hstore로 만든다</td></tr>
        <tr><td><code>akeys</code> · <code>avals</code> · <code>skeys</code> · <code>svals</code></td><td>키·값을 배열(a) 또는 행 집합(s)으로 꺼낸다</td></tr>
        <tr><td><code>each</code></td><td>(key, value) 행으로 펼친다</td></tr>
        <tr><td><code>exist</code> · <code>defined</code></td><td>키 존재 / 키가 있고 값이 NULL이 아님</td></tr>
        <tr><td><code>delete</code> · <code>slice</code></td><td>키 삭제 / 일부 키만 남기기</td></tr>
        <tr><td><code>populate_record</code></td><td>hstore 값으로 행 타입의 필드를 채운다</td></tr>
        <tr><td><code>hstore_to_json</code> · <code>hstore_to_jsonb</code> · <code>*_loose</code></td><td>json/jsonb로 변환 (<Ref to="/hstore/vs-jsonb#convert">변환 페이지</Ref>)</td></tr>
      </tbody></table>
      <CodeBlock language="sql" output={demo.fn_keys_vals.output} outputCaption="실제 실행 결과">{demo.fn_keys_vals.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.fn_build.output} outputCaption="실제 실행 결과 · 배열·한 쌍·행·집계로 만들기">{demo.fn_build.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.fn_populate.output} outputCaption="실제 실행 결과 · 이름이 같은 키의 값이 채워지고 없는 키(size)는 NULL">{demo.fn_populate.sql}</CodeBlock>
      <p>어떤 속성이 몇 개 행에 쓰이는지 세는 쿼리는 <code>skeys</code>와 <code>LATERAL</code>로 쓴다. 속성 목록이 자라는 모습을 관찰할 때 유용하다.</p>
      <CodeBlock language="sql" output={demo.fn_key_stats.output} outputCaption="실제 실행 결과">{demo.fn_key_stats.sql}</CodeBlock>
    </Section>

    <Section id="subscript" title="5. 첨자와 갱신">
      <p>hstore 1.8(PostgreSQL 14 이상)부터 <code>h['key']</code> 첨자로 읽고 쓸 수 있다. 읽기에서 키가 없거나 첨자가 NULL이면 NULL, 쓰기에서 첨자가 NULL이면 오류다.</p>
      <CodeBlock language="sql" output={demo.sub_read.output} outputCaption="실제 실행 결과">{demo.sub_read.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.sub_write.output} outputCaption="실제 실행 결과 · 있는 키는 바꾸고 없는 키는 추가">{demo.sub_write.sql}</CodeBlock>
      <p>공식 문서는 <strong>여러 키를 한 번에 바꿀 때는 <code>||</code>가 첨자보다 효율적</strong>이라고 안내한다. 키 하나만 바꿀 때의 비용은 둘이 같았다 (<Ref to="/hstore/updates">갱신 비용 실험</Ref>). 키 삭제는 <code>-</code>다.</p>
      <CodeBlock language="sql" output={demo.upd_concat.output} outputCaption="실제 실행 결과">{demo.upd_concat.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.upd_delete.output} outputCaption="실제 실행 결과">{demo.upd_delete.sql}</CodeBlock>
      <p>카운터처럼 값을 계산해 올릴 때는 캐스팅과 <code>coalesce</code>가 필요하다. 이 형태가 <strong>UPDATE 안에서 값을 계산하는 원자적 갱신</strong>이며, 동시 갱신에서 유실이 없다 (<Ref to="/hstore/concurrency">동시성</Ref>).</p>
      <CodeBlock language="sql" output={demo.upd_counter.output} outputCaption="실제 실행 결과">{demo.upd_counter.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.sub_null_error.output} outputCaption="NULL 첨자로 쓰면 (실제 출력)">{demo.sub_null_error.sql}</CodeBlock>
    </Section>

    <Section id="next" title="다음으로">
      <p>연산자와 함수를 익혔다면 <Ref to="/hstore/when-to-use">언제 쓰고 언제 피하나</Ref>에서 이 확장이 맞는 상황인지 판단한다. 이 페이지의 SQL은 <code>week04/hstore/labs/01-install-and-syntax</code>에서 그대로 실행할 수 있다.</p>
    </Section>
  </>
}
