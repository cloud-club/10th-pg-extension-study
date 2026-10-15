import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function MaxWorkerProcesses() {
  return <>
    <PageHeader eyebrow="Week 03 · PostgreSQL 설정 기초" title="max_worker_processes는 서버 전체 worker 프로세스의 상한이다" lede="PostgreSQL 기능과 확장은 서버 뒤에서 별도 프로세스를 실행할 수 있다. max_worker_processes는 이런 worker들이 함께 쓰는 전체 슬롯 수이며, pg_cron 잡만을 위한 동시 실행 개수가 아니다." />
    <Section title="1. worker 슬롯을 좌석으로 생각한다">
      <p>PostgreSQL 16의 기본값은 8이며 서버 시작 때 정해진다. pg_cron launcher, worker 모드로 실행하는 각 잡, 논리 복제 worker, 다른 확장의 background worker와 병렬 쿼리 worker가 이 한도에 영향을 받는다.</p>
      <table><thead><tr><th>프로세스</th><th>pg_cron worker 모드에서 슬롯 사용</th><th>설명</th></tr></thead><tbody>
        <tr><td>pg_cron launcher</td><td>항상 1개</td><td>시간을 확인하고 잡 상태를 관리하는 상주 background worker</td></tr>
        <tr><td>실행 중인 pg_cron 잡</td><td>회차마다 1개</td><td><code>cron.use_background_workers=on</code>일 때 동적 worker로 실행</td></tr>
        <tr><td>기본 libpq 모드의 잡</td><td>실행용 worker 슬롯은 쓰지 않음</td><td>일반 client backend 연결을 사용한다. launcher 1개는 여전히 필요하다.</td></tr>
        <tr><td>다른 기능</td><td>구성에 따라 사용</td><td>병렬 쿼리·논리 복제·다른 확장과 같은 서버 풀을 나눠 쓴다.</td></tr>
      </tbody></table>
    </Section>
    <Section title="2. pg_cron의 두 설정은 서로 다른 상한이다">
      <p><code>cron.max_running_jobs</code>는 pg_cron이 동시에 실행하도록 허용할 잡 수다. <code>max_worker_processes</code>는 PostgreSQL 전체 worker 수다. worker 모드에서는 두 한도를 모두 통과해야 실제 실행 worker가 생긴다.</p>
      <CodeBlock language="text">{`예: max_worker_processes = 8

pg_cron launcher                         1
논리 복제·다른 확장을 위해 남긴 몫      2
병렬 쿼리를 위해 남긴 몫                2
-------------------------------------------
pg_cron 실행 worker에 쓸 수 있는 몫     3 이하

cron.max_running_jobs = 5여도 이 구성에서는 5개를 안정적으로 보장하지 못한다.`}</CodeBlock>
      <p>실제 여유는 시점마다 달라진다. 다른 worker가 먼저 슬롯을 쓰면 pg_cron이 원하는 수만큼 시작하지 못할 수 있다. 숫자를 늘리면 프로세스별 메모리, CPU와 I/O 경쟁도 늘 수 있으므로 동시 잡 수와 쿼리 비용을 함께 측정한다.</p>
    </Section>
    <Section title="3. 현재 값과 실행 프로세스를 확인한다">
      <CodeBlock language="sql" output={' max_worker_processes | max_parallel_workers | cron.max_running_jobs\n----------------------+----------------------+-----------------------\n 8                    | 8                    | 5\n(1 row)'} outputCaption="설명용 출력 · 실제 값은 서버 설정에 따라 다름">{`SELECT current_setting('max_worker_processes') AS max_worker_processes,
       current_setting('max_parallel_workers') AS max_parallel_workers,
       current_setting('cron.max_running_jobs') AS "cron.max_running_jobs";`}</CodeBlock>
      <CodeBlock language="sql" output={'  pid  |   backend_type   | application_name\n-------+------------------+-------------------\n 10100 | pg_cron launcher | pg_cron scheduler\n 10142 | pg_cron          |\n(2 rows)'} outputCaption="worker 모드 실행 중의 예시 · v1.6.8의 bgw_type 기준이며 시점에 따라 실행 행이 보이지 않을 수 있음">{`SELECT pid, backend_type, application_name
FROM pg_stat_activity
WHERE backend_type ILIKE '%cron%'
   OR application_name ILIKE '%cron%';`}</CodeBlock>
      <p><code>SHOW</code>는 설정값을 보여주고, <code>pg_stat_activity</code>는 조회 순간 실제 프로세스를 보여준다. 짧은 잡은 너무 빨리 끝나 조회에서 보이지 않을 수 있다.</p>
    </Section>
    <Section title="4. 변경에는 서버 재시작이 필요하다">
      <p>max_worker_processes도 <code>context=postmaster</code>인 시작 설정이다. postgresql.conf나 관리형 DB의 파라미터 그룹에서 바꾼 뒤 서버를 재시작해야 한다. standby는 primary와 같거나 더 큰 값이 필요하다는 PostgreSQL 제약도 함께 확인한다.</p>
      <p>pg_cron 기본 모드와 worker 모드의 차이는 <Ref to="/pg-cron/modes">두 실행 모드</Ref>, 실제 동시성 측정은 <Ref to="/pg-cron/experiments">실험 결과</Ref>에서 확인할 수 있다.</p>
    </Section>
    <p className="text-muted-foreground"><a href="https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-WORKER-PROCESSES">PostgreSQL 16 공식 문서</a> · 다음: <Ref to="/pg-cron/modes">두 실행 모드</Ref></p>
  </>
}
