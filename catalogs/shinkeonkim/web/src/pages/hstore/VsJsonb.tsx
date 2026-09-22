import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { Clotho } from '@/components/viz/Clotho'
import { demo, exp, fmtBytes, fmtMs, ratio, storageCell } from './stats'

const idx = exp.index.configs
const q = exp.index.queries
const upd = exp.update.cases
const s20 = storageCell(20, 'low')
const s500 = storageCell(500, 'low')

export default function VsJsonb() {
  return <>
    <PageHeader eyebrow="Week 04 · hstore vs jsonb" title="jsonb 컬럼과 무엇이 다른가?"
      lede="둘 다 ‘키로 값을 찾는 묶음’을 한 컬럼에 담는다. 차이는 값에 타입과 중첩이 있는가에서 시작해, 저장 형식이 만드는 압축·읽기·갱신 특성까지 이어진다. 같은 데이터를 두 타입에 넣고 측정한 결과를 함께 정리했다." />

    <Section id="table" title="1. 한눈에 보는 차이">
      <table><thead><tr><th></th><th>hstore</th><th>jsonb</th></tr></thead><tbody>
        <tr><td>값의 모양</td><td>text 하나</td><td>문자열·숫자·불리언·null·배열·객체</td></tr>
        <tr><td>중첩</td><td>없음 (평평한 맵)</td><td>있음</td></tr>
        <tr><td>키</td><td>text, NULL 불가</td><td>문자열</td></tr>
        <tr><td>키 정렬·중복 키</td><td>키 (길이, 바이트) 순, 중복 키는 하나만 남김</td><td>키 (길이, 바이트) 순, 중복 키는 하나만 남김 — 어느 값이 남는지는 아래 결과 참고</td></tr>
        <tr><td>연산자</td><td><code>-&gt;</code> <code>?</code> <code>@&gt;</code> <code>||</code> <code>-</code> …</td><td>비슷한 연산자 + 경로(<code>#&gt;</code>), SQL/JSON 경로(<code>@?</code> <code>@@</code>)</td></tr>
        <tr><td>GIN 인덱스</td><td><code>gin_hstore_ops</code> 하나</td><td><code>jsonb_ops</code> · <code>jsonb_path_ops</code></td></tr>
        <tr><td>표준·이식성</td><td>PostgreSQL 전용 확장</td><td>JSON은 표준 교환 형식, 타입은 PostgreSQL 내장</td></tr>
        <tr><td>설치</td><td><code>CREATE EXTENSION hstore</code></td><td>내장</td></tr>
      </tbody></table>
      <p>같은 입력을 두 타입에 넣어 정렬과 중복 처리를 확인한 결과다. hstore의 저장 순서는 <Ref to="/hstore/storage#bytes">디스크 바이트 확인</Ref>에서 직접 봤다.</p>
      <CodeBlock language="sql" output={demo.jsonb_order.output} outputCaption="jsonb와 hstore의 키 정렬·중복 처리 · 실제 실행 결과">{demo.jsonb_order.sql}</CodeBlock>
      <p>두 타입 모두 키를 <strong>길이 → 바이트</strong> 순으로 놓는다(<code>b</code>, <code>aa</code>, <code>ccc</code>). 중복 키 <code>b</code>는 jsonb에서 <strong>마지막 값(9)</strong>이, hstore에서는 이번 실행에서 <strong>처음 값(2)</strong>이 남았다. 앞서 본 것처럼 hstore는 어느 값이 남는지 문서가 보장하지 않으므로 중복 키가 생기는 입력은 미리 정리한다.</p>
    </Section>

    <Section id="types" title="2. 타입과 중첩: 가장 큰 차이">
      <Clotho id="hstore-vs-jsonb-types" />
      <p>jsonb 문서를 hstore로 옮기면 숫자·불리언은 문자열이 되고, 배열과 객체는 JSON 문자열 한 덩어리가 된다. 안쪽 키는 더 이상 키가 아니다.</p>
      <CodeBlock language="sql" output={demo.jsonb_to_hstore.output} outputCaption="jsonb → hstore (내장 캐스트가 없어 jsonb_each_text로 펼쳐서 만든다) · 실제 실행 결과">{demo.jsonb_to_hstore.sql}</CodeBlock>
      <h3>비교와 정렬은 문자열 기준이다</h3>
      <p>hstore의 값은 text라서 숫자로 정렬하려면 캐스팅해야 한다. 캐스팅을 빠뜨리면 조용히 잘못된 순서가 나온다.</p>
      <CodeBlock language="sql" output={demo.sort_text.output} outputCaption="text 정렬은 10 &lt; 2 &lt; 9, 캐스팅하면 2 &lt; 9 &lt; 10 · 실제 실행 결과">{demo.sort_text.sql}</CodeBlock>
      <Callout kind="tip" title="타입을 강제하고 싶다면">
        <p>hstore는 ‘값은 문자열’이라는 계약이 타입에 들어 있다. 숫자·불리언을 섞어 넣는 실수를 애초에 막는다. 반대로 jsonb는 <code>{`{"age": "30"}`}</code>과 <code>{`{"age": 30}`}</code>이 다른 값이라, 같은 키에 타입이 섞이면 검증이 필요하다.</p>
      </Callout>
    </Section>

    <Section id="convert" title="3. 서로 변환하기">
      <CodeBlock language="sql" output={demo.to_json.output} outputCaption="hstore → json / jsonb: 값은 전부 문자열 · 실제 실행 결과">{demo.to_json.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.to_jsonb_loose.output} outputCaption="_loose 변환: 숫자로 읽히는 값은 숫자, t·f 는 불리언 · 실제 실행 결과">{demo.to_jsonb_loose.sql}</CodeBlock>
      <Callout kind="warn" title="_loose는 모양으로 추측한다">
        <p>위 결과에서 <strong>불리언은 <code>t</code>·<code>f</code> 한 글자만</strong> 변환됐다(<code>flag=&gt;t</code> → <code>true</code>). <code>word=&gt;true</code>는 문자열로 남았다. 숫자로 읽히는 값은 숫자가 됐다(<code>ver=&gt;1.10</code> → 숫자 <code>1.10</code>). 앞자리 0이 있는 <code>zip=&gt;007</code>은 유효한 JSON 숫자가 아니라 문자열로 남았다. 모양으로 추측하는 변환이라 버전·우편번호·ID처럼 숫자로 보이는 문자열은 의도와 다르게 바뀔 수 있다. 타입이 중요한 경계에서는 strict 변환 후 앱에서 해석한다.</p>
      </Callout>
    </Section>

    <Section id="size" title="4. 크기와 압축">
      <p>키 20개 이하에서는 저장 크기가 같았다 (행당 hstore {fmtBytes(s20.hs.avg_column_bytes)}, jsonb {fmtBytes(s20.jb.avg_column_bytes)}). 키 500개에서는 hstore {fmtBytes(s500.hs.avg_column_bytes)}, jsonb {fmtBytes(s500.jb.avg_column_bytes)}로 갈렸다. 원인은 HEntry가 <strong>끝 위치</strong>를, JEntry가 <strong>길이</strong>를 저장한다는 점이다. 합성 데이터로 원인을 가른 과정은 <Ref to="/hstore/storage#toast">저장 방식</Ref>에 있다.</p>
    </Section>

    <Section id="query" title="5. 인덱스와 조회">
      <p>같은 20만 행(속성 12개)에 GIN을 만들어 비교했다. 각 쿼리는 {exp.index.runs}회 반복한 중앙값이다.</p>
      <table><thead><tr><th>인덱스</th><th>크기</th><th>생성 시간</th><th>2키 포함 (색·사이즈)</th><th>희귀 값 포함</th><th>키 존재 <code>?</code></th></tr></thead><tbody>
        {(['hstore_gin', 'jsonb_gin', 'jsonb_gin_path'] as const).map((n) => <tr key={n}>
          <td>{{ hstore_gin: 'hstore GIN', jsonb_gin: 'jsonb GIN (jsonb_ops)', jsonb_gin_path: 'jsonb GIN (jsonb_path_ops)' }[n]}</td>
          <td>{fmtBytes(idx[n].index_bytes.median)}</td>
          <td>{idx[n].build_seconds.median.toFixed(1)} 초</td>
          <td>{fmtMs(idx[n].queries.contain_2keys_common.ms.median)}</td>
          <td>{fmtMs(idx[n].queries.contain_rare_value.ms.median)}</td>
          <td>{idx[n].queries.key_exists_rare.plans[0].includes('Seq Scan') ? `${fmtMs(idx[n].queries.key_exists_rare.ms.median)} (인덱스 못 씀)` : fmtMs(idx[n].queries.key_exists_rare.ms.median)}</td>
        </tr>)}
        <tr><td>인덱스 없음</td><td>—</td><td>—</td><td>{fmtMs(idx.none.queries.contain_2keys_common.ms.median)}</td><td>{fmtMs(idx.none.queries.contain_rare_value.ms.median)}</td><td>{fmtMs(idx.none.queries.key_exists_rare.ms.median)}</td></tr>
      </tbody></table>
      <ul>
        <li><strong>hstore GIN = jsonb_ops GIN:</strong> 크기({fmtBytes(idx.hstore_gin.index_bytes.median)} vs {fmtBytes(idx.jsonb_gin.index_bytes.median)})도 조회 시간도 사실상 같다. 둘 다 키와 값을 별도 항목으로 색인하는 구조다. 다만 <strong>생성 시간</strong>은 hstore가 {idx.hstore_gin.build_seconds.median.toFixed(1)}초, jsonb가 {idx.jsonb_gin.build_seconds.median.toFixed(1)}초로 {ratio(idx.hstore_gin.build_seconds.median, idx.jsonb_gin.build_seconds.median)} 걸렸다.</li>
        <li><strong>jsonb_path_ops</strong>는 더 작고({fmtBytes(idx.jsonb_gin_path.index_bytes.median)}) 포함 조회가 더 빠르지만 <code>?</code> 연산자를 지원하지 않아 그 쿼리는 순차 스캔이 됐다. hstore에는 이런 선택지가 없다.</li>
      </ul>
      <p>인덱스 종류와 연산자 지원의 자세한 내용은 <Ref to="/hstore/indexes">인덱스 페이지</Ref>에 있다. 쿼리 조건은 {q.contain_2keys_common}, {q.contain_rare_value}, {q.key_exists_rare}다.</p>
    </Section>

    <Section id="write" title="6. 갱신과 읽기">
      <table><thead><tr><th>측정 (행 1000개)</th><th>키 5개</th><th>키 50개</th><th>키 500개</th></tr></thead><tbody>
        <tr><td>hstore UPDATE 1건 WAL</td><td>{fmtBytes(upd['5'].hstore_concat.wal_bytes_per_update.median)}</td><td>{fmtBytes(upd['50'].hstore_concat.wal_bytes_per_update.median)}</td><td>{fmtBytes(upd['500'].hstore_concat.wal_bytes_per_update.median)}</td></tr>
        <tr><td>jsonb UPDATE 1건 WAL</td><td>{fmtBytes(upd['5'].jsonb_set.wal_bytes_per_update.median)}</td><td>{fmtBytes(upd['50'].jsonb_set.wal_bytes_per_update.median)}</td><td>{fmtBytes(upd['500'].jsonb_set.wal_bytes_per_update.median)}</td></tr>
        <tr><td>hstore 키 하나 읽기 (1000행)</td><td>{fmtMs(upd['5'].read_ms_1000_rows.hstore.median)}</td><td>{fmtMs(upd['50'].read_ms_1000_rows.hstore.median)}</td><td>{fmtMs(upd['500'].read_ms_1000_rows.hstore.median)}</td></tr>
        <tr><td>jsonb 키 하나 읽기 (1000행)</td><td>{fmtMs(upd['5'].read_ms_1000_rows.jsonb.median)}</td><td>{fmtMs(upd['50'].read_ms_1000_rows.jsonb.median)}</td><td>{fmtMs(upd['500'].read_ms_1000_rows.jsonb.median)}</td></tr>
      </tbody></table>
      <ul>
        <li>키 50개까지는 UPDATE 비용이 같다. 두 타입 모두 <strong>값 전체를 새로 쓴다</strong>.</li>
        <li>키 500개에서는 jsonb가 압축된 만큼 적게 쓰지만, 읽을 때 압축을 풀어야 해서 hstore보다 느리다. 쓰기와 저장 공간을 줄이는 대가가 읽기 CPU다.</li>
        <li>단, 이 값들은 <strong>값 종류가 무작위인 데이터</strong>(12자리 해시) 기준이다. 압축이 잘 되는 데이터에서는 jsonb의 이점이 더 크다.</li>
      </ul>
      <SourceNote path="week04/hstore/experiments/02-update-write-amplification/bench.py">읽기는 EXPLAIN ANALYZE 실행 시간의 중앙값이다.</SourceNote>
    </Section>

    <Section id="choose" title="7. 어떻게 고르나">
      <ul>
        <li>값에 숫자·불리언·배열·중첩이 있거나 SQL/JSON 경로 쿼리가 필요하다 → <strong>jsonb</strong>.</li>
        <li>값이 전부 문자열이고 키가 적다(수십 개 이하) → <strong>둘 다 가능</strong>. 크기·인덱스·갱신 비용이 같다. 타입 계약을 문자열로 못 박고 싶으면 hstore.</li>
        <li>키가 수백 개인 큰 맵 → 저장 공간은 jsonb, 읽기 속도는 hstore가 유리했다. 어느 쪽이든 <Ref to="/hstore/updates">키 하나 수정이 값 전체 재기록</Ref>이라는 점은 같다.</li>
      </ul>
    </Section>
  </>
}
