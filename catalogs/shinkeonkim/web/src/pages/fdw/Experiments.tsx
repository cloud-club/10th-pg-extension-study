import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import data from '@/data/fdw-results.json'

function Metric({ value }: { value: { median_ms: number; min_ms: number; max_ms: number; n: number } }) {
 return <span>{value.median_ms.toFixed(3)} ms <span className="text-muted-foreground">({value.min_ms.toFixed(3)}–{value.max_ms.toFixed(3)}, n={value.n})</span></span>
}
export default function Experiments() {
 const push = data.experiments['01-pushdown-and-transfer']
 const fetch = data.experiments['02-fetch-and-row-width']
 const plan = data.experiments['03-planning-and-connections']
 const labFetch = data.labs['03-fetch-and-network']
 const snapshot = data.labs['04-transactions-and-locks'].snapshot
 return <>
  <PageHeader eyebrow="Week 07 · 실제 결과" title="실험의 질문·관측·해석"
   lede="한 번의 빠른 실행보다 같은 정답·반복 범위·측정 구간을 먼저 확인한다. 표의 값은 week07의 실제 JSON에서 동기화된다." />
  <Callout title="환경과 측정 범위"><p>{push.environment.postgresql}</p><p>원격 책 {push.environment.rows.toLocaleString()}행, 동일 호스트 Docker 내부 연결. 조건당 예열 2회·본 측정 10회이며 EXPLAIN 계측 시간을 보고한다. 앱 풀·WAN·wire bytes·RSS·서비스 p99는 측정하지 않았다.</p></Callout>
  <Section id="labs" title="먼저: 기능 검증 5개">
   <table><thead><tr><th>검증 질문</th><th>실제 관찰</th><th>해석</th></tr></thead><tbody>
    <tr><td>읽기 권한이 쓰기를 막나?</td><td>10행 조회, UPDATE 권한 오류</td><td>접속 성공과 쓰기 권한은 별도</td></tr>
    <tr><td>같은 정답에서 위치가 달라지나?</td><td>로컬 Filter가 {push.local_rows_removed.toLocaleString()}행 제거</td><td>최종 10행과 중간 이동량을 구분</td></tr>
    <tr><td>실제 FETCH는 몇 회인가?</td><td>100행 묶음: {labFetch.observed_fetch_commands['100']}회 · 1000행 묶음: {labFetch.observed_fetch_commands['1000']}회</td><td>마지막 빈 FETCH로 종료 확인</td></tr>
    <tr><td>원격 스냅샷이 유지되나?</td><td>{snapshot.first} → {snapshot.within_transaction} → {snapshot.after_commit}</td><td>COMMIT 전후의 읽기 시점 구분</td></tr>
    <tr><td>전역 연결 하나를 공유하나?</td><td>로컬 4세션 → 원격 4연결</td><td>backend별 연결, keep=false 후 0개</td></tr>
   </tbody></table>
   <p>pg_trgm의 %는 STABLE이라 등록 후에도 로컬에 남고, IMMUTABLE similarity 조건은 원격으로 전달되는 것을 대조했다. 정상 rollback과 잠금 timeout도 확인했다. 분산 장애 원자성 실험은 아니다.</p>
   <Ref to="/postgres-fdw/labs">명령과 해설을 따라 직접 확인하기</Ref>
  </Section>
  <Section id="pushdown" title="실험 01: 같은 정답의 원격/로컬 필터">
   <p>가설: 원격 필터는 중간 반환 행을 줄여 더 적은 작업으로 같은 10행을 만들 것이다. 검증은 반환 ID 집합 동일성과 로컬 제거 행 수를 먼저 확인했다.</p>
   <table><thead><tr><th>조건</th><th>Execution Time 중앙값 (범위)</th></tr></thead><tbody>{Object.entries(push.cases).map(([key,value]) => <tr key={key}><td>{key}</td><td><Metric value={value} /></td></tr>)}</tbody></table>
   <p>이 환경에서는 원격 필터가 더 낮은 실행 시간을 보였다. 로컬 VOLATILE 함수 호출 비용도 포함되므로 시간 차이를 순수 네트워크 비용으로 해석하지 않는다. 예상·실제 행과 Remote SQL이 원시 계획에 함께 저장돼 있다.</p>
   <SourceNote path="catalogs/shinkeonkim/week07/postgres_fdw/experiments/01-pushdown-and-transfer/bench.py" />
  </Section>
  <Section id="fetch" title="실험 02: fetch_size와 행 폭">
   <p>id/title인 narrow와 payload를 더한 wide를 비교한다. 모두 실제 10,000행을 읽는다. 성능 측정에는 statement 로그를 켜지 않으며, 명령 횟수 확인은 Lab 03과 분리했다.</p>
   <table><thead><tr><th>조건</th><th>Execution Time 중앙값 (범위)</th></tr></thead><tbody>{Object.entries(fetch.cases).map(([key,value]) => <tr key={key}><td>{key}</td><td><Metric value={value} /></td></tr>)}</tbody></table>
   <p>100→1000에서는 두 행 폭 모두 중앙값이 낮아졌다. 그러나 wide의 10000은 1000보다 중앙값이 높아져 단조 개선 가설은 성립하지 않았다. 반환 폭·반복 범위도 함께 봐야 한다. 메모리·첫 행 수신·WAN을 측정하지 않았으므로 최대 fetch_size를 운영 기본값으로 권하지 않는다. 단순 ceil(N/F) 모델에는 종료 확인 FETCH가 빠져 있다는 점도 실제 횟수와 연결한다.</p>
   <SourceNote path="catalogs/shinkeonkim/week07/postgres_fdw/experiments/02-fetch-and-row-width/bench.py" />
   <p><Ref to="/postgres-fdw/network">가정 계산기</Ref> · <Ref to="/postgres-fdw/cursors">cursor·메모리 심화</Ref></p>
  </Section>
  <Section id="planning" title="실험 03: 원격 추정·연결 유지">
   <p>지속 로컬 psql 세션에서 짧은 id 필터를 반복한다. use_remote_estimate와 keep_connections의 네 조합을 비교하고 Planning Time과 Execution Time을 나눈다. 조건 블록 순서만 섞었으므로 캐시·실행 순서 영향은 남는다.</p>
   <table><thead><tr><th>조건</th><th>Planning Time</th><th>Execution Time</th></tr></thead><tbody>{Object.entries(plan.cases).map(([key,value]) => <tr key={key}><td>{key}</td><td><Metric value={value.planning} /></td><td><Metric value={value.execution} /></td></tr>)}</tbody></table>
   <p>원격 추정의 계획 통신과 연결 수립의 영향을 서로 다른 구간에서 관찰할 수 있다. 어떤 조건이 모든 쿼리에 더 좋다는 결론이 아니다. 예열을 제외했으므로 최초 요청의 연결 비용을 별도로 검증한 것으로 표현하지 않는다.</p>
   <SourceNote path="catalogs/shinkeonkim/week07/postgres_fdw/experiments/03-planning-and-connections/bench.py" />
  </Section>
  <Section id="reproduce" title="재현하고 질문을 더 좁히기">
   <CodeBlock language="bash">{`# 저장소 루트에서 순서대로 실행
catalogs/shinkeonkim/week07/postgres_fdw/labs/shared/run.sh up
python3 catalogs/shinkeonkim/week07/postgres_fdw/experiments/01-pushdown-and-transfer/bench.py
python3 catalogs/shinkeonkim/week07/postgres_fdw/experiments/02-fetch-and-row-width/bench.py
python3 catalogs/shinkeonkim/week07/postgres_fdw/experiments/03-planning-and-connections/bench.py
python3 catalogs/shinkeonkim/web/scripts/sync-fdw-results.py`}</CodeBlock>
   <p>다음 질문은 실제 RTT를 바꾸면 선택 경계가 어떻게 이동하는지, 동시 사용자가 늘 때 어느 자원이 포화하는지, 넓은 fetch가 RSS와 첫 결과 시간에 어떤 영향을 주는지다. 현재 측정으로 답할 수 없는 부분은 새 실험으로 확인한다.</p>
  </Section>
 </>
}
