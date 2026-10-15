import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function Limits() {
  return <>
    <PageHeader eyebrow="Week 03 · 운영 한계" title="worker 슬롯, 서버 중단과 중복 실행에 대비한다" lede="pg_cron은 PostgreSQL 안에서 SQL 실행 시각을 관리한다. 실행 자원과 수명도 PostgreSQL 서버에 종속되며, 장애 상황의 exactly-once 처리는 제공하지 않는다." />
    <Section title="1. worker 수는 서버 전체가 나눠 쓴다">
      <p><Ref to="/pg-cron/max-worker-processes">max_worker_processes</Ref>는 pg_cron 전용 개수가 아니다. 상주 pg_cron launcher, worker 모드의 실행 프로세스, 다른 확장의 worker, 병렬 쿼리 worker가 같은 전체 한도 안에서 움직인다.</p>
      <CodeBlock language="sql" output={' max_worker_processes | cron.max_running_jobs\n----------------------+-----------------------\n 8                    | 5\n(1 row)'} outputCaption="설명용 예시. 실제 서버 값은 다를 수 있음">{`SELECT current_setting('max_worker_processes') AS max_worker_processes,
       current_setting('cron.max_running_jobs') AS "cron.max_running_jobs";`}</CodeBlock>
      <p>위 예시의 8에서 launcher 1개와 실행 잡 5개를 빼면 여유는 2개뿐이다. 다른 확장이나 병렬 쿼리가 필요하면 부족하다. 숫자만 맞추지 말고 피크 시간의 <code>pg_stat_activity</code>, worker 시작 실패, 쿼리 지연을 함께 본다.</p>
    </Section>
    <Section title="2. PostgreSQL이 멈춘 동안 예약을 대신 실행하지 않는다">
      <p>launcher는 PostgreSQL의 background worker다. 서버가 중단되면 시간 확인도 멈춘다. 서버가 다시 켜졌을 때 중단 시간의 모든 회차를 외부에 보관했다가 재생하지 않는다. psql 종료와 서버 종료의 차이, 저장 위치와 v1.6.8 코드 근거는 <Ref to="/pg-cron/downtime">서버 중단과 놓친 예약</Ref>에서 설명한다.</p>
      <table><thead><tr><th>필요한 성질</th><th>검토할 구성</th></tr></thead><tbody>
        <tr><td>DB 점검 중에도 반드시 호출</td><td>외부 스케줄러가 DB 상태를 확인하고 호출</td></tr>
        <tr><td>실패 업무를 내구성 있게 보관</td><td>상태 테이블·메시지 큐에 업무 단위를 저장</td></tr>
        <tr><td>장애 후 누락 구간을 보충</td><td>마지막 성공 시각을 저장하고 기간 단위로 따라잡는 SQL</td></tr>
      </tbody></table>
    </Section>
    <Section title="3. 프로세스 재시작과 업무 재시도는 다르다">
      <p>launcher의 <code>bgw_restart_time=1</code>은 launcher 프로세스가 비정상 종료되면 PostgreSQL이 다시 시작할 수 있다는 설정이다. 실행 중이던 업무를 성공 시점부터 이어 가거나 정확히 한 번 커밋한다는 뜻은 아니다. 재기동한 launcher는 starting/running 이력을 failed와 <code>server restarted</code>로 바꾼다.</p>
      <p>장애가 커밋 직전·직후에 생기면 호출자는 결과를 확신하지 못할 수 있다. 업무 테이블에 고유한 실행 키를 두고 <code>INSERT ... ON CONFLICT</code> 또는 UNIQUE 제약으로 중복 효과를 막는다.</p>
    </Section>
    <Section title="4. 분산·고가용성 구성에서는 실행 주체를 하나로 만든다">
      <p>pg_cron 메타데이터는 <code>cron.database_name</code>의 한 DB에 있고 launcher는 해당 PostgreSQL 인스턴스에서 실행된다. 물리 복제 standby에서는 쓰기 작업을 실행하지 않으며, 승격 뒤 새 primary에서 launcher가 동작한다. 전환 시점의 누락과 중복 가능성은 업무 로직에서 처리해야 한다.</p>
      <p>여러 독립 primary나 샤드에 같은 예약을 복제하면 각 서버가 자기 예약을 실행할 수 있다. 전체 클러스터에서 한 번만 필요한 업무라면 단일 조정 DB, advisory lock, 리더 선출 또는 외부 스케줄러로 실행 주체를 정한다.</p>
    </Section>
    <Section title="선택 기준">
      <ul><li>한 DB 안의 정리·집계이며 서버 중단 때 함께 쉬어도 된다면 pg_cron이 단순하다.</li><li>DB 밖 API 호출, 긴 재시도, 전역 순서, 장애 중 실행이 필요하면 업무 큐나 외부 스케줄러를 함께 검토한다.</li><li>어떤 구성이든 실행 이력과 업무 결과를 연결할 키, 실패 알림, 재처리 절차를 먼저 정한다.</li></ul>
      <p><Ref to="/pg-cron/failures">실패 기록과 다음 회차</Ref> · <Ref to="/pg-cron/downtime">서버 중단과 놓친 예약</Ref> · <Ref to="/pg-cron/schedules">예약 수정과 분산 환경</Ref></p>
    </Section>
  </>
}
