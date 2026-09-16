import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'
import { SourceExcerpt } from './SourceExcerpt'

export default function BackgroundWorkers() {
  return <>
    <PageHeader eyebrow="Week 03 · 배경 지식" title="Background worker: 확장 코드를 별도 프로세스에서 실행하기" lede="PostgreSQL은 확장이 서버 안에서 계속 일하거나 필요할 때 작업하도록 프로세스 실행 기능을 제공한다. 이 기능이 background worker다. 먼저 사용자가 보는 역할을 이해하고, 뒤에서 개발자가 등록하는 방법을 살펴본다." />
    <Section title="1. 어떤 문제를 해결하는 기능인가?">
      <p>일반 SQL 함수는 누군가 호출해야 실행된다. 그런데 pg_cron은 앱이 SQL을 보내지 않는 동안에도 시간을 확인해야 한다. PostgreSQL은 이런 확장이 자기 코드를 별도 프로세스에서 실행하도록 background worker API를 제공한다. API는 확장 개발자가 호출할 수 있는 C 함수와 자료구조의 모음이다.</p>
      <table><thead><tr><th>구성</th><th>누가 일을 시작하나?</th><th>예시</th></tr></thead><tbody>
        <tr><td>일반 연결의 client backend</td><td>psql·앱이 연결하고 SQL을 요청</td><td>앱이 보낸 SELECT 실행</td></tr>
        <tr><td>상주 background worker</td><td>서버 기동 시 등록한 확장 코드</td><td>pg_cron launcher가 예약 확인을 반복</td></tr>
        <tr><td>필요할 때 시작하는 worker</td><td>동작 중인 서버 프로세스가 요청</td><td>pg_cron의 worker 모드에서 한 회차의 SQL 실행</td></tr>
      </tbody></table>
      <p>background는 별도로 일을 맡는다는 뜻이다. 웹 서버나 스레드를 뜻하지 않는다. 각 worker는 OS 프로세스이고 자기 PID를 갖는다. 이 기능 자체에 cron 시간표나 자동 업무 재시도가 들어 있는 것은 아니다. 그런 동작은 확장이 구현한다.</p>
    </Section>
    <Section title="2. PostgreSQL과 확장이 각각 맡는 일">
      <Diagram chart={`flowchart TD
        E["확장 개발자: 실행할 C 함수 작성"] --> R["시작 함수와 조건을 PostgreSQL에 등록"]
        R --> P["postmaster: worker 프로세스 시작·관리"]
        P --> W["worker: 등록한 C 함수 실행"]
        W --> D["필요하면 DB에 연결하여 SQL 수행"]
        W --> Q["계속 대기·반복하거나 작업 후 종료"]
      `} caption="postmaster는 PostgreSQL의 부모·관리 프로세스다. 확장은 시작할 코드를 제공하고, PostgreSQL은 프로세스의 시작과 종료를 관리한다." />
      <table><thead><tr><th>PostgreSQL이 제공</th><th>확장 개발자가 구현</th></tr></thead><tbody>
        <tr><td>worker 등록 API와 프로세스 시작·감시</td><td>언제 무엇을 처리할지, 반복할지 종료할지</td></tr>
        <tr><td>공유 메모리 접근과 내부 DB 연결 API</td><td>명령·결과 전달 방법과 SQL 트랜잭션 처리</td></tr>
        <tr><td>종료 신호와 프로세스 재시작 정책</td><td>정리 코드, 실패한 업무의 재시도·중복 방지 정책</td></tr>
      </tbody></table>
      <p>공유 메모리는 프로세스들이 함께 접근할 수 있도록 마련한 메모리다. 내부 DB 연결은 TCP 접속 대신 worker 안에 DB·사용자 문맥을 설정하는 방식이다. 모든 worker가 SQL을 실행해야 하는 것은 아니며, DB 연결이 필요한 worker만 해당 기능을 사용한다.</p>
    </Section>
    <Section title="3. 서버 시작 때 등록하는 방식과 실행 중 등록하는 방식">
      <table><thead><tr><th>항목</th><th>서버 기동 시 등록</th><th>동작 중 동적 등록</th></tr></thead><tbody>
        <tr><td>C API</td><td>RegisterBackgroundWorker</td><td>RegisterDynamicBackgroundWorker</td></tr>
        <tr><td>요청하는 곳</td><td>postmaster에서 실행되는 확장의 _PG_init</td><td>일반 backend 또는 다른 background worker</td></tr>
        <tr><td>예시</td><td>pg_cron launcher</td><td>pg_cron의 한 회차 실행 worker</td></tr>
        <tr><td>언제 프로세스가 시작되나?</td><td>등록한 서버 상태 조건이 충족될 때</td><td>요청 후 서버가 자원을 확보해 시작할 때</td></tr>
      </tbody></table>
      <p>‘동적 등록’은 서버를 다시 시작하지 않고 worker 시작을 요청한다는 뜻이다. 동적 worker라고 반드시 한 번만 일하거나, 기동 시 등록한 worker라고 반드시 영원히 도는 것은 아니다. 실제 수명과 재시작 정책은 확장 구현에 달려 있다.</p>
    </Section>
    <Section title="4. pg_cron 사용자는 무엇을 설정하나?">
      <ol><li>서버에 pg_cron 패키지를 설치한다. 이 안에 worker가 실행할 C 라이브러리도 들어 있다.</li><li>shared_preload_libraries에 pg_cron을 넣고 재시작한다. 초기화 함수가 launcher의 시작 방법을 등록한다.</li><li>예약을 관리할 DB에서 CREATE EXTENSION pg_cron을 실행한다. 예약 함수와 관리 테이블이 만들어진다.</li><li>cron.schedule로 예약한다. 기본 모드의 SQL은 client backend에서, worker 모드의 SQL은 동적 worker에서 실행된다.</li></ol>
      <p>pg_cron을 쓰기 위해 직접 C worker를 작성할 필요는 없다. 이미 구현된 확장의 설정과 SQL 함수를 사용하면 된다. 모든 확장을 shared_preload_libraries에 넣어야 하는 것도, 넣은 확장이 모두 worker를 만드는 것도 아니다.</p>
      <CodeBlock language="sql" output={"   backend_type   | count\n------------------+-------\n pg_cron launcher |     1\n(1 row)"} outputCaption="예상 출력 · pg_cron launcher만 실행 중인 시점. 조회 권한과 실행 모드·시점에 따라 달라짐">{`SELECT backend_type, count(*)
FROM pg_stat_activity
WHERE backend_type IN ('pg_cron launcher', 'pg_cron')
GROUP BY backend_type ORDER BY backend_type;`}</CodeBlock>
      <p>worker 모드에서 잡이 실행 중이면 backend_type='pg_cron' 행도 나타날 수 있다. 기본 모드의 잡은 client backend라 이 쿼리에는 포함하지 않았다. <Ref to="/pg-cron/processes">전체 프로세스 관찰 예제</Ref>에서 함께 볼 수 있다.</p>
    </Section>
    <details className="my-8 rounded-xl border border-border p-5">
      <summary className="cursor-pointer font-semibold">심화 · 확장 개발자가 구현하는 절차와 실제 코드</summary>
      <Section title="C 코드에서 실행 조건과 시작 함수를 등록한다">
        <ol><li>공유 라이브러리에 worker의 시작 함수를 작성한다.</li><li>BackgroundWorker 구조체에 함수 이름·라이브러리·시작 시점·재시작 정책을 채운다.</li><li>기동 시 등록 또는 동적 등록 API를 호출한다. 등록 성공과 실제 프로세스 시작은 구분한다.</li><li>worker 함수에서 신호 처리, 필요한 DB 연결, 반복 작업과 종료 정리를 구현한다.</li></ol>
        <SourceExcerpt name="register" />
        <p>위는 pg_cron의 실제 등록 코드다. bgw_function_name은 새 프로세스가 실행할 함수, bgw_start_time은 시작할 수 있는 서버 상태, bgw_restart_time은 프로세스 재시작 정책이다. RegisterBackgroundWorker 호출 자체가 예약 SQL을 실행하는 것은 아니다.</p>
        <p>worker가 SQL을 수행하려면 DB 연결과 트랜잭션을 관리해야 한다. PostgreSQL의 SPI는 C 코드에서 SQL을 호출하는 API이며 일반 worker 예제에서 사용한다. pg_cron 실행 worker는 자체 ExecuteSqlString 경로를 사용한다. 확장마다 같은 구현을 쓰지는 않는다.</p>
        <p>직접 개발할 때에는 PostgreSQL 소스의 <a href="https://github.com/postgres/postgres/tree/REL_16_STABLE/src/test/modules/worker_spi">worker_spi 예제</a>를 참고할 수 있다. 이것은 C 확장 개발 자료이며 SQL 입력창에 붙여 넣는 설치 예제가 아니다.</p>
      </Section>
    </details>
    <Section title="5. 여기서 다음으로 읽을 내용">
      <p>Background worker API의 역할을 알았다면 <Ref to="/pg-cron/max-worker-processes">서버 전체 worker 슬롯의 한도</Ref>를 먼저 확인하고 pg_cron이 잡을 실행하는 두 모드를 비교할 수 있다. 서버 중단, exactly-once와 분산 구성은 별도 운영 한계 페이지에서 사례와 함께 다룬다.</p>
      <p><a href="https://www.postgresql.org/docs/16/bgworker.html">PostgreSQL 16 공식 Background Worker 문서</a> · <Ref to="/pg-cron/max-worker-processes">max_worker_processes 기초</Ref> · <Ref to="/pg-cron/modes">pg_cron의 두 실행 모드</Ref> · <Ref to="/pg-cron/limits">장애·자원·분산 한계</Ref></p>
    </Section>
  </>
}
