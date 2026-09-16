import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import demo from '@/data/cron-concurrency-demo.json'
import { Clotho } from '@/components/viz/Clotho'
import { Diagram } from '@/components/viz/Diagram'

export default function Processes() {
  return <>
    <PageHeader eyebrow="Week 03 · 프로세스 구조" title="누가 시간을 보고, 누가 SQL을 실행하는가?" lede="PostgreSQL 16의 일반적인 서버 구성에서 pg_cron은 스레드 풀을 만드는 대신 별도 프로세스를 사용한다. launcher는 일정을 관리하고, 잡의 SQL은 client backend 또는 일회성 background worker가 실행한다." />
    <Section title="먼저: PostgreSQL도 여러 프로그램이 함께 동작하는 서버다">
      <p>프로세스는 OS에서 실행 중인 프로그램 단위다. 각 프로세스에는 PID라는 번호가 있고, 자기 메모리와 실행 상태를 갖는다. PostgreSQL 서버를 켜면 프로세스 하나가 모든 일을 처리하는 것이 아니라, 연결·SQL 실행·저장 작업 등을 맡는 여러 프로세스가 함께 동작한다.</p>
      <h3>postmaster는 PostgreSQL의 부모·관리 프로세스다</h3>
      <p>PostgreSQL 서버를 시작할 때 먼저 실행되어 다른 PostgreSQL 프로세스들을 시작하고 살피는 역할을 한다. DB 접속 요청이 오면 연결을 처리할 프로세스를 만들고, 등록된 background worker도 시작한다. postmaster는 이 역할을 부르는 이름이며, 실제 서버 실행 프로그램은 postgres다. 별도의 웹 서버나 추가로 설치해야 할 서비스 이름이 아니다.</p>
      <h3>client backend는 DB 연결 하나의 SQL을 처리한다</h3>
      <p>앱에서 DB에 접속해 SELECT를 보내면, PostgreSQL 쪽에서 그 연결을 담당하는 프로세스가 SELECT를 실행한다. 이것이 client backend다. client는 ‘DB에 요청하는 쪽’, backend는 ‘DB 서버 쪽에서 처리하는 프로세스’라는 뜻이다. 여기서 backend를 Spring·Node.js 웹 서버와 혼동하기 쉽지만 서로 다른 프로그램이다.</p>
      <CodeBlock language="text">{`앱 서버 또는 psql                 PostgreSQL 서버
[SQL을 보내는 client] ──접속──▶ [postmaster: 연결 접수]
         │                               │ 담당 프로세스 시작
         └──── SELECT / 결과 ─────▶ [client backend: SQL 실행]`}</CodeBlock>
      <p>예를 들어 앱의 DB 연결 풀이 연결 10개를 유지하면, 일반적인 직접 접속 구성에서는 PostgreSQL에도 그 연결들을 담당하는 client backend 10개가 생긴다. 앱 서버와 DB 서버가 서로 다른 컴퓨터여도 원리는 같다. pg_cron 기본 모드에서는 SQL을 보내는 쪽이 앱 대신 pg_cron launcher가 된다.</p>
      <h3>launcher는 이 문서에서 pg_cron launcher를 뜻한다</h3>
      <p>예약 목록을 읽고, 시간이 되면 SQL 실행을 요청하는 pg_cron 전용 프로세스다. 잡 하나가 끝났다고 종료되지 않고 계속 예약을 살핀다. ‘상주한다’는 말은 이렇게 계속 실행 상태를 유지한다는 뜻이다. PostgreSQL에 다른 종류의 launcher도 있으므로 실제 목록에서는 pg_cron launcher라는 이름을 확인한다.</p>
    </Section>
    <Section title="확장 기능이 어떻게 별도 프로세스를 시작할 수 있나?">
      <p><Ref to="/pg-cron/background-workers">Background worker 전용 페이지</Ref>에서는 기능의 목적, 등록 방식과 사용 절차를 자세히 설명한다.</p>
      <p>모든 확장이 프로세스를 추가하는 것은 아니다. PostgreSQL은 필요한 확장에 background worker라는 기능을 제공한다. 확장 코드가 ‘이 함수를 별도 프로세스에서 실행해 달라’고 등록하면, PostgreSQL이 그 프로세스를 시작하고 종료를 관리한다. pg_cron은 이 기능을 사용한다.</p>
      <ol><li><strong>서버 기동:</strong> postmaster가 shared_preload_libraries에 지정된 pg_cron 코드 파일을 읽는다. preload는 서버 시작 때 미리 불러온다는 뜻이다.</li><li><strong>시작 방법 등록:</strong> pg_cron의 초기화 함수 _PG_init이 ‘pg_cron launcher라는 프로세스에서 PgCronLauncherMain 함수를 실행하라’는 정의를 등록한다.</li><li><strong>프로세스 시작:</strong> PostgreSQL이 정상 읽기·쓰기가 가능한 상태가 되면 postmaster가 worker 프로세스를 시작한다. 새 프로세스가 PgCronLauncherMain을 실행하며 예약 확인을 반복한다.</li><li><strong>DB에 기능 등록:</strong> CREATE EXTENSION pg_cron이 현재 DB에 cron.schedule 함수와 예약 관리 테이블을 만든다. 이제 저장한 예약을 launcher가 읽어 처리할 수 있다.</li></ol>
      <p>즉 패키지 설치만으로 프로세스가 실행되거나, CREATE EXTENSION을 호출할 때마다 launcher가 하나씩 늘어나는 것은 아니다. 서버 설정과 기동 단계에서 worker를 등록·시작한다. 이 실습 서버에는 예약을 관리하는 pg_cron launcher가 하나 있고, SQL 실행 프로세스는 잡이 실행될 때 별도로 준비된다.</p>
      <p><a href="https://www.postgresql.org/docs/16/bgworker.html">PostgreSQL이 제공하는 background worker 기능</a> · <Ref to="/pg-cron/source">이 등록 과정을 C 코드로 확인하기</Ref></p>
    </Section>
    <Section title="1. 프로세스별 역할을 표로 다시 확인한다">
      <table><thead><tr><th>구성 요소</th><th>수명과 역할</th><th>pg_cron과의 관계</th></tr></thead><tbody>
        <tr><td>postmaster</td><td>서버의 부모·감독 프로세스. 연결을 받고 자식 프로세스를 시작·감시</td><td>기동 시 pg_cron을 preload하고 등록된 launcher를 시작</td></tr>
        <tr><td>사용자 client backend</td><td>psql·앱 연결에 대응하는 SQL 실행 프로세스</td><td>사용자가 cron.schedule을 실행하는 곳</td></tr>
        <tr><td>pg_cron launcher</td><td>상주 background worker. 시각 판단·잡 상태 관리</td><td>하나의 메타데이터 DB에 연결해 예약을 관리</td></tr>
        <tr><td>잡 실행 프로세스</td><td>회차별 SQL 실행. 완료 후 종료</td><td>기본 모드에서는 client backend, worker 모드에서는 동적 worker</td></tr>
        <tr><td>checkpointer·WAL writer·autovacuum 등</td><td>PostgreSQL의 저장·유지보수 작업</td><td>pg_cron과 별개지만 CPU·I/O·메모리 자원을 공유</td></tr>
      </tbody></table>
      <p>‘backend’는 SQL을 실행하는 서버 측 프로세스를 뜻한다. 웹 서비스의 백엔드 애플리케이션과 혼동하지 말자. ‘background’도 스레드라는 뜻이 아니다. 이 페이지는 실습의 PostgreSQL 16/Linux 컨테이너를 기준으로 한다.</p>
      <Diagram chart={`flowchart TD
        P["postmaster · 부모 프로세스"] --> U["사용자 client backend · 예약 등록"]
        P --> L["pg_cron launcher · 시각과 상태 관리"]
        P --> E["잡 실행 프로세스 · SQL 수행"]
        P --> S["checkpointer / WAL writer 등"]
        U -. "예약 커밋" .-> J[("cron.job · 저장된 예약")]
        J -. "캐시 갱신" .-> L
        L -. "연결 또는 worker 등록으로 실행 요청" .-> E
        E --> T[("업무 테이블")]
        L --> H[("cron.job_run_details · 이력")]
      `} caption="실선 위쪽은 프로세스 생성 관계, 점선은 예약·실행 제어 흐름이다. launcher가 자식 프로세스를 직접 fork한다는 그림이 아니다." />
    </Section>
    <Section title="예약 하나를 등록하면 어느 프로세스가 무엇을 하나?">
      <p>psql에서 ‘1초마다 SELECT pg_sleep(2)’를 등록하는 상황을 생각해보자. 다음 단계들은 하나의 함수 호출 안에서 모두 실행되는 것이 아니라, 서로 다른 프로세스가 맡아 진행한다.</p>
      <ol>
        <li><strong>등록 세션:</strong> psql이 접속하면 postmaster가 그 연결을 처리할 client backend를 만든다. cron.schedule은 이 backend에서 실행되어 cron.job에 SQL·주기·실행 사용자·DB를 저장한다. 반환되는 jobid는 저장한 예약의 번호다.</li>
        <li><strong>커밋과 반영:</strong> 예약이 커밋되어야 다른 프로세스에서 볼 수 있다. 변경 알림으로 launcher의 캐시가 무효화되면 launcher가 예약 정보를 다시 읽는다. psql 연결을 닫아도 저장한 예약은 남는다.</li>
        <li><strong>시간 확인:</strong> 상주하는 launcher가 ‘예약 시각인가? 이 잡이 이미 실행 중인가? 전체 한도에 빈자리가 있나?’를 확인한다. 이 단계에서 잡마다 별도 스레드를 만들지는 않는다.</li>
        <li><strong>실행:</strong> 기본 모드에서는 launcher가 libpq로 새 연결을 요청하고 postmaster가 또 다른 client backend를 만든다. 이 backend가 2초 동안 pg_sleep을 실행한다. 등록용 backend와 실행용 backend의 PID·세션은 다르다.</li>
        <li><strong>완료:</strong> 실행 backend가 SQL 결과를 반환하면 launcher는 실행 이력을 갱신하고 연결을 닫아 슬롯을 돌려준다. 다음 회차에는 새 연결을 사용한다.</li>
      </ol>
      <p>worker 모드에서는 4번이 달라진다. launcher가 동적 background worker를 등록하면 postmaster가 그 프로세스를 시작한다. worker가 DB·사용자 문맥을 설정해 SQL을 실행하며, 결과는 소켓 대신 공유 메모리의 메시지 큐로 전달한다. <Ref to="/pg-cron/modes">실행 모드 페이지</Ref>에서 두 경로를 비교할 수 있다.</p>
    </Section>
    <Section title="프로세스마다 따로 가진 것과 함께 사용하는 것">
      <table><thead><tr><th>범위</th><th>구체적인 내용</th><th>실습에서 보이는 차이</th></tr></thead><tbody>
        <tr><td>프로세스별 메모리와 세션</td><td>호출 스택, 로컬 변수, SQL 세션 상태와 현재 트랜잭션</td><td>등록 세션의 임시 테이블·SET을 잡이 그대로 이어받지 않는다.</td></tr>
        <tr><td>launcher의 작업 상태</td><td>jobid별 CronTask와 실행 슬롯 사용량</td><td>서버 재시작 후 cron.job은 남아도 메모리의 대기 회차가 그대로 복구되지는 않는다.</td></tr>
        <tr><td>PostgreSQL 공유 자원</td><td>공유 버퍼, 잠금 관리, WAL과 디스크</td><td>다른 잡도 같은 행을 갱신하면 행 잠금 때문에 기다릴 수 있다.</td></tr>
      </tbody></table>
      <p>실행 중 잡이 두 개라고 항상 CPU 두 개를 사용한다는 뜻은 아니다. pg_sleep은 타이머를 기다리고, 잠긴 행의 UPDATE는 잠금 해제를 기다린다. CPU가 하나여도 OS가 실행 시간을 나누므로 두 잡의 실행 구간은 겹칠 수 있다. 여기서 잡의 ‘병렬 처리’는 주로 이 동시 진행을 뜻한다.</p>
      <p>잡을 100개 예약하고 현재 두 개만 실행한다면, pg_cron 관련 프로세스는 보통 launcher 1개 + 잡 실행 2개다. postmaster·등록/관찰 세션·일반 앱 연결·유지보수 프로세스는 별도다. 병렬 쿼리가 추가 worker를 요청하는 경우에는 이 수보다 많아질 수 있다.</p>
    </Section>
    <Section title="2. jobid·task·runid는 프로세스 ID가 아니다">
      <table><thead><tr><th>이름</th><th>의미</th><th>남는 위치</th></tr></thead><tbody>
        <tr><td>jobid</td><td>‘5초마다 INSERT’라는 예약의 식별자</td><td>cron.job. DB 데이터로 보존</td></tr>
        <tr><td>CronTask</td><td>해당 잡이 대기·연결·실행 중인지 관리하는 C 자료구조</td><td>launcher 메모리. 재시작을 넘는 업무 큐가 아님</td></tr>
        <tr><td>runid</td><td>예약의 특정 실행 회차 식별자</td><td>이력 기록이 켜져 있으면 job_run_details</td></tr>
        <tr><td>pid / job_pid</td><td>그 시점에 실제 실행 중인 OS 프로세스 식별자</td><td>pg_stat_activity와 실행 이력. 종료 후 PID 재사용 가능</td></tr>
      </tbody></table>
      <p>예약을 100개 등록해도 곧바로 100개의 프로세스가 상주하지 않는다. 실행 시각이 되고 슬롯을 얻은 회차에 실행 자원이 배정된다. 예약 개수, 실행 대기 개수, 연결 중 개수, 실제 SQL 실행 개수는 서로 다른 지표다.</p>
    </Section>
    <Section title="3. 한 프로세스가 여러 잡을 관리하는 방법">
      <p>launcher가 SQL을 직접 끝까지 실행한다면 긴 잡 하나 때문에 다른 잡을 살필 수 없을 것이다. 그래서 SQL은 별도 실행 프로세스에 맡기고, pg_cron launcher는 각 잡의 ‘대기 중·연결 중·실행 중·완료’ 상태를 짧게 확인한다. 이 상태 확인을 반복하는 구조를 이벤트 루프라고 부른다.</p>
      <Clotho id="cron-event-loop" />
      <p>그림에서 오른쪽 두 실행 프로세스는 따로 동작한다. launcher가 B를 확인하는 동안에도 A의 SQL 실행은 계속된다. 색이 바뀌는 것은 launcher가 현재 확인하는 상태이며, CPU가 그 프로세스에만 배정됐다는 뜻은 아니다. 그림은 libpq 모드의 설명용 흐름이고 실제 실행 시간을 재현한 것은 아니다.</p>
      <ol><li>A가 시작할 시각이면 실행을 요청하고 A를 ‘실행 중’으로 관리한다.</li><li>A의 완료를 기다리며 멈추지 않고 B도 살핀다. 한도에 여유가 있으면 B 역시 시작한다.</li><li>둘 다 실행 중이면 연결에서 결과가 도착했는지, 다음 예약 시각이 됐는지 기다렸다가 다시 확인한다. 쉴 틈 없이 무한히 검사한다는 뜻은 아니다.</li><li>A의 완료를 확인하면 이력을 기록하고 A가 사용하던 실행 자리를 반환한다. B는 끝날 때까지 계속 동작한다.</li></ol>
      <p>C 코드에서는 잡별 상태를 담은 자료구조를 CronTask라고 부른다. launcher는 각 CronTask의 상태를 순회하는 이벤트 루프를 사용한다. 기본 모드에서는 비동기 libpq 연결과 소켓 준비 상태를 확인하므로 잡 하나의 긴 SELECT가 끝날 때까지 launcher 전체가 그 SELECT를 실행하며 기다리는 구조가 아니다.</p>
      <p>SQL 자체는 별도 프로세스에서 실행되어 다른 잡과 병렬로 진행될 수 있다. ‘비동기 연결’은 launcher가 연결 상태를 나누어 처리한다는 뜻이고, SQL이 CPU를 사용하지 않는다거나 무제한 병렬 실행된다는 뜻은 아니다. worker 기동 대기 등 일부 경로의 대기와 자원 제약은 여전히 있다.</p>
      <p>pg_cron이 잡마다 pthread 같은 스레드를 만들어 실행하지는 않는다. 한 잡의 SQL이 PostgreSQL의 병렬 쿼리 계획을 사용하면 추가 parallel worker가 붙을 수 있는데, 이는 pg_cron의 잡 동시성과는 별도의 계층이다.</p>
    </Section>
    <Section title="4. 실제 서버에서 확인하는 방법">
      <p>아래는 <Ref to="/pg-cron/source#concurrency-demo">두 잡 실행 예제</Ref>의 SELECT pg_sleep(2)가 진행되는 동안 조회한 실제 출력이다. 일반 사용자에게 다른 세션의 상세 정보가 안 보이면 통계 조회 권한도 확인한다.</p>
      <CodeBlock language="sql" output={demo.blocks.activity.output} outputCaption={demo.note}>{demo.blocks.activity.sql}</CodeBlock>
      <p>client backend 두 행은 잡 SQL을 실행하는 서로 다른 PID다. state=active인데 wait_event=PgSleep인 것은 ‘명령은 실행 중이고 현재는 타이머를 기다리는 상태’라는 뜻이다. launcher는 일정을 관리하는 프로세스이므로 잡 두 개에 추가로 존재한다. 이 스냅샷의 PID는 환경마다 다르다.</p>
      <p>launcher는 backend_type='pg_cron launcher', application_name='pg_cron scheduler'로 식별할 수 있다. 기본 모드의 실행 잡은 client backend이며 application_name='pg_cron'이다. worker 모드는 backend_type='pg_cron'을 확인한다. 짧은 잡은 조회 전에 끝날 수 있으므로 실습의 pg_sleep 작업으로 관찰한다.</p>
      <p>connecting 이력이 있는데 실행 backend가 안 보이면 아직 연결이 완료되지 않았거나 상태 수집이 지연된 것일 수 있다. 이력만으로 실제 작업 진행 여부를 단정하지 말고 업무 테이블·activity·로그를 함께 확인한다. 다른 사용자의 상세 조회에는 적절한 통계 조회 권한이 필요하다.</p>
      <p><Ref to="/pg-cron/background-workers">다음: PostgreSQL이 확장에 제공하는 Background worker 기능</Ref></p>
      <p>근거: <a href="https://www.postgresql.org/docs/16/connect-estab.html">PostgreSQL 연결과 backend 생성</a> · <a href="https://www.postgresql.org/docs/16/bgworker.html">Background worker 프로세스</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c">pg_cron v1.6.8</a></p>
    </Section>
  </>
}
