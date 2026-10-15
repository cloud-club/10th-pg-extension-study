import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function DollarQuoting() {
  return <>
    <PageHeader eyebrow="Week 03 · PostgreSQL SQL 기초" title="$$…$$는 문자열을 쓰는 dollar quoting 문법이다" lede="pg_cron 전용 문법이 아니다. 작은따옴표가 많은 함수 본문이나 예약 SQL을 읽기 쉽게 하나의 text 값으로 전달할 때 쓰는 PostgreSQL 문자열 표기법이다." />
    <Section title="1. 안쪽 SQL을 지금 실행하지 않고 문자열 값으로 넘긴다">
      <CodeBlock language="sql" output={"               command                | type\n--------------------------------------+------\n INSERT INTO audit_log VALUES ('ok') | text\n(1 row)"}>{`SELECT $$INSERT INTO audit_log VALUES ('ok')$$ AS command,
       pg_typeof($$INSERT INTO audit_log VALUES ('ok')$$) AS type;`}</CodeBlock>
      <p>바깥 SELECT가 실행될 때 결과는 SQL 문장의 글자들로 이루어진 text 값이다. 안쪽 INSERT는 이 순간 실행되지 않는다. <code>cron.schedule</code>이 그 문자열을 <code>cron.job.command</code>에 저장하고, 예약 시각이 되면 별도 실행 프로세스가 SQL로 해석한다.</p>
      <CodeBlock language="sql" output={' schedule\n----------\n       12\n(1 row)'} outputCaption="설명용 출력 · 12는 저장된 예약의 jobid">{`SELECT cron.schedule(
  'cleanup-job',
  '0 3 * * *',
  $$DELETE FROM events WHERE expires_at < now()$$
);`}</CodeBlock>
    </Section>
    <Section title="2. 작은따옴표 문자열과 값은 같다">
      <CodeBlock language="sql" output={' same_value\n------------\n t\n(1 row)'}>{`SELECT 'DELETE FROM events WHERE state = ''expired'''
       = $$DELETE FROM events WHERE state = 'expired'$$ AS same_value;`}</CodeBlock>
      <p>작은따옴표 문법에서는 문자열 안의 작은따옴표를 두 번 써야 한다. dollar quoting 안에서는 작은따옴표와 줄바꿈을 그대로 쓸 수 있어 긴 SQL이 읽기 쉽다. 여는 구분자와 닫는 구분자는 모두 필요하다.</p>
    </Section>
    <Section title="3. 내용에 $$가 있다면 이름표를 붙인다">
      <CodeBlock language="sql" output={'              message\n------------------------------------\n 가격 표시는 $$처럼 보일 수 있습니다\n(1 row)'}>{`SELECT $command$가격 표시는 $$처럼 보일 수 있습니다$command$ AS message;`}</CodeBlock>
      <p>형식은 <code>$이름표$내용$이름표$</code>다. 이름표는 생략할 수 있고 대소문자를 구분한다. <code>$body$...$body$</code>는 맞지만 <code>$body$...$BODY$</code>는 닫히지 않는다. 서로 다른 이름표를 쓰면 함수 본문 안에 다른 dollar quoted 문자열을 넣을 수도 있다.</p>
    </Section>
    <Section title="4. 비슷해 보이는 $ 문법을 구분한다">
      <table><thead><tr><th>표현</th><th>뜻</th></tr></thead><tbody>
        <tr><td><code>$$text$$</code></td><td>이름표 없는 dollar quoted 문자열</td></tr>
        <tr><td><code>$body$text$body$</code></td><td>body라는 이름표를 붙인 문자열</td></tr>
        <tr><td><code>$1</code></td><td>함수 본문이나 prepared statement의 첫 번째 위치 매개변수</td></tr>
        <tr><td>시간표의 <code>$</code></td><td>pg_cron에서 그 달의 마지막 날을 뜻하는 예약 표현</td></tr>
      </tbody></table>
      <p>쉘 스크립트에서는 <code>$$</code>가 현재 프로세스 ID로 확장될 수 있다. 터미널의 heredoc으로 SQL을 만들 때는 쉘 확장이 없는 인용 방식을 사용하거나 SQL 파일에 작성한다. 사용자 입력을 문자열에 직접 이어 붙이는 보안 문제를 dollar quoting이 해결해 주는 것도 아니다. 애플리케이션에서는 값 매개변수를 사용한다.</p>
    </Section>
    <Section title="5. pg_cron에서 읽는 순서">
      <ol><li>두 번째 인자 <code>'0 3 * * *'</code>는 언제 실행할지를 나타내는 일반 작은따옴표 문자열이다.</li><li>세 번째 인자 <code>$$DELETE ...$$</code>는 나중에 실행할 SQL을 담은 문자열이다.</li><li><code>cron.schedule</code> 호출이 커밋되면 문자열이 예약 테이블에 저장된다.</li><li>예약 시간이 되면 pg_cron이 저장된 문자열을 SQL로 실행한다.</li></ol>
      <p>예약식의 각 칸은 <Ref to="/pg-cron/about">개요와 첫 예약</Ref>, 실제 저장된 값은 <Ref to="/pg-cron/storage">예약 테이블</Ref>에서 확인한다.</p>
    </Section>
    <p className="text-muted-foreground"><a href="https://www.postgresql.org/docs/16/sql-syntax-lexical.html#SQL-SYNTAX-DOLLAR-QUOTING">PostgreSQL 16 dollar quoting 공식 문서</a> · 다음: <Ref to="/pg-cron/storage">예약 테이블 들여다보기</Ref></p>
  </>
}
