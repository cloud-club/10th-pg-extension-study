import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Diagram } from '@/components/viz/Diagram'
import { Ref } from '@/components/common/Ref'

const commit = '5cedfa472ccc83567aa23ec645925ed8489a7797'
const src = (file: string, line: number) => `https://github.com/citusdata/pg_cron/blob/${commit}/src/${file}#L${line}`

export default function SourceMap() {
  return <>
    <PageHeader eyebrow="Week 03 · 소스 지도" title="다섯 파일과 핵심 함수부터 찾고 흐름을 읽는다" lede="현재 main의 함수 목록을 역할별로 정리했다. 시간식 파싱, 저장 정보, 실행 중 상태, launcher 제어 흐름을 구분한 뒤 v1.6.8 원문 발췌를 읽는다." tags={[{label:'main 확인: 2026-09-15'}, {label:'commit 5cedfa4'}, {label:'실습: v1.6.8'}]} />
    <Section title="버전 기준을 먼저 구분한다">
      <table><thead><tr><th>자료</th><th>기준</th><th>용도</th></tr></thead><tbody>
        <tr><td>이 페이지의 파일·함수 목록</td><td>GitHub main, commit <code>5cedfa4</code></td><td>현재 코드에서 어디를 읽을지 찾는 지도</td></tr>
        <tr><td>다음 페이지의 원문 발췌·실행 실험</td><td>tag v1.6.8</td><td>실제 설치 이미지와 같은 코드로 동작 설명</td></tr>
      </tbody></table>
      <p>main은 앞으로 바뀔 수 있으므로 확인한 commit을 고정했다. 두 버전의 함수 이름이 같더라도 줄 번호와 세부 구현이 같다고 가정하지 않는다.</p>
    </Section>
    <Section title="다섯 파일은 서로 다른 질문에 답한다">
      <table><thead><tr><th>파일</th><th>쉬운 역할</th><th>답하는 질문</th></tr></thead><tbody>
        <tr><td><a href={src('job_metadata.c', 188)}>job_metadata.c</a></td><td>DB 테이블의 예약과 실행 이력을 읽고 쓴다.</td><td>무엇을 예약했나? 결과를 어디에 기록하나?</td></tr>
        <tr><td><a href={src('task_states.c', 82)}>task_states.c</a></td><td>launcher 메모리에서 각 jobid의 현재 상태를 관리한다.</td><td>지금 대기·연결·실행 중인가?</td></tr>
        <tr><td><a href={src('pg_cron.c', 220)}>pg_cron.c</a></td><td>서버 기동, 시간 계산, 실행 시작, 결과 수집을 지휘한다.</td><td>언제 어떤 프로세스로 SQL을 실행하나?</td></tr>
        <tr><td><a href={src('entry.c', 80)}>entry.c</a></td><td>cron 표현식을 숫자 집합으로 파싱한다.</td><td><code>*/5</code>, 범위, 목록, 월·요일 이름을 어떻게 해석하나?</td></tr>
        <tr><td><a href={src('misc.c', 38)}>misc.c</a></td><td>파서가 문자를 읽고 되돌리고 문자열을 자르는 보조 기능을 제공한다.</td><td>entry.c가 입력 문자를 어떤 도구로 읽나?</td></tr>
      </tbody></table>
      <p><code>entry.c</code>와 <code>misc.c</code>는 Vixie cron에서 이어진 파서 코드다. ‘지금 실행할 시각인가’라는 최종 판정은 <code>pg_cron.c</code>의 <code>ShouldRunTask</code>가 파싱된 비트 집합과 현재 시각을 비교해 수행한다.</p>
    </Section>
    <Section title="entry.c와 misc.c: 시간식을 실행 가능한 형태로 바꾼다">
      <table><thead><tr><th>파일·함수</th><th>역할</th></tr></thead><tbody>
        <tr><td><a href={src('entry.c',80)}>entry.c · parse_cron_entry</a></td><td>다섯 필드를 차례로 읽어 분·시·일·월·요일에 허용된 값을 비트 집합으로 만든다.</td></tr>
        <tr><td><a href={src('entry.c',299)}>entry.c · get_list</a></td><td>쉼표로 나눈 값 목록을 읽는다.</td></tr>
        <tr><td><a href={src('entry.c',346)}>entry.c · get_range</a></td><td><code>*</code>, <code>1-5</code>, <code>*/10</code> 같은 범위와 간격을 해석한다.</td></tr>
        <tr><td><a href={src('entry.c',450)}>entry.c · get_number</a></td><td>숫자와 jan·mon 같은 이름을 필드의 값으로 바꾼다.</td></tr>
        <tr><td><a href={src('entry.c',65)}>entry.c · free_entry</a></td><td>파싱 결과에 할당된 메모리를 해제한다.</td></tr>
        <tr><td><a href={src('misc.c',38)}>misc.c · get_char</a> / <a href={src('misc.c',78)}>unget_char</a></td><td>입력에서 문자 하나를 읽거나 한 글자를 되돌려 파서가 다시 보게 한다.</td></tr>
        <tr><td><a href={src('misc.c',110)}>misc.c · get_string</a></td><td>지정한 종료 문자를 만나기 전까지 문자열 한 덩어리를 읽는다.</td></tr>
        <tr><td><a href={src('misc.c',131)}>misc.c · skip_comments</a></td><td>공백과 주석을 건너뛴다. pg_cron의 일정 문자열 경로에서는 파서 기반을 이루는 보조 함수다.</td></tr>
      </tbody></table>
      <p>흐름은 <code>ScheduleCronJob → ParseSchedule → parse_cron_entry → get_list/get_range → get_number → get_char</code> 순서로 먼저 내려간다. cron 표현식 파싱이 실패하면 <code>TryParseInterval</code>이 1~59초 간격 문자열을 검사한다. 저장된 파싱 결과는 launcher가 <code>ShouldRunTask</code>에서 현재 시각과 비교한다.</p>
    </Section>
    <Section title="job_metadata.c: 저장된 예약과 이력">
      <table><thead><tr><th>함수</th><th>역할</th></tr></thead><tbody>
        <tr><td><a href={src('job_metadata.c',188)}>ScheduleCronJob</a></td><td>시간식을 검사하고 cron.job에 INSERT한다. 이름 있는 잡은 같은 사용자·이름 충돌 시 갱신한다.</td></tr>
        <tr><td><a href={src('job_metadata.c',1525)}>ParseSchedule</a></td><td>entry.c로 cron 표현식을 먼저 시도하고, 실패하면 1~59초 간격 문자열인지 확인한다.</td></tr>
        <tr><td><a href={src('job_metadata.c',1247)}>AlterJob</a></td><td>소유권과 권한을 검사한 뒤 schedule·command·database·username·active를 변경한다.</td></tr>
        <tr><td><a href={src('job_metadata.c',859)}>LoadCronJobList</a></td><td>cron.job 행을 읽어 launcher가 사용할 CronJob 목록으로 만든다.</td></tr>
        <tr><td><a href={src('job_metadata.c',809)}>InvalidateJobCache</a> / <a href={src('job_metadata.c',827)}>Callback</a></td><td>예약 변경을 launcher에 알려 다음 반복에서 다시 읽게 한다.</td></tr>
        <tr><td><a href={src('job_metadata.c',1077)}>InsertJobRunDetail</a></td><td>새 회차를 cron.job_run_details에 starting 상태로 넣는다.</td></tr>
        <tr><td><a href={src('job_metadata.c',1145)}>UpdateJobRunDetail</a></td><td>PID·상태·결과 문장·시작/종료 시각을 갱신한다.</td></tr>
        <tr><td><a href={src('job_metadata.c',1420)}>MarkPendingRunsAsFailed</a></td><td>재기동 때 남아 있던 starting/running 이력을 failed, server restarted로 정리한다.</td></tr>
      </tbody></table>
    </Section>
    <Section title="task_states.c: jobid마다 하나인 실행 상태">
      <table><thead><tr><th>함수</th><th>역할</th></tr></thead><tbody>
        <tr><td><a href={src('task_states.c',41)}>InitializeTaskStateHash</a></td><td>jobid를 키로 쓰는 메모리 해시를 만든다.</td></tr>
        <tr><td><a href={src('task_states.c',82)}>RefreshTaskHash</a></td><td>cron.job을 다시 읽고 삭제·비활성·새 예약을 현재 상태에 반영한다.</td></tr>
        <tr><td><a href={src('task_states.c',119)}>GetCronTask</a></td><td>jobid의 상태를 찾고 없으면 새로 만든다.</td></tr>
        <tr><td><a href={src('task_states.c',146)}>InitializeCronTask</a></td><td>새 상태를 WAITING, 대기 회차 0으로 초기화한다.</td></tr>
        <tr><td><a href={src('task_states.c',169)}>CurrentTaskList</a></td><td>launcher가 한 번 훑을 현재 task 목록을 만든다.</td></tr>
        <tr><td><a href={src('task_states.c',190)}>RemoveTask</a></td><td>삭제된 잡의 상태를 메모리 해시에서 제거한다.</td></tr>
      </tbody></table>
    </Section>
    <Section title="pg_cron.c: 시간을 계산하고 상태를 진행한다">
      <table><thead><tr><th>함수</th><th>역할</th></tr></thead><tbody>
        <tr><td><a href={src('pg_cron.c',220)}>_PG_init</a></td><td>설정 값을 정의하고 PgCronLauncherMain을 상주 worker 진입점으로 등록한다.</td></tr>
        <tr><td><a href={src('pg_cron.c',579)}>PgCronLauncherMain</a></td><td>메타데이터 DB에 연결하고 예약 확인 루프를 계속 실행한다.</td></tr>
        <tr><td><a href={src('pg_cron.c',712)}>StartAllPendingRuns</a></td><td>시각 변화와 시간식을 비교해 실행할 회차를 pendingRunCount에 반영한다.</td></tr>
        <tr><td><a href={src('pg_cron.c',1090)}>PollForTasks</a></td><td>연결 소켓, timeout, 다음 시간 이벤트 중 먼저 오는 변화를 기다린다.</td></tr>
        <tr><td><a href={src('pg_cron.c',1283)}>CanStartTask</a></td><td>WAITING·대기 회차·전체 실행 한도를 모두 만족하는지 검사한다.</td></tr>
        <tr><td><a href={src('pg_cron.c',1311)}>ManageCronTask</a></td><td>한 task를 연결·전송·실행·완료·오류 상태로 한 단계씩 옮긴다.</td></tr>
        <tr><td><a href={src('pg_cron.c',1883)}>GetTaskFeedback</a></td><td>libpq 결과를 성공/실패로 해석해 이력을 갱신한다.</td></tr>
        <tr><td><a href={src('pg_cron.c',1986)}>ProcessBgwTaskFeedback</a></td><td>worker 모드의 공유 메모리 큐에서 결과·오류 메시지를 읽는다.</td></tr>
        <tr><td><a href={src('pg_cron.c',2094)}>CronBackgroundWorker</a></td><td>일회성 worker가 DB·사용자·명령을 받아 실행하는 시작 함수다.</td></tr>
        <tr><td><a href={src('pg_cron.c',2181)}>ExecuteSqlString</a></td><td>worker 안에서 SQL 문자열을 파싱·계획·실행한다.</td></tr>
      </tbody></table>
    </Section>
    <Section title="한 회차의 호출 흐름">
      <Diagram chart={`flowchart TD
        A[cron.schedule] --> B[ScheduleCronJob: cron.job 저장]
        B --> C[InvalidateJobCache]
        C --> D[launcher: RefreshTaskHash]
        D --> E[StartAllPendingRuns: 시간이 됐는지 계산]
        E --> E2[ShouldRunTask: 파싱 결과와 현재 시각 비교]
        E2 --> F[CanStartTask]
        F --> G[ManageCronTask]
        G --> H{실행 모드}
        H -->|libpq| I[client backend 실행]
        H -->|worker| J[CronBackgroundWorker]
        I --> K[GetTaskFeedback]
        J --> L[ProcessBgwTaskFeedback]
        K --> M[UpdateJobRunDetail]
        L --> M
      `} caption="함수 호출과 상태 전달을 학습용으로 줄인 흐름. 시간식 등록 때의 entry.c 파싱은 앞 표에 따로 표시했다." />
      <p>다음 페이지는 v1.6.8 원문을 실제 연속 구간으로 발췌해 <code>_PG_init</code>, launcher 루프, 직렬화 조건과 두 실행 모드를 따라간다.</p>
      <p><Ref to="/pg-cron/source">v1.6.8 실제 C 코드 읽기</Ref> · <Ref to="/pg-cron/failures">실패 결과가 기록되는 과정</Ref></p>
    </Section>
  </>
}
