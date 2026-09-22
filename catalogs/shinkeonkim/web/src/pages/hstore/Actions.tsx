import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { demo } from './stats'

export default function Actions() {
  return <>
    <PageHeader eyebrow="Week 04 · 실전 액션" title="조회·조작·삭제: hstore로 할 수 있는 것들"
      lede="사용자 설정 테이블 하나(app_user)를 만들어 생성·조회·수정·삭제를 순서대로 실행한다. 각 SQL과 그 실제 결과를 그대로 실었다. hstore가 직접 지원하지 않아 우회가 필요한 동작(키 이름 바꾸기, 접두사로 지우기)도 실제로 되는 형태로 보여준다."
      tags={[{ label: '실제 실행 결과' }, { label: 'app_user 예제 하나로 끝까지' }]} />

    <Section id="setup" title="0. 준비: 사용자 설정 테이블">
      <CodeBlock language="sql">{demo.crud_setup}</CodeBlock>
      <p>이후의 모든 SQL은 이 테이블 하나를 계속 바꿔 가며 실행한 것이다 — 각 결과는 그 앞의 결과 위에 누적된다.</p>
    </Section>

    <Section id="create" title="1. 생성 (Create)">
      <h3>리터럴로 바로 삽입</h3>
      <CodeBlock language="sql" output={demo.crud_insert_literal.output} outputCaption="실제 실행 결과">{demo.crud_insert_literal.sql}</CodeBlock>
      <h3>API 요청 본문(JSON)을 그대로 받기</h3>
      <p>클라이언트가 JSON으로 보낸 설정을 hstore 컬럼에 넣을 때는 <code>jsonb_each_text</code>로 펼쳐 <code>hstore()</code>로 다시 묶는다 (<Ref to="/hstore/vs-jsonb#convert">jsonb ↔ hstore 변환</Ref>).</p>
      <CodeBlock language="sql" output={demo.crud_insert_from_json.output} outputCaption="실제 실행 결과">{demo.crud_insert_from_json.sql}</CodeBlock>
    </Section>

    <Section id="read" title="2. 조회 (Read)">
      <h3>키 하나 꺼내기</h3>
      <CodeBlock language="sql" output={demo.crud_read_one_key.output} outputCaption="실제 실행 결과">{demo.crud_read_one_key.sql}</CodeBlock>
      <h3>여러 키를 한 번에</h3>
      <CodeBlock language="sql" output={demo.crud_read_many_keys.output} outputCaption="실제 실행 결과 · 배열로 돌아온다">{demo.crud_read_many_keys.sql}</CodeBlock>
      <h3>키가 있는지만 확인</h3>
      <CodeBlock language="sql" output={demo.crud_read_key_exists.output} outputCaption="실제 실행 결과">{demo.crud_read_key_exists.sql}</CodeBlock>
      <h3>조건에 맞는 행 찾기</h3>
      <p>여러 키-값 쌍을 동시에 만족하는 행은 <code>@&gt;</code> 하나로 찾는다. <Ref to="/hstore/indexes">GIN 인덱스</Ref>가 있으면 이 형태의 조건이 그대로 인덱스를 탄다.</p>
      <CodeBlock language="sql" output={demo.crud_read_filter.output} outputCaption="실제 실행 결과">{demo.crud_read_filter.sql}</CodeBlock>
      <h3>역방향 조회: “이 값을 가진 사람은?”</h3>
      <CodeBlock language="sql" output={demo.crud_read_reverse.output} outputCaption="실제 실행 결과">{demo.crud_read_reverse.sql}</CodeBlock>
      <h3>한 행의 설정을 화면에 표로 보여주기</h3>
      <CodeBlock language="sql" output={demo.crud_read_unnest.output} outputCaption="실제 실행 결과 · each()로 (key, value) 행 집합을 얻는다">{demo.crud_read_unnest.sql}</CodeBlock>
      <h3>집계: 어떤 설정 키가 가장 흔한가</h3>
      <p>제품 분석·마이그레이션 우선순위를 정할 때 쓴다. 결과가 많으면 값이 큰 hstore에서는 비용이 커진다 (<Ref to="/hstore/updates#read">읽기 비용</Ref>).</p>
      <CodeBlock language="sql" output={demo.crud_read_aggregate.output} outputCaption="실제 실행 결과">{demo.crud_read_aggregate.sql}</CodeBlock>
    </Section>

    <Section id="update" title="3. 수정 (Update)">
      <h3>키 하나 추가/변경 — 나머지는 그대로</h3>
      <CodeBlock language="sql" output={demo.crud_update_merge.output} outputCaption="실제 실행 결과">{demo.crud_update_merge.sql}</CodeBlock>
      <h3>UPSERT: 있으면 병합, 없으면 생성</h3>
      <p><code>ON CONFLICT ... DO UPDATE</code>에서 <code>||</code>를 쓰면 <strong>기존 설정을 지우지 않고 새 값만 겹쳐 쓴다</strong>. <code>SET settings = excluded.settings</code>로만 쓰면 기존 키가 전부 날아간다는 점과 비교해서 본다.</p>
      <CodeBlock language="sql" output={demo.crud_update_upsert.output} outputCaption="실제 실행 결과 · beta 키가 추가되고 나머지는 남았다">{demo.crud_update_upsert.sql}</CodeBlock>
      <Callout kind="warn" title="함정: SET settings = excluded.settings 였다면">
        <p>병합(<code>||</code>) 대신 <code>SET settings = excluded.settings</code>로 썼다면, 이번에 보낸 <code>beta=&gt;on</code> 하나만 남고 <code>theme</code>·<code>locale</code>·<code>marketing_email</code>은 전부 사라졌을 것이다. UPSERT에서 hstore를 “부분 갱신”하려면 반드시 <code>||</code>로 병합해야 한다.</p>
      </Callout>
      <h3>키 이름 바꾸기: hstore에는 rename이 없다</h3>
      <p>연산자 목록(<Ref to="/hstore/install-syntax#operators">문법 페이지</Ref>)에 “키 이름 변경”은 없다. 값을 꺼내 새 키로 넣고 옛 키를 지우는 두 단계로 대신한다 — <strong>원자적으로 한 문장</strong> 안에서 할 수 있다.</p>
      <CodeBlock language="sql" output={demo.crud_update_rename_key.output} outputCaption="실제 실행 결과 · locale이 language로 바뀌었다">{demo.crud_update_rename_key.sql}</CodeBlock>
    </Section>

    <Section id="delete" title="4. 삭제 (Delete)">
      <h3>키 하나 삭제</h3>
      <CodeBlock language="sql" output={demo.crud_delete_key.output} outputCaption="실제 실행 결과">{demo.crud_delete_key.sql}</CodeBlock>
      <h3>조건에 맞는 값만 삭제</h3>
      <p>hstore에는 “이 값을 가진 키만 지워라” 같은 조건부 삭제 연산자가 없다. <code>CASE</code>로 조건을 먼저 판단한 뒤 지운다. 이번엔 <code>WHERE</code> 없이 테이블 전체에 적용해, 조건에 맞는 행만 실제로 바뀌는 것을 본다.</p>
      <CodeBlock language="sql" output={demo.crud_delete_by_value.output} outputCaption="실제 실행 결과 · marketing_email=off였던 행만 지워졌다(kim·park·choi·yamada), on이었던 lee는 남았다">{demo.crud_delete_by_value.sql}</CodeBlock>
      <h3>접두사로 여러 키 한 번에 삭제</h3>
      <p>이것도 hstore에 직접 있는 기능이 아니다 — <code>each()</code>로 펼쳐 <code>LIKE</code>로 거른 뒤 <code>hstore()</code>로 다시 조립한다. 알림(<code>notify_*</code>) 설정을 일괄 초기화하는 상황을 가정했다.</p>
      <CodeBlock language="sql" output={demo.crud_delete_by_prefix.output} outputCaption="실제 실행 결과 · notify_push가 사라졌다">{demo.crud_delete_by_prefix.sql}</CodeBlock>
      <h3>컬럼 전체 비우기</h3>
      <CodeBlock language="sql" output={demo.crud_delete_clear.output} outputCaption="실제 실행 결과 · 빈 hstore(''), NULL이 아니다">{demo.crud_delete_clear.sql}</CodeBlock>
    </Section>

    <Section id="summary" title="5. 한 장 요약">
      <table><thead><tr><th>하고 싶은 것</th><th>바로 되는가</th><th>방법</th></tr></thead><tbody>
        <tr><td>키 하나 추가/변경</td><td>✔ 직접 지원</td><td><code>attrs || 'k=&gt;v'</code></td></tr>
        <tr><td>키 하나 삭제</td><td>✔ 직접 지원</td><td><code>attrs - 'k'::text</code></td></tr>
        <tr><td>여러 키 동시 확인</td><td>✔ 직접 지원</td><td><code>attrs @&gt; 'a=&gt;1, b=&gt;2'</code></td></tr>
        <tr><td>UPSERT 시 부분 병합</td><td>✔ 직접 지원 (연산자 조합)</td><td><code>ON CONFLICT DO UPDATE SET attrs = t.attrs || excluded.attrs</code></td></tr>
        <tr><td>같은 행의 두 hstore 비교(변경분 추출)</td><td>✔ 직접 지원</td><td><code>attrs - attrs_prev</code> (<Ref to="/hstore/use-cases#multi">여러 hstore 컬럼</Ref>)</td></tr>
        <tr><td>키 이름 바꾸기</td><td>✘ 우회 필요</td><td>꺼내서 새 키로 넣고 옛 키 삭제</td></tr>
        <tr><td>값 조건으로 키 삭제</td><td>✘ 우회 필요</td><td><code>CASE WHEN ... THEN attrs - 'k'::text ELSE attrs END</code></td></tr>
        <tr><td>접두사로 키 일괄 삭제</td><td>✘ 우회 필요</td><td><code>each()</code>로 펼쳐 걸러서 재조립</td></tr>
        <tr><td>값 자체를 부분 수정(문자열 치환 등)</td><td>✘ 우회 필요</td><td>꺼내서(<code>-&gt;</code>) 앱이나 SQL 문자열 함수로 고친 뒤 다시 <code>||</code></td></tr>
      </tbody></table>
      <p>“우회 필요”로 표시된 것들의 공통점: hstore는 <strong>키-값 쌍 단위</strong>로만 조작한다. 값의 일부, 키의 이름, 여러 키에 걸친 패턴은 전부 <code>each()</code>로 꺼내 SQL·앱 코드로 처리한 뒤 다시 hstore로 조립해야 한다 — 이 조립 자체가 <Ref to="/hstore/updates">값 전체 재기록</Ref>이라는 점도 함께 고려한다.</p>
    </Section>
  </>
}
