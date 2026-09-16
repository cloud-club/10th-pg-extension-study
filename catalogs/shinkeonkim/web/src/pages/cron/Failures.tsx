import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Callout } from '@/components/layout/Callout'
import data from '@/data/cron-experiments.json'

export default function Failures() {
  const failure = data.failure_example
  return <>
    <PageHeader eyebrow="Week 03 · 실패 처리" title="pg_cron에는 실패 회차의 자동 재시도가 없다" lede="실패한 회차는 failed로 끝난다. active 잡은 다음 예약 시각에 새 runid로 다시 실행될 수 있지만, 실패한 runid를 정해진 횟수만큼 다시 실행하는 retry는 아니다." tags={[{label:'실측 10회 이상'}, {label:'pg_cron 1.6.8'}, {label:'자동 재시도 없음'}]} />
    <Section title="결론: 실패를 기록하지만 다시 시도해 주지는 않는다">
      <Callout kind="warn" title="retry 횟수·backoff·dead-letter queue가 없다">
        <p>pg_cron 자체에는 실패한 동일 회차를 즉시 또는 일정 시간 뒤 다시 실행하는 정책이 없다. 최대 시도 횟수, 고정·지수 backoff, 재시도 jitter, 최종 실패 업무를 격리하는 dead-letter queue도 제공하지 않는다.</p>
      </Callout>
      <CodeBlock language="text" caption="5분 간격 잡이 10:00에 실패한 경우">{`10:00  runid=41 실행 → SQL 오류 → failed
10:01  자동 재시도 없음
10:02  자동 재시도 없음
10:03  자동 재시도 없음
10:04  자동 재시도 없음
10:05  runid=42 실행 → 원래 시간표가 만든 새로운 회차`}</CodeBlock>
      <p>10:05 실행은 10:00 실패의 두 번째 시도가 아니다. 시간표가 원래 만들기로 한 다음 회차다. 잡이 비활성화되거나 제거되지 않았다면 이전 회차의 성공·실패와 관계없이 다음 예약 시각을 계속 평가한다.</p>
    </Section>
    <Section title="먼저 답부터 확인한다">
      <table><thead><tr><th>질문</th><th>동작</th></tr></thead><tbody>
        <tr><td>한 회차의 SQL이 오류를 내면?</td><td>그 회차를 failed로 끝내고 오류 문장을 return_message에 기록한다.</td></tr>
        <tr><td>다음 예약 시각에도 실행하나?</td><td>잡이 active 상태라면 새 runid로 다음 회차를 시도한다.</td></tr>
        <tr><td>실패한 회차를 자동으로 다시 실행하나?</td><td>아니다. 다음 회차 실행과 실패 회차 재시도는 다른 개념이다.</td></tr>
        <tr><td>실패 직전의 INSERT는 남나?</td><td>같은 트랜잭션에서 오류가 났다면 롤백된다. 외부 HTTP 요청처럼 DB 밖의 효과는 롤백할 수 없다.</td></tr>
        <tr><td>서버가 재시작되면?</td><td>기록상 starting/running이던 회차를 failed, server restarted로 바꾼다. 그 업무를 정확히 한 번 다시 수행하지는 않는다.</td></tr>
      </tbody></table>
    </Section>
    <Section title="v1.6.8 코드도 오류를 retry로 되돌리지 않는다">
      <p><code>ManageCronTask</code>의 오류 분기는 실행 이력을 failed로 바꾸고 task를 <code>CRON_TASK_DONE</code>으로 보낸다. 완료 분기는 task 상태를 초기화할 뿐, 오류 때문에 <code>pendingRunCount</code>를 증가시키지 않는다.</p>
      <CodeBlock language="c" caption="pg_cron v1.6.8 · src/pg_cron.c의 오류·완료 분기를 줄여서 발췌">{`case CRON_TASK_ERROR:
    UpdateJobRunDetail(task->runId, NULL,
                       GetCronStatus(CRON_STATUS_FAILED),
                       task->errorMessage, ...);
    task->state = CRON_TASK_DONE;
    RunningTaskCount--;
    /* fall through */

case CRON_TASK_DONE:
    currentPendingRunCount = task->pendingRunCount;
    InitializeCronTask(task, jobId);
    task->pendingRunCount = currentPendingRunCount;`}</CodeBlock>
      <p><code>pendingRunCount</code>가 남아 곧 다음 실행이 시작될 수는 있다. 이것은 오류가 만든 retry가 아니라, 앞선 회차가 실행되는 동안 시간표상 새 실행 시각이 도착해 대기하던 회차다. 오류가 발생하지 않았어도 같은 방식으로 대기한다.</p>
      <p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L1790-L1862">v1.6.8 ManageCronTask 원문</a></p>
    </Section>
    <Section title="실패는 어느 단계에서도 생길 수 있다">
      <ol>
        <li><strong>예약 등록 실패:</strong> 잘못된 시간식, CONNECT 권한 부족이면 cron.schedule 자체가 오류를 내며 cron.job 행이 만들어지지 않는다.</li>
        <li><strong>실행 시작 실패:</strong> 기본 모드의 인증·연결 실패, worker 모드의 worker 슬롯 부족, 시작 시간 초과가 여기에 해당한다.</li>
        <li><strong>SQL 실행 실패:</strong> 없는 테이블, 권한 부족, 제약 조건 위반, statement_timeout, 사용자 함수의 예외가 해당한다.</li>
        <li><strong>서버·launcher 중단:</strong> 완료 여부를 확인하지 못한 회차는 재기동 때 실패 이력으로 정리된다.</li>
      </ol>
      <p>등록에 성공했다는 것은 시간표와 SQL 문자열을 저장했다는 뜻이다. 실행 시점의 데이터·권한·연결까지 성공했다는 보장은 아니다.</p>
    </Section>
    <Section id="history" title="cron.job_run_details에서 실패 근거를 찾는다">
      <CodeBlock language="sql" output={` jobid | runid | status | return_message\n-------+-------+--------+----------------------------------------\n ${failure.jobid} | ${failure.runid} | failed | ERROR: intentional failure after insert\n(1 row)`} outputCaption="10회 반복 실험 원본 중 실제 실패 행을 읽기 쉽게 줄여 표시">{`SELECT jobid, runid, status, return_message,
       start_time, end_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY runid DESC
LIMIT 20;`}</CodeBlock>
      <p><code>jobid</code>는 예약 번호, <code>runid</code>는 실행 회차 번호다. <code>status</code>는 starting·connecting·sending·running을 거쳐 succeeded 또는 failed가 될 수 있다. <code>return_message</code>에는 SQL 오류, 연결 오류, startup timeout, server restarted 같은 이유가 들어간다.</p>
      <p><code>cron.log_run=off</code>이면 이 테이블에 새 실행 이력을 남기지 않는다. 이 경우 PostgreSQL 서버 로그와 업무 테이블의 자체 이력을 이용해야 한다. 이력은 자동으로 보존 기간에 맞춰 삭제되지 않으므로 정리 정책도 필요하다.</p>
    </Section>
    <Section title="실패 뒤에도 다음 시각은 독립적으로 온다">
      <CodeBlock language="sql" output={' jobid | status | count\n-------+--------+------\n     3 | failed |     2\n(1 row)'} outputCaption="실험에서 같은 잡이 연속 두 회차 실패한 형태">{`SELECT jobid, status, count(*)
FROM cron.job_run_details
WHERE jobid = 3
GROUP BY jobid, status;`}</CodeBlock>
      <p>위 두 행은 첫 실패를 즉시 재시도한 기록이 아니다. 1초 간격 잡의 다음 예약 시각이 와서 새 회차가 실행된 결과다. 재시도 횟수·간격·지수 백오프가 필요하면 별도의 상태 테이블과 SQL로 설계하거나 외부 작업 시스템을 사용한다.</p>
      <p>업무 키에 UNIQUE 제약을 두고, 처리 상태를 같은 트랜잭션에서 갱신하면 중복 효과를 줄일 수 있다. 결제 API 호출처럼 DB 밖에 효과가 생기는 작업은 idempotency key와 상대 시스템의 중복 방지 기능까지 필요하다.</p>
    </Section>
    <Section title="재시도가 필요하면 업무 상태로 구현한다">
      <table><thead><tr><th>필요한 수준</th><th>구현 방법</th></tr></thead><tbody>
        <tr><td>다음 예약 때 다시 계산해도 되는 집계</td><td>다음 정규 회차가 미완료 구간을 다시 계산하도록 SQL을 멱등하게 작성한다.</td></tr>
        <tr><td>항목별 횟수·backoff가 필요한 작업</td><td>업무 테이블에 attempts, next_attempt_at, last_error, status를 저장하고 pg_cron은 처리 함수를 주기적으로 호출한다.</td></tr>
        <tr><td>외부 API와 복잡한 실패 분류</td><td>내구성 있는 작업 큐나 외부 오케스트레이터를 사용하고 idempotency key를 전달한다.</td></tr>
      </tbody></table>
      <p>PL/pgSQL 함수 안에서 긴 sleep과 반복문으로 재시도하면 한 실행 슬롯과 트랜잭션을 오래 점유한다. 짧고 제한적인 재시도 외에는 다음 시도 시각을 테이블에 저장하고 각 호출을 짧게 끝내는 편이 운영하기 쉽다.</p>
    </Section>
    <Section title="운영 점검 순서">
      <ol><li><code>cron.job</code>에서 active·database·username·command를 확인한다.</li><li><code>cron.job_run_details</code>에서 최근 failed의 return_message를 묶어 본다.</li><li>연결 오류면 실행 모드의 인증과 자원, SQL 오류면 잡 사용자로 직접 SQL을 실행해 권한과 데이터를 확인한다.</li><li>알림을 붙이고, 실패한 업무를 다시 수행해도 안전한지 확인한 뒤 재처리한다.</li></ol>
      <p><Ref to="/pg-cron/limits">장애와 중복 실행의 한계</Ref> · <Ref to="/pg-cron/experiments#queue">롤백 반복 실험</Ref></p>
    </Section>
  </>
}
