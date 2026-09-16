import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'

export default function WhenToUse() {
  return <>
    <PageHeader eyebrow="Week 03 · 시작하기" title="DB 안에서 끝나는 반복 SQL이라면 pg_cron을 검토한다" lede="정리, 집계, 갱신처럼 PostgreSQL이 실행할 수 있는 일을 몇 분·몇 시간·매일 간격으로 반복하고 싶을 때 잘 맞는다. 아래 네 질문으로 먼저 판단한다." tags={[{label:'5분 판단'}, {label:'사용 사례'}, {label:'대안 비교'}]} />

    <Callout kind="tip" title="한 문장으로 판단하기">
      <p><strong>PostgreSQL이 켜져 있는 동안, SQL 하나 또는 DB 함수 하나로 끝나며, 실패를 다음 회차나 업무 로직에서 안전하게 보충할 수 있는 반복 작업</strong>에 pg_cron을 쓰면 좋다.</p>
    </Callout>

    <Section title="1. 네 질문에 차례로 답한다">
      <table><thead><tr><th>질문</th><th>예라면</th><th>아니라면</th></tr></thead><tbody>
        <tr><td>① 일이 SQL이나 DB 함수 호출로 끝나는가?</td><td>다음 질문으로</td><td>셸, 파일, 외부 API가 필요하면 앱 작업 큐나 외부 스케줄러 검토</td></tr>
        <tr><td>② PostgreSQL이 꺼진 동안에는 실행하지 않아도 되는가?</td><td>다음 질문으로</td><td>DB 장애 중에도 돌아야 하면 DB 밖의 스케줄러 필요</td></tr>
        <tr><td>③ 실패 시 자동 재시도·백오프·단계별 복구가 없어도 되는가?</td><td>다음 질문으로</td><td>워크플로 엔진이나 작업 큐 검토</td></tr>
        <tr><td>④ 실행 SQL을 여러 번 시도해도 결과가 안전하도록 만들 수 있는가?</td><td><strong>pg_cron이 잘 맞는 후보</strong></td><td>UNIQUE 제약, 처리 상태, advisory lock 등 중복 방지부터 설계</td></tr>
      </tbody></table>
    </Section>

    <Section title="2. 이런 작업에 바로 적용할 수 있다">
      <table><thead><tr><th>상황</th><th>예약할 작업</th><th>주의할 점</th></tr></thead><tbody>
        <tr><td>화면의 집계 조회가 느리다</td><td><code>REFRESH MATERIALIZED VIEW</code></td><td>갱신 중 잠금과 허용할 데이터 지연 확인</td></tr>
        <tr><td>오래된 로그·세션이 쌓인다</td><td>한 회차에 일정량만 <code>DELETE</code></td><td>인덱스와 배치 크기, vacuum 영향 측정</td></tr>
        <tr><td>매일 통계 정보를 갱신하고 싶다</td><td><code>ANALYZE</code> 또는 저장 프로시저</td><td>autovacuum이 이미 하는 일과 겹치지 않는지 확인</td></tr>
        <tr><td>DB의 미처리 행을 조금씩 소비한다</td><td><code>FOR UPDATE SKIP LOCKED</code>를 쓰는 DB 함수</td><td>실패한 행의 상태와 중복 처리 방지 설계</td></tr>
      </tbody></table>
      <p><Ref to="/pg-cron/recipes">활용 사례</Ref>에서 파티션 유지보수, outbox, 다른 DB 예약에 사용하는 SQL을 볼 수 있다.</p>
    </Section>

    <Section title="3. 이 조건이면 다른 도구를 먼저 본다">
      <table><thead><tr><th>필요한 기능</th><th>pg_cron만으로 부족한 이유</th><th>검토할 방향</th></tr></thead><tbody>
        <tr><td>실패하면 1분, 5분, 30분 뒤 자동 재시도</td><td>실패 회차를 자동 재시도하는 정책이 없다.</td><td>작업 큐, 워크플로 엔진</td></tr>
        <tr><td>DB가 멈춘 동안에도 반드시 실행</td><td>launcher도 PostgreSQL과 함께 멈추며 지난 예약을 보충하지 않는다.</td><td>외부 스케줄러</td></tr>
        <tr><td>API 호출 → 파일 생성 → 승인처럼 여러 단계 연결</td><td>SQL 예약 기능이며 DAG와 사람 승인 기능이 없다.</td><td>외부 오케스트레이터</td></tr>
        <tr><td>여러 독립 primary 중 전역에서 정확히 한 번 실행</td><td>노드 사이 리더 선출이나 exactly-once를 제공하지 않는다.</td><td>분산 락과 처리 원장 또는 중앙 스케줄러</td></tr>
      </tbody></table>
    </Section>

    <Section title="4. 선택했다면 다음 세 가지만 확인한다">
      <ol>
        <li><strong>설치 가능 여부:</strong> 자체 서버는 패키지·preload 설정, 관리형 DB는 제공 서비스의 지원 목록을 확인한다. <Ref to="/pg-cron/about#managed-services">관리형 DB 지원 표</Ref></li>
        <li><strong>실행 자원:</strong> 기본 libpq 모드는 연결 슬롯, worker 모드는 worker 슬롯을 쓴다. <Ref to="/pg-cron/modes">두 실행 모드 비교</Ref></li>
        <li><strong>실패 처리:</strong> 이력을 감시하고 업무 SQL을 재실행해도 안전하게 만든다. <Ref to="/pg-cron/failures">실패와 재시도</Ref></li>
      </ol>
    </Section>
  </>
}
