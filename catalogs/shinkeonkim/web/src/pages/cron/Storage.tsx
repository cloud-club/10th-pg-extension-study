import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'
import demo from '@/data/cron-storage-demo.json'

export default function Storage() {
  return <>
    <PageHeader eyebrow="Week 03 · 기초 개념" title="cron.schedule을 실행하면 DB에 무엇이 기록될까?" lede="예약 한 개는 cron.job의 행 한 개로 저장된다. 그 예약이 실행될 때마다 cron.job_run_details에 실행 회차가 추가된다. 실제 업무 결과는 예약 SQL이 변경한 업무 테이블에 별도로 남는다." />

    <Section title="먼저 세 종류의 기록을 구분한다">
      <Diagram chart={`flowchart LR
        S["cron.schedule 호출"] --> J["cron.job\n예약 정의 1행"]
        J -->|"시간이 됨"| R1["cron.job_run_details\n실행 회차 1"]
        J -->|"다음 시간이 됨"| R2["cron.job_run_details\n실행 회차 2"]
        R1 --> B["업무 테이블\n예약 SQL의 결과"]
        R2 --> B
      `} caption="jobid 하나에 여러 runid가 연결되는 1:N 관계다. 실행 이력과 업무 결과는 같은 데이터가 아니다." />
      <table><thead><tr><th>기록</th><th>한 행이 뜻하는 것</th><th>언제 생기나?</th></tr></thead><tbody>
        <tr><td><code>cron.job</code></td><td>반복해서 실행할 예약 하나</td><td><code>cron.schedule</code>이 커밋될 때</td></tr>
        <tr><td><code>cron.job_run_details</code></td><td>예약이 실제로 실행된 한 회차</td><td>실행을 시작하고 상태를 기록할 때</td></tr>
        <tr><td>업무 테이블</td><td>INSERT·DELETE·집계 등 SQL의 결과</td><td>예약 SQL의 트랜잭션이 성공해 커밋될 때</td></tr>
      </tbody></table>
      <p><code>cron.schedule</code>이 jobid를 반환했다고 업무 SQL까지 성공한 것은 아니다. 예약 등록은 <code>cron.job</code>에서, 실행 결과는 이력과 업무 테이블에서 따로 확인한다.</p>
    </Section>

    <Section title="1. 어느 DB와 스키마에 있는지 확인한다">
      <p>{demo.note}</p>
      <CodeBlock language="sql" output={demo.location.output} outputCaption="실제 조회 결과">{demo.location.sql}</CodeBlock>
      <p><strong>study</strong>는 현재 접속한 DB다. pg_cron은 이 PostgreSQL 인스턴스의 <code>cron.database_name=study</code> 설정에 따라 이 DB에서 예약을 관리한다. <code>extension_schema=pg_catalog</code>은 확장 자체가 등록된 네임스페이스이고, 예약 테이블의 스키마 이름과는 다르다.</p>
      <CodeBlock language="sql" output={demo.tables.output} outputCaption="실제 조회 결과">{demo.tables.sql}</CodeBlock>
      <p>SQL에서 사용하는 논리적 위치는 <code>study</code> DB의 <code>cron.job</code>과 <code>cron.job_run_details</code>다. 다른 DB에 접속하면 이 이름의 테이블이 보이지 않을 수 있다. <code>cron.schedule_in_database</code>로 다른 DB의 SQL을 예약해도 예약 행은 관리 DB의 <code>cron.job</code>에 저장된다.</p>
    </Section>

    <Section title="2. 두 테이블에는 어떤 열이 있나?">
      <CodeBlock language="sql" output={demo.columns.output} outputCaption="실제 정보 스키마 조회 결과">{demo.columns.sql}</CodeBlock>
      <h3>cron.job: 앞으로 실행할 예약의 현재 설정</h3>
      <table><thead><tr><th>열</th><th>뜻</th></tr></thead><tbody>
        <tr><td>jobid / jobname</td><td>예약 번호 / 사용자가 붙인 선택적 이름</td></tr>
        <tr><td>schedule / command</td><td>언제 실행할지 / 실행할 SQL 문자열</td></tr>
        <tr><td>database / username</td><td>SQL을 실행할 DB / 권한을 적용할 DB 사용자</td></tr>
        <tr><td>nodename / nodeport</td><td>기본 libpq 모드가 접속할 주소 / 포트. 실습은 Unix 소켓 경로를 사용</td></tr>
        <tr><td>active</td><td>true면 실행 대상, false면 정의는 남지만 새 회차를 시작하지 않음</td></tr>
      </tbody></table>
      <h3>cron.job_run_details: 지나간 실행 회차의 상태</h3>
      <table><thead><tr><th>열</th><th>뜻</th></tr></thead><tbody>
        <tr><td>runid / jobid</td><td>실행 회차 번호 / 어느 예약에서 시작됐는지</td></tr>
        <tr><td>job_pid</td><td>그 회차를 실행한 PostgreSQL 프로세스의 PID</td></tr>
        <tr><td>status</td><td>connecting, running, succeeded, failed 등의 상태</td></tr>
        <tr><td>return_message</td><td>명령 태그나 오류 메시지. 업무 결과 전체를 보관하는 칸은 아님</td></tr>
        <tr><td>start_time / end_time</td><td>이력에서 기록한 시작·종료 시각</td></tr>
      </tbody></table>
      <p>이력은 <code>cron.log_run=on</code>일 때 기록된다. 자동 보존 기간이 있는 테이블이 아니므로 운영에서는 오래된 행을 정리하는 정책도 필요하다.</p>
    </Section>

    <Section title="3. 예약 전에는 cron.job이 비어 있다">
      <CodeBlock language="sql" output={demo.empty.output} outputCaption="실제 조회 결과">{demo.empty.sql}</CodeBlock>
      <p>이 임시 DB에는 아직 예약이 없었다. 여러 사용자가 함께 쓰는 실제 DB에서는 권한과 행 수준 보안 정책에 따라 자신이 소유한 예약만 보일 수 있다.</p>
    </Section>

    <Section title="4. cron.schedule이 cron.job에 행을 만든다">
      <p>먼저 결과를 확인하기 위한 <code>public.cron_storage_heartbeat</code> 테이블을 준비했다. 이 테이블은 pg_cron 내부 테이블이 아니라 예약 SQL의 효과를 확인하기 위한 업무 테이블 역할이다.</p>
      <CodeBlock language="sql" output={demo.schedule.output} outputCaption="실제 등록 결과">{demo.schedule.sql}</CodeBlock>
      <p>반환된 <code>jobid=1</code>은 새 예약 행의 기본키다. 같은 트랜잭션이 커밋된 뒤 다음 SELECT에서 조회할 수 있다.</p>
      <CodeBlock language="sql" output={demo.job.output} outputCaption="등록 직후 cron.job의 실제 행">{demo.job.sql}</CodeBlock>
      <ul>
        <li><code>schedule='2 seconds'</code>와 <code>command</code>에 함수 호출 때 전달한 값이 저장됐다.</li>
        <li><code>database='study'</code>와 <code>username='postgres'</code>는 어디에서 누구 권한으로 실행할지를 나타낸다.</li>
        <li><code>nodename='/var/run/postgresql'</code>은 이 실습의 <code>cron.host</code> 설정이 반영된 Unix 소켓 위치다.</li>
        <li><code>active=t</code>이므로 launcher가 이 예약을 실행 대상으로 본다.</li>
      </ul>
    </Section>

    <Section title="5. 실행되면 이력과 업무 결과가 각각 남는다">
      <CodeBlock language="sql" output={demo.run.output} outputCaption="첫 성공 회차의 실제 이력">{demo.run.sql}</CodeBlock>
      <p><code>runid=1</code>은 첫 실행 회차이고 <code>jobid=1</code>은 앞의 예약을 가리킨다. <code>status=succeeded</code>와 <code>return_message='INSERT 0 1'</code>은 INSERT 명령이 행 하나를 처리했다는 뜻이다.</p>
      <CodeBlock language="sql" output={demo.effect.output} outputCaption="같은 시점의 실제 업무 결과">{demo.effect.sql}</CodeBlock>
      <p>이력의 성공과 함께 heartbeat 행도 하나 생겼다. 업무 SQL에 따라 이력은 성공했지만 기대한 업무 행이 없을 수도 있으므로, 운영 점검에서는 두 기록을 함께 본다.</p>
    </Section>

    <Section title="6. 물리 파일 위치는 참고만 한다">
      <CodeBlock language="sql" output={demo.physical.output} outputCaption="실제 임시 DB의 내부 파일 경로">{demo.physical.sql}</CodeBlock>
      <p><code>base/16384/…</code>는 PostgreSQL 데이터 디렉터리를 기준으로 한 내부 파일 경로다. OID·relfilenode와 유지보수 작업에 따라 이름이 달라질 수 있다. 애플리케이션이나 백업 스크립트가 이 파일을 직접 읽거나 복사하지 않는다. SQL 이름인 <code>study.cron.job</code>으로 접근하고, 백업은 PostgreSQL의 논리·물리 백업 도구를 사용한다.</p>
    </Section>

    <Section title="7. 수정하거나 삭제하면 어떻게 되나?">
      <table><thead><tr><th>동작</th><th>cron.job</th><th>기존 실행 이력</th></tr></thead><tbody>
        <tr><td><code>cron.alter_job</code></td><td>같은 jobid 행의 지정한 열을 변경</td><td>기존 행 유지</td></tr>
        <tr><td>같은 이름으로 <code>cron.schedule</code></td><td>같은 사용자의 이름 있는 잡을 갱신하고 jobid 유지</td><td>기존 행 유지</td></tr>
        <tr><td><code>active=false</code></td><td>행을 남기고 새 실행을 멈춤</td><td>기존 행 유지</td></tr>
        <tr><td><code>cron.unschedule</code></td><td>예약 행 삭제</td><td>이력은 별도 보존</td></tr>
      </tbody></table>
      <CodeBlock language="sql" output={demo.unschedule.output} outputCaption="실제 예약 삭제 결과">{demo.unschedule.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.after_unschedule.output} outputCaption="삭제 직후 실제 조회 결과">{demo.after_unschedule.sql}</CodeBlock>
      <p><code>jobs_after=0</code>이므로 예약 정의는 삭제됐다. <code>histories_after</code>는 이미 실행된 회차가 별도 테이블에 남아 있음을 보여준다. 이력은 운영 보존 정책에 따라 따로 정리한다.</p>
      <p>변경 사항이 launcher 메모리에 반영되는 과정은 <Ref to="/pg-cron/schedules">예약 저장·수정·분산 환경</Ref>에서 이어서 설명한다. 현재 실행 중인 회차와 다음 회차가 어떻게 다른지도 그 페이지에서 확인할 수 있다.</p>
      <p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/README.md#how-pg_cron-works">pg_cron v1.6.8의 cron.job 설명</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/sql/pg_cron.sql">테이블·함수 정의 원문</a></p>
    </Section>
  </>
}
