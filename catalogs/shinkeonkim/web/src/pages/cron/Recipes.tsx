import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

export default function Recipes() {
  return <>
    <PageHeader eyebrow="Week 03 · 활용 사례" title="반복 SQL로 구성하는 일곱 가지 작업" lede="각 사례에서 반복 실행이 필요한 이유, 한 회차가 변경하는 데이터와 운영 시 주의점을 설명한다. pg_cron은 실행 시각을 관리하고, 처리량·잠금·실패 복구는 업무 SQL과 연계 도구가 결정한다." />
    <Section title="활용 사례 요약">
      <p>pg_cron이 직접 예약하는 명령은 SQL이다. 하지만 SQL은 SELECT로 조회만 하는 언어가 아니다. 데이터를 바꾸거나, 여러 업무 단계를 담은 함수·프로시저를 호출하고, 다른 확장의 기능을 실행할 수도 있다. pg_cron은 ‘언제 실행할지’를 맡고, 그 SQL이 ‘무엇을 할지’를 결정한다.</p>
      <table><thead><tr><th>하고 싶은 일</th><th>실제 작업 담당</th><th>아래 설명</th></tr></thead><tbody>
        <tr><td>대시보드 매출 집계를 갱신</td><td>PostgreSQL의 저장된 집계 갱신</td><td><Ref to="/pg-cron/recipes#refresh">1. 집계 갱신</Ref></td></tr>
        <tr><td>오래된 데이터를 조금씩 정리</td><td>배치 DELETE SQL</td><td><Ref to="/pg-cron/recipes#retention">2. 보존 정책</Ref></td></tr>
        <tr><td>다음 달 파티션 준비와 보존 기간 관리</td><td>pg_partman 프로시저</td><td><Ref to="/pg-cron/recipes#partitions">3. 파티션 관리</Ref></td></tr>
        <tr><td>웹 요청에서 미뤄 둔 DB 업무 처리</td><td>작업 테이블과 소비 함수</td><td><Ref to="/pg-cron/recipes#queue">4. 내부 큐</Ref></td></tr>
        <tr><td>외부 API·서버 함수 정기 호출</td><td>pg_net의 HTTP 전송 기능</td><td><Ref to="/pg-cron/recipes#http">5. HTTP 연계</Ref></td></tr>
        <tr><td>같은 서버의 다른 DB를 유지보수</td><td>대상 DB에서 실행되는 SQL</td><td><Ref to="/pg-cron/recipes#databases">6. 다른 DB 작업</Ref></td></tr>
        <tr><td>정기 보고서·메일 발송 요청을 앱에 전달</td><td>DB의 발송 대기 목록 + 외부 소비 앱</td><td><Ref to="/pg-cron/recipes#outbox">7. 외부 작업과 연결</Ref></td></tr>
      </tbody></table>
      <p>예를 들어 ‘매일 보고서 메일 보내기’는 pg_cron으로 발송 대상 목록을 만들고 앱이 메일을 보내는 구조로 구현할 수 있다. pg_cron 자체가 셸 명령·Python 파일·메일을 직접 실행하는 도구는 아니다. 외부 작업에는 그 일을 처리할 앱이나 연계 확장이 필요하다.</p>
    </Section>
    <p className="text-muted-foreground">각 예약 SQL 아래에 반환값 예시를 표시했다. 숫자는 jobid이며 등록 성공을 뜻한다. 실제 업무 결과나 외부 API 응답이 아니다. pg_partman·pg_net 출력도 실행 실측이 아닌 반환 형식 예시다.</p>
    <Section id="refresh" title="1. 대시보드: 계산 결과를 저장하고 주기적으로 갱신">
      <p>매출 대시보드에서 수백만 주문을 매 요청마다 GROUP BY하면 같은 계산을 반복한다. materialized view는 SELECT 결과를 저장해 조회할 때 읽게 한다. 원본 주문이 바뀌어도 저장 결과가 자동 갱신되지는 않으므로, 허용 가능한 데이터 지연에 맞춰 REFRESH를 예약한다.</p>
<CodeBlock language="sql" output={"CREATE TABLE"} outputCaption={"psql 예상 출력"}>{"CREATE TABLE public.sales (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  sold_on date NOT NULL, amount numeric NOT NULL\n);"}</CodeBlock>
<CodeBlock language="sql" output={"INSERT 0 2"} outputCaption={"psql 예상 출력"}>{"INSERT INTO public.sales(sold_on, amount)\nVALUES (current_date, 10), (current_date, 20);"}</CodeBlock>
<CodeBlock language="sql" output={"SELECT 1"} outputCaption={"psql 예상 출력 · 집계 결과 1행을 뷰에 저장"}>{"CREATE MATERIALIZED VIEW public.daily_sales AS\nSELECT sold_on, sum(amount) AS total FROM public.sales GROUP BY sold_on;"}</CodeBlock>
<CodeBlock language="sql" output={"CREATE INDEX"} outputCaption={"psql 예상 출력"}>{"CREATE UNIQUE INDEX daily_sales_day ON public.daily_sales(sold_on);"}</CodeBlock>
      <CodeBlock language="sql" output={" schedule\n----------\n        1\n(1 row)"}>{`SELECT cron.schedule('refresh-sales', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_sales');`}</CodeBlock>
<CodeBlock language="sql" output={" total\n-------\n    30\n(1 row)"} outputCaption={"예상 출력 · 처음 만든 집계"}>{"SELECT total FROM public.daily_sales WHERE sold_on = current_date;"}</CodeBlock>
<CodeBlock language="sql" output={"INSERT 0 1"} outputCaption={"psql 예상 출력 · 원본 매출 1건 추가"}>{"INSERT INTO public.sales(sold_on, amount) VALUES (current_date, 5);"}</CodeBlock>
      <p>다음 5분 경계의 예약 갱신이 완료된 뒤 아래 쿼리를 실행한다. 기다리지 않으면 저장된 집계는 여전히 30일 수 있다.</p>
<CodeBlock language="sql" output={" total\n-------\n    35\n(1 row)"} outputCaption={"예상 출력 · 예약 갱신이 성공한 뒤"}>{"SELECT total FROM public.daily_sales WHERE sold_on = current_date;"}</CodeBlock>
      <p>한 회차는 원본 sales의 현재 데이터로 저장 집계를 갱신한다. 초기 total은 30이고 같은 날짜에 amount=5인 주문을 추가하면 다음 갱신 후 35가 된다. 예약 직후 바로 바뀌는 것은 아니다.</p>
      <p>미리 채워진 뷰와 전체 행을 대상으로 하는 열 기반 UNIQUE 인덱스가 필요하다. CONCURRENTLY는 조회를 허용하는 옵션이며 증분 집계 기능이 아니다. 갱신이 주기보다 오래 걸린다면 주기를 줄이는 것으로 신선도를 해결할 수 없다.</p>
      <p>CONCURRENTLY는 갱신 중 일반 조회를 허용하기 위한 선택이다. 전체 집계 비용은 남고 같은 뷰의 동시 갱신은 직렬화된다. 확인할 지표는 마지막 성공 시각, 갱신 소요시간, 집계값의 최신성이다. 실패하면 오래된 결과가 계속 보일 수 있으므로 ‘조회가 된다’만으로 정상이라고 판단하지 않는다.</p>
      <p><a href="https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html">PostgreSQL 16 공식 설명</a></p>
    </Section>
    <Section id="retention" title="2. 보존 정책: 만료 데이터를 작은 배치로 삭제">
      <p>90일 이전 이벤트를 한 번에 수백만 건 지우면 큰 트랜잭션이 오랫동안 잠금을 잡고 WAL을 만들 수 있다. 한 회차에서 최대 1,000건만 처리하면 트랜잭션 단위를 줄일 수 있다. 총 삭제 비용이 사라지는 것은 아니다.</p>
<CodeBlock language="sql" output={"CREATE TABLE"} outputCaption={"psql 예상 출력"}>{"CREATE TABLE public.events (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  created_at timestamptz NOT NULL DEFAULT now()\n);"}</CodeBlock>
<CodeBlock language="sql" output={"CREATE INDEX"} outputCaption={"psql 예상 출력"}>{"CREATE INDEX events_expiry ON public.events(created_at, id);"}</CodeBlock>
      <CodeBlock language="sql" output={" schedule\n----------\n        2\n(1 row)"}>{`SELECT cron.schedule('prune-events', '10 seconds', $job$
  WITH batch AS (
    SELECT id FROM public.events
    WHERE created_at < now() - interval '90 days'
    ORDER BY created_at, id LIMIT 1000
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.events e USING batch b WHERE e.id = b.id
$job$);`}</CodeBlock>
<CodeBlock language="sql" output={" expired_rows\n--------------\n         1005\n(1 row)"} outputCaption={"예상 출력 · 만료 행 1,005건을 넣은 환경"}>{"SELECT count(*) AS expired_rows FROM public.events\nWHERE created_at < now() - interval '90 days';"}</CodeBlock>
      <p>삭제 작업이 두 회차 이상 성공한 뒤 같은 쿼리를 다시 실행한다.</p>
<CodeBlock language="sql" output={" expired_rows\n--------------\n            0\n(1 row)"} outputCaption={"예상 출력 · 만료 행을 모두 삭제한 뒤"}>{"SELECT count(*) AS expired_rows FROM public.events\nWHERE created_at < now() - interval '90 days';"}</CodeBlock>
      <p>위 표는 만료 행 1,005건을 넣은 경우의 예상이다. 빈 테이블을 준비하기만 했다면 두 조회 모두 0이다. 일반 SELECT는 즉시 조회하므로 안내한 대기 없이 한 번에 실행하면 같은 값이 나올 수 있다.</p>
      <ol><li>batch가 오래된 행의 ID를 최대 1,000개 고르고 잠근다. SKIP LOCKED는 다른 작업이 잠근 행을 기다리지 않고 건너뛴다.</li><li>같은 SQL 안에서 고른 ID만 DELETE한다. 성공하면 커밋되고 잠금이 풀린다.</li><li>다음 회차는 남아 있는 만료 행에서 다시 시작한다. 실패한 회차의 삭제는 롤백된다.</li></ol>
      <p>10초당 1,000개는 매번 한도까지 처리할 수 있을 때의 약 100행/초 계획값이다. 외래키·트리거·I/O 때문에 실제 처리량은 달라진다. 만료 유입량이 더 크면 잔여 행이 늘므로 남은 만료 행 수와 삭제 소요시간을 함께 본다.</p>
      <p>삭제 후 공간 재사용과 통계 갱신은 여전히 autovacuum이 담당한다.</p>
    </Section>
    <Section id="partitions" title="3. pg_partman: 파티션 생성·보존 정책을 주기적으로 적용">
      <p>시간별 파티션을 사용하는 테이블은 다음 달 파티션을 미리 만들거나 보존 기간이 지난 파티션을 처리해야 한다. 이 정책과 실행 함수는 pg_partman이 제공하고, pg_cron은 유지보수를 호출할 시각을 담당한다.</p>
      <p>pg_partman으로 관리 중인 파티션은 <code>CALL partman.run_maintenance_proc()</code>를 예약할 수 있다. 파티션 정책은 pg_partman에서 먼저 구성하며, 자체 BGW와 중복 예약하지 않는다.</p>
      <CodeBlock language="sql" output={" schedule\n----------\n        3\n(1 row)"}>{`-- pg_partman 설치 스키마가 partman이고 관리 테이블 등록이 끝난 환경
SELECT cron.schedule('partman-maintenance', '0 * * * *',
  'CALL partman.run_maintenance_proc()');`}</CodeBlock>
      <p>먼저 파티션 부모 테이블을 pg_partman에 등록하고 premake·retention 정책을 정해야 한다. CALL을 등록하는 것만으로 일반 테이블이 파티션 테이블로 변하지 않는다. 프로시저의 트랜잭션 제어를 유지하려면 CALL 단독 명령으로 예약한다. 실행 뒤 미래 파티션이 준비됐는지, 보존 정책이 의도대로 적용됐는지 확인한다.</p>
      <p><a href="https://github.com/pgpartman/pg_partman/blob/v5.4.3/doc/pg_partman.md">pg_partman 유지보수 API</a> · <a href="https://www.postgresql.org/docs/16/routine-vacuuming.html">VACUUM의 역할</a></p>
    </Section>
    <Section id="queue" title="4. 내부 작업 큐: 두 소비자가 서로 다른 항목을 처리">
      <p>웹 요청은 정산할 항목만 work에 적고 빨리 응답한다. 예약 잡은 나중에 미처리 행을 가져와 정산 결과를 effects에 남긴다. 이 예제의 작업은 DB 내부 변경만 하며 외부 메일이나 HTTP 요청은 하지 않는다.</p>
      <p>미처리 행을 FOR UPDATE SKIP LOCKED로 잠그고, DB 내부 결과 기록과 완료 처리를 한 트랜잭션에서 수행한다. 두 잡이 서로 잠근 항목을 건너뛰며 나머지를 처리하도록 만들 수 있다.</p>
<CodeBlock language="sql" output={" schedule\n----------\n        4\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"-- consume 함수와 work/effects 테이블은 실험 04 setup.sql로 먼저 준비\nSELECT cron.schedule('worker-a', '1 second', 'SELECT consume(1)');"}</CodeBlock>
<CodeBlock language="sql" output={" schedule\n----------\n        5\n(1 row)"} outputCaption={"예상 출력 · ID와 시각은 실행 환경에 따라 달라짐"}>{"SELECT cron.schedule('worker-b', '1 second', 'SELECT consume(2)');"}</CodeBlock>
      <p>소비자 A가 1~5번 행을 잠근 동안 B는 그 행들을 건너뛰고 다른 미처리 행을 고를 수 있다. 작업 선택·effects INSERT·done 변경이 한 트랜잭션이어야 잠금이 완료 표시 전에 풀리지 않는다. effects의 업무 ID 기본키는 중복 효과를 추가로 막는다. 항목이 두 소비자에게 정확히 절반씩 나뉜다는 보장은 없다.</p>
      <p>한 회차가 중간에 실패하면 결과와 완료 표시가 함께 롤백된다. 영구적으로 실패하는 항목은 계속 재선택될 수 있으므로 운영에서는 오류 상태·처리 기한·격리 큐가 필요하다. 성공 여부는 cron 이력뿐 아니라 미처리 수, 가장 오래된 미처리 항목, 결과 중복 수로 본다.</p>
      <p>이 패턴은 <Ref to="/pg-cron/experiments">직접 실행한 큐·롤백 실험</Ref>에서 검증했다. 실패한 트랜잭션의 시도 횟수 증가도 롤백되므로 영구 실패 항목의 분리·재시도 기록은 추가 설계가 필요하다.</p>
      <p><a href="https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE">SKIP LOCKED 공식 문서</a></p>
    </Section>
    <Section id="http" title="5. HTTP 호출: 비동기 요청 접수와 응답을 구분">
      <p>정기적으로 외부 서비스 상태를 확인하거나 Edge Function을 호출하고 싶을 수 있다. pg_cron 자체는 HTTP 클라이언트가 아니므로 pg_net 같은 연계 확장이 실제 요청을 전송한다. DB 작업만 필요하다면 HTTP를 거쳐 DB로 되돌아오는 구조가 필요한지도 먼저 판단한다.</p>
      <p>pg_net이 설치된 환경에서는 비동기 HTTP 함수를 예약할 수 있다. 아래 주소는 실제 전송 대상이 아닌 자리표시자다.</p>
      <CodeBlock language="sql" output={" schedule\n----------\n        6\n(1 row)"}>{`SELECT cron.schedule('check-api', '*/5 * * * *', $job$
  SELECT net.http_get(
    url := 'https://service.example.invalid/health',
    timeout_milliseconds := 2000)
$job$);`}</CodeBlock>
      <ol><li>예약 SQL이 net.http_get을 호출해 요청을 접수한다.</li><li>SQL 트랜잭션이 커밋된 뒤 pg_net이 네트워크 요청을 처리한다.</li><li>운영 코드는 request ID로 응답 상태·타임아웃을 추적한다. 500 응답과 전송 실패를 따로 다룬다.</li></ol>
      <p>SQL은 request ID를 반환하고 커밋 뒤 요청이 시작된다. cron 이력의 succeeded만으로 HTTP 200을 판단할 수 없다. request ID와 응답을 연결해서 확인해야 하며, 외부 부수 효과는 DB 롤백으로 되돌릴 수 없다.</p>
      <p>운영에서는 요청 ID를 업무 키와 함께 보관해야 추적할 수 있다. 재전송이 중복 효과를 만들 수 있다면 대상 API의 멱등 키를 사용한다. 토큰을 cron.job.command에 그대로 넣으면 예약 조회·로그에 노출될 수 있으므로 환경의 비밀 저장소를 사용한다. 예시 URL은 자리표시자라 그대로 성공하는 데모가 아니다.</p>
      <p><a href="https://supabase.com/docs/guides/database/extensions/pg_net">pg_net 공식 문서</a>. pg_net·pg_partman 연계는 문헌 조사이며 이번 실험에서는 실행하지 않았다.</p>
    </Section>
    <Section id="databases" title="6. 다른 DB: 예약 저장 위치와 실행 위치를 분리">
      <p>한 PostgreSQL 인스턴스에 운영용 DB와 warehouse DB가 있을 때 예약은 한 곳에 모으고 warehouse의 통계 갱신 SQL을 실행할 수 있다. 각 DB에 pg_cron을 중복 설치하는 방식이 아니다.</p>
      <CodeBlock language="sql" output={" schedule_in_database\n----------------------\n                    7\n(1 row)"}>{`SELECT cron.schedule_in_database(
  'warehouse-analyze', '30 2 * * *',
  'ANALYZE public.fact_orders', 'warehouse');`}</CodeBlock>
      <p>warehouse DB와 대상 테이블이 이미 존재해야 한다. cron을 설치한 DB에 예약을 모으면서 실행 대상만 바꾼다. 대상 DB 접속·객체 권한은 별도로 필요하다.</p>
      <p>launcher는 cron.database_name의 예약을 읽지만, 실행 프로세스는 warehouse DB에 연결한다. 대상 DB·테이블이 없거나 사용자에게 접속·ANALYZE 권한이 없으면 등록 후 실행 단계에서 실패할 수 있다. 다른 서버로 작업을 자동 분산하는 기능으로 해석하지 않는다.</p>
      <p>이 페이지의 예제처럼 예약 저장 DB와 실행 대상 DB를 구분하고, 대상 DB의 접속·객체 권한을 함께 확인한다. 조사 기준: 2026-09-15.</p>
    </Section>
    <Section id="outbox" title="7. 보고서·메일: DB에 할 일을 남기고 앱이 처리">
      <p>매일 오전 9시에 고객별 보고서를 보내는 상황을 생각해 보자. 발송 대상은 DB에 있지만, PDF 생성과 메일 발송은 앱이 더 잘 처리할 수 있다. 두 역할을 다음처럼 나눌 수 있다.</p>
      <ol><li><strong>pg_cron:</strong> 매일 실행하는 SQL로 발송 대상과 업무 ID를 outbox 테이블에 저장한다. outbox는 외부로 전달할 일을 보관하는 대기 목록이다.</li><li><strong>앱:</strong> 아직 처리하지 않은 행을 가져와 보고서를 만들고 메일을 보낸다.</li><li><strong>앱:</strong> 성공·실패와 다음 시도 시각을 DB에 기록한다. 업무 ID를 기준으로 중복 처리를 방지한다.</li></ol>
      <table><thead><tr><th>고민할 부분</th><th>설계 기준</th></tr></thead><tbody>
        <tr><td>같은 날짜의 대상을 두 번 등록</td><td>보고서 날짜 + 고객 ID 등에 UNIQUE 제약 적용</td></tr>
        <tr><td>발송 성공 후 앱이 종료되어 DB 기록이 누락</td><td>외부 서비스가 지원하면 업무 ID를 멱등 키로 사용. DB 트랜잭션만으로 외부 발송의 정확히 한 번을 보장할 수 없음</td></tr>
        <tr><td>앱이 새 작업을 빨리 알아야 함</td><td>주기적 조회 또는 LISTEN/NOTIFY를 깨우기 신호로 사용. 실제 작업은 outbox에 보관</td></tr>
      </tbody></table>
      <p>NOTIFY는 연결해서 듣고 있는 세션에 알림을 보내는 기능이다. 앱이 꺼져 있을 때 알림만으로 할 일을 보관할 수는 없으므로 outbox 행을 근거로 다시 조회한다. 이 항목은 설계 응용 예시이며 실제 메일 전송을 실행한 실험은 아니다. <a href="https://www.postgresql.org/docs/16/sql-notify.html">PostgreSQL NOTIFY의 전달 규칙</a></p>
    </Section>
    <Section title="실습을 마치고 확인할 것">
      <p>등록한 사용자로 cron.unschedule에 잡 이름을 전달해 예제 예약을 정리한다. 예약 삭제는 업무 테이블을 삭제하지 않는다. 매출 집계·배치 삭제·다른 DB ANALYZE는 별도 실습 DB에서 실행을 확인했고, 큐는 실험 04에서 검증했다. pg_partman·pg_net 연계는 문헌 조사이며 해당 확장을 설치해 실행한 결과는 아니다.</p>
    </Section>
  </>
}
