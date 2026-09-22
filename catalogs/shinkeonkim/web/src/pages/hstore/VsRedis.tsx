import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { demo, exp, fmtBytes, fmtNum, fmtTps, range, ratio } from './stats'

const cfgs = exp.redis.configs
const CFG = [
  { key: 'none', title: '영속화 없음', redis: 'Redis: 영속화 없음 (RDB·AOF 끔)', pg: 'PostgreSQL: UNLOGGED 테이블 (WAL 없음)' },
  { key: 'relaxed', title: '느슨한 내구성', redis: 'Redis: AOF, appendfsync everysec', pg: 'PostgreSQL: synchronous_commit = off' },
  { key: 'strict', title: '엄격한 내구성', redis: 'Redis: AOF, appendfsync always', pg: 'PostgreSQL: synchronous_commit = on (기본)' },
] as const
const OPS = [
  { key: 'write_one_field', label: '필드 하나 쓰기', redis: 'HSET', pg: "UPDATE … SET attrs = attrs || hstore('f05', …)" },
  { key: 'read_one_field', label: '필드 하나 읽기', redis: 'HGET', pg: "SELECT attrs -> 'f05' …" },
  { key: 'increment_counter', label: '카운터 +1', redis: 'HINCRBY', pg: "UPDATE … SET attrs = attrs || hstore('cnt', …)" },
] as const
type OpKey = (typeof OPS)[number]['key']
const spreadOf = (cfg: (typeof CFG)[number]['key'], side: 'redis' | 'postgres', op: OpKey, c: 1 | 8) =>
  cfgs[cfg][side][`${op}_c${c}` as `${OpKey}_c1`].ops_per_sec
const rate = (cfg: (typeof CFG)[number]['key'], side: 'redis' | 'postgres', op: OpKey, c: 1 | 8) => spreadOf(cfg, side, op, c).median
const mem = cfgs.none.memory

export default function VsRedis() {
  return <>
    <PageHeader eyebrow="Week 04 · hstore vs Redis" title="Redis 같은 키-값 저장소로 봐도 될까?"
      lede="hstore 행 하나는 Redis 해시 하나와 닮았다. 필드를 넣고, 읽고, 지우고, 카운터를 올린다. 하지만 실행 모델·영속성·원자성의 단위가 다르다. 같은 일을 시켜 보고, 내구성 수준을 맞춰 비교했다."
      tags={[{ label: `${exp.redis.runs}회 반복` }, { label: 'Redis 7.4' }, { label: `객체 ${fmtNum(exp.redis.objects)}개 × 필드 ${exp.redis.fields}개` }]} />

    <Section id="mapping" title="1. 명령을 옮겨 보면">
      <p>Redis 해시 명령은 hstore 연산으로 거의 일대일로 옮겨진다. 아래는 <code>kv(k text PRIMARY KEY, h hstore)</code> 테이블에서 실제로 실행한 결과다.</p>
      <table><thead><tr><th>Redis</th><th>hstore(PostgreSQL)</th></tr></thead><tbody>
        <tr><td><code>HSET k f v …</code></td><td><code>INSERT … ON CONFLICT (k) DO UPDATE SET h = kv.h || EXCLUDED.h</code></td></tr>
        <tr><td><code>HGET k f</code></td><td><code>h -&gt; 'f'</code></td></tr>
        <tr><td><code>HEXISTS k f</code></td><td><code>h ? 'f'</code></td></tr>
        <tr><td><code>HDEL k f</code></td><td><code>h - 'f'::text</code></td></tr>
        <tr><td><code>HKEYS</code> · <code>HVALS</code> · <code>HLEN</code></td><td><code>akeys(h)</code> · <code>avals(h)</code> · <code>array_length(akeys(h), 1)</code></td></tr>
        <tr><td><code>HGETALL k</code></td><td><code>each(h)</code></td></tr>
        <tr><td><code>HINCRBY k f n</code></td><td><code>h || hstore('f', ((h -&gt; 'f')::int + n)::text)</code></td></tr>
        <tr><td><code>HEXPIRE</code> (필드 만료)</td><td><strong>없음</strong></td></tr>
      </tbody></table>
      <CodeBlock language="sql">{demo.kv_setup}</CodeBlock>
      <CodeBlock language="sql" output={demo.kv_hset.output} outputCaption="HSET에 해당 · 실제 실행 결과">{demo.kv_hset.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.kv_hget.output} outputCaption="HGET · HEXISTS · HKEYS · HVALS · HLEN · 실제 실행 결과">{demo.kv_hget.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.kv_hincrby.output} outputCaption="HINCRBY에 해당 · 실제 실행 결과">{demo.kv_hincrby.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.kv_hgetall.output} outputCaption="HGETALL · 실제 실행 결과">{demo.kv_hgetall.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.kv_hdel.output} outputCaption="HDEL · 실제 실행 결과">{demo.kv_hdel.sql}</CodeBlock>
    </Section>

    <Section id="differences" title="2. 닮은 점과 다른 점">
      <table><thead><tr><th></th><th>Redis 해시</th><th>hstore 컬럼</th></tr></thead><tbody>
        <tr><td>실행 모델</td><td>명령을 <strong>단일 스레드</strong>가 하나씩 실행한다. 명령 하나가 원자적</td><td>세션마다 <strong>프로세스</strong>. 행 잠금 + MVCC. 원자성의 단위는 문장·트랜잭션</td></tr>
        <tr><td>부분 갱신</td><td>필드 하나만 고친다 (HSET)</td><td>값 전체를 새로 쓴다 (<Ref to="/hstore/updates">갱신 비용</Ref>)</td></tr>
        <tr><td>영속성</td><td>선택: 없음 / RDB 스냅샷 / AOF(fsync 정책 3가지). RDB만 쓰면 몇 분치를 잃을 수 있다</td><td>WAL이 기본. 커밋하면 (기본 설정에서) 디스크에 남는다</td></tr>
        <tr><td>메모리·디스크</td><td>데이터셋이 메모리에 상주</td><td>디스크에 저장, 자주 쓰는 페이지만 캐시 (<code>shared_buffers</code>·OS 캐시)</td></tr>
        <tr><td>필드 단위 TTL</td><td>있음 (필드 만료 명령)</td><td>없음. 행 단위 TTL은 <code>expires_at</code> 열과 정리 작업(예: <Ref to="/pg-cron/about">pg_cron</Ref>)으로</td></tr>
        <tr><td>질의</td><td>키로 찾기. 필드 값으로 찾기는 별도 구조(보조 인덱스)가 필요</td><td>SQL: 조인·집계·<code>@&gt;</code>·GIN 인덱스</td></tr>
        <tr><td>트랜잭션</td><td>MULTI/EXEC, Lua 스크립트</td><td>완전한 ACID, 여러 테이블에 걸친 트랜잭션</td></tr>
        <tr><td>필드 수 한계</td><td>해시당 2<sup>32</sup>−1개 (Redis 문서)</td><td>형식상 2<sup>28</sup>개, 현실적으로는 값 크기가 먼저 문제 (<Ref to="/hstore/storage#limits">한계</Ref>)</td></tr>
        <tr><td>값 타입</td><td>문자열</td><td>text (NULL 가능)</td></tr>
      </tbody></table>
      <Callout kind="info" title="한 줄 요약">
        <p>Redis는 <strong>‘빠른 메모리 구조 + 선택적 영속화’</strong>, hstore는 <strong>‘트랜잭션 데이터베이스의 한 컬럼’</strong>이다. 키-값처럼 쓸 수는 있지만, hstore를 쓰면 얻는 것은 속도가 아니라 <strong>같은 트랜잭션·같은 SQL·같은 백업 안에 있다</strong>는 점이다.</p>
      </Callout>
    </Section>

    <Section id="path" title="3. 필드 하나를 올릴 때 지나가는 길">
      <Clotho id="hstore-redis-path" />
    </Section>

    <Section id="benchmark" title="4. 같은 일을 시켰다 (실험 05)">
      <p>객체 {fmtNum(exp.redis.objects)}개(필드 {exp.redis.fields}개, 값 12자리)를 양쪽에 적재하고 무작위 객체를 골라 한 필드를 읽고·쓰고·올렸다. 클라이언트는 각 서버의 컨테이너 안에서 실행했다(pgbench <code>-M prepared</code>, redis-benchmark). <strong>내구성 수준이 비슷한 것끼리</strong> 세 쌍으로 묶었고, 각 쌍은 새 컨테이너에서 {exp.redis.runs}회 반복했다. 표는 초당 연산 수의 <strong>중앙값(최소~최대)</strong>이다. 회차마다 편차가 커서 범위를 함께 적었다.</p>
      {CFG.map((cf) => <div key={cf.key}>
        <h3>{cf.title}: {cf.redis} ↔ {cf.pg}</h3>
        <table><thead><tr><th>연산</th><th>클라이언트</th><th>Redis</th><th>hstore</th><th>Redis ÷ hstore</th></tr></thead><tbody>
          {OPS.flatMap((op) => ([1, 8] as const).map((c) => {
            const r = rate(cf.key, 'redis', op.key, c)
            const p = rate(cf.key, 'postgres', op.key, c)
            return <tr key={`${op.key}${c}`}><td>{op.label} ({op.redis})</td><td>{c}</td><td>{range(spreadOf(cf.key, 'redis', op.key, c), fmtTps)}</td><td>{range(spreadOf(cf.key, 'postgres', op.key, c), fmtTps)}</td><td>{ratio(r, p)}</td></tr>
          }))}
        </tbody></table>
      </div>)}
      <ChartBox type="bar" title="필드 하나 쓰기 · 클라이언트 8개 (초당 연산, 로그 축)" height={300}
        data={{
          labels: CFG.map((cf) => cf.title),
          datasets: [
            { label: 'Redis 해시', data: CFG.map((cf) => rate(cf.key, 'redis', 'write_one_field', 8)), backgroundColor: C.trgm },
            { label: 'hstore', data: CFG.map((cf) => rate(cf.key, 'postgres', 'write_one_field', 8)), backgroundColor: C.tsv },
          ],
        }}
        options={{ scales: axes({ log: true, yTitle: 'ops/s (log)' }) }}
        caption="영속화가 없거나 느슨하면 Redis가 앞선다. 매 쓰기 fsync를 요구하는 엄격한 쌍에서는 순서가 뒤집혔다. 뒤집힌 원인은 이 실험으로 가르지 않았다." />
      <ChartNotes items={[
        {
          label: '영속화 없음 · 느슨한 내구성: 왼쪽 두 쌍이 서로 비슷한 이유', note: <>
            두 설정 모두 <strong>쓰기마다 디스크를 기다리지 않는다</strong> — Redis는 영속화를 껐거나(RDB·AOF 끔) AOF를 초당 한 번만 fsync하고(everysec), PostgreSQL도 WAL이 없거나(UNLOGGED) 커밋마다 WAL을 기다리지 않는다(<code>synchronous_commit = off</code>). 그래서 Redis {fmtTps(rate('none', 'redis', 'write_one_field', 8))}→{fmtTps(rate('relaxed', 'redis', 'write_one_field', 8))}, hstore {fmtTps(rate('none', 'postgres', 'write_one_field', 8))}→{fmtTps(rate('relaxed', 'postgres', 'write_one_field', 8))}로 두 쌍 다 큰 차이 없이 메모리·페이지 캐시 속도에 가깝다.
          </>,
        },
        {
          label: '왜 이 두 쌍에서는 Redis가 hstore보다 훨씬 빠른가', note: <>
            디스크 대기가 없으면 남는 건 명령 하나가 지나는 경로 차이다(<Ref to="#path">그림</Ref>) — Redis는 단일 스레드가 해시 필드 하나를 바로 갱신하지만, hstore는 SQL 파싱·플래너·트랜잭션 관리자를 거쳐 값 전체를 다시 쓴다(<Ref to="/hstore/updates">갱신 비용</Ref>). 그 결과 영속화 없음 {ratio(rate('none', 'redis', 'write_one_field', 8), rate('none', 'postgres', 'write_one_field', 8))}, 느슨한 내구성 {ratio(rate('relaxed', 'redis', 'write_one_field', 8), rate('relaxed', 'postgres', 'write_one_field', 8))}.
          </>,
        },
        {
          label: '엄격한 내구성: 왜 순서가 뒤집히나', note: <>
            둘 다 느려지지만 같은 비율로 느려지지 않는다. Redis는 {fmtTps(rate('relaxed', 'redis', 'write_one_field', 8))} → {fmtTps(rate('strict', 'redis', 'write_one_field', 8))}로 약 {(rate('relaxed', 'redis', 'write_one_field', 8) / rate('strict', 'redis', 'write_one_field', 8)).toFixed(1)}배 떨어지는데, hstore는 {fmtTps(rate('relaxed', 'postgres', 'write_one_field', 8))} → {fmtTps(rate('strict', 'postgres', 'write_one_field', 8))}로 약 {(rate('relaxed', 'postgres', 'write_one_field', 8) / rate('strict', 'postgres', 'write_one_field', 8)).toFixed(1)}배만 떨어진다. 두 시스템 모두 그룹 커밋으로 여러 클라이언트의 쓰기를 fsync 한 번에 묶을 수 있지만, 이 환경에서는 그 효과가 서로 달라 hstore가 더 적게 느려졌고, 그 결과 막대 순서가 뒤집혔다 — 왜 이만큼 차이 나는지는 이 실험으로 가르지 않았다.
          </>,
        },
      ]} />
      <ul>
        <li><strong>영속화가 없을 때·느슨할 때</strong> Redis가 hstore보다 {ratio(rate('none', 'redis', 'write_one_field', 8), rate('none', 'postgres', 'write_one_field', 8))}·{ratio(rate('relaxed', 'redis', 'write_one_field', 8), rate('relaxed', 'postgres', 'write_one_field', 8))} 빨랐다(쓰기, 클라이언트 8). 원인을 나눠 재지는 않았지만, 명령 하나가 지나는 경로의 차이(<Ref to="#path">위 그림</Ref>)가 가장 유력한 후보다.</li>
        <li><strong>엄격한 내구성</strong>에서는 순서가 뒤집혔다: Redis(AOF always) {fmtTps(rate('strict', 'redis', 'write_one_field', 8))}, hstore {fmtTps(rate('strict', 'postgres', 'write_one_field', 8))}. 두 시스템 모두 여러 클라이언트의 쓰기를 묶어 fsync할 수 있다(Redis 문서는 <code>always</code>가 그룹 커밋을 지원한다고 적는다). 이 환경에서 왜 이 순서가 나왔는지는 fsync 호출 방식·묶는 정도 등을 따로 재야 알 수 있고, 이 실험은 거기까지 가지 않았다.</li>
        <li>이 결과는 <strong>Docker Desktop VM의 가상 디스크</strong> 위 fsync 지연을 반영한다. 실제 SSD·클라우드 디스크의 fsync 비용과는 다를 수 있으므로 <em>엄격한 쌍의 순위</em>를 일반화하지 않는다.</li>
      </ul>
      <h3>메모리·저장 공간</h3>
      <table><thead><tr><th>같은 데이터(객체 {fmtNum(exp.redis.objects)}개 × 필드 {exp.redis.fields}개)</th><th>크기</th></tr></thead><tbody>
        <tr><td>Redis <code>used_memory</code> 증가분 (메모리)</td><td>{fmtBytes(mem.redis_dataset_bytes.median)}</td></tr>
        <tr><td>PostgreSQL 테이블 + PK 인덱스 (디스크)</td><td>{fmtBytes(mem.postgres_total_bytes.median)}</td></tr>
        <tr><td>hstore 값 하나 (평균)</td><td>{fmtBytes(mem.postgres_avg_hstore_bytes.median)}</td></tr>
      </tbody></table>
      <p>Redis는 이 크기가 <strong>RAM</strong>이고, PostgreSQL은 <strong>디스크</strong>이며 캐시에 올라간 부분만 메모리를 쓴다. 같은 단위로 비교하기 어렵다는 점을 감안해 읽는다. (Redis 8.10의 ‘compact hash’ 같은 최신 메모리 최적화는 이 실험에 포함하지 않았다. 테스트한 것은 Redis 7.4다.)</p>
      <Callout kind="warn" title="이 비교가 말해주지 않는 것">
        <ul>
          <li>같은 VM CPU 3개를 서버와 클라이언트가 나눠 쓰고, 서버는 한 번에 하나씩만 부하를 받았다. 절대 수치는 일반화하지 않는다.</li>
          <li>네트워크 왕복이 없다(루프백). 실제 서비스에서는 왕복 시간이 두 시스템 모두에 더해진다.</li>
          <li>객체 5만 개에 무작위로 분산한 부하다. 같은 키에 몰리는 부하는 <Ref to="/hstore/concurrency#contention">동시성 페이지</Ref>에 따로 있다.</li>
          <li>Redis Cluster·복제, PostgreSQL 복제는 다루지 않았다.</li>
        </ul>
      </Callout>
      <SourceNote path="week04/hstore/experiments/05-redis-comparison/bench.py" />
    </Section>

    <Section id="choose" title="5. 어느 쪽을 쓸까">
      <table><thead><tr><th>요구</th><th>선택</th></tr></thead><tbody>
        <tr><td>잃어도 되는 캐시·세션·레이트 리미터, 필드 TTL, 초당 수십만 연산</td><td><strong>Redis</strong></td></tr>
        <tr><td>이미 PostgreSQL에 있는 행의 부가 속성, 같은 트랜잭션에서 함께 바뀌어야 함</td><td><strong>hstore(또는 jsonb)</strong></td></tr>
        <tr><td>잃으면 안 되는 카운터·설정, 조인·집계와 함께 쓴다</td><td><strong>hstore</strong> — 단, 한 행에 쓰기가 몰리면 분산 설계가 필요하다</td></tr>
        <tr><td>PostgreSQL이 원본, 읽기 부하를 덜고 싶다</td><td><strong>둘 다</strong>: PostgreSQL이 원본, Redis는 캐시. 무효화 규칙이 필요하다</td></tr>
      </tbody></table>
      <p>참고: Redis 영속성 문서는 “PostgreSQL이 제공하는 수준의 데이터 안전성을 원하면 RDB와 AOF를 함께 쓰라”고 안내한다.</p>
    </Section>
  </>
}
