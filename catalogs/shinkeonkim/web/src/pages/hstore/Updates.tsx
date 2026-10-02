import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { exp, fmtBytes, fmtMs, ratio } from './stats'

const cases = exp.update.cases
const ks = ['5', '50', '500'] as const
const rows = exp.update.rows
const wal = (k: (typeof ks)[number], name: 'hstore_concat' | 'hstore_subscript' | 'hstore_concat_gin' | 'jsonb_set' | 'plain_column' | 'eav_row') =>
  cases[k][name].wal_bytes_per_update.median
const CASE_LABEL = {
  hstore_concat: 'hstore ||', hstore_subscript: "hstore h['k']=", hstore_concat_gin: 'hstore || + GIN',
  jsonb_set: 'jsonb_set', plain_column: '일반 테이블(열 하나)', eav_row: 'EAV(행 하나)',
} as const
const names = Object.keys(CASE_LABEL) as (keyof typeof CASE_LABEL)[]

export default function Updates() {
  return <>
    <PageHeader eyebrow="Week 04 · 갱신 비용" title="키 하나를 바꿔도 값 전체가 다시 쓰인다"
      lede="hstore(와 jsonb)는 값 전체가 하나의 datum이다. 그래서 키 하나를 바꾸는 UPDATE도 값 전체를 만들어 새 튜플로 쓴다. 그 비용이 키 개수와 인덱스에 따라 얼마나 커지는지 WAL·힙·TOAST·HOT로 측정했다."
      tags={[{ label: `행 ${rows}개` }, { label: `${exp.update.runs}회 반복` }, { label: 'WAL 바이트는 결정적' }]} />

    <Section id="why" title="1. 왜 전체를 다시 쓰나">
      <Clotho id="hstore-update-rewrite" />
      <ul>
        <li><strong>값이 하나의 datum이다.</strong> 키마다 저장 위치가 따로 있지 않다. 정렬된 HEntry 배열과 문자열 영역이 한 덩어리다 (<Ref to="/hstore/storage">저장 방식</Ref>).</li>
        <li><strong><code>||</code>는 병합이다.</strong> <code>hstore_concat</code>은 정렬된 두 배열을 병합해 새 값을 만든다 (<Ref to="/hstore/source#concat">소스</Ref>). 바뀐 키가 하나여도 결과는 전체 쌍을 담은 새 값이다.</li>
        <li><strong>PostgreSQL의 MVCC</strong>는 UPDATE를 새 튜플 추가로 처리한다. 옛 튜플과 옛 TOAST 조각은 VACUUM 전까지 남는다.</li>
      </ul>
    </Section>

    <Section id="measure" title="2. 실측: UPDATE 1건이 쓰는 양 (실험 02)">
      <p>행 {rows}개에서 각 행의 키 하나(<code>attr_001</code>)를 바꾸는 UPDATE를 행마다 한 번 실행했다. 값은 12자리 해시(압축이 잘 안 되는 값)다. 1차 패스로 페이지를 먼저 건드려 전체 페이지 쓰기(FPW)를 소진하고, 측정 구간에 체크포인트가 없었음을 검증했다. autovacuum은 테이블 단위로 꺼서 죽은 튜플이 그대로 남은 상태를 잰다.</p>
      <table><thead><tr><th>UPDATE 1건당 WAL</th>{ks.map((k) => <th key={k}>키 {k}개<br />(hstore 평균 {fmtBytes(cases[k].hstore_avg_column_bytes)})</th>)}</tr></thead><tbody>
        {names.map((n) => <tr key={n}><td>{CASE_LABEL[n]}</td>{ks.map((k) => <td key={k}>{fmtBytes(wal(k, n))}</td>)}</tr>)}
      </tbody></table>
      <ChartBox type="bar" title="UPDATE 1건당 WAL 바이트 (로그 축)" height={320}
        data={{
          labels: ks.map((k) => `키 ${k}개`),
          datasets: names.map((n, i) => ({ label: CASE_LABEL[n], data: ks.map((k) => wal(k, n)), backgroundColor: [C.tsv, C.bigm, C.trgm, C.ok, C.warn, C.none][i] })),
        }}
        options={{ scales: axes({ log: true, yTitle: 'WAL 바이트 / UPDATE (log)' }) }}
        caption={`키 5개는 여섯 방식이 거의 같다(튜플 하나 분량). 키가 늘면 hstore·jsonb는 값 크기를 따라 늘고, EAV는 ${fmtBytes(wal('500', 'eav_row'))}로 그대로다. 키 500개에서 hstore ${fmtBytes(wal('500', 'hstore_concat'))}, EAV의 ${ratio(wal('500', 'hstore_concat'), wal('500', 'eav_row'))}.`} />
      <ChartNotes items={[
        {
          label: '키 5개: GIN만 튀어 오른다', note: <>
            나머지 다섯 방식은 {fmtBytes(wal('5', 'hstore_concat'))} 안팎으로 거의 같다 — 값 자체가 작아 튜플 하나를 새로 쓰는 고정비가 WAL의 대부분이기 때문이다. GIN이 걸린 hstore만 {fmtBytes(wal('5', 'hstore_concat_gin'))}({ratio(wal('5', 'hstore_concat_gin'), wal('5', 'hstore_concat'))})로 튀는데, 키가 5개뿐이어도 UPDATE마다 인덱스 항목 5개를 지우고 다시 넣어야 하기 때문이다.
          </>,
        },
        {
          label: '키 50개: hstore·jsonb·GIN은 커지고, 일반 열·EAV는 그대로', note: <>
            hstore(<code>||</code>, 첨자)와 jsonb는 값 크기를 따라 {fmtBytes(wal('50', 'hstore_concat'))} 안팎까지 늘었다. 반면 일반 테이블은 바뀐 열 앞뒤가 옛 튜플과 같아 그 구간은 WAL에서 생략되므로 {fmtBytes(wal('50', 'plain_column'))}에 머물고, EAV는 여전히 좁은 행 하나만 바꾸므로 {fmtBytes(wal('50', 'eav_row'))} 그대로다. GIN은 인덱스 항목이 50개로 늘어 {fmtBytes(wal('50', 'hstore_concat_gin'))}({ratio(wal('50', 'hstore_concat_gin'), wal('50', 'hstore_concat'))})까지 뛴다.
          </>,
        },
        {
          label: '키 500개: hstore가 jsonb보다 큰 이유', note: <>
            hstore는 {fmtBytes(wal('500', 'hstore_concat'))}인데 jsonb는 {fmtBytes(wal('500', 'jsonb_set'))}로 더 적다 — 같은 500쌍이라도 jsonb 쪽이 더 잘 압축되기 때문이다(<Ref to="/hstore/storage#toast">압축 차이</Ref>). 첨자와 <code>||</code>가 {fmtBytes(wal('500', 'hstore_subscript'))} vs {fmtBytes(wal('500', 'hstore_concat'))}로 거의 같은 것은, 어느 쪽도 값의 일부만 바꾸지 못하고 결국 정렬된 배열 전체를 다시 만들어 쓰기 때문이다.
          </>,
        },
        {
          label: '키 500개: GIN과 일반 열이 양 끝에 있는 이유', note: <>
            GIN이 걸린 hstore가 {fmtBytes(wal('500', 'hstore_concat_gin'))}로 가장 크다 — GIN 없는 hstore의 {ratio(wal('500', 'hstore_concat_gin'), wal('500', 'hstore_concat'))}인데, 인덱스 항목 500개를 매번 지우고 다시 등록하기 때문이다. 일반 테이블은 {fmtBytes(wal('500', 'plain_column'))}로 hstore보다 적은데, 열 500개짜리 행이 통째로 새 페이지에 복사되긴 해도(HOT 0, 힙 증가 급등 — 위 표) 열 이름을 카탈로그가 아니라 행마다 반복해 저장하는 hstore 값(평균 {fmtBytes(cases['500'].hstore_avg_column_bytes)})보다는 가볍기 때문이다. EAV는 {fmtBytes(wal('500', 'eav_row'))}로 키 개수와 무관하게 늘 좁은 행 하나만 바꾼다.
          </>,
        },
      ]} />
      <table><thead><tr><th>키 500개</th><th>WAL / UPDATE</th><th>힙 증가 (1000건)</th><th>TOAST 증가 (1000건)</th><th>HOT 비율</th></tr></thead><tbody>
        {names.map((n) => {
          const c = cases['500'][n]
          return <tr key={n}><td>{CASE_LABEL[n]}</td><td>{fmtBytes(c.wal_bytes_per_update.median)}</td><td>{fmtBytes(c.heap_growth_bytes.median)}</td><td>{fmtBytes(c.toast_growth_bytes.median)}</td><td>{c.hot_ratio.median.toFixed(2)}</td></tr>
        })}
      </tbody></table>
      <ul>
        <li><strong>hstore의 TOAST 증가는 UPDATE 1건당 약 {fmtBytes(cases['500'].hstore_concat.toast_growth_bytes.median / rows)}</strong>다. 값 전체(평균 {fmtBytes(cases['500'].hstore_avg_column_bytes)})가 통째로 다시 쓰인 것이다. 옛 조각은 죽은 채 남는다.</li>
        <li><strong>첨자(<code>h['k']=</code>)와 <code>||</code>는 같다</strong>. 키 하나만 바꿀 때 WAL이 {fmtBytes(wal('500', 'hstore_subscript'))} vs {fmtBytes(wal('500', 'hstore_concat'))}.</li>
        <li><strong>jsonb는 압축된 만큼 적게 쓴다</strong>: 키 500개에서 {fmtBytes(wal('500', 'jsonb_set'))}. 이 데이터(12자리 해시 값)에서 jsonb가 압축되고 hstore는 압축되지 않았기 때문이다 (<Ref to="/hstore/storage#toast">압축 차이</Ref>).</li>
        <li><strong>일반 테이블의 ‘열 하나’ 수정</strong>도 키 500개(열 500개)에서는 {fmtBytes(wal('500', 'plain_column'))}였다. 이 경우 행 하나가 페이지 하나에 가깝게 차서 UPDATE마다 새 페이지가 필요했고(힙 증가 {fmtBytes(cases['500'].plain_column.heap_growth_bytes.median)}, HOT 0) — 열 수가 많은 넓은 행은 어느 방식이든 비싸다는 뜻이다.</li>
      </ul>
      <p>키 50개 구간에서 hstore·jsonb의 HOT 비율이 {cases['50'].hstore_concat.hot_ratio.median.toFixed(2)}로 떨어진 것은 값이 커서 한 페이지에 새 버전을 둘 자리가 곧 부족해졌기 때문이다(힙 증가 {fmtBytes(cases['50'].hstore_concat.heap_growth_bytes.median)}). 값이 클수록 HOT 확률이 낮아지고 테이블이 빨리 부푼다.</p>
      <SourceNote path="week04/hstore/experiments/02-update-write-amplification/bench.py" />
    </Section>

    <Section id="gin" title="3. GIN이 있으면 훨씬 비싸다">
      <table><thead><tr><th>UPDATE 1건 WAL</th>{ks.map((k) => <th key={k}>키 {k}개</th>)}</tr></thead><tbody>
        <tr><td>GIN 없음</td>{ks.map((k) => <td key={k}>{fmtBytes(wal(k, 'hstore_concat'))}</td>)}</tr>
        <tr><td>GIN 있음</td>{ks.map((k) => <td key={k}>{fmtBytes(wal(k, 'hstore_concat_gin'))} ({ratio(wal(k, 'hstore_concat_gin'), wal(k, 'hstore_concat'))})</td>)}</tr>
        <tr><td>HOT 비율 (GIN 있음)</td>{ks.map((k) => <td key={k}>{cases[k].hstore_concat_gin.hot_ratio.median.toFixed(2)}</td>)}</tr>
        <tr><td>1000건 실행 시간 (GIN 있음 / 없음)</td>{ks.map((k) => <td key={k}>{cases[k].hstore_concat_gin.seconds_per_1000_updates.median.toFixed(2)}초 / {cases[k].hstore_concat.seconds_per_1000_updates.median.toFixed(2)}초</td>)}</tr>
      </tbody></table>
      <p>GIN은 hstore 값을 키·값 항목으로 쪼개 색인한다(키 500개면 항목 1,000개). 인덱스 열의 값이 바뀌면 HOT 갱신을 못 쓰고, 새 튜플의 TID로 항목 전체를 다시 등록한다. 바뀐 키가 하나여도 그렇다.</p>
      <Callout kind="warn" title="자주 바뀌는 hstore에 GIN을 걸기 전에">
        <p>키 500개에서 GIN이 있으면 UPDATE 1건이 {fmtBytes(wal('500', 'hstore_concat_gin'))}를 쓴다({ratio(wal('500', 'hstore_concat_gin'), wal('500', 'hstore_concat'))}). 조회를 빠르게 하려고 건 인덱스가 쓰기 경로의 병목이 될 수 있다. 자주 바뀌는 키는 별도 열이나 별도 테이블로 빼고, GIN은 잘 바뀌지 않는 속성 묶음에만 건다.</p>
      </Callout>
    </Section>

    <Section id="read" title="4. 읽기 비용: 키 하나를 읽어도 값 전체를 펼친다">
      <table><thead><tr><th>키 하나 읽기 (1000행, 서버 실행 시간)</th>{ks.map((k) => <th key={k}>키 {k}개</th>)}</tr></thead><tbody>
        {(['hstore', 'jsonb', 'plain_column', 'eav_row'] as const).map((n) => <tr key={n}>
          <td>{{ hstore: 'hstore ->', jsonb: 'jsonb ->>', plain_column: '일반 테이블 열', eav_row: 'EAV (PK 조회 1000번)' }[n]}</td>
          {ks.map((k) => <td key={k}>{fmtMs(cases[k].read_ms_1000_rows[n].median)}</td>)}
        </tr>)}
      </tbody></table>
      <p>hstore는 값 전체를 detoast(필요하면 TOAST 조각을 모아 붙이기)한 뒤 이진 탐색한다. 키 500개에서는 압축이 안 되어 풀 필요가 없어 jsonb({fmtMs(cases['500'].read_ms_1000_rows.jsonb.median)})보다 빨랐다({fmtMs(cases['500'].read_ms_1000_rows.hstore.median)}). 반면 키 5개에서는 hstore({fmtMs(cases['5'].read_ms_1000_rows.hstore.median)})가 jsonb({fmtMs(cases['5'].read_ms_1000_rows.jsonb.median)})보다 느렸다. 절대값은 행당 1마이크로초 안팎이라 병목이 될 일은 드물다.</p>
    </Section>

    <Section id="advice" title="5. 설계 지침">
      <table><thead><tr><th>상황</th><th>조치</th></tr></thead><tbody>
        <tr><td>여러 키를 한 번에 바꾼다</td><td><code>attrs || 'k1=&gt;v1, k2=&gt;v2'</code> 한 번으로 묶는다. 값 전체 재기록은 어차피 한 번이다.</td></tr>
        <tr><td>같은 행의 특정 키가 초당 수십 번 바뀐다</td><td>그 키를 열 또는 별도 테이블로 뺀다. 값이 작아지고 HOT가 살아난다.</td></tr>
        <tr><td>GIN을 걸어야 하고 쓰기도 잦다</td><td>변하지 않는 속성만 hstore에 두거나, 인덱스가 필요한 키만 식 인덱스로 대체한다.</td></tr>
        <tr><td>값이 크고 자주 갱신된다</td><td><code>fillfactor</code>를 낮춰 HOT 여유를 두고, autovacuum이 TOAST 테이블까지 따라가는지 <code>n_dead_tup</code>으로 본다.</td></tr>
      </tbody></table>
    </Section>
  </>
}
