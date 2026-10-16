import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function Downtime() {
  return <>
    <PageHeader eyebrow="Week 03 · 서버 중단" title="서버가 꺼진 동안 지난 예약은 다시 실행되지 않는다" lede="psql은 접속 프로그램이고 PostgreSQL은 서버다. psql을 닫는 것은 커밋된 예약에 영향을 주지 않지만, PostgreSQL 서버가 멈추면 pg_cron launcher도 멈춘다. 다시 시작해도 중단 중의 예약 회차를 자동 재생하지 않는다." />
    <Section title="1. 먼저 무엇이 꺼졌는지 구분한다">
      <table><thead><tr><th>상황</th><th>예약 실행</th><th>이유</th></tr></thead><tbody>
        <tr><td>cron.schedule을 커밋한 뒤 psql 종료</td><td>계속 실행</td><td>psql은 명령을 보내는 클라이언트다. 예약은 서버의 cron.job에 저장되고 launcher가 처리한다.</td></tr>
        <tr><td>예약 트랜잭션을 COMMIT하지 않고 psql 비정상 종료</td><td>예약 자체가 남지 않음</td><td>열려 있던 트랜잭션이 rollback된다.</td></tr>
        <tr><td>PostgreSQL 서버 종료</td><td>중단 중에는 실행 불가</td><td>launcher와 잡 실행 프로세스도 서버 프로세스이므로 함께 종료된다.</td></tr>
        <tr><td>서버 재시작</td><td>이후 시간부터 다시 판단</td><td>cron.job은 다시 읽지만 중단 중 놓친 회차 목록은 저장되어 있지 않다.</td></tr>
      </tbody></table>
      <p>예를 들어 매분 실행하는 잡이 10:00 직전에 서버와 함께 멈추고 10:05에 다시 켜졌다면, 10:00~10:04의 다섯 회차를 몰아서 실행하지 않는다. 놓친 각 회차를 failed 행으로 만들지도 않는다. 실제 실행을 시작한 적이 없으므로 실행 이력도 생성되지 않았기 때문이다.</p>
    </Section>
    <Section title="2. 예약 정의와 실행 대기 상태의 저장 위치가 다르다">
      <table><thead><tr><th>정보</th><th>위치</th><th>재시작 뒤</th></tr></thead><tbody>
        <tr><td>시간표·SQL·사용자·DB</td><td>cron.job 테이블</td><td>남아 있으며 launcher가 다시 읽음</td></tr>
        <tr><td>마지막으로 검사한 분</td><td>launcher 프로세스의 정적 메모리</td><td>사라지고 현재 분으로 초기화</td></tr>
        <tr><td>대기 회차 수 pendingRunCount</td><td>launcher의 CronTask 메모리</td><td>영속 큐처럼 복원되지 않음</td></tr>
        <tr><td>실제로 시작한 실행 이력</td><td>cron.job_run_details</td><td>설정에 따라 남음</td></tr>
      </tbody></table>
      <p>pg_cron은 캘린더 정의를 보존하지만, 서버 밖에서 시간을 계속 세는 서비스가 아니다. 그래서 다시 켰을 때 “그 사이 예정됐던 실행”을 알아낼 영속 next_run 값이나 회차별 대기 행이 없다.</p>
    </Section>
    <Section title="3. v1.6.8 코드에서 근거 찾기">
      <p><code>StartAllPendingRuns</code>의 <code>lastMinute</code>는 함수의 정적 변수다. launcher 프로세스가 새로 뜨면 0에서 시작하고 첫 루프의 현재 분으로 설정된다. 그러면 과거 중단 구간과의 차이를 계산하지 않는다.</p>
      <CodeBlock language="c" caption="pg_cron v1.6.8 · src/pg_cron.c 716~767 일부">{`static void
StartAllPendingRuns(List *taskList, TimestampTz currentTime)
{
    static TimestampTz lastMinute = 0;
    /* ... */
    if (lastMinute == 0)
    {
        lastMinute = TimestampMinuteStart(currentTime);
    }

    minutesPassed = MinutesPassed(lastMinute, currentTime);
    if (minutesPassed == 0)
    {
        return;
    }
    /* ... */
}`}</CodeBlock>
      <p>초 간격 잡도 새 task를 처음 알게 된 시각을 기준으로 타이머를 시작한다. 서버가 꺼져 있던 시간을 회차 수로 바꾸지 않는다.</p>
      <CodeBlock language="c" caption="pg_cron v1.6.8 · src/task_states.c 122~136 일부">{`if (!isPresent)
{
    InitializeCronTask(task, jobId);

    /* timer for the first run starts when pg_cron learns about the job */
    task->lastStartTime = GetCurrentTimestamp();
}`}</CodeBlock>
      <p>같은 launcher가 살아 있는 동안 시스템 시계가 앞으로 바뀌는 처리는 별도 코드 경로다. 작은 시계 진행이나 DST 보정 규칙을 서버 종료 뒤 복구 규칙으로 해석하면 안 된다. 서버 재시작에서는 위의 메모리 기준점 자체가 새로 만들어진다.</p>
    </Section>
    <Section title="4. 중단 전에 시작한 회차는 어떻게 기록될까?">
      <p>서버가 중단되기 전에 <code>starting</code> 또는 <code>running</code> 이력이 만들어졌다면, 재기동한 launcher가 미완료 이력을 <code>failed</code>와 <code>server restarted</code> 메시지로 정리할 수 있다. 이것은 이미 시작한 시도를 실패로 표시하는 처리다. 중단 중 예정만 되었던 회차를 새로 만드는 처리가 아니다.</p>
      <p><code>@reboot</code> 예약은 pg_cron이 시작될 때 한 번 실행하도록 명시하는 별도 시간표다. 놓친 일반 예약의 재생 기능은 아니며 launcher가 다시 시작되는 상황에서도 실행될 수 있으므로 업무가 중복되어도 안전하게 작성해야 한다.</p>
    </Section>
    <Section title="5. 놓친 기간을 보충해야 한다면 업무 상태를 저장한다">
      <p>“매분 한 번 호출”보다 “마지막 성공 지점 다음부터 현재까지 처리”하도록 업무를 작성한다. 실행 시작·완료 경계를 업무 테이블에 커밋하고, 같은 구간을 다시 처리해도 결과가 중복되지 않게 고유 키를 둔다.</p>
      <CodeBlock language="sql" caption="개념 예시 · 함수 내부에서 watermark 잠금과 중복 방지를 구현">{`CREATE TABLE report_watermark (
  report_name text PRIMARY KEY,
  completed_through timestamptz NOT NULL
);

SELECT cron.schedule(
  'catch-up-hourly-sales',
  '*/5 * * * *',
  $$SELECT refresh_sales_from_watermark('hourly-sales')$$
);`}</CodeBlock>
      <ol><li>함수가 report_watermark의 행을 잠근다.</li><li>completed_through 다음 구간부터 현재의 완료된 시간 구간까지 처리한다.</li><li>업무 결과와 새 completed_through를 같은 트랜잭션에서 커밋한다.</li><li>실패하면 다음 예약이 같은 미완료 구간부터 다시 시도한다.</li></ol>
      <p>DB가 꺼져 있어도 정해진 시각에 외부 API를 호출해야 한다면 PostgreSQL 밖의 스케줄러가 필요하다. DB 복구 뒤 누락된 데이터 구간만 보충하면 된다면 위와 같은 watermark 방식이 적합하다.</p>
    </Section>
    <p className="text-muted-foreground"><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L712-L825">v1.6.8 StartAllPendingRuns</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/task_states.c#L122-L136">v1.6.8 task 초기 시각</a> · <Ref to="/pg-cron/failures">실패 기록</Ref> · <Ref to="/pg-cron/limits">운영 한계</Ref></p>
  </>
}
