import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Clotho } from '@/components/viz/Clotho'
import { Diagram } from '@/components/viz/Diagram'
import demo from '@/data/cron-concurrency-demo.json'
import { SourceExcerpt } from './SourceExcerpt'

export default function Source() {
  return <>
    <PageHeader eyebrow="Week 03 · 실제 C 코드" title="서버 기동부터 예약 실행까지 코드로 따라가기" lede="_PG_init은 PostgreSQL이 라이브러리를 로드할 때 찾는 초기화 함수다. 여기서 launcher의 시작 함수를 등록하고, PostgreSQL이 별도 프로세스에서 그 함수를 실행한다. 코드와 실습 기준은 pg_cron v1.6.8로 맞췄다." />
    <p className="text-muted-foreground">이 페이지는 실습 이미지와 같은 v1.6.8 원문을 읽는다. 현재 main의 <code>pg_cron.c</code>·<code>task_states.c</code>·<code>job_metadata.c</code> 함수 목록은 <Ref to="/pg-cron/source-map">소스 파일·함수 지도</Ref>에서 먼저 볼 수 있다. postmaster는 PostgreSQL 프로세스들을 시작·관리하는 부모 프로세스이고, 여기의 launcher는 예약을 관리하는 pg_cron launcher다. 아래 C 코드는 SQL 입력창에 실행하는 코드가 아니다.</p>
    <Section title="코드를 읽기 전에 이름부터 정리한다">
      <table className="sm:[&_td:first-child]:w-[26%]"><thead><tr><th>코드의 이름</th><th>쉬운 설명</th><th>이름이 가리키는 것</th></tr></thead><tbody>
        <tr><td>공유 라이브러리 / pg_cron.so</td><td>서버가 필요할 때 불러 쓰는 C 함수 묶음</td><td>파일. 그 자체가 실행 중인 프로세스는 아니다.</td></tr>
        <tr><td>_PG_init</td><td>라이브러리가 로드될 때 설정과 worker 정의를 등록하는 초기화 함수</td><td>함수. 실습에서는 서버 기동 때 postmaster가 호출한다.</td></tr>
        <tr><td>BackgroundWorker worker</td><td>새 프로세스를 어떤 조건과 함수로 시작할지 적는 구조체</td><td>설정 데이터. 선언만으로 프로세스가 생기지 않는다.</td></tr>
        <tr><td>PgCronLauncherMain</td><td>생성된 launcher 프로세스가 처음 실행할 함수</td><td>함수. 일정 확인을 반복하는 루프가 이 안에 있다.</td></tr>
        <tr><td>CronJob / CronTask</td><td>‘무엇을 언제 실행할지’라는 예약 정보 / ‘지금 어디까지 진행했는지’라는 실행 상태</td><td>launcher가 관리하는 C 자료구조. SQL을 수행하는 프로세스 자체가 아니다.</td></tr>
      </tbody></table>
      <p>코드의 화살표 <code>task-&gt;state</code>는 ‘task가 가리키는 구조체의 state 필드’를 읽는 C 문법이다. <code>&amp;worker</code>는 구조체가 있는 주소를 함수에 전달한다. 둘 다 새로운 프로세스를 만드는 문법은 아니다.</p>
    </Section>
    <Section title="1. PostgreSQL이 _PG_init을 호출하는 시점">
      <p>pg_cron은 실행 파일이 아니라 서버가 로드하는 C 공유 라이브러리다. PostgreSQL의 라이브러리 로더는 그 안에 _PG_init이라는 심볼이 있으면 호출한다. 사용자가 SQL로 호출하는 함수도, 잡마다 실행되는 함수도 아니다.</p>
      <CodeBlock language="c" caption={<a href="https://github.com/postgres/postgres/blob/REL_16_STABLE/src/backend/utils/fmgr/dfmgr.c#L287-L289">PostgreSQL 16 · dfmgr.c:287–289 · 로더 원문</a>}>{`PG_init = (PG_init_t) dlsym(file_scanner->handle, "_PG_init");
if (PG_init)
    (*PG_init) ();`}</CodeBlock>
      <p>dlsym은 로드한 라이브러리에서 이름에 해당하는 함수 주소를 찾는다. 찾은 함수 포인터를 다음 줄에서 호출한다. 일반 확장에서는 세션 중 로드될 수도 있지만, pg_cron은 서버 시작 시 shared_preload_libraries를 처리하는 문맥에서만 정상 초기화를 허용한다. 실습의 Linux에서는 postmaster가 이 기동 초기화를 수행한다.</p>
      <SourceExcerpt name="init" />
      <p>process_shared_preload_libraries_in_progress가 거짓이면 오류를 낸다. IsBinaryUpgrade 분기는 업그레이드용 예외다. 평소 CREATE EXTENSION만 실행해서 상주 스케줄러를 시작할 수 없는 이유가 여기에 있다. 초기화 중에는 설정 변수와 캐시 무효화 콜백도 등록한다.</p>
    </Section>
    <Section title="2. PgCronLauncherMain이 호출되는 경로">
      <p>_PG_init의 아래쪽에서 BackgroundWorker 구조체에 ‘어떤 라이브러리의 어떤 함수를 새 프로세스의 시작점으로 쓸지’를 적는다. PgCronLauncherMain이라는 문자열이 그 연결 고리다.</p>
      <p>‘초기화 함수 안에서 launcher 함수를 호출한다’로 읽으면 실행 위치를 놓치게 된다. 먼저 시작 방법을 등록하고, 나중에 PostgreSQL이 별도 프로세스를 생성한다. 그 새 프로세스에서 등록한 함수가 시작된다.</p>
      <SourceExcerpt name="register" />
      <table><thead><tr><th>코드</th><th>읽는 방법</th></tr></thead><tbody>
        <tr><td>bgw_flags</td><td>공유 메모리 접근과 DB 연결이 필요한 worker라고 서버에 알리는 옵션. SHMEM_ACCESS는 공유 메모리, BACKEND_DATABASE_CONNECTION은 DB 연결을 허용한다.</td></tr>
        <tr><td>bgw_library_name = pg_cron</td><td>시작 함수가 들어 있는 라이브러리</td></tr>
        <tr><td>bgw_function_name = PgCronLauncherMain</td><td>새 worker 프로세스가 진입할 함수 이름</td></tr>
        <tr><td>BgWorkerStart_RecoveryFinished</td><td>서버 복구가 끝나 정상 읽기·쓰기가 가능한 시점에 시작. standby에서는 아직 시작하지 않음</td></tr>
        <tr><td>bgw_restart_time = 1</td><td>worker의 비정상 종료 후 재시작 정책. SQL 잡의 실패 재시도 간격이 아님</td></tr>
        <tr><td>bgw_main_arg / bgw_notify_pid</td><td>시작 함수에 넘길 값 / 시작·종료 알림을 받을 프로세스. 이 상주 launcher 등록에서는 둘 다 0으로 설정한다.</td></tr>
        <tr><td>bgw_name / bgw_type</td><td>프로세스 표시 이름 / pg_stat_activity에서 볼 worker 종류. 함수 이름과는 용도가 다르다.</td></tr>
        <tr><td>RegisterBackgroundWorker</td><td>서버에 worker 정의를 등록. 이 줄에서 PgCronLauncherMain을 일반 함수처럼 직접 호출하는 것이 아님</td></tr>
      </tbody></table>
      <p>PostgreSQL이 등록된 정의를 보고 worker 프로세스를 시작한 뒤 해당 함수를 진입점으로 호출한다. 원문에 함께 있는 PG_VERSION_NUM &lt; 100000 분기는 구버전 API 호환용이며 PostgreSQL 16에서는 함수 이름을 지정하는 경로를 읽으면 된다.</p>
    </Section>
    <Section title="3. launcher 프로세스는 메타데이터 DB에 연결하고 반복한다">
      <SourceExcerpt name="entry" />
      <p>이 코드는 PgCronLauncherMain 안이다. CronTableDatabaseName은 cron.database_name 설정에서 온다. 이 연결은 예약을 관리하는 launcher 자신의 내부 연결이며, 앞으로 실행할 모든 잡이 이 연결에서 SQL을 실행한다는 뜻은 아니다.</p>
      <p>메타데이터 DB는 cron.job 같은 예약 관리 테이블이 있는 DB를 뜻한다. 캐시는 그 내용을 매번 디스크에서 읽지 않도록 메모리에 보관한 복사본이다. 캐시 무효화는 ‘예약이 바뀌었으니 다음에 다시 읽어야 한다’는 표시다.</p>
      <SourceExcerpt name="loop" />
      <ol>
        <li>캐시가 무효화되었다면 RefreshTaskHash로 잡 정의를 반영한다. 매 반복마다 전체 예약을 무조건 다시 SELECT하는 것은 아니다.</li>
        <li>CurrentTaskList와 현재 시각을 얻고 StartAllPendingRuns로 실행할 회차를 계산한다.</li>
        <li>WaitForCronTasks로 다음 시각 또는 연결의 읽기·쓰기 준비를 기다린다.</li>
        <li>ManageCronTasks가 각 잡의 상태를 한 단계씩 진행시킨다.</li>
      </ol>
      <p>이 반복문은 launcher 안에서 돈다. 잡의 SQL 본문이 실행되는 위치는 <Ref to="/pg-cron/modes">실행 모드</Ref>에 따라 별도 client backend 또는 일회성 worker다.</p>
    </Section>
    <Section title="4. 시작 조건을 확인한 뒤 실행 모드를 선택한다">
      <SourceExcerpt name="gate" />
      <p>WAITING은 지금 SQL을 실행 중이지 않은 상태, pendingRunCount는 실행 대기, RunningTaskCount는 launcher가 관리하는 실행 슬롯 사용량이다. 세 조건을 모두 만족해야 시작한다. 슬롯 사용량에는 연결·기동 단계도 들어가므로 실제로 CPU에서 SQL을 실행하는 프로세스 수와 같지 않을 수 있다.</p>
      <table><thead><tr><th>검사식</th><th>질문으로 읽기</th><th>거짓이면?</th></tr></thead><tbody>
        <tr><td>task-&gt;state == CRON_TASK_WAITING</td><td>이 잡의 이전 회차가 끝나서 다시 시작할 수 있는가?</td><td>연결 중·실행 중이면 같은 잡을 또 시작하지 않는다.</td></tr>
        <tr><td>task-&gt;pendingRunCount &gt; 0</td><td>실행해야 할 예약 회차가 있는가?</td><td>시간이 안 됐으면 실행하지 않는다.</td></tr>
        <tr><td>RunningTaskCount &lt; MaxRunningTasks</td><td>모든 잡이 함께 쓰는 실행 자리에 여유가 있는가?</td><td>이 잡은 대기한다.</td></tr>
      </tbody></table>
      <p><code>&amp;&amp;</code>는 ‘그리고’다. 세 조건 중 하나라도 거짓이면 CanStartTask는 false를 반환한다. 앞의 두 조건은 잡마다 다르고, 마지막 사용량·한도는 launcher 전체가 공유한다.</p>
      <SourceExcerpt name="mode" />
      <p>설정에 따라 CRON_TASK_BGW_START 또는 CRON_TASK_START로 이동한다. 이것이 두 실행 방식이 갈리는 지점이다. 동일 jobid는 하나의 상태를 관리하므로 실행 중 다른 회차를 동시에 시작하지 않는다.</p>
      <h3>같은 잡은 왜 겹치지 않는가?</h3>
      <p>jobid 하나에 대응하는 CronTask 하나가 현재 회차의 상태를 갖는다. 시작할 때 WAITING에서 START/BGW_START로 바뀌므로, 다음 예약 시각이 와도 같은 task는 첫 번째 조건을 통과하지 못한다. 완료·정리 후 다시 WAITING으로 돌아와야 다음 회차를 시작할 수 있다. SQL에 잠금을 자동 삽입해서 직렬화하는 방식이 아니다.</p>
      <SourceExcerpt name="reserve" />
      <p>위 코드에서 대기 회차 하나를 사용하고 상태를 바꾼 뒤 전체 사용량을 1 늘린다. libpq 완료 경로에서는 아래처럼 DONE으로 바꾸고 사용량을 1 줄인다. 뒤의 정리 단계에서 task를 다시 초기화한다.</p>
      <SourceExcerpt name="release" />
      <h3>다른 잡은 왜 동시에 진행될 수 있는가?</h3>
      <p>잡 A가 RUNNING이어도 다른 jobid인 B의 task는 WAITING일 수 있다. B에도 대기 회차가 있고 전체 한도가 남으면 launcher가 B도 시작한다. SQL은 A와 B의 별도 backend/worker에서 실행되므로 실행 구간이 겹친다. launcher의 상태 점검은 순차적이어도 SQL 실행 전체를 순서대로 기다리지는 않는다.</p>
      <p><strong>동일 잡은 동일 jobid를 뜻한다.</strong> 같은 SQL을 서로 다른 잡 이름으로 등록하면 두 jobid가 만들어져 겹칠 수 있다. 같은 테이블을 쓴다는 이유로 pg_cron이 두 잡을 직렬화하지는 않는다. 실제 SQL의 잠금 때문에 한쪽이 기다리는 일은 별개다.</p>
      <Diagram chart={`sequenceDiagram
        participant L as launcher (한도 2)
        participant A as 잡 A의 실행 프로세스
        participant B as 잡 B의 실행 프로세스
        L->>A: A 시작 · 사용량 0 → 1
        L->>B: B 시작 · 사용량 1 → 2
        Note over A,B: 서로 다른 jobid의 SQL이 동시에 진행
        Note over L: A의 다음 시각 도착 / A가 WAITING이 아니므로 보류
        A-->>L: 완료 · 사용량 2 → 1
        Note over L: A 정리 후 WAITING으로 복귀
        L->>A: A의 다음 회차 시작
      `} caption="설명용 정상 실행 흐름. 실행 프로세스는 회차마다 새로 생기며, 그림의 A는 동일 PID의 재사용을 뜻하지 않는다. 포화 상태의 실제 진행 여부는 버전별 검증이 필요하다." />
      <Clotho id="cron-concurrency" />
      <p>초 간격 스케줄은 이미 대기 회차가 있으면 초마다 무한히 쌓지 않는다. 대기 상태는 launcher 메모리에 있고 영속 재시도 큐가 아니다. 그림은 이 직렬화 원리를 설명하며 시간 비율은 실측값이 아니다.</p>
      <p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c">pg_cron.c 전체 원문</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/job_metadata.c">예약 저장·캐시 무효화 코드</a>. 각 발췌는 표시한 연속된 원문 구간이며 생략된 앞뒤 문맥은 링크에서 확인할 수 있다.</p>
    </Section>
    <Section id="parallel-limit" title="5. 그러면 몇 개까지 동시에 실행되는가?">
      <p>시작할 수 있는 잡 수는 ‘실행할 서로 다른 잡 수’와 ‘launcher의 유효 한도’ 중 작은 값 이하이다. cron.max_running_jobs는 모든 잡이 공유하는 한도이며, 같은 jobid에 적용되는 한도는 항상 1이다.</p>
      <table><thead><tr><th>예시 조건</th><th>잡 실행의 이론상 상한</th><th>이유</th></tr></thead><tbody>
        <tr><td>잡 A 하나 · cron.max_running_jobs=4</td><td>1개</td><td>A의 다음 회차는 현재 회차와 겹칠 수 없다.</td></tr>
        <tr><td>잡 A·B · 한도 4</td><td>2개</td><td>두 task만 실행 대상이다. 아래 실측에서 확인한다.</td></tr>
        <tr><td>서로 다른 잡 10개 · 한도 4</td><td>4개 이하</td><td>나머지는 대기. 포화 상황의 정상 진행까지 보장하는 수치는 아니다.</td></tr>
        <tr><td>worker 모드 · 잡 10개 · 한도 3 · max_worker_processes=4</td><td>3개 이하</td><td>launcher 하나를 제외하면 최대 3개다. 다른 worker가 사용 중이면 실행 자원은 더 부족하다.</td></tr>
      </tbody></table>
      <p>worker 모드의 설정 허용 범위도 max_worker_processes − 1까지다. max_worker_processes=4인 상태에서 cron.max_running_jobs=8로 설정하는 것은 유효한 구성이 아니다. 아래 코드는 launcher에서도 worker 수에 맞춰 상한을 확인하는 부분이다.</p>
      <SourceExcerpt name="workerLimit" />
      <p>v1.6.8의 launcher 초기화는 max_connections·파일 디스크립터 한도도 확인해 MaxRunningTasks를 줄인다. 따라서 SHOW로 본 cron.max_running_jobs가 그대로 실행 가능한 개수라는 뜻은 아니다. 연결 실패·worker 부족·행 잠금·CPU/I/O 경합 때문에 실제 처리량은 더 낮아질 수 있다. <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L613-L646">유효 한도를 계산하는 원문</a></p>
      <p>잡 4개·한도 2의 v1.6.8 libpq 실험에서는 대기가 정상적으로 소진되지 않는 정체도 관측했다. 위 표는 시작 가능한 개수의 상한이며, 그 개수를 계속 유지하거나 공정하게 순환한다는 보장은 아니다. <Ref to="/pg-cron/experiments">포화 실험 결과</Ref>를 함께 읽는다.</p>
    </Section>
    <Section id="concurrency-demo" title="6. 두 잡을 실행해서 직렬화와 동시 진행을 직접 확인한다">
      <p>{demo.note}</p>
      <p>잡 A와 B를 각각 1초 간격으로 등록하고, 매 회차는 약 2초 동안 기다리게 한다. 예상은 ‘같은 잡의 회차는 겹치지 않고, 서로 다른 두 잡의 구간은 겹친다’이다. 아래 SQL은 pg_cron이 설치된 별도 실습 DB에서 자동 커밋으로 순서대로 실행한다.</p>
      <CodeBlock language="sql" output={demo.blocks.settings.output} outputCaption="실제 조회 결과">{demo.blocks.settings.sql}</CodeBlock>
      <CodeBlock language="sql" output="CREATE TABLE" outputCaption="psql 예상 출력 · 실습용 결과 테이블 생성">{demo.blocks.setup.sql.slice(0, demo.blocks.setup.sql.indexOf('CREATE FUNCTION')).trim()}</CodeBlock>
      <CodeBlock language="sql" output="CREATE FUNCTION" outputCaption="psql 예상 출력 · 함수 본문 전체가 하나의 CREATE FUNCTION 문장">{demo.blocks.setup.sql.slice(demo.blocks.setup.sql.indexOf('CREATE FUNCTION'))}</CodeBlock>
      <CodeBlock language="sql" output={demo.blocks.register.output} outputCaption="실제 등록 결과 · jobid는 실행마다 달라짐">{demo.blocks.register.sql}</CodeBlock>
      <p>등록 후 약 8초 이상 기다린다. 준비한 함수는 시작 시각을 기억하고 2초 뒤 종료 시각과 함께 INSERT한다. 따라서 테이블에는 커밋된 완료 회차만 남는다. 관찰 중인 프로세스는 <Ref to="/pg-cron/processes">프로세스 페이지의 실제 출력</Ref>에서 확인할 수 있다.</p>
      <CodeBlock language="sql" output={demo.blocks.cleanup.output} outputCaption="실제 정리 결과 · t는 예약 제거 성공">{demo.blocks.cleanup.sql}</CodeBlock>
      <p>예약 제거 시 실행 중 회차는 취소될 수 있다. 아래 비교는 완료되어 기록된 회차만 사용한다. 테이블과 함수는 결과 조회를 위해 남겨 둔다.</p>
      <CodeBlock language="sql" output={demo.blocks.runs.output} outputCaption="실제 기록 · SQL 함수 본문의 시작/종료 시각">{demo.blocks.runs.sql}</CodeBlock>
      <p>같은 label의 다음 started가 이전 finished보다 앞서지 않는지 본다. 반대로 A와 B 사이에는 시간이 겹치는 행이 있다. PID가 회차마다 달라지는 것도 확인할 수 있다. 연결 준비부터 포함한 전체 지연을 측정한 표는 아니다.</p>
      <CodeBlock language="sql" output={demo.blocks.overlap.output} outputCaption="실제 겹침 검사 결과">{demo.blocks.overlap.sql}</CodeBlock>
      <p>tstzrange는 두 시각 사이의 구간이고, [)는 시작은 포함하고 끝은 제외한다. &amp;&amp;는 두 구간의 겹침 검사다. 같은 잡의 겹침은 0이어야 하고, 다른 잡의 겹침은 0보다 커야 한다. other_job_overlaps는 겹친 회차 쌍의 수이므로 동시 실행 개수 자체가 아니다.</p>
      <CodeBlock language="sql" output={demo.blocks.peak.output} outputCaption="실제 최대 동시 실행 개수">{demo.blocks.peak.sql}</CodeBlock>
      <p>각 회차의 시작 순간에 열려 있는 실행 구간을 세고 그 최댓값을 구했다. 이 실험은 최대 2개였다. 한도 4는 빈자리를 남겨 둔 상한이고, 서로 다른 잡이 두 개뿐이므로 4개까지 늘어나지 않는다. pg_sleep은 CPU 성능 실험이 아니라 실행 구간의 겹침을 관찰하기 위한 장치다.</p>
<CodeBlock language="sql" output={"DROP FUNCTION"} outputCaption={"psql 예상 출력"}>{"DROP FUNCTION public.cron_demo(text);"}</CodeBlock>
<CodeBlock language="sql" output={"DROP TABLE"} outputCaption={"psql 예상 출력"}>{"DROP TABLE public.cron_demo_runs;"}</CodeBlock>
    </Section>
  </>
}
