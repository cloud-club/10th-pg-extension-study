import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { CodeBlock } from '@/components/common/Code'

export default function Operations() {
  return <>
    <PageHeader eyebrow="Week 03 · 운영" title="예약 성공과 실행 성공은 다르다" lede="등록된 잡이 실행되지 않는다면 활성 상태, 실행 자원, 연결 인증, SQL 오류를 순서대로 확인한다." />
    <p className="text-muted-foreground">예약 수정의 저장 위치와 반영 시점, 서버가 여러 대일 때의 동작은 <Ref to="/pg-cron/schedules">예약 저장·수정·분산 환경</Ref>에서 먼저 확인할 수 있다.</p>
    <Section title="실행 모드와 자원 확인">
      <p>기본 libpq 모드는 launcher가 새 DB 연결을 열고 client backend에 SQL을 보내는 방식이다. worker 모드는 PostgreSQL이 시작한 일회성 프로세스가 내부 연결로 SQL을 수행한다. 두 방식의 프로세스·인증·명령 전달 흐름은 <Ref to="/pg-cron/modes">실행 모드 상세 설명</Ref>에서 먼저 확인한다.</p>
      <table><thead><tr><th>구분</th><th>기본 libpq</th><th>background worker</th></tr></thead><tbody>
        <tr><td>설정</td><td>cron.use_background_workers = off</td><td>on · 서버 재시작</td></tr>
        <tr><td>실행 자원</td><td>클라이언트 연결 슬롯</td><td>max_worker_processes의 worker 슬롯</td></tr>
        <tr><td>인증</td><td>pg_hba.conf와 접속 자격 확인</td><td>내부 DB 연결 · 잡 사용자 권한 적용</td></tr>
        <tr><td>공통 한도</td><td colSpan={2}>cron.max_running_jobs · 같은 jobid는 직렬 실행</td></tr>
      </tbody></table>
      <p>worker 슬롯은 다른 확장과 공유한다. 기본 모드도 연결 수를 소비하므로 앱 연결에 필요한 여유를 남긴다. 두 모드의 속도는 부하와 접속 방식에 따라 달라지며 실제 환경에서 측정해야 한다.</p>
      <p><Ref to="/pg-cron/experiments">추가 실험</Ref>에서는 pg_cron 1.6.8의 잡 4개·한도 2 조건에서 정체와 startup timeout을 관찰했다. 한도를 낮추면 정상적으로 줄 서기만 한다고 가정하지 말고 대상 버전에서 포화 조건을 검증한다.</p>
    </Section>
    <Section title="이력과 현재 실행을 함께 확인한다">
      <p>각 쿼리는 서로 다른 질문에 답한다. 첫 번째는 ‘무엇이 예약되어 있나’, 두 번째는 ‘이전 회차가 성공했나’, 세 번째는 ‘지금 어떤 프로세스가 실행 중인가’를 확인한다. 아래는 출력 형식을 설명하는 예시다.</p>
<CodeBlock language="sql" output={" jobid | jobname  | schedule  | active | database | username\n-------+----------+-----------+--------+----------+---------\n    42 | demo-job | 5 seconds | t      | study    | postgres\n(1 row)"} outputCaption={"출력 예시 · 활성화된 예약 한 개"}>{"SELECT jobid, jobname, schedule, active, database, username\nFROM cron.job ORDER BY jobid;"}</CodeBlock>
<CodeBlock language="sql" output={" jobid | runid | status    | return_message | start_time             | end_time\n-------+-------+-----------+----------------+------------------------+-----------------------\n    42 |   100 | succeeded | SELECT 1       | 2026-09-15 12:00:00+09 | 2026-09-15 12:00:02+09\n(1 row)"} outputCaption={"출력 예시 · 완료된 회차. runid는 예약 번호와 별개인 실행 회차 번호"}>{"SELECT jobid, runid, status, return_message, start_time, end_time\nFROM cron.job_run_details\nORDER BY runid DESC LIMIT 30;"}</CodeBlock>
<CodeBlock language="sql" output={" pid | backend_type     | application_name  | state  | wait_event | query\n-----+------------------+-------------------+--------+------------+--------------------\n  75 | pg_cron launcher | pg_cron scheduler |        |            |\n 148 | client backend   | pg_cron           | active | PgSleep    | SELECT pg_sleep(2)\n(2 rows)"} outputCaption={"출력 예시 · 다음 회차가 현재 실행 중인 시점"}>{"SELECT pid, backend_type, application_name, state, wait_event, query\nFROM pg_stat_activity\nWHERE application_name IN ('pg_cron', 'pg_cron scheduler')\n   OR backend_type IN ('pg_cron launcher', 'pg_cron');"}</CodeBlock>
      <p>일반 사용자는 RLS 때문에 자기 잡과 이력을 조회한다. 이름 있는 잡의 이름 범위도 사용자별이다. cron.log_run을 끄면 이력 테이블만으로 실행 여부를 판단할 수 없다. job_run_details는 자동 정리되지 않으므로 보존 기간을 정한다. unschedule과 active=false는 실행 중인 잡에도 취소를 요청할 수 있으며, 이미 커밋된 업무 결과를 되돌리지는 않는다.</p>
<CodeBlock language="sql" output={" schedule\n----------\n       43\n(1 row)"} outputCaption={"예상 출력 · 오래된 이력을 매일 정리할 예약 등록"}>{"SELECT cron.schedule('prune-cron-history', '0 4 * * *',\n  $$DELETE FROM cron.job_run_details\n    WHERE end_time < now() - interval '14 days'$$);"}</CodeBlock>
      <p>다음은 앞에서 조회한 본인 잡 42번을 비활성화하는 예다. 실제 jobid로 바꿔 실행한다. 실행 중인 회차에도 취소를 요청할 수 있다.</p>
<CodeBlock language="sql" output={" alter_job\n-----------\n\n(1 row)"} outputCaption={"예상 출력 · alter_job은 값을 반환하지 않아 결과 칸이 비어 있음"}>{"SELECT cron.alter_job(42, active := false);"}</CodeBlock>
    </Section>
    <Section title="실패와 한계는 증상에 맞는 페이지에서 확인한다">
      <p>SQL 오류·인증 실패·worker 시작 실패가 이력에 어떻게 남는지는 <Ref to="/pg-cron/failures">잡 실패와 기록</Ref>에 단계별로 정리했다. worker 슬롯, 서버 중단, exactly-once와 여러 DB 서버의 실행 주체는 <Ref to="/pg-cron/limits">장애·자원·분산 한계</Ref>에서 다룬다.</p>
      <p>같은 SQL을 서로 다른 이름으로 두 번 예약하면 서로 다른 jobid라 겹칠 수 있다. 업무 단위 직렬화가 필요하면 트랜잭션 advisory lock 등 별도 조정을 고려한다. 반복 측정값과 원본은 <Ref to="/pg-cron/experiments">처리량·큐·롤백 실험</Ref>에서 확인한다.</p>
      <p><a href="https://github.com/citusdata/pg_cron/tree/v1.6.8#readme">설정·권한·운영 설명의 기준: 공식 v1.6.8 README</a></p>
    </Section>
  </>
}
