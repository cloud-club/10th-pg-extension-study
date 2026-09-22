import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { demo, exp, fmtNum, fmtTps, range } from './stats'

const conc = exp.concurrency
const ka = conc.key_add
const ct = conc.counter
const total = conc.clients * conc.per_client
const KEY_LABEL: Record<keyof typeof ka, string> = {
  rmw_autocommit: '읽고 → 앱에서 합치고 → 통째로 쓰기 (문장마다 자동 커밋)',
  rmw_read_committed: '읽고 → 앱에서 합치고 → 통째로 쓰기 (한 트랜잭션, READ COMMITTED)',
  rmw_for_update: 'SELECT ... FOR UPDATE로 잠그고 읽은 뒤 쓰기',
  atomic_concat: '원자적 UPDATE (attrs || ...)',
  atomic_repeatable_read: '원자적 UPDATE (attrs || ...), REPEATABLE READ',
}
const CT_LABEL: Record<keyof typeof ct, string> = {
  counter_rmw: '읽고 → 앱에서 +1 계산 → 통째로 쓰기',
  counter_atomic: '원자적 UPDATE (식 안에서 +1)',
  counter_for_update: 'SELECT ... FOR UPDATE로 잠그고 읽은 뒤 +1',
  counter_atomic_repeatable_read: '원자적 UPDATE (식 안에서 +1), REPEATABLE READ',
}
const clientsList = [1, 2, 4, 8, 16]
const cont = (rows: number, c: number) => conc.contention[`rows${rows}_clients${c}` as keyof typeof conc.contention]

export default function Concurrency() {
  return <>
    <PageHeader eyebrow="Week 04 · 동시성" title="hstore 컬럼을 동시에 갱신하면 어떻게 될까?"
      lede="hstore에는 자체 잠금이 없다. 동시성은 PostgreSQL의 행 단위 MVCC와 잠금이 그대로 결정한다. 그래서 서로 다른 키를 고쳐도 같은 행이면 순서대로 처리된다. 안전은 hstore가 아니라 ‘값을 어디서 계산하느냐’에 달려 있다."
      tags={[{ label: `클라이언트 ${conc.clients}개 × ${conc.per_client}회` }, { label: `${conc.runs}회 반복` }, { label: 'pgbench' }]} />

    <Section id="model" title="1. 어떻게 처리되나: 잠금 단위는 행이다">
      <ul>
        <li><strong>읽기는 막지 않는다.</strong> MVCC 덕분에 SELECT는 UPDATE를 기다리지 않고 자기 스냅샷의 옛 버전을 본다.</li>
        <li><strong>쓰기는 행 잠금을 잡는다.</strong> hstore의 키는 잠금 대상이 아니다. 같은 행의 다른 키를 바꾸는 두 UPDATE도 서로 기다린다.</li>
        <li><strong>기다리다 풀린 UPDATE는 최신 행으로 식을 다시 계산한다</strong> (READ COMMITTED). <code>attrs || ...</code>처럼 값을 UPDATE 안에서 계산하면 남의 변경을 덮어쓰지 않는다.</li>
        <li><strong>앱에서 읽어 계산한 값을 통째로 쓰면</strong> 그 사이의 남의 변경을 덮어쓴다. 오류도 나지 않는다.</li>
      </ul>
      <h3>실제로 기다리는가? 두 세션으로 확인</h3>
      <p>세션 A가 키 <code>b</code>를 추가하고 커밋 전에 3초 대기하는 동안, 세션 B가 <strong>다른 키 <code>c</code></strong>를 추가한다. 두 세션은 컨테이너 안의 별도 psql 프로세스다.</p>
      <CodeBlock language="bash" output={demo.cc_row_lock.output} outputCaption={`실제 실행 결과 · 대기 시간(ms)은 실행마다 다르다`}>{demo.cc_row_lock.sql}</CodeBlock>
      <p><code>wait_event_type = Lock</code>은 B가 A의 트랜잭션 잠금을 기다리고 있다는 뜻이다. A가 커밋한 뒤 B가 최신 행에 자기 변경을 적용해 <strong>두 변경이 모두 남았다</strong>.</p>
    </Section>

    <Section id="lost" title="2. 통째로 쓰면 유실된다">
      <Clotho id="hstore-lost-update" />
      <CodeBlock language="bash" output={demo.cc_lost_update.output} outputCaption="두 세션이 각자 읽고 각자 합쳐 쓴다 · 실제 실행 결과">{demo.cc_lost_update.sql}</CodeBlock>
      <p>아래는 같은 일을 클라이언트 {conc.clients}개가 각자 {conc.per_client}번, 총 {total}번 반복한 결과다. 매번 <strong>서로 다른 키</strong>를 추가하므로 유실 없이 다 반영됐다면 키가 {total}개 남아야 한다. {conc.runs}회 반복.</p>
      <Callout kind="warn" title="표를 읽는 법: “SQL 오류 없이 실행됨”과 “실제로 값이 남음”은 다른 숫자다">
        <p>읽고-쓰기 시나리오에서 UPDATE는 <strong>{total}번 다 SQL 오류 없이 끝난다</strong> — 유실은 SQL 오류로 나타나지 않기 때문이다. 그래서 “SQL 오류 없이 실행된 횟수”는 항상 {total}으로 고정이고(모든 방식이 같은 값), 정작 방식마다 갈리는 건 그 옆의 <strong>“실제로 남은 키 수”</strong>다. 이 둘이 같은 시나리오(원자적 UPDATE)도 있고 크게 벌어지는 시나리오(읽고-쓰기)도 있다 — 그 차이 자체가 이 실험의 핵심 결과다.</p>
      </Callout>
      <table><thead><tr><th>방식</th><th>실제로 남은 키<br />(기대 {total} · 중앙값, 범위)</th><th>SQL 오류 없이<br />실행된 횟수</th><th>유실이 있던 회차</th><th>TPS</th></tr></thead><tbody>
        {(Object.keys(ka) as (keyof typeof ka)[]).map((n) => <tr key={n}>
          <td>{KEY_LABEL[n]}</td>
          <td><strong>{range(ka[n].keys_present)}</strong></td>
          <td>{range(ka[n].succeeded)}</td>
          <td>{ka[n].runs_with_loss} / {conc.runs}</td>
          <td>{fmtTps(ka[n].tps.median)}</td>
        </tr>)}
      </tbody></table>
      <ChartBox type="bar" title={`실제로 남은 키 수 (중앙값, 기대 ${total})`} height={280}
        data={{
          labels: [['읽고-쓰기', '(자동 커밋)'], ['읽고-쓰기', '(한 트랜잭션)'], ['FOR UPDATE', '후 쓰기'], ['원자적', 'UPDATE'], ['원자적 UPDATE', '(REPEATABLE READ)']],
          datasets: [{ label: '남은 키', data: (Object.keys(ka) as (keyof typeof ka)[]).map((n) => ka[n].keys_present.median), backgroundColor: [C.trgm, C.trgm, C.ok, C.ok, C.warn] }],
        }}
        options={{ scales: { x: axes().x, y: { ...axes({ yTitle: '남은 키 수' }).y, max: total } }, plugins: { legend: { display: false } } }}
        caption="빨강은 유실이 있었던 방식, 초록은 유실 없음, 노랑은 유실은 없지만 대부분의 시도가 REPEATABLE READ 오류로 거절된 경우다." />
      <ul>
        <li><strong>읽고 → 합치고 → 쓰기</strong>는 한 트랜잭션 안에서 해도(READ COMMITTED) 유실된다. 트랜잭션이 남의 변경을 막아 주지 않는다. UPDATE 문장 자체는 매번 성공(커밋)하므로, 로그만 봐서는 아무 문제가 없어 보인다 — 그런데도 값은 <strong>조용히</strong> 사라진다.</li>
        <li><strong><code>attrs || ...</code>와 <code>SELECT ... FOR UPDATE</code></strong>는 {conc.runs}회 모두 {total}개가 남았다(유실 0). 후자는 읽는 순간 행을 잠가 그동안 남이 못 고치게 한다. 대신 TPS가 낮다(행 잠금을 오래 쥐고 있기 때문).</li>
        <li><strong>REPEATABLE READ</strong>에서는 유실 대신 오류(<code>40001 could not serialize access</code>)로 거절된다. {total}번 시도 중 SQL 오류 없이 끝난(=그대로 반영된) 것은 중앙값 {fmtNum(ka.atomic_repeatable_read.succeeded.median)}번뿐이고, 나머지는 40001 오류로 롤백됐다. 오류난 시도는 앱이 재시도해야 한다(이 실험은 재시도 없이 1회만 시도했다).</li>
      </ul>
      <CodeBlock language="bash" output={demo.cc_atomic_for_update.output} outputCaption="유실을 막는 두 방법 · 실제 실행 결과">{demo.cc_atomic_for_update.sql}</CodeBlock>
      <CodeBlock language="bash" output={demo.cc_repeatable_read.output} outputCaption="REPEATABLE READ에서의 오류 · 실제 실행 결과">{demo.cc_repeatable_read.sql}</CodeBlock>
      <SourceNote path="week04/hstore/experiments/04-concurrency-lost-update/bench.py">각 시나리오는 새 행에서 시작하고 pgbench로 동시에 실행했다.</SourceNote>
    </Section>

    <Section id="counter" title="3. 카운터: 같은 키를 여럿이 올릴 때">
      <p>키 하나(<code>cnt</code>)를 {conc.clients}개 클라이언트가 {conc.per_client}번씩 올린다. 유실 없이 다 반영됐다면 최종값은 {total}이어야 한다.</p>
      <table><thead><tr><th>방식</th><th>최종 값<br />(기대 {total} · 중앙값, 범위)</th><th>유실된 증가분<br />(기대 0)</th><th>SQL 오류 없이<br />실행된 횟수</th></tr></thead><tbody>
        {(Object.keys(ct) as (keyof typeof ct)[]).map((n) => <tr key={n}>
          <td>{CT_LABEL[n]}</td>
          <td><strong>{range(ct[n].final_value)}</strong></td>
          <td>{range(ct[n].lost_increments)}</td>
          <td>{range(ct[n].succeeded)}</td>
        </tr>)}
      </tbody></table>
      <CodeBlock language="bash" output={demo.cc_counter.output} outputCaption="lab 04에서 pgbench로 다시 확인 · 실제 실행 결과">{demo.cc_counter.sql}</CodeBlock>
      <Callout kind="ok" title="원자적 갱신의 형태">
        <CodeBlock language="sql">{`UPDATE doc
SET attrs = attrs || hstore('cnt', ((attrs -> 'cnt')::int + 1)::text)
WHERE id = 2;`}</CodeBlock>
        <p>새 값이 <strong>UPDATE 문 안에서</strong> 그 행의 최신 값으로 계산된다. 앱이 값을 들고 있지 않는다.</p>
      </Callout>
    </Section>

    <Section id="contention" title="4. 한 행에 몰리면 처리량이 늘지 않는다">
      <p>원자적 카운터 UPDATE를 클라이언트 수를 바꿔 실행했다. 대상이 <strong>행 1개</strong>일 때와 <strong>행 1000개에 무작위 분산</strong>일 때를 비교한다 (각 {conc.runs}회 중앙값, 4초). 실행 후 카운터 합이 처리한 트랜잭션 수와 같은지 검사해 유실 0을 확인했다.</p>
      <ChartBox type="line" title="처리량(TPS) vs 클라이언트 수" height={300}
        data={{
          labels: clientsList.map((c) => `${c}`),
          datasets: [
            { label: '행 1개에 집중', data: clientsList.map((c) => cont(1, c).tps.median), borderColor: C.trgm, backgroundColor: C.trgm },
            { label: '행 1000개에 분산', data: clientsList.map((c) => cont(1000, c).tps.median), borderColor: C.ok, backgroundColor: C.ok },
          ],
        }}
        options={{ scales: axes({ xTitle: '동시 클라이언트 수', yTitle: 'TPS' }) }}
        caption="측정 환경의 CPU는 3개이고 pgbench도 같은 VM에서 돈다. 분산 쪽의 상한은 CPU가 만든 것이고, 집중 쪽은 그와 별개로 행 잠금 때문에 늘지 않는다." />
      <table><thead><tr><th>클라이언트 수</th>{clientsList.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>
        <tr><td>행 1개 · TPS</td>{clientsList.map((c) => <td key={c}>{fmtTps(cont(1, c).tps.median)}</td>)}</tr>
        <tr><td>행 1개 · 평균 지연</td>{clientsList.map((c) => <td key={c}>{cont(1, c).latency_ms.median.toFixed(2)} ms</td>)}</tr>
        <tr><td>행 1000개 · TPS</td>{clientsList.map((c) => <td key={c}>{fmtTps(cont(1000, c).tps.median)}</td>)}</tr>
        <tr><td>행 1000개 · 평균 지연</td>{clientsList.map((c) => <td key={c}>{cont(1000, c).latency_ms.median.toFixed(2)} ms</td>)}</tr>
      </tbody></table>
      <p>같은 행을 노리는 UPDATE는 서로 기다리므로 클라이언트를 늘려도 TPS가 늘지 않고 지연만 는다. 인기 있는 하나의 객체(전역 카운터, 하나의 설정 행)를 여러 세션이 자주 고치는 설계는 hstore든 열이든 같은 벽에 부딪힌다.</p>
    </Section>

    <Section id="guide" title="5. 정리: 무엇을 지키면 안전한가">
      <table><thead><tr><th>규칙</th><th>이유</th></tr></thead><tbody>
        <tr><td>값을 앱에서 읽어 고쳐 통째로 쓰지 않는다. <code>SET attrs = attrs || ...</code>로 쓴다</td><td>유실이 조용히 일어난다 ({total}건 중 남은 키 중앙값 {fmtNum(ka.rmw_autocommit.keys_present.median)}개)</td></tr>
        <tr><td>읽고 판단한 뒤 써야 하면 <code>SELECT ... FOR UPDATE</code> 또는 재시도 루프</td><td>판단 근거가 되는 값을 그 사이 남이 바꾸지 못하게 하거나, 오류(40001)를 받아 다시 한다</td></tr>
        <tr><td>REPEATABLE READ·SERIALIZABLE이면 40001·40P01 재시도를 앱에 넣는다</td><td>성공률이 {total}번 중 {fmtNum(ka.atomic_repeatable_read.succeeded.median)}번뿐이었다 (재시도 없이 측정)</td></tr>
        <tr><td>같은 행에 쓰기가 몰리는 키는 행을 분산하거나 별도 저장소를 쓴다</td><td>행 잠금이 직렬화하므로 처리량이 늘지 않는다 → <Ref to="/hstore/vs-redis">Redis 해시와 비교</Ref></td></tr>
        <tr><td>키 하나를 자주 바꾸면 <Ref to="/hstore/updates">갱신 비용</Ref>도 함께 본다</td><td>경합하는 UPDATE 하나하나가 값 전체를 다시 쓴다</td></tr>
      </tbody></table>
    </Section>
  </>
}
