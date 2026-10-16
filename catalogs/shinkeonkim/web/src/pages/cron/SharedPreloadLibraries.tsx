import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function SharedPreloadLibraries() {
  return <>
    <PageHeader eyebrow="Week 03 · PostgreSQL 설정 기초" title="shared_preload_libraries는 서버 시작 때 먼저 읽을 라이브러리 목록이다" lede="일부 확장은 공유 메모리를 준비하거나 background worker를 등록해야 한다. PostgreSQL이 여러 세션을 받기 전에 이런 초기화를 할 수 있도록 지정하는 서버 설정이 shared_preload_libraries다." />
    <Section title="1. 이름을 세 부분으로 나눠 읽기">
      <table><thead><tr><th>부분</th><th>뜻</th></tr></thead><tbody>
        <tr><td>shared</td><td>여러 서버 프로세스가 함께 쓰는 메모리·상태를 준비할 수 있다.</td></tr>
        <tr><td>preload</td><td>일반 SQL이 처음 호출할 때까지 기다리지 않고 PostgreSQL 서버 시작 단계에 미리 읽는다.</td></tr>
        <tr><td>libraries</td><td>PostgreSQL이 로드할 수 있게 서버에 설치된 공유 라이브러리 이름의 목록이다.</td></tr>
      </tbody></table>
      <p>설치된 확장 전체를 적는 목록은 아니다. 서버 시작 단계가 필요한 라이브러리만 해당 확장의 안내에 따라 추가한다. pg_cron은 이 시점에 launcher를 background worker로 등록하므로 목록에 들어가야 한다. pg_stat_statements도 공유 메모리가 필요해 흔히 함께 사용한다.</p>
    </Section>
    <Section title="2. 여러 항목은 하나의 문자열 안에 쉼표로 나열한다">
      <CodeBlock language="ini" caption="postgresql.conf 예시">{`# 한 개
shared_preload_libraries = 'pg_cron'

# 여러 개: 기존 항목을 지우지 않고 쉼표로 추가
shared_preload_libraries = 'pg_stat_statements,pg_cron'`}</CodeBlock>
      <p>따옴표 바깥에 설정 줄을 두 번 쓰는 방식으로 목록을 합치지 않는다. 같은 설정을 다시 쓰면 마지막 값만 적용될 수 있다. 공백은 항목 구분에서 무시되지만, 보통 위처럼 라이브러리 이름만 쉼표로 나열한다.</p>
      <CodeBlock language="sql" output={'     name                 | setting                       | context    | pending_restart\n--------------------------+-------------------------------+------------+-----------------\n shared_preload_libraries | pg_stat_statements,pg_cron    | postmaster | f\n(1 row)'} outputCaption="설명용 출력 · context=postmaster는 서버 시작 때만 적용된다는 뜻">{`SELECT name, setting, context, pending_restart
FROM pg_settings
WHERE name = 'shared_preload_libraries';`}</CodeBlock>
      <p><code>SHOW shared_preload_libraries</code>는 현재 실행 중인 서버가 실제 사용하는 값을 보여준다. <code>pg_settings.pending_restart</code>가 true라면 설정 파일의 변경이 아직 재시작으로 적용되지 않았다는 뜻이다.</p>
    </Section>
    <Section title="3. reload가 아니라 restart가 필요하다">
      <ol><li>pg_cron 패키지를 설치해 서버의 라이브러리 경로에 파일을 둔다.</li><li>shared_preload_libraries 목록에 pg_cron을 추가한다.</li><li>PostgreSQL 서버를 재시작한다. 설정 reload만으로는 적용되지 않는다.</li><li>예약을 관리할 DB에서 <code>CREATE EXTENSION pg_cron</code>을 실행한다.</li></ol>
      <p>라이브러리 파일이 없는 이름을 지정하면 PostgreSQL 서버가 시작하지 못한다. 운영 서버에서는 설치 여부와 현재 목록을 먼저 확인하고, 재시작 창구와 되돌릴 설정을 준비한다.</p>
      <CodeBlock language="sql" output={' shared_preload_libraries\n--------------------------\n pg_stat_statements,pg_cron\n(1 row)'}>{`SHOW shared_preload_libraries;`}</CodeBlock>
    </Section>
    <Section title="4. CREATE EXTENSION과 하는 일이 다르다">
      <table><thead><tr><th>단계</th><th>하는 일</th><th>범위</th></tr></thead><tbody>
        <tr><td>shared_preload_libraries + 재시작</td><td>C 라이브러리를 서버 시작 때 읽고 pg_cron launcher를 등록·시작</td><td>PostgreSQL 인스턴스</td></tr>
        <tr><td>CREATE EXTENSION pg_cron</td><td>cron.schedule 함수, cron.job 테이블 등 SQL 객체 생성</td><td>확장을 만든 데이터베이스</td></tr>
      </tbody></table>
      <p>둘 중 하나만으로는 pg_cron 전체가 준비되지 않는다. 서버 코드가 먼저 떠 있어야 하고, 예약을 저장하고 호출할 DB 객체도 있어야 한다. 실제 기동 흐름은 <Ref to="/pg-cron/processes">프로세스 기초</Ref>에서 이어진다.</p>
    </Section>
    <p className="text-muted-foreground"><a href="https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-SHARED-PRELOAD-LIBRARIES">PostgreSQL 16 공식 문서</a> · 다음: <Ref to="/pg-cron/dollar-quoting">$$ 문자열 문법</Ref></p>
  </>
}
