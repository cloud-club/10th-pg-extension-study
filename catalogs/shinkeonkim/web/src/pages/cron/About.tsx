import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Clotho } from '@/components/viz/Clotho'

export default function About() {
  return <>
    <PageHeader eyebrow="Week 03 · pg_cron 개요" title="DB에 쌓이는 일을 정해진 시간에 처리한다" lede="pg_cron은 PostgreSQL 안에 실행 일정을 저장하고, 시간이 되면 SQL을 별도 세션에서 실행하는 스케줄러다. 만료 데이터 정리나 집계 갱신처럼 ‘DB에서 끝나는 반복 작업’을 애플리케이션과 분리해 운영할 때 사용한다." />
    <Section title="이 자료는 어떤 순서로 읽으면 될까?">
      <ol><li><strong>무엇에 쓰는지:</strong> 이 페이지에서 첫 예약을 실행하고, <Ref to="/pg-cron/recipes">활용처 전체 개요</Ref>에서 내 작업과 비슷한 사례를 찾는다.</li><li><strong>처음 보는 설정과 문법:</strong> <Ref to="/pg-cron/shared-preload-libraries">shared_preload_libraries</Ref>와 <Ref to="/pg-cron/dollar-quoting">$$ 문자열 문법</Ref>을 먼저 읽는다.</li><li><strong>어떻게 동작하는지:</strong> <Ref to="/pg-cron/storage">예약 테이블</Ref> → <Ref to="/pg-cron/schedules">예약 저장·수정</Ref> → <Ref to="/pg-cron/processes">프로세스 기초</Ref> → <Ref to="/pg-cron/background-workers">Background worker</Ref> → <Ref to="/pg-cron/max-worker-processes">worker 수의 한도</Ref> → <Ref to="/pg-cron/modes">실행 모드</Ref> 순서로 읽는다.</li><li><strong>운영과 확인:</strong> <Ref to="/pg-cron/operations">운영 점검</Ref> 뒤에 필요한 경우 <Ref to="/pg-cron/source">실제 코드</Ref>와 <Ref to="/pg-cron/experiments">실험 결과</Ref>를 살펴본다.</li></ol>
    </Section>
    <Section id="why" title="1. 어떤 문제 때문에 필요한가?">
      <p>주문 서비스가 매번 대시보드를 열 때마다 하루 매출을 다시 집계한다고 해보자. 데이터가 늘면 사용자 요청이 무거워진다. 집계 결과를 별도로 저장하고 5분마다 갱신하면 조회 비용을 줄일 수 있지만, 이제 ‘누가 5분마다 갱신 SQL을 실행할지’를 정해야 한다.</p>
      <p>앱 안의 타이머는 앱 재배포 때 함께 중단되고, 앱 인스턴스가 여러 개면 같은 작업을 중복 실행할 수 있다. OS cron이나 외부 작업 큐로 관리할 수도 있다. SQL 하나로 끝나는 작업이라면 pg_cron에 일정을 두어 DB와 함께 관리하는 선택이 가능하다.</p>
      <table><thead><tr><th>반복되는 일</th><th>pg_cron으로 예약할 SQL</th><th>얻으려는 효과</th></tr></thead><tbody>
        <tr><td>대시보드 집계가 오래 걸림</td><td>REFRESH MATERIALIZED VIEW</td><td>조회 시마다 집계하지 않고 갱신 간격만큼의 지연 허용</td></tr>
        <tr><td>오래된 이벤트가 계속 쌓임</td><td>만료 행을 제한된 수만큼 DELETE</td><td>보존 정책 적용과 회차별 작업량 제한</td></tr>
        <tr><td>DB 안의 미처리 항목을 순차 처리</td><td>작은 배치를 소비하는 함수</td><td>웹 요청과 분리해서 주기적으로 처리</td></tr>
        <tr><td>특정 테이블의 운영 작업</td><td>ANALYZE 또는 유지보수 프로시저</td><td>필요한 작업을 정한 시간에 수행</td></tr>
      </tbody></table>
      <p>예약 기능이 SQL 자체를 빠르게 만드는 것은 아니다. 비용이 큰 집계·삭제는 여전히 CPU, I/O, 잠금을 사용한다. 목적은 실행 시점과 작업량을 관리하는 것이며, autovacuum을 대체하는 도구도 아니다.</p>
    </Section>
    <Section id="tradeoffs" title="2. pg_cron을 선택했을 때의 장점과 단점">
      <h3>장점</h3>
      <table><thead><tr><th>장점</th><th>실제로 얻는 효과</th></tr></thead><tbody>
        <tr><td>예약과 SQL을 DB에서 함께 관리</td><td><code>cron.job</code>에서 시간표·명령·실행 사용자를 SQL로 조회하고 변경할 수 있다.</td></tr>
        <tr><td>애플리케이션과 실행 수명 분리</td><td>예약을 커밋한 뒤 앱이나 psql이 종료돼도 PostgreSQL 서버가 정상 동작하면 실행을 계속한다.</td></tr>
        <tr><td>같은 jobid의 실행 직렬화</td><td>이전 회차가 끝나기 전에 같은 잡의 SQL을 동시에 하나 더 실행하지 않는다.</td></tr>
        <tr><td>실행 이력을 DB에서 조회</td><td><code>cron.job_run_details</code>에서 시작·종료 시각, 성공·실패와 결과 메시지를 SQL로 확인한다.</td></tr>
        <tr><td>DB 권한 체계 사용</td><td>지정한 DB 사용자로 SQL을 실행하므로 기존 객체 권한과 트랜잭션 규칙을 적용할 수 있다.</td></tr>
        <tr><td>SQL 함수로 활용 범위 확장</td><td>일반 SQL뿐 아니라 저장 함수나 설치된 확장의 함수를 호출해 배치 처리와 유지보수를 구성할 수 있다.</td></tr>
      </tbody></table>
      <h3>단점과 운영자가 보완할 부분</h3>
      <table><thead><tr><th>제약</th><th>운영에 미치는 영향</th><th>이어 읽기</th></tr></thead><tbody>
        <tr><td>자동 재시도 정책 없음</td><td>실패 회차의 횟수 제한, backoff와 최종 격리를 직접 구현해야 한다. 다음 정규 회차는 retry가 아니다.</td><td><Ref to="/pg-cron/failures">실패와 재시도</Ref></td></tr>
        <tr><td>서버 중단 중 실행 회차 누락</td><td>예약 정의는 남지만, PostgreSQL이 꺼진 동안 지난 회차를 재시작 후 몰아서 실행하거나 실패 이력으로 만들지 않는다.</td><td><Ref to="/pg-cron/downtime">놓친 예약</Ref></td></tr>
        <tr><td>DB와 자원을 함께 사용</td><td>무거운 배치가 서비스 쿼리와 CPU·I/O·잠금·연결 또는 worker 슬롯을 두고 경쟁한다.</td><td><Ref to="/pg-cron/operations">동시성과 운영</Ref></td></tr>
        <tr><td>설치와 재시작 필요</td><td>서버 패키지와 shared_preload_libraries 설정이 필요하다. 사용할 수 없는 관리형 DB도 있다.</td><td><Ref to="/pg-cron/shared-preload-libraries">preload 기초</Ref></td></tr>
        <tr><td>실행 모드별 추가 설정</td><td>기본 모드는 연결 인증, worker 모드는 max_worker_processes 용량을 준비해야 한다.</td><td><Ref to="/pg-cron/modes">두 실행 모드</Ref></td></tr>
        <tr><td>알림·이력 보존 자동화 없음</td><td>실패 알림을 별도로 붙여야 하고, 계속 쌓이는 실행 이력의 정리 정책도 운영자가 정한다.</td><td><Ref to="/pg-cron/failures#history">실패 이력</Ref></td></tr>
        <tr><td>분산 실행 조정 기능 없음</td><td>독립된 여러 primary가 같은 예약을 가지면 각각 실행할 수 있다. 전역 단일 실행과 리더 선출을 제공하지 않는다.</td><td><Ref to="/pg-cron/schedules">분산 환경</Ref></td></tr>
        <tr><td>복잡한 워크플로 기능 없음</td><td>DAG, 사람 승인, 단계별 재시도, dead-letter queue가 필요하면 외부 작업 시스템이 더 적합하다.</td><td><Ref to="/pg-cron/limits">운영 한계</Ref></td></tr>
      </tbody></table>
      <p>SQL로 끝나고 다음 실행 때 미완료 구간을 안전하게 보충할 수 있는 반복 작업에는 장점이 크다. 정해진 시각의 실행 자체가 반드시 보장돼야 하거나 여러 시스템을 순서대로 제어해야 한다면 외부 스케줄러·작업 큐와 비교한다.</p>
      <p className="text-muted-foreground">근거: <a href="https://github.com/citusdata/pg_cron/tree/v1.6.8#readme">pg_cron v1.6.8 사용법·제약</a> · <a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L1790-L1862">실패 상태 처리 코드</a> · <a href="https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-SHARED-PRELOAD-LIBRARIES">PostgreSQL preload 설정</a></p>
    </Section>
    <Section id="fit" title="3. 어디에서 쓰고, 어디까지 맡기는가?">
      <p>PostgreSQL 확장을 설치할 수 있는 서버나 pg_cron을 지원하는 관리형 DB에서 쓴다. 앱 서버에 설치하는 라이브러리가 아니라 DB 서버에 로드하는 확장이다. 앱이 꺼져 있어도 DB가 정상 실행 중이면 예약은 진행된다.</p>
      <table><thead><tr><th>pg_cron이 맡는 것</th><th>업무 SQL·운영자가 맡는 것</th></tr></thead><tbody>
        <tr><td>언제, 어느 DB에서, 어떤 사용자로 SQL을 실행할지</td><td>무엇을 지우거나 갱신할지, 적절한 인덱스와 배치 크기</td></tr>
        <tr><td>같은 jobid의 실행 직렬화와 실행 이력</td><td>다른 잡·앱과의 중복 방지, 오류 알림과 이력 보존</td></tr>
        <tr><td>다음 예약 시각에 다시 실행</td><td>실패한 항목의 재시도 횟수·백오프·격리 정책</td></tr>
      </tbody></table>
      <p>여러 외부 시스템의 의존성, 사람의 승인, 복잡한 재시도가 필요하면 작업 큐나 외부 오케스트레이터가 더 적합할 수 있다. 서버 장애 중 놓친 회차를 모두 복원하거나 업무 효과를 정확히 한 번 보장하는 기능은 아니다.</p>
    </Section>
    <Section id="first-job" title="4. 설치와 첫 예약을 구분해서 따라 해보기">
      <p>서버 준비가 끝난 환경이라면 CREATE EXTENSION pg_cron을 실행한 뒤 바로 예약 함수를 사용할 수 있다. 아래에 나오는 heartbeat 테이블은 pg_cron 설치에 필요한 테이블이 아니다. ‘예약한 INSERT가 정말 실행됐는지’ 눈으로 확인하려고 이 실습에서 만드는 결과 저장용 테이블이다.</p>
      <h3>서버 관리자가 준비하는 부분</h3>
      <p>처음 설치하는 서버는 pg_cron 패키지 설치 → 서버 설정 → 재시작이 먼저다. 패키지는 pg_cron 코드 파일을 서버에 놓고, shared_preload_libraries는 서버 시작 때 그 코드를 읽으라는 설정이다. 재시작하면서 예약 시간을 확인하는 pg_cron launcher 프로세스가 시작된다. 이 서버 작업은 CREATE EXTENSION 한 줄이 대신하지 않는다.</p>
      <CodeBlock language="ini">{`# postgresql.conf · pg_cron 패키지 설치 후 서버 재시작
# 기존 shared_preload_libraries 항목이 있다면 함께 유지
shared_preload_libraries = 'pg_cron'
cron.database_name = 'study'
cron.timezone = 'Asia/Seoul'`}</CodeBlock>
      <h3>다른 확장도 함께 미리 읽어야 한다면?</h3>
      <p>shared_preload_libraries에는 라이브러리 이름 여러 개를 쉼표로 나열할 수 있다. 예를 들어 이미 pg_stat_statements를 쓰는 서버에 pg_cron을 추가한다면, 기존 항목을 남기고 같은 문자열에 추가한다.</p>
      <CodeBlock language="ini" caption="두 라이브러리 모두 서버에 설치되어 있는 경우의 설정 예시">{`# 기존: shared_preload_libraries = 'pg_stat_statements'
# 변경: 하나의 설정값 안에서 쉼표로 나열
shared_preload_libraries = 'pg_stat_statements,pg_cron'`}</CodeBlock>
      <p>두 개의 설정 줄을 따로 써도 목록이 합쳐지지는 않는다. pg_cron만 남기면 기존 preload 항목이 빠지므로 현재 목록을 확인한 뒤 수정한다. 위 복수 예시는 선택 사항이며 이 첫 실습에 pg_stat_statements가 필요한 것은 아니다.</p>
      <CodeBlock language="sql" output={"   shared_preload_libraries\n-------------------------------\n pg_stat_statements,pg_cron\n(1 row)"} outputCaption="조회 예시 · 위 복수 설정으로 재시작한 환경">{`SHOW shared_preload_libraries;`}</CodeBlock>
      <p>변경은 서버 재시작 후 적용된다. 이 목록은 설치된 모든 확장의 목록이 아니라 기동 때 미리 읽을 라이브러리 목록이다. 해당 라이브러리 파일이 없으면 서버가 시작하지 못할 수 있으므로 설치된 이름을 사용한다. <a href="https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-SHARED-PRELOAD-LIBRARIES">PostgreSQL 설정 문서</a></p>
      <p>study DB가 존재하고 실행 사용자로 접속할 수 있어야 한다. 이 저장소의 실습 이미지는 서버 설정을 준비해 둔다. 관리형 DB라면 서비스가 제공하는 설정 절차를 따른다. 접속 인증은 <Ref to="/pg-cron/modes">실행 모드의 기본 설명</Ref>에서 이어서 다룬다.</p>
      <h3>① DB에서 pg_cron 기능을 사용할 수 있게 등록</h3>
<CodeBlock language="sql" output={"CREATE EXTENSION"} outputCaption={"psql 예상 출력 · 이미 설치되어 있으면 건너뛴다는 NOTICE가 함께 나올 수 있음"}>{"CREATE EXTENSION IF NOT EXISTS pg_cron;"}</CodeBlock>
      <p>이 명령은 현재 DB에 cron.schedule 같은 함수와 cron.job 같은 관리 테이블을 만든다. IF NOT EXISTS는 이미 설치되어 있으면 다시 만들지 말라는 뜻이다. 이후 업무 테이블 없이 SELECT 1만 예약하는 것도 가능하다.</p>
      <h3>② 이번 실습에서 실행 결과를 담을 테이블 준비</h3>
<CodeBlock language="sql" output={"CREATE TABLE"} outputCaption={"psql 예상 출력 · pg_cron 설치와 별개의 실습용 테이블"}>{"CREATE TABLE public.cron_intro_heartbeat (\n  tick timestamptz DEFAULT clock_timestamp()\n);"}</CodeBlock>
      <p>heartbeat는 ‘동작 중인지 확인하는 신호’라는 뜻으로 붙인 이름이다. tick에는 행이 추가된 시각을 저장한다. timestamptz는 시각 자료형이고, DEFAULT clock_timestamp()는 값을 생략하면 현재 시각을 넣으라는 뜻이다. 실제 서비스에서는 이 자리에 매출 집계나 만료 데이터 삭제 같은 업무가 들어간다.</p>
      <h3>③ 5초마다 한 행을 넣도록 예약</h3>
<CodeBlock language="sql" output={" schedule\n----------\n        1\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.schedule('intro-heartbeat', '5 seconds',\n  $$INSERT INTO public.cron_intro_heartbeat DEFAULT VALUES$$);"}</CodeBlock>
      <p>세 인자는 잡 이름, 실행 간격, 나중에 실행할 SQL이다. <Ref to="/pg-cron/dollar-quoting">$$…$$는 SQL을 문자열로 감싼 PostgreSQL 문법</Ref>이다. 반환된 1은 예약 번호(jobid)이며 INSERT가 끝났다는 뜻은 아니다. 각 SQL이 바로 커밋되는 자동 커밋 상태로 실행한다. 전체 실습을 하나의 BEGIN/COMMIT으로 묶으면 다른 프로세스에서 새 예약을 아직 볼 수 없다.</p>
      <p>이 호출이 <code>cron.job</code>에 만든 실제 행과 첫 실행 뒤 <code>cron.job_run_details</code>에 추가되는 이력은 <Ref to="/pg-cron/storage">예약 테이블 들여다보기</Ref>에서 실제 출력으로 확인한다.</p>
      <h3>④ 한 회차가 실행될 때까지 기다린 뒤 결과 조회</h3>
<CodeBlock language="sql" output={" pg_sleep\n----------\n\n(1 row)"} outputCaption={"예상 출력 · 6초 대기만 수행하므로 반환값 칸은 비어 있음"}>{"SELECT pg_sleep(6);"}</CodeBlock>
<CodeBlock language="sql" output={"             tick\n-------------------------------\n 2026-09-15 12:00:05.123456+09\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT * FROM public.cron_intro_heartbeat;"}</CodeBlock>
      <p>tick 행이 생겼다면 예약 SQL의 INSERT가 실행되어 저장된 것이다. 서버 부하에 따라 더 기다려야 할 수 있고, 오래 기다렸다면 여러 행이 보인다. 이 SELECT를 실행한 연결과 예약 INSERT를 실행한 연결은 서로 다르다.</p>
      <h3>⑤ 확인이 끝나면 예약 제거</h3>
<CodeBlock language="sql" output={" unschedule\n------------\n t\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.unschedule('intro-heartbeat');"}</CodeBlock>
      <p>t는 true, 즉 예약 제거 성공이다. 이미 저장된 tick 행은 남는다. 예약을 지우면 실행 중인 회차에도 취소를 요청할 수 있다.</p>
      <Clotho id="cron-lifecycle" />
      <p>그림의 launcher는 pg_cron launcher를 줄여 부른 것이다. PostgreSQL 안에서 예약 시간을 살피는 별도 프로세스이며, INSERT 자체는 또 다른 실행 프로세스가 맡는다. 그림의 시간은 설명용이다.</p>
    </Section>
    <Section title="예약을 바꾸거나 서버가 여러 대라면?">
      <p>예약은 cron.job 테이블에 저장된다. 수정이 커밋되면 pg_cron launcher가 메모리의 예약 정보를 다시 읽으므로, 일반적인 시간표·SQL 변경에 재시작은 필요하지 않다. 이미 실행 중인 SQL이 도중에 새 SQL로 바뀌는 것은 아니다.</p>
      <p><Ref to="/pg-cron/schedules">예약 저장·수정·분산 환경</Ref>에서 같은 이름의 예약 수정 예제, 커밋과 캐시 갱신 순서, 물리 복제·장애 전환·독립 노드의 차이를 설명한다.</p>
    </Section>
    <Section title="5. 예약 문법: crontab처럼 다섯 칸을 읽는다">
      <p>기본 시간 표현식은 OS의 crontab에서 쓰는 다섯 칸 형식과 같다. 왼쪽부터 ‘분, 시, 일, 월, 요일’이다. 다만 OS cron이 셸 명령을 실행하는 것과 달리 pg_cron은 SQL을 실행한다. OS crontab의 사용자 칸이나 셸 명령을 이 문자열에 붙이지 않는다.</p>
      <CodeBlock language="text">{`0   3   *   *   *
분  시  일  월  요일
→ 매일 03:00에 실행`}</CodeBlock>
      <table><thead><tr><th>칸</th><th>범위</th><th>0 3 * * *에서의 뜻</th></tr></thead><tbody>
        <tr><td>분</td><td>0~59</td><td>0분</td></tr>
        <tr><td>시</td><td>0~23</td><td>새벽 3시</td></tr>
        <tr><td>일</td><td>1~31</td><td>*: 날짜와 관계없이</td></tr>
        <tr><td>월</td><td>1~12</td><td>*: 매월</td></tr>
        <tr><td>요일</td><td>0~7 · 0과 7은 일요일</td><td>*: 모든 요일</td></tr>
      </tbody></table>
      <p>*는 모든 값, */5는 해당 칸의 값에서 5씩 간격을 두는 표현이다. 따라서 */5 * * * *는 매시 0·5·10·…·55분에 실행한다. 1-5는 범위, 1,3,5는 나열이다. cron.timezone='Asia/Seoul'이면 예약 시각을 한국 시간으로 판단한다.</p>
<CodeBlock language="sql" output={" schedule\n----------\n        2\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.schedule('intro-analyze', '0 3 * * *',\n  'ANALYZE public.cron_intro_heartbeat');"}</CodeBlock>
      <p>아래의 $는 pg_cron에서 ‘그 달의 마지막 날’을 나타내는 표현이다. 5 seconds도 지원하므로 초 간격은 다섯 칸 표현식 대신 별도 문자열로 지정한다. 초를 뜻하는 여섯 번째 칸을 덧붙이지 않는다.</p>
<CodeBlock language="sql" output={" schedule\n----------\n        3\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.schedule('intro-month-end', '0 12 $ * *', 'SELECT 1');"}</CodeBlock>
      <p>이 예약은 매월 마지막 날 정오에 SELECT 1을 실행한다. 테이블이 필요 없는 SQL도 예약할 수 있다는 예다. 데모 예약은 다음처럼 각각 제거한다.</p>
<CodeBlock language="sql" output={" unschedule\n------------\n t\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.unschedule('intro-analyze');"}</CodeBlock>
<CodeBlock language="sql" output={" unschedule\n------------\n t\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.unschedule('intro-month-end');"}</CodeBlock>
      <details className="my-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">추가 규칙: 날짜와 요일을 함께 지정하면?</summary>
        <p>기본값은 OR 조건이다. 예를 들어 0 9 1 * 1은 매월 1일 또는 매주 월요일 09:00에 실행한다. v1.6.8의 cron.dom_dow_and_logic으로 AND를 선택할 수 있다. 초 간격 문자열은 1~59초를 지원한다. 예약 시각을 계산하는 cron.timezone과 SQL 세션의 TimeZone 설정도 용도가 다르다.</p>
      </details>
      <p>다음은 <Ref to="/pg-cron/recipes">어디에 활용할 수 있는지</Ref>를 살펴보고, <Ref to="/pg-cron/processes">프로세스 기초</Ref>로 넘어가면 된다. C 코드가 궁금할 때 <Ref to="/pg-cron/source">소스 분석</Ref>으로 넘어간다. 기준 버전은 <a href="https://github.com/citusdata/pg_cron/tree/v1.6.8">pg_cron v1.6.8</a>이다.</p>
    </Section>
  </>
}
