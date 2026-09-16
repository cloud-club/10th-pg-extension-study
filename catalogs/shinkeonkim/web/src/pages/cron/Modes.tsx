import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'
import { SourceExcerpt } from './SourceExcerpt'

export default function Modes() {
  return <>
    <PageHeader eyebrow="Week 03 · 실행 모드" title="같은 SQL을 실행하는 두 경로" lede="두 모드 모두 pg_cron launcher가 예약 시간을 확인한다. 차이는 시간이 됐을 때 SQL을 일반 DB 연결로 보낼지, PostgreSQL 내부 worker 프로세스에서 실행할지다." tags={[{label:'입문 설명'}, {label:'선택표'}, {label:'C 코드 심화'}]} />
    <p className="text-muted-foreground">프로세스가 낯설다면 <Ref to="/pg-cron/processes">프로세스 기초</Ref>와 <Ref to="/pg-cron/background-workers">Background worker</Ref>를 먼저 읽는다.</p>

    <Section title="1. 먼저 변하지 않는 부분과 바뀌는 부분">
      <table><thead><tr><th>구분</th><th>두 모드에서의 동작</th></tr></thead><tbody>
        <tr><td>항상 존재</td><td><strong>pg_cron launcher</strong>가 cron.job을 읽고 예약 시간을 계산한다.</td></tr>
        <tr><td>바뀌는 부분</td><td>한 회차의 SQL을 실행할 프로세스를 만드는 경로</td></tr>
        <tr><td>항상 적용</td><td>잡의 database·username 권한, 같은 jobid 직렬화, cron.max_running_jobs</td></tr>
      </tbody></table>
      <p><strong>postmaster</strong>는 PostgreSQL의 부모 프로세스, <strong>launcher</strong>는 예약 관리자, <strong>실행 프로세스</strong>는 한 회차의 SQL을 수행하는 프로세스다. ‘worker 모드’는 launcher를 켜는 옵션이 아니라 마지막 실행 프로세스를 고르는 옵션이다.</p>
    </Section>

    <Section id="libpq" title="2. 기본 libpq 모드: 새 DB 연결로 실행한다">
      <p>psql이나 애플리케이션이 DB에 접속하는 것과 비슷하다. launcher가 PostgreSQL의 접속 라이브러리인 <strong>libpq</strong>로 자기 서버에 새 연결을 열고 SQL을 보낸다.</p>
      <ol><li>launcher가 host·port·database·username으로 접속을 요청한다.</li><li>postmaster가 그 연결 하나를 담당할 <strong>client backend</strong> 프로세스를 만든다.</li><li>client backend가 SQL을 실행하고 성공 또는 오류를 돌려준다.</li><li>launcher가 결과를 기록하고 연결을 닫는다.</li></ol>
      <p>client backend는 별도 웹 서버가 아니다. PostgreSQL 안에서 DB 연결 하나를 처리하는 서버 프로세스다.</p>
      <Diagram chart={`sequenceDiagram
        participant L as pg_cron launcher
        participant P as postmaster
        participant B as client backend
        L->>P: libpq 접속 요청
        P->>B: 연결 담당 프로세스 생성
        L->>B: 인증 후 SQL 전송
        B-->>L: 결과 또는 오류
        L->>B: 연결 종료
      `} caption="기본 모드는 잡 회차마다 일반 DB 연결을 하나 만든다." />
      <table><thead><tr><th>필요한 것</th><th>부족하거나 틀리면</th></tr></thead><tbody>
        <tr><td>pg_hba.conf에 맞는 인증 정보</td><td>connection failed, password 오류</td></tr>
        <tr><td>max_connections의 여유</td><td>새 연결을 받지 못함</td></tr>
        <tr><td>잡 username의 DB·객체 권한</td><td>permission denied로 회차 실패</td></tr>
      </tbody></table>
    </Section>

    <Section id="worker" title="3. worker 모드: 내부 작업 프로세스로 실행한다">
      <p>launcher가 PostgreSQL에 일회성 background worker 시작을 요청한다. postmaster가 프로세스를 만들고, launcher는 DB·사용자·SQL을 공유 메모리로 전달한다.</p>
      <ol><li>launcher가 명령을 동적 공유 메모리에 넣는다.</li><li>postmaster가 <strong>CronBackgroundWorker</strong>를 시작 함수로 하는 worker를 만든다.</li><li>worker가 내부 방식으로 database와 username 문맥을 설정한다.</li><li>SQL을 실행해 결과를 공유 메모리 큐로 보내고 종료한다.</li></ol>
      <Diagram chart={`sequenceDiagram
        participant L as pg_cron launcher
        participant M as 공유 메모리
        participant P as postmaster
        participant W as SQL 실행 worker
        L->>M: DB·사용자·SQL 저장
        L->>P: worker 시작 요청
        P->>W: 새 프로세스 생성
        W->>M: 명령 읽기
        W-->>M: 결과 또는 오류
        M-->>L: 결과 수집
      `} caption="미리 만들어 둔 스레드 풀이 아니라, 실행 회차마다 요청하는 PostgreSQL 프로세스다." />
      <table><thead><tr><th>필요한 것</th><th>부족하거나 틀리면</th></tr></thead><tbody>
        <tr><td>max_worker_processes의 여유</td><td>worker를 시작하지 못함</td></tr>
        <tr><td>launcher와 다른 worker의 몫을 뺀 용량</td><td>예상 동시 실행 수보다 작아짐</td></tr>
        <tr><td>잡 username의 DB·객체 권한</td><td>permission denied로 회차 실패</td></tr>
      </tbody></table>
      <p>네트워크 접속 인증은 거치지 않지만 사용자 권한 검사는 그대로 적용된다.</p>
    </Section>

    <Section title="4. 내 환경에서는 어떤 모드를 고를까?">
      <table><thead><tr><th>상황</th><th>먼저 검토할 모드</th><th>확인할 값</th></tr></thead><tbody>
        <tr><td>처음 설치하고 로컬 인증을 구성할 수 있음</td><td>기본 libpq</td><td>pg_hba.conf, .pgpass/로컬 인증, max_connections</td></tr>
        <tr><td>잡용 접속 비밀번호 관리가 어려움</td><td>worker</td><td>서비스 지원 여부, max_worker_processes 여유</td></tr>
        <tr><td>다른 확장·병렬 쿼리가 worker를 많이 사용</td><td>libpq부터 비교</td><td>worker 사용량과 앱 연결 여유를 함께 측정</td></tr>
        <tr><td>짧은 잡을 매우 자주 실행</td><td>두 모드 측정</td><td>예약 시각부터 업무 커밋까지 지연과 실패율</td></tr>
      </tbody></table>
      <p>어느 모드가 항상 빠르다고 정할 수 없다. libpq는 연결·인증 비용, worker는 프로세스 기동·공유 메모리 비용이 있다. SQL 실행 시간이 길면 이 차이가 작게 보일 수 있다.</p>
    </Section>

    <Section title="5. 현재 설정을 한 줄씩 확인한다">
      <CodeBlock language="sql" output={' cron.use_background_workers\n-----------------------------\n off\n(1 row)'} outputCaption="실습의 실제 기본값. off는 libpq 모드">{`SHOW cron.use_background_workers;`}</CodeBlock>
      <CodeBlock language="sql" output={' cron.max_running_jobs\n-----------------------\n 32\n(1 row)'} outputCaption="실습 이미지 기본값. 실제 유효 용량은 다른 자원 한도에도 좌우됨">{`SHOW cron.max_running_jobs;`}</CodeBlock>
      <CodeBlock language="sql" output={' max_connections\n-----------------\n 100\n(1 row)'} outputCaption="libpq 모드가 앱 연결과 나눠 쓰는 서버 한도 예시">{`SHOW max_connections;`}</CodeBlock>
      <CodeBlock language="sql" output={' max_worker_processes\n----------------------\n 8\n(1 row)'} outputCaption="worker 모드가 다른 background worker와 나눠 쓰는 서버 한도 예시">{`SHOW max_worker_processes;`}</CodeBlock>
      <p><code>cron.use_background_workers</code>를 변경하면 PostgreSQL을 재시작한다. 운영에서 한도를 정할 때에는 <Ref to="/pg-cron/limits">자원·장애 한계</Ref>도 함께 본다.</p>
    </Section>

    <details className="my-10 rounded-xl border border-border p-5">
      <summary className="cursor-pointer text-lg font-semibold">심화 · 실제 C 코드에서 두 경로가 갈리는 곳</summary>
      <div className="mt-5 space-y-6">
        <div><h3>libpq 경로</h3><SourceExcerpt name="libpq" /><p><code>PQconnectStartParams</code>로 비동기 접속을 시작하고, 상태 기계가 <code>PQconnectPoll</code>·<code>PQsendQuery</code>·<code>PQgetResult</code>를 차례로 진행한다.</p></div>
        <div><h3>worker 등록 경로</h3><SourceExcerpt name="worker" /><p>동적 worker의 시작 함수는 상주 launcher 함수와 다른 <code>CronBackgroundWorker</code>다. <code>BGW_NEVER_RESTART</code>는 이 한 회차용 프로세스를 자동 재시작하지 않는다는 뜻이다.</p></div>
        <div><h3>worker의 SQL 실행</h3><SourceExcerpt name="execute" /><p><code>BackgroundWorkerInitializeConnection</code>이 DB·사용자 문맥을 만들고 <code>ExecuteSqlString</code>이 파싱·계획·실행한다. pg_cron은 이 경로에서 SPI를 사용하지 않는다.</p></div>
      </div>
    </details>
    <p><Ref to="/pg-cron/failures">연결·worker·SQL 실패가 기록되는 방식</Ref> · <Ref to="/pg-cron/source-map">전체 함수 지도</Ref></p>
  </>
}
