import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'
import { Callout } from '@/components/layout/Callout'
import { SourceExcerpt } from './SourceExcerpt'

export default function Modes() {
  return <>
    <PageHeader eyebrow="Week 03 · 실행 모드" title="같은 SQL을 실행하는 두 경로" lede="두 모드 모두 pg_cron launcher가 예약 시간을 확인한다. 예약 시각이 되면 기본 모드는 일반 DB 연결을 만들고, worker 모드는 PostgreSQL background worker를 시작한다." tags={[{label:'기본 개념'}, {label:'선택 기준'}, {label:'C 코드'}]} />
    <p className="text-muted-foreground">프로세스가 낯설다면 <Ref to="/pg-cron/processes">프로세스 기초</Ref>와 <Ref to="/pg-cron/background-workers">Background worker</Ref>를 먼저 읽는다.</p>

    <Callout kind="tip" title="두 모드 모두 회차별 실행 프로세스를 만든다">
      <p>예약 한 회차가 시작될 때마다 <strong>SQL을 실행할 별도 PostgreSQL 서버 프로세스 하나</strong>가 생긴다. 기본 모드는 일반 접속을 받아 <strong>client backend</strong>를 만들고, worker 모드는 PostgreSQL의 background worker API로 <strong>SQL 실행 worker</strong>를 만든다. 둘 다 스레드나 별도 웹 서버가 아니다.</p>
    </Callout>

    <Section title="1. 공통 출발점 하나, 실행 프로세스를 만드는 경로 두 개">
      <p>PostgreSQL을 시작하면 <strong>postmaster</strong>가 상주하는 <strong>pg_cron launcher</strong> 하나를 띄운다. launcher는 <code>cron.job</code>을 읽고 “지금 실행할 잡이 있는가?”를 계속 확인한다. 예약 시간이 되면 launcher 자신이 업무 SQL을 실행하지 않고, 아래 두 경로 중 하나로 실행 담당 프로세스를 요청한다.</p>
      <Diagram chart={`flowchart TD
        P[postmaster<br/>PostgreSQL 부모 프로세스] -->|서버 시작 때 1개| L[pg_cron launcher<br/>예약 확인·상태 관리]
        J[(cron.job)] -->|일정 읽기| L
        L -->|기본값: libpq 접속| C[client backend<br/>한 회차 SQL 실행]
        L -->|worker 옵션: 동적 worker 요청| W[pg_cron worker<br/>한 회차 SQL 실행]
        C --> R[(업무 테이블)]
        W --> R
      `} caption="launcher까지는 공통이다. 갈라지는 지점은 한 회차의 SQL 실행 프로세스를 만드는 방법이다." />
      <table><thead><tr><th>비교 항목</th><th>기본 libpq 모드</th><th>background worker 모드</th></tr></thead><tbody>
        <tr><td>누가 예약을 확인하나</td><td colSpan={2}>같은 pg_cron launcher</td></tr>
        <tr><td>회차마다 생기는 것</td><td>일반 DB 접속을 담당하는 client backend 프로세스</td><td>동적으로 등록한 pg_cron worker 프로세스</td></tr>
        <tr><td>어떻게 생기나</td><td>launcher의 libpq 접속을 postmaster가 수락</td><td>launcher의 worker 요청을 postmaster가 수락</td></tr>
        <tr><td>SQL 전달 경로</td><td>일반 PostgreSQL 연결 프로토콜</td><td>동적 공유 메모리</td></tr>
        <tr><td>주요 자원 한도</td><td><code>max_connections</code></td><td><code>max_worker_processes</code></td></tr>
        <tr><td>접속 인증</td><td><code>pg_hba.conf</code>, 비밀번호·로컬 인증 필요</td><td>libpq 접속 인증은 없음</td></tr>
        <tr><td>DB 객체 권한</td><td colSpan={2}>잡의 username 권한을 똑같이 검사</td></tr>
        <tr><td>같은 jobid 직렬화</td><td colSpan={2}>똑같이 적용. 앞 회차가 끝날 때까지 다음 회차 대기</td></tr>
        <tr><td>종료 시점</td><td colSpan={2}>해당 회차의 SQL과 결과 처리가 끝나면 실행 프로세스 종료</td></tr>
      </tbody></table>
      <p>‘worker 모드’는 launcher를 새로 하나 더 켜는 옵션이 아니다. 항상 있던 launcher가 <strong>마지막 실행 담당자를 만드는 방법</strong>만 바꾼다.</p>
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
      <p><code>pg_stat_activity</code>에서는 일반 애플리케이션 연결과 같은 <code>client backend</code>로 보이며, <code>application_name</code>이 <code>pg_cron</code>이라 어느 연결인지 구분할 수 있다.</p>
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
      <p><code>pg_stat_activity</code>에서는 <code>backend_type = 'pg_cron'</code>인 프로세스로 구분된다. 이 모드를 지원하지 않는 관리형 서비스도 있으며, Cloud SQL처럼 반대로 이 모드만 허용하는 서비스도 있다.</p>
    </Section>

    <Section title="4. 내 환경에서는 어떤 모드를 고를까?">
      <table><thead><tr><th>상황</th><th>먼저 검토할 모드</th><th>확인할 값</th></tr></thead><tbody>
        <tr><td>처음 설치하고 로컬 인증을 구성할 수 있음</td><td>기본 libpq</td><td>pg_hba.conf, .pgpass/로컬 인증, max_connections</td></tr>
        <tr><td>잡용 접속 비밀번호 관리가 어려움</td><td>worker</td><td>서비스 지원 여부, max_worker_processes 여유</td></tr>
        <tr><td>다른 확장·병렬 쿼리가 worker를 많이 사용</td><td>libpq부터 비교</td><td>worker 사용량과 앱 연결 여유를 함께 측정</td></tr>
        <tr><td>짧은 잡을 매우 자주 실행</td><td>두 모드 측정</td><td>예약 시각부터 업무 커밋까지 지연과 실패율</td></tr>
        <tr><td>관리형 PostgreSQL 사용</td><td>서비스가 허용한 모드</td><td>확장 문서의 실행 모드 제한. Cloud SQL은 worker 모드만 지원</td></tr>
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
      <summary className="cursor-pointer text-lg font-semibold">C 코드에서 실행 경로가 나뉘는 지점</summary>
      <div className="mt-5 space-y-6">
        <div><h3>libpq 경로</h3><SourceExcerpt name="libpq" /><p><code>PQconnectStartParams</code>로 비동기 접속을 시작하고, 상태 기계가 <code>PQconnectPoll</code>·<code>PQsendQuery</code>·<code>PQgetResult</code>를 차례로 진행한다.</p></div>
        <div><h3>worker 등록 경로</h3><SourceExcerpt name="worker" /><p>동적 worker의 시작 함수는 상주 launcher 함수와 다른 <code>CronBackgroundWorker</code>다. <code>BGW_NEVER_RESTART</code>는 이 한 회차용 프로세스를 자동 재시작하지 않는다는 뜻이다.</p></div>
        <div><h3>worker의 SQL 실행</h3><SourceExcerpt name="execute" /><p><code>BackgroundWorkerInitializeConnection</code>이 DB·사용자 문맥을 만들고 <code>ExecuteSqlString</code>이 파싱·계획·실행한다. pg_cron은 이 경로에서 SPI를 사용하지 않는다.</p></div>
      </div>
    </details>
    <p><Ref to="/pg-cron/failures">연결·worker·SQL 실패가 기록되는 방식</Ref> · <Ref to="/pg-cron/source-map">전체 함수 지도</Ref></p>
  </>
}
