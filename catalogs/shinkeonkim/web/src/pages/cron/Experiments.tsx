import { PageHeader, Section } from '@/components/layout/PageHeader'
import { ChartBox } from '@/components/charts/ChartBox'
import { SourceNote } from '@/components/common/SourceNote'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import data from '@/data/cron-experiments.json'

const cases = ['one-job', 'four-jobs-cap4', 'four-jobs-cap2']
const labels = ['잡 1 · 한도 4', '잡 4 · 한도 4', '잡 4 · 한도 2']
const meanings = ['같은 잡은 한 번에 하나씩 실행됐다.', '서로 다른 잡은 최대 4개가 함께 실행됐다.', '한도는 지켰지만 폴링 대상 선택 문제로 진행이 정체됐다.']
const values = (name: string, key: 'completed_admitted_runs' | 'peak_overlap') => data.capacity.filter(row => row.case === name).map(row => row[key])
const rangeMean = (items: number[]) => {
  const mean = items.reduce((sum, value) => sum + value, 0) / items.length
  const variance = items.length > 1 ? items.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (items.length - 1) : 0
  return `${Math.min(...items)}–${Math.max(...items)} · 평균 ${mean.toFixed(1)} · 표준편차 ${Math.sqrt(variance).toFixed(1)}`
}
const mean = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length
const repetitions = Math.min(...cases.map(name => data.capacity.filter(row => row.case === name).length))

export default function Experiments() {
  return <>
    <PageHeader eyebrow="Week 03 · 반복 실험" title="가설과 반복 측정으로 확인한 pg_cron 동작" lede="같은 잡의 직렬 실행, 동시 실행 한도, 큐 중복 처리와 실패 트랜잭션을 독립된 임시 DB에서 반복했다. 각 조건의 범위, 평균과 표준편차를 함께 제시한다." tags={[{label:`각 조건 ${repetitions}회`}, {label:'pg_cron 1.6.8'}, {label:'PostgreSQL 16.15'}]} />
    <Section title="무엇을 확인했나?">
      <table><thead><tr><th>궁금한 점</th><th>확인한 결과</th><th>이어서 읽기</th></tr></thead><tbody>
        <tr><td>같은 잡도 동시에 여러 번 실행될까?</td><td>같은 잡의 회차는 겹치지 않았다. 다른 잡은 함께 실행됐다.</td><td><Ref to="/pg-cron/experiments#capacity">동시 실행 비교</Ref></td></tr>
        <tr><td>잡 4개의 한도를 2로 줄이면 차례대로 진행할까?</td><td>v1.6.8 libpq 모드에서는 WAITING 작업이 폴링 자리를 차지해 진행이 정체됐다.</td><td><Ref to="/pg-cron/experiments#stall">원인 확인</Ref></td></tr>
        <tr><td>두 잡의 중복 처리와 실패한 INSERT는 어떻게 될까?</td><td>40개 항목을 처리했고, 강제로 실패시킨 INSERT는 남지 않았다.</td><td><Ref to="/pg-cron/experiments#queue">큐·실패 실험</Ref></td></tr>
      </tbody></table>
      <p>실험 03의 세 조건과 실험 04를 각각 {repetitions}회 새 컨테이너에서 실행했다. 회차별 상세 JSON과 서버 로그는 재현할 때 로컬 <code>results/</code>에 생성되며 Git에는 넣지 않는다. 웹에는 검토에 필요한 반복별 요약만 게시한다.</p>
    </Section>
    <Section title="측정 지표 두 가지">
      <table><thead><tr><th>지표</th><th>뜻</th><th>예시</th></tr></thead><tbody>
        <tr><td>최대 동시 실행 수</td><td>같은 순간에 겹쳐 실행된 작업의 최대 개수</td><td>작업 두 개가 함께 실행 중이면 2</td></tr>
        <tr><td>완료 작업 수</td><td>실행을 마치고 결과를 DB에 저장한 회차의 개수</td><td>두 작업을 세 번씩 끝냈다면 총 6</td></tr>
      </tbody></table>
      <p>동시 실행 수가 2라고 완료 작업 수가 항상 2인 것은 아니다. 시간이 지나며 같은 자리를 다른 회차가 사용한다. 이 실험은 작업마다 2초 기다리게 해 겹침을 관찰하며, CPU 계산 성능을 측정하지 않는다.</p>
    </Section>
    <Section id="capacity" title="1. 같은 잡과 서로 다른 잡은 얼마나 함께 실행될까?">
      <h3>실험 준비</h3>
      <table><thead><tr><th>고정한 조건</th><th>설정</th></tr></thead><tbody>
        <tr><td>잡의 예약 간격</td><td>1초마다</td></tr><tr><td>한 회차가 하는 일</td><td>시작 시각 기록 → 2초 대기 → 끝 시각과 결과 행 저장</td></tr>
        <tr><td>새 업무를 받아들이는 구간</td><td>실험 시작부터 12초. 등록·첫 실행 지연도 포함</td></tr>
        <tr><td>남은 업무가 끝나도록 기다리는 시점</td><td>실험 시작 후 17초까지</td></tr>
        <tr><td>반복</td><td>조건마다 새 임시 DB에서 {repetitions}회</td></tr>
      </tbody></table>
      <p>아래 완료 수는 ‘12초 안에 끝난 개수’가 아니라, 처음 12초 동안 접수되어 이후 결과를 저장한 개수다. 12초 이후 함수는 새 업무를 시작하지 않고 반환한다.</p>
      <h3>예상과 실제 결과</h3>
      <table><thead><tr><th>조건</th><th>측정 전 가설</th><th>완료 수<br/>범위 · 평균 · 표준편차</th><th>최대 동시 실행<br/>범위 · 평균 · 표준편차</th></tr></thead><tbody>
        {cases.map((name,i)=><tr key={name}><td>{labels[i]}</td><td>{['한도가 4여도 같은 jobid는 최대 1개','서로 다른 네 jobid가 최대 4개 겹침','최대 2개가 겹치며 대기 회차도 계속 소진'][i]}</td><td>{rangeMean(values(name, 'completed_admitted_runs'))}</td><td>{rangeMean(values(name, 'peak_overlap'))}</td></tr>)}
      </tbody></table>
      <div className="grid gap-3 sm:grid-cols-3">
        {labels.map((label,i)=><div key={label} className="rounded-xl border border-border bg-card p-4"><strong>{label}</strong><p>{meanings[i]}</p></div>)}
      </div>
      <ChartBox type="line" title="반복별 완료 작업 수" data={{labels:Array.from({length:repetitions},(_,i)=>`${i+1}차`),datasets:cases.map((name,i)=>({label:labels[i],borderColor:['#60a5fa','#34d399','#f59e0b'][i],backgroundColor:['#60a5fa','#34d399','#f59e0b'][i],data:data.capacity.filter(r=>r.case===name).sort((a,b)=>a.repetition-b.repetition).map(r=>r.completed_admitted_runs)}))}} options={{scales:{y:{beginAtZero:true,title:{display:true,text:'완료 작업 수'}}}}} caption="같은 조건을 10회 반복한 분포다. 잡 4개·한도 2의 낮은 값은 정상적인 처리량 감소로 단정하지 않고 아래 진단과 함께 읽는다." />
      <p>모든 조건에서 같은 jobid의 실행 구간 겹침은 0이었다. 한도 4는 같은 잡을 네 개로 복제하는 설정이 아니다. <Ref to="/pg-cron/source#concurrency-demo">실제 SQL과 실행 시각 표</Ref>로 확인할 수 있다.</p>
      <details className="my-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">보충: 왜 완료 수를 6·12·24건 정도로 예상했나?</summary>
        <p>한 작업이 2초 걸리고 실행 자리를 계속 채울 수 있다면, 한 자리에서 12초 동안 약 6건을 처리한다. 두 자리는 약 12건, 네 자리는 약 24건이다. 실제 실험은 등록·접속 지연과 마지막 회차의 종료 대기가 있어 정확한 합격 기준은 아니다. 10회의 짧은 sleep 실험만으로 운영 용량을 계산할 수도 없다.</p>
      </details>
      <SourceNote path="week03/pg_cron/experiments/03-capacity-and-serialization/bench.py">실험을 재현하면 회차별 상세 JSON을 로컬에 생성한다.</SourceNote>
    </Section>
    <Section id="stall" title="2. 한도를 2로 줄였는데 왜 단일 잡보다도 적게 끝났을까?">
      <p><strong>같은 잡의 직렬 실행 때문이 아니다.</strong> v1.6.8의 기본 libpq 모드에서 아직 시작하지 못한 WAITING 작업이 실제 연결과 같은 폴링 대상 한도를 차지했기 때문이다.</p>
      <table><thead><tr><th>추가 진단에서 한 일</th><th>목적</th></tr></thead><tbody>
        <tr><td>잡 네 개를 한 트랜잭션으로 한 번에 등록</td><td>하나씩 등록하는 과정 때문인지 확인</td></tr>
        <tr><td>업무 함수의 12초 접수 제한 제거</td><td>접수 종료 때문에 결과가 멈춘 것인지 구분</td></tr>
        <tr><td>약 6초 간격으로 세 번 조회, 전체를 10회 반복</td><td>결과 증가와 실제 실행 프로세스를 반복 관찰</td></tr>
      </tbody></table>
      <table><thead><tr><th>대략적인 시점</th><th>누적 완료 수<br/>{data.diagnostics.length}회 범위·평균·표준편차</th><th>확인할 내용</th></tr></thead><tbody>
        <tr><td>6초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[0]))}</td><td>처음 일부 작업은 끝났다.</td></tr>
        <tr><td>12초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[1]))}</td><td>다음 관찰까지 완료 수가 얼마나 늘었는지 본다.</td></tr>
        <tr><td>18초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[2]))}</td><td>시작 시간 초과 뒤 일부 작업이 다시 진행되는지 본다.</td></tr>
      </tbody></table>
      <h3>실측 타임라인: 원본만 6~12초 사이가 평평하다</h3>
      <ChartBox type="line" title="6·12·18초 누적 완료 작업 수 · 10회 평균" data={{
        labels:['6초','12초','18초'],
        datasets:[
          {label:'v1.6.8 원본',borderColor:'#f59e0b',backgroundColor:'#f59e0b',pointRadius:5,borderWidth:3,data:[0,1,2].map(index=>mean(data.causal_comparison.map(row=>row.original[index])))},
          {label:'WAITING 제외',borderColor:'#34d399',backgroundColor:'#34d399',pointRadius:5,borderWidth:3,data:[0,1,2].map(index=>mean(data.causal_comparison.map(row=>row.fixed[index])))},
        ],
      }} options={{plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,title:{display:true,text:'누적 완료 작업 수'}},x:{title:{display:true,text:'잡 등록 후 관찰 시점'}}}}} caption="원본 평균은 2.5→2.5→4.3건으로, 6~12초 사이 완료가 한 건도 늘지 않았다. 조건 변경 빌드는 4→10→16건으로 계속 진행했다. 선은 세 관찰점을 연결한 것이며 그 사이를 연속 측정한 값은 아니다." />
      <ul><li>마지막 스냅샷의 <code>job startup timeout</code> 수는 {rangeMean(data.diagnostics.map(row=>row.startup_timeouts))}였다. 작업 시작 준비를 정해진 시간 안에 마치지 못했다는 뜻이다.</li><li>30번의 시점 조회 중 실행용 client backend가 보인 시점은 {data.diagnostics.reduce((sum,row)=>sum+row.client_backend_snapshots,0)}번이었다. 나머지 시점에는 launcher만 보였지만 이력에는 connecting이 남았다.</li><li>한 번에 등록해도 정체가 남았다. 따라서 순차 등록만으로 현상을 설명할 수 없었다.</li></ul>
      <h3>코드에서는 어떤 일이 일어났나?</h3>
      <ol>
        <li>실행 중인 두 작업 때문에 <code>RunningTaskCount</code>가 한도 2에 도달한다.</li>
        <li>다음 예약 시각이 되어 다른 작업들의 <code>pendingRunCount</code>가 생기지만 실행 자리는 없다.</li>
        <li><code>PollForTasks()</code>가 이 WAITING 작업을 fd=-1인 폴링 대상으로 세고 <code>activeTaskCount</code>를 올린다.</li>
        <li>대기 작업 두 개가 폴링 한도를 채우면 뒤쪽의 실제 연결 소켓은 검사 목록에 들어가지 못한다.</li>
        <li>완료 응답을 읽지 못해 실행 자리가 반환되지 않고, 약 10초 뒤 <code>job startup timeout</code> 처리 후에야 일부 진행이 재개된다.</li>
      </ol>
      <p>즉, 대기열이 <code>[잡1, 잡1, 잡2]</code>처럼 구성되어 잡1이 잡2를 의도적으로 막은 것이 아니다. 각 jobid는 상태 하나와 <code>pendingRunCount</code>를 갖는다. 문제는 실행 대기 상태를 소켓 폴링 자리로도 계산한 데 있다.</p>
      <h3>내부 상태 타임라인: 정체가 만들어지는 한 루프</h3>
      <p>아래의 <code>T</code>는 실제 연결 두 개가 실행 한도를 사용하고, 해시 순회에서 pending이 있는 WAITING 작업 두 개가 그 연결보다 먼저 나온 시점이다. PostgreSQL 해시 순회 순서이므로 잡 등록 순서의 FIFO 큐가 아니다.</p>
      <Diagram chart={`sequenceDiagram
        participant L as launcher · PollForTasks
        participant W1 as WAITING 작업 C
        participant W2 as WAITING 작업 D
        participant C as 실제 연결 A·B
        Note over L,C: T · RunningTaskCount=2, MaxRunningTasks=2
        L->>W1: CanStartTask? false · 빈 실행 슬롯 없음
        W1-->>L: fd=-1 · activeTaskCount=1
        L->>W2: CanStartTask? false · 빈 실행 슬롯 없음
        W2-->>L: fd=-1 · activeTaskCount=2
        Note over L: 폴링 한도 도달 · 순회 중단
        Note over C: 실제 연결 소켓은 pollFDs에 들어가지 못함
        loop T부터 시작 제한 시간까지
          L->>L: fd=-1 두 개를 poll · 유효한 소켓 이벤트 없음
          L->>C: isSocketReady=false · 상태 진행 못함
        end
        Note over L,C: 약 T+10초 · job startup timeout
        L->>C: ERROR → DONE · RunningTaskCount 감소
        L->>W1: 다음 루프에서 CanStartTask=true
        Note over L,W2: 대기 작업이 시작되며 일부 진행 재개
      `} caption="WAITING 작업이 SQL을 실행한 것이 아니라, fd=-1인 상태로 폴링 목록 두 자리를 채운다. 그 결과 실제 연결 A·B의 준비·완료 이벤트를 launcher가 처리하지 못한다." />
      <table><thead><tr><th>상대 시점</th><th>launcher가 보는 상태</th><th>처리량에 생기는 결과</th></tr></thead><tbody>
        <tr><td><code>T</code></td><td>실행 수 2, 대기 작업에도 pending 회차 존재</td><td>새 회차를 시작할 자리가 없음</td></tr>
        <tr><td><code>T + 한 루프</code></td><td>WAITING 두 개가 fd=-1로 <code>pollFDs[0..1]</code>을 채움</td><td>뒤쪽 실제 연결 소켓을 검사하지 않음</td></tr>
        <tr><td><code>T ~ T+10초</code></td><td>연결 이벤트를 읽지 못해 상태와 실행 수가 그대로 남음</td><td>완료 수가 증가하지 않는 평평한 구간</td></tr>
        <tr><td><code>약 T+10초</code></td><td><code>jobStartupTimeout()</code>이 연결 작업을 ERROR와 DONE으로 정리</td><td>실행 수가 줄어 다음 대기 작업이 시작됨</td></tr>
      </tbody></table>
      <h3>한 조건만 바꾼 인과 비교</h3>
      <p>v1.6.8 원본과 WAITING 작업을 폴링 목록에서 제외한 빌드를 같은 조건으로 각각 {data.causal_comparison.length}회 실행했다. 그 밖의 코드와 실행 조건은 같게 유지했다.</p>
      <CodeBlock language="c">{`// v1.6.8 원본
if (task->state == CRON_TASK_WAITING && task->pendingRunCount == 0)

// 인과 확인용 변경
if (task->state == CRON_TASK_WAITING)`}</CodeBlock>
      <table><thead><tr><th>빌드</th><th>6초 누적 완료</th><th>12초 누적 완료</th><th>18초 누적 완료</th><th>startup timeout</th></tr></thead><tbody>
        <tr><td>v1.6.8 원본</td><td>{rangeMean(data.causal_comparison.map(row=>row.original[0]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.original[1]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.original[2]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.original_timeouts))}</td></tr>
        <tr><td>조건 변경</td><td>{rangeMean(data.causal_comparison.map(row=>row.fixed[0]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.fixed[1]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.fixed[2]))}</td><td>{rangeMean(data.causal_comparison.map(row=>row.fixed_timeouts))}</td></tr>
      </tbody></table>
      <p>원본은 10회 모두 6초와 12초 사이 완료 수가 늘지 않았고 timeout이 2건씩 발생했다. 조건 변경 빌드는 10회 모두 4→10→16건으로 진행했고 timeout은 없었다. 따라서 <strong>이 실험 환경의 정체는 pending이 있는 WAITING 작업을 폴링 대상으로 센 경로가 원인</strong>이라고 판단할 수 있다.</p>
      <details className="my-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">어디까지 확인한 결론인가?</summary>
        <p>PostgreSQL 16.15, pg_cron v1.6.8, 기본 libpq·유닉스 소켓 모드에서 확인했다. 이 한 줄 변경은 인과관계를 분리하기 위한 실험 패치이며 검토된 운영 패치가 아니다. worker 모드와 다른 버전은 이 결과만으로 단정할 수 없다.</p>
        <p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L1116-L1214">분석한 v1.6.8 원문</a> · <a href="https://github.com/citusdata/pg_cron/issues/63">같은 fd=-1 정체를 보고한 upstream issue #63</a></p>
      </details>
      <SourceNote path="week03/pg_cron/experiments/03-capacity-and-serialization/confirm_cause.py">v1.6.8 원본과 한 조건 변경 빌드를 각각 10회 비교</SourceNote>
    </Section>
    <Section id="queue" title="3. 두 잡이 같은 일을 집어 가거나, 실패한 데이터가 남지는 않을까?">
      <p>큐는 아직 처리하지 않은 항목을 모아 둔 테이블이고, 소비자는 그 항목을 가져와 처리하는 잡이다. 실험 04는 정상 처리와 강제 실패를 따로 확인한다.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4"><h3 className="!mt-0">A. 정상 항목 40개 처리</h3><ol><li>미처리 항목 40개 준비</li><li>두 잡이 각 회차에 최대 5개 선택</li><li>선택한 행을 잠가 다른 잡은 건너뛰게 함</li><li>결과 저장과 완료 표시를 한 트랜잭션으로 커밋</li></ol><p><strong>예상:</strong> 완료 40개, 결과 40행, 각 항목의 저장된 처리 횟수 1</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><h3 className="!mt-0">B. INSERT 직후 강제 실패</h3><ol><li>별도 실패용 잡 등록</li><li>업무 결과 테이블에 INSERT</li><li>바로 예외를 발생시켜 실패시킴</li><li>두 회차의 실패 이력과 남은 행 확인</li></ol><p><strong>예상:</strong> 실패 이력 2개, 실패 직전에 넣은 행은 0개</p></div>
      </div>
      <h3>실제 결과</h3>
      <table><thead><tr><th>확인한 값</th><th>{data.queue.length}회 결과</th><th>의미</th></tr></thead><tbody>
        <tr><td>완료 / 입력</td><td>{data.queue.every(r=>r.queue.done===40&&r.queue.total===40) ? `모든 반복 40/40` : '반복별 차이 있음'}</td><td>처리하지 못하고 남은 항목 확인</td></tr>
        <tr><td>결과 행</td><td>{rangeMean(data.queue.map(r=>r.effects))}</td><td>입력마다 결과가 하나인지 확인</td></tr>
        <tr><td>항목별 처리 횟수</td><td>{Math.min(...data.queue.map(r=>r.queue.min_attempts))}–{Math.max(...data.queue.map(r=>r.queue.max_attempts))}</td><td>커밋된 attempts의 전체 범위</td></tr>
        <tr><td>의도한 실패 이력</td><td>{rangeMean(data.queue.map(r=>r.failed_runs))}</td><td>다음 예약 시각까지 기다려 실패를 두 번 이상 관찰</td></tr>
        <tr><td>실패 후 남은 행</td><td>{rangeMean(data.queue.map(r=>r.effects_after_failure))}</td><td>오류 전 INSERT의 롤백 여부</td></tr>
      </tbody></table>
      <p>롤백은 실패한 트랜잭션의 DB 변경을 취소하는 것이다. 실패 이력이 남는 것과 업무 데이터가 남는 것은 별개다.</p>
      <details className="my-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">이 결과로 보장할 수 없는 것</summary><ul><li>attempts는 커밋된 횟수다. 실패하여 롤백된 시도까지 세는 값은 아니다.</li><li>다음 실패 회차는 다음 예약 시각의 실행이다. 자동 재시도 정책을 검증한 것은 아니다.</li><li>이미 보낸 HTTP 요청은 DB 롤백으로 취소되지 않는다. 서버 장애 이후의 정확히 한 번 처리도 이 실험의 대상이 아니다.</li></ul></details>
      <SourceNote path="week03/pg_cron/experiments/04-queue-and-rollback/bench.py">입력·결과·cron 이력 JSON을 로컬 results에 생성</SourceNote>
      <p><Ref to="/pg-cron/recipes#queue">업무 큐 활용 예제와 전제조건</Ref></p>
    </Section>
    <Section title="직접 재현하기">
      <table><tbody><tr><th>DB</th><td>{data.environment.postgres}</td></tr><tr><th>확장 패키지</th><td>{data.environment.package}</td></tr><tr><th>연결 방식</th><td>기본 libpq 모드 · Unix 소켓</td></tr><tr><th>CPU</th><td>컨테이너에서 확인한 {data.environment.cpu_count}개</td></tr></tbody></table>
      <p>저장소 루트에서 Docker와 Python 3을 준비하고 아래 명령을 하나씩 실행한다. 전용 임시 DB를 공유하므로 동시에 실행하지 않는다. 결과 파일은 Git에서 제외된 각 실험의 <code>results/</code>에 생성되며 다시 실행하면 덮어쓴다.</p>
      <CodeBlock language="bash">{`python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/bench.py`}</CodeBlock>
      <CodeBlock language="bash">{`python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/diagnose.py`}</CodeBlock>
      <CodeBlock language="bash">{`python3 catalogs/shinkeonkim/week03/pg_cron/experiments/03-capacity-and-serialization/confirm_cause.py`}</CodeBlock>
      <CodeBlock language="bash">{`python3 catalogs/shinkeonkim/week03/pg_cron/experiments/04-queue-and-rollback/bench.py`}</CodeBlock>
      <p>각 스크립트가 실행 뒤 실습 컨테이너를 정리한다. 과거 1.6.7 측정이나 문헌으로만 조사한 pg_net·pg_partman 사례와 이 수치를 혼합하지 않는다.</p>
    </Section>
  </>
}
