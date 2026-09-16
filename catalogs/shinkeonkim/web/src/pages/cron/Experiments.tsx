import { PageHeader, Section } from '@/components/layout/PageHeader'
import { ChartBox } from '@/components/charts/ChartBox'
import { SourceNote } from '@/components/common/SourceNote'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import data from '@/data/cron-experiments.json'

const cases = ['one-job', 'four-jobs-cap4', 'four-jobs-cap2']
const labels = ['잡 1 · 한도 4', '잡 4 · 한도 4', '잡 4 · 한도 2']
const meanings = ['같은 잡은 한 번에 하나씩 실행됐다.', '서로 다른 잡은 최대 4개가 함께 실행됐다.', '한도는 지켰지만 진행이 정체됐다. 추가 진단이 필요했다.']
const values = (name: string, key: 'completed_admitted_runs' | 'peak_overlap') => data.capacity.filter(row => row.case === name).map(row => row[key])
const rangeMean = (items: number[]) => {
  const mean = items.reduce((sum, value) => sum + value, 0) / items.length
  const variance = items.length > 1 ? items.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (items.length - 1) : 0
  return `${Math.min(...items)}–${Math.max(...items)} · 평균 ${mean.toFixed(1)} · 표준편차 ${Math.sqrt(variance).toFixed(1)}`
}
const repetitions = Math.min(...cases.map(name => data.capacity.filter(row => row.case === name).length))

export default function Experiments() {
  return <>
    <PageHeader eyebrow="Week 03 · 직접 실행한 실험" title="가설을 세우고 10회씩 다시 측정한 pg_cron 실험" lede="같은 잡의 직렬화, 동시 실행 한도, 큐 중복 처리, 실패 트랜잭션을 독립된 임시 DB에서 반복했다. 범위와 평균을 함께 보며 한 번의 우연한 결과로 결론내리지 않는다." tags={[{label:`각 조건 ${repetitions}회`}, {label:'pg_cron 1.6.8'}, {label:'PostgreSQL 16.15'}]} />
    <Section title="무엇을 확인했나?">
      <table><thead><tr><th>궁금한 점</th><th>확인한 결과</th><th>이어서 읽기</th></tr></thead><tbody>
        <tr><td>같은 잡도 동시에 여러 번 실행될까?</td><td>같은 잡의 회차는 겹치지 않았다. 다른 잡은 함께 실행됐다.</td><td><Ref to="/pg-cron/experiments#capacity">동시 실행 비교</Ref></td></tr>
        <tr><td>잡 4개의 한도를 2로 줄이면 차례대로 진행할까?</td><td>이 환경에서는 진행이 정체됐다. 단순히 느려진 것으로 볼 수 없었다.</td><td><Ref to="/pg-cron/experiments#stall">정체 진단</Ref></td></tr>
        <tr><td>두 잡의 중복 처리와 실패한 INSERT는 어떻게 될까?</td><td>40개 항목을 처리했고, 강제로 실패시킨 INSERT는 남지 않았다.</td><td><Ref to="/pg-cron/experiments#queue">큐·실패 실험</Ref></td></tr>
      </tbody></table>
      <p>실험 03의 세 조건과 실험 04를 각각 {repetitions}회 새 컨테이너에서 실행했다. 회차별 상세 JSON과 서버 로그는 재현할 때 로컬 <code>results/</code>에 생성되며 Git에는 넣지 않는다. 웹에는 검토에 필요한 반복별 요약만 게시한다.</p>
    </Section>
    <Section title="먼저 구분할 숫자 두 가지">
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
      <p><strong>확인된 것은 정체 현상이고, 정확한 내부 원인은 아직 확정하지 않았다.</strong> 단순히 잡을 두 개씩 처리했다면 결과가 계속 늘어야 한다. 실제로는 한동안 결과가 늘지 않았다.</p>
      <table><thead><tr><th>추가 진단에서 한 일</th><th>목적</th></tr></thead><tbody>
        <tr><td>잡 네 개를 한 트랜잭션으로 한 번에 등록</td><td>하나씩 등록하는 과정 때문인지 확인</td></tr>
        <tr><td>업무 함수의 12초 접수 제한 제거</td><td>접수 종료 때문에 결과가 멈춘 것인지 구분</td></tr>
        <tr><td>약 6초 간격으로 세 번 조회, 전체를 10회 반복</td><td>결과 증가와 실제 실행 프로세스를 반복 관찰</td></tr>
      </tbody></table>
      <table><thead><tr><th>대략적인 시점</th><th>누적 완료 수<br/>{data.diagnostics.length}회 범위·평균·표준편차</th><th>쉽게 읽기</th></tr></thead><tbody>
        <tr><td>6초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[0]))}</td><td>처음 일부 작업은 끝났다.</td></tr>
        <tr><td>12초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[1]))}</td><td>다음 관찰까지 완료 수가 얼마나 늘었는지 본다.</td></tr>
        <tr><td>18초</td><td>{rangeMean(data.diagnostics.map(row=>row.committed[2]))}</td><td>시작 시간 초과 뒤 일부 작업이 다시 진행되는지 본다.</td></tr>
      </tbody></table>
      <ul><li>마지막 스냅샷의 <code>job startup timeout</code> 수는 {rangeMean(data.diagnostics.map(row=>row.startup_timeouts))}였다. 작업 시작 준비를 정해진 시간 안에 마치지 못했다는 뜻이다.</li><li>30번의 시점 조회 중 실행용 client backend가 보인 시점은 {data.diagnostics.reduce((sum,row)=>sum+row.client_backend_snapshots,0)}번이었다. 나머지 시점에는 launcher만 보였지만 이력에는 connecting이 남았다.</li><li>한 번에 등록해도 정체가 남았다. 따라서 순차 등록만으로 현상을 설명할 수 없었다.</li></ul>
      <details className="my-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">심화: 코드에서 의심한 부분과 아직 하지 않은 검증</summary>
        <table><thead><tr><th>구분</th><th>내용</th></tr></thead><tbody>
          <tr><td>원인 가설</td><td>아직 시작하지 못한 대기 잡이 상태 확인 대상 수에 포함되어, 실제 연결 중인 잡을 확인하는 순서가 밀릴 수 있다.</td></tr>
          <tr><td>분석 위치</td><td>PollForTasks에서 pending이 있는 WAITING task를 fd=-1로 포함하는 경로</td></tr>
          <tr><td>다음에 확인할 것</td><td>대상 목록과 카운트를 기록하고 해당 경로를 바꾼 패치 전후를 비교</td></tr>
          <tr><td>미실시</td><td>패치 효과 검증, 다른 버전·TCP·worker 모드 비교</td></tr>
        </tbody></table>
        <p><a href="https://github.com/citusdata/pg_cron/blob/v1.6.8/src/pg_cron.c#L1116-L1214">분석 대상 원문</a>. 관찰 쿼리에도 시간이 걸리므로 위 시점은 정확히 6·12·18초는 아니다.</p>
      </details>
      <SourceNote path="week03/pg_cron/experiments/03-capacity-and-serialization/diagnose.py">시점별 activity·이력·서버 로그를 로컬 results에 생성</SourceNote>
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
      <CodeBlock language="bash">{`python3 catalogs/shinkeonkim/week03/pg_cron/experiments/04-queue-and-rollback/bench.py`}</CodeBlock>
      <p>각 스크립트가 실행 뒤 실습 컨테이너를 정리한다. 과거 1.6.7 측정이나 문헌으로만 조사한 pg_net·pg_partman 사례와 이 수치를 혼합하지 않는다.</p>
    </Section>
  </>
}
