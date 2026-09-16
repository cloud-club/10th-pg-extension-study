import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'

export default function Schedules() {
  return <>
    <PageHeader eyebrow="Week 03 · 예약 저장과 변경" title="예약을 바꾸면 어디에 저장되고 언제 반영될까?" lede="예약의 원본은 DB의 cron.job 테이블이다. pg_cron launcher는 이를 메모리에 읽어 실행을 관리한다. 변경이 커밋되면 캐시를 다시 읽으며, 일반적인 예약 수정에 서버 재시작은 필요하지 않다." />
    <Section title="1. 테이블과 메모리는 서로 다른 것을 보관한다">
      <table><thead><tr><th>위치</th><th>내용</th><th>재시작하면?</th></tr></thead><tbody>
        <tr><td>cron.job</td><td>jobid, 이름, 시간표, SQL, 대상 DB, 사용자, 활성 여부</td><td>일반 DB 데이터로 보존된다.</td></tr>
        <tr><td>launcher 메모리의 예약 캐시</td><td>빠르게 확인하기 위해 읽어 둔 예약 정보</td><td>DB에서 다시 읽는다.</td></tr>
        <tr><td>launcher 메모리의 CronTask</td><td>대기·연결·실행 상태와 대기 회차 수</td><td>그대로 복원되는 영속 업무 큐가 아니다.</td></tr>
        <tr><td>cron.job_run_details</td><td>실행 회차별 상태·시각·결과 메시지</td><td>이력 기록이 켜져 있으면 DB 데이터로 남는다.</td></tr>
      </tbody></table>
      <p>예약은 OS의 crontab 파일에 쓰는 것이 아니라 PostgreSQL 테이블 데이터로 저장한다. cron.job은 cron.database_name으로 지정한 관리 DB에 있다. 한 PostgreSQL 인스턴스에는 pg_cron을 한 DB에 설치하고, 다른 DB의 작업은 schedule_in_database로 예약한다. 업무 결과는 예약 SQL이 대상으로 삼은 테이블에 따로 저장된다.</p>
    </Section>
    <Section title="2. 수정한 값이 메모리까지 전달되는 순서">
      <Diagram chart={`flowchart TD
        U["사용자: cron.alter_job 또는 이름 있는 cron.schedule"] --> T["cron.job의 예약 행 변경"]
        T --> C["트랜잭션 COMMIT"]
        C --> I["PostgreSQL 캐시 무효화 알림"]
        I --> L["launcher: 기존 캐시가 오래됐다고 표시"]
        L --> R["다음 루프에서 예약을 다시 읽어 상태에 반영"]
        R --> N["변경된 정보로 이후 실행 판단"]
      `} caption="변경할 때마다 새 launcher를 만드는 것이 아니다. 기존 launcher가 예약 정보를 갱신한다." />
      <ol><li>수정 함수가 cron.job 행을 바꾸고 캐시 무효화를 요청한다.</li><li>COMMIT 후 다른 세션에서도 새 예약을 볼 수 있다. BEGIN 안에서만 수정하고 커밋하지 않았다면 launcher는 아직 그 변경을 볼 수 없다.</li><li>launcher가 알림을 처리하면 캐시를 다시 읽고 예약 간격·활성 여부 등을 갱신한다.</li></ol>
      <p>변경 SQL이 반환되는 순간 이미 모든 실행 단계가 바뀌었다는 뜻은 아니다. launcher의 루프가 반영할 시간이 필요하다. 이미 실행 프로세스에 보낸 SQL 본문이 도중에 다른 SQL로 교체되지는 않는다. 연결 준비 중인 회차와 이미 대기 중인 회차도 있으므로, 수정이 기존 대기를 모두 초기화한다고 가정하지 않는다.</p>
      <table><thead><tr><th>변경</th><th>처리 방법</th></tr></thead><tbody>
        <tr><td>예약 시간·SQL·활성 여부</td><td>예약 함수 호출 → 커밋 → 캐시 갱신. 보통 서버 재시작 불필요</td></tr>
        <tr><td>shared_preload_libraries·실행 모드</td><td>서버 설정 변경과 재시작 필요</td></tr>
        <tr><td>active=false 또는 unschedule</td><td>실행 중 회차에도 취소를 요청할 수 있음. 이미 커밋한 업무 결과는 남음</td></tr>
      </tbody></table>
    </Section>
    <Section title="3. 같은 이름의 예약을 수정하고 확인하기">
      <p>pg_cron이 준비된 실습 DB에서 자동 커밋으로 실행한다. 같은 사용자가 같은 잡 이름으로 cron.schedule을 다시 호출하면 새 잡을 추가하는 대신 기존 예약을 갱신한다. 아래 jobid 숫자는 예시다.</p>
      <CodeBlock language="sql" output={" schedule\n----------\n        1\n(1 row)"}>{`SELECT cron.schedule('editable-demo', '5 seconds', 'SELECT 1');`}</CodeBlock>
      <CodeBlock language="sql" output={" schedule\n----------\n        1\n(1 row)"} outputCaption="예상 출력 · 같은 사용자·이름이므로 같은 jobid 반환">{`SELECT cron.schedule('editable-demo', '10 seconds', 'SELECT 2');`}</CodeBlock>
      <CodeBlock language="sql" output={" jobid |    jobname    |  schedule  | command  | active\n-------+---------------+------------+----------+-------\n     1 | editable-demo | 10 seconds | SELECT 2 | t\n(1 row)"}>{`SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'editable-demo' AND username = current_user;`}</CodeBlock>
      <p>이 SELECT는 DB에 저장된 원본을 확인한다. 실제로 새 SQL이 실행됐는지는 cron.job_run_details와 업무 결과도 함께 확인한다. 일부 속성만 바꾸려면 cron.alter_job을 사용한다.</p>
      <CodeBlock language="sql" output={" alter_job\n-----------\n\n(1 row)"} outputCaption="예상 출력 · 반환값이 없는 함수라 결과 칸은 비어 있음">{`SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname = 'editable-demo' AND username = current_user;`}</CodeBlock>
      <CodeBlock language="sql" output={" unschedule\n------------\n t\n(1 row)"}>{`SELECT cron.unschedule('editable-demo');`}</CodeBlock>
      <p>테이블을 직접 바꾸기보다 공식 예약 함수를 사용하면 시간표 검사·권한 검사·캐시 무효화 경로를 함께 사용할 수 있다. 이름이 없는 cron.schedule(schedule, command)를 반복 호출하면 별도 잡들이 만들어지는 점도 구분한다.</p>
    </Section>
    <Section title="별도 임시 DB에서 변경 반영을 확인한 결과">
      <table><thead><tr><th>확인 순서</th><th>관측 결과</th></tr></thead><tbody>
        <tr><td>1초마다 old 값을 기록하는 잡 실행</td><td>업무 테이블에 old 행 생성</td></tr>
        <tr><td>다른 세션의 트랜잭션에서 SQL을 new로 변경하고 아직 커밋하지 않음</td><td>조회 세션에서는 기존 SQL이 보이고 new 결과는 0행</td></tr>
        <tr><td>수정 트랜잭션 커밋 후 기다림</td><td>서버 재시작 없이 new 행 생성</td></tr>
        <tr><td>같은 이름으로 간격을 2초로 다시 예약</td><td>jobid는 유지되고 cron.job의 간격이 변경됨</td></tr>
      </tbody></table>
      <p>PostgreSQL 16·pg_cron 1.6.8의 단일 임시 DB, 기본 libpq 모드에서 확인했다. 이 검사는 수정의 커밋과 반영을 확인한 것이며 반영 지연의 상한이나 분산 환경의 동작을 측정한 것은 아니다.</p>
    </Section>
    <Section title="4. 분산 DB에서는 무엇이 달라지나?">
      <p>‘분산 DB’가 복제 서버인지, 독립된 여러 DB인지, 데이터를 나눠 저장하는 샤딩 DB인지에 따라 다르다. pg_cron 자체는 노드 간 예약을 합의하거나 전역적으로 한 번만 실행시키는 스케줄러가 아니다.</p>
      <table><thead><tr><th>구성</th><th>예약과 실행</th><th>확인할 점</th></tr></thead><tbody>
        <tr><td>Primary + 물리 복제 standby</td><td>관리 테이블은 DB 데이터와 함께 복제. hot standby에서는 pg_cron 잡이 실행되지 않고 승격 뒤 시작</td><td>복제 서버에도 라이브러리·서버 설정 필요. 이런 파일·설정은 테이블 복제로 설치되지 않음</td></tr>
        <tr><td>독립된 DB 서버 여러 개</td><td>각 서버에 등록한 예약과 launcher가 독립적으로 동작</td><td>같은 이름·SQL이어도 서버 전체에서 직렬화되지 않음. 같은 업무를 중복 실행할 수 있음</td></tr>
        <tr><td>샤딩·분산 SQL 엔진</td><td>예약을 실행하는 노드와 SQL을 분산 처리하는 엔진의 역할이 다름</td><td>어느 노드에 예약을 둘지, 함수·확장 지원 범위를 해당 제품 기준으로 확인</td></tr>
        <tr><td>논리 복제 구성</td><td>publication 등으로 지정한 데이터만 복제하는 방식</td><td>확장 설치·예약 테이블·시퀀스·설정이 자동으로 동일해진다고 가정하지 않음</td></tr>
      </tbody></table>
      <p><a href="https://www.postgresql.org/docs/16/logical-replication-restrictions.html">논리 복제에서는 스키마·DDL과 시퀀스 상태가 자동 복제되지 않는다.</a></p>
      <p>같은 jobid의 직렬화는 해당 launcher 안의 규칙이다. 독립된 두 서버가 같은 이름의 잡을 실행하는 것을 막는 전역 잠금이 아니다. 외부 메일 발송처럼 중복에 민감한 업무는 공통 저장소의 업무 키·소유권 관리나 대상 서비스의 멱등 키를 함께 설계한다.</p>
    </Section>
    <Section title="5. 장애 전환 때 무엇이 남고 무엇이 보장되지 않나?">
      <ol><li>물리 standby가 새 primary로 승격되면, 준비된 pg_cron이 복제되어 있는 예약을 읽는다.</li><li>이전 launcher 메모리의 대기 회차는 새 launcher로 옮겨지는 영속 큐가 아니다. 서버가 멈춘 동안 놓친 모든 실행을 자동 복원한다고 기대하면 안 된다.</li><li>이전 primary가 계속 쓰기·예약 실행을 하지 못하도록 장애 전환 시스템이 차단해야 한다. pg_cron이 별도로 리더 선출을 해 주지는 않는다.</li><li>실패 직전 업무의 커밋 여부와 복제 도달 여부를 확인한다. 특히 비동기 복제에서는 최신 예약 변경·업무 데이터가 새 primary에 없을 수 있다.</li></ol>
      <p>따라서 장애 전환에서도 ‘업무 효과가 정확히 한 번 발생한다’는 보장은 별도 설계가 필요하다. 단일 서버가 꺼진 동안 놓친 회차가 왜 재생되지 않는지는 <Ref to="/pg-cron/downtime">서버 중단과 놓친 예약</Ref>에서 코드로 확인한다. 이 페이지의 복제·분산 설명은 공식 동작과 설계상 주의점을 정리한 것이며, 다중 노드 장애 전환을 직접 실험한 결과는 아니다.</p>
    </Section>
    <details className="my-8 rounded-xl border border-border p-5"><summary className="cursor-pointer font-semibold">심화 · 변경 반영을 담당하는 실제 함수</summary>
      <div className="prose-doc"><table><thead><tr><th>함수</th><th>역할</th></tr></thead><tbody>
        <tr><td>InvalidateJobCache</td><td>cron.job 관계의 캐시 무효화 요청</td></tr><tr><td>InvalidateJobCacheCallback</td><td>CronJobCacheValid를 false로 표시</td></tr><tr><td>RefreshTaskHash</td><td>예약을 다시 읽고 task의 활성 여부·초 간격 등을 반영</td></tr>
      </tbody></table><p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/job_metadata.c#L805-L835">job_metadata.c의 캐시 무효화</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/task_states.c#L77-L115">task_states.c의 새 예약 반영</a></p></div>
    </details>
    <p className="text-muted-foreground"><a href="https://github.com/citusdata/pg_cron/tree/v1.6.8#readme">pg_cron 공식 설명</a> · <a href="https://www.postgresql.org/docs/16/warm-standby.html">PostgreSQL 물리 복제·장애 전환</a> · 다음: <Ref to="/pg-cron/processes">프로세스와 메모리의 역할</Ref></p>
  </>
}
