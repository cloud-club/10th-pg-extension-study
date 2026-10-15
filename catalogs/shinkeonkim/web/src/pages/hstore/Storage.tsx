import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { ChartBox } from '@/components/charts/ChartBox'
import { ChartNotes } from '@/components/common/ChartNotes'
import { Clotho } from '@/components/viz/Clotho'
import { C, axes } from '@/lib/chart'
import { demo, exp, fmtBytes, fmtNum, ratio, storageCell } from './stats'

const cells = exp.storage.cells
const label = (c: (typeof cells)[number]) => `키 ${c.keys}개 · ${c.profile === 'low' ? '값 종류 적음' : '값이 무작위'}`
const formName: Record<string, string> = {
  'inline-short-header': '인라인 (짧은 헤더)',
  inline: '인라인',
  compressed: '압축됨(인라인)',
  'external-uncompressed': 'TOAST 테이블 (압축 안 됨)',
}
const s5l = storageCell(5, 'low'), s5h = storageCell(5, 'high')
const s20l = storageCell(20, 'low'), s20h = storageCell(20, 'high')
const s100l = storageCell(100, 'low'), s100h = storageCell(100, 'high')
const low500 = storageCell(500, 'low'), s500h = storageCell(500, 'high')
const probe = low500.compression_probe!

export default function Storage() {
  return <>
    <PageHeader eyebrow="Week 04 · 저장 방식" title="hstore는 디스크에 어떻게 저장될까?"
      lede="hstore 값은 varlena 하나다. 키를 (길이, 바이트) 순으로 정렬해 두고, 4바이트 HEntry 배열과 문자열 영역을 이어 붙인 구조다. 실제 디스크 바이트를 pageinspect로 읽어 확인하고, 크기와 압축이 jsonb·EAV와 어떻게 다른지 측정했다."
      tags={[{ label: `${exp.storage.runs}회 반복 · 결정적` }, { label: 'pageinspect' }, { label: 'contrib/hstore/hstore.h' }]} />

    <Section id="layout" title="1. 값 하나의 구조">
      <Clotho id="hstore-storage-layout" />
      <table><thead><tr><th>구성</th><th>크기</th><th>내용</th></tr></thead><tbody>
        <tr><td>varlena 헤더</td><td>4B (짧으면 1B)</td><td>전체 길이. 130바이트 이하는 1바이트 짧은 헤더로 저장</td></tr>
        <tr><td><code>size_</code></td><td>4B</td><td>쌍 개수(하위 28비트)와 새 형식 플래그(최상위 비트)</td></tr>
        <tr><td>HEntry 배열</td><td>쌍 × 2 × 4B</td><td>키와 값마다 하나. <strong>문자열 영역 안의 끝 위치</strong> + ISFIRST·ISNULL 비트</td></tr>
        <tr><td>문자열 영역</td><td>가변</td><td>정렬된 순서로 키·값을 이어 붙인 바이트 (NULL 값은 0바이트)</td></tr>
      </tbody></table>
      <p>이 표는 <code>contrib/hstore/hstore.h</code>의 <code>HEntry</code>, <code>HStore</code> 정의와 <code>CALCDATASIZE</code> 매크로에서 가져왔다 (<Ref to="/hstore/source#header">소스 지도</Ref>). 아래는 실제로 확인한 결과다.</p>
    </Section>

    <Section id="bytes" title="2. 디스크의 바이트를 직접 읽어 확인">
      <p><code>pageinspect</code>의 <code>heap_page_items</code>로 힙 페이지의 튜플을 읽고 hstore 부분을 잘라 낸다. 입력은 순서가 뒤섞이고 <code>aa</code>가 두 번, NULL 값이 하나 있는 리터럴이다.</p>
      <CodeBlock language="sql">{demo.st_setup}</CodeBlock>
      <CodeBlock language="sql" output={demo.st_logical.output} outputCaption="논리적으로 보이는 값과 저장 크기 · 실제 실행 결과">{demo.st_logical.sql}</CodeBlock>
      <p>먼저 원시 바이트다. <code>t_data</code>는 튜플 헤더(<code>t_hoff</code> = 24바이트)를 뺀 사용자 데이터라서, 앞 4바이트가 <code>id</code>이고 그다음이 hstore다.</p>
      <CodeBlock language="sql" output={demo.st_hex.output} outputCaption="hstore 부분의 16진수 · 실제 실행 결과">{demo.st_hex.sql}</CodeBlock>
      <p>이 바이트열을 읽으려고 리틀 엔디언 4바이트를 읽는 함수를 만든다.</p>
      <CodeBlock language="sql">{demo.st_u32}</CodeBlock>
      <CodeBlock language="sql" output={demo.st_header.output} outputCaption="첫 바이트는 짧은 헤더의 길이(39), 이어서 size_ 의 쌍 개수 · 실제 실행 결과">{demo.st_header.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.st_entries.output} outputCaption="HEntry 6개를 해독한 결과 · 실제 실행 결과">{demo.st_entries.sql}</CodeBlock>
      <ul>
        <li><strong>정렬:</strong> 키가 <code>b</code>, <code>aa</code>, <code>ccc</code> 순서로 놓였다. 길이 우선이다.</li>
        <li><strong>중복 제거:</strong> <code>aa=&gt;9</code>는 없다. 하나만 저장됐다.</li>
        <li><strong>NULL:</strong> <code>b</code>의 값은 <code>isnull = 1</code>이고 길이가 0이다. 문자열 영역에 자리를 차지하지 않는다.</li>
        <li><strong>끝 위치:</strong> 1, 1, 3, 4, 7, 10처럼 누적값이다. 길이는 저장하지 않고 앞 항목과의 차이로 구한다.</li>
      </ul>
      <CodeBlock language="sql" output={demo.st_formula.output} outputCaption="크기 공식 검증 · 실제 실행 결과">{demo.st_formula.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.st_null_vs_empty.output} outputCaption="NULL 값과 빈 문자열은 크기가 같고 한 글자 값은 1바이트 크다. 둘의 차이는 ISNULL 비트뿐이다 · 실제 실행 결과">{demo.st_null_vs_empty.sql}</CodeBlock>
      <SourceNote path="week04/hstore/labs/02-storage-and-toast/sql/01-on-disk-layout.sql">lab 02의 첫 SQL과 같은 문장이다.</SourceNote>
    </Section>

    <Section id="footprint" title="3. 같은 속성 묶음의 저장 크기 (실험 01)">
      <p>같은 키·값을 hstore, jsonb, EAV(<code>(id, key, value)</code> 행)에 넣고 행당 저장 크기와 전체 크기를 쟀다. 키 개수 4가지, 값 종류 2가지({fmtNum(cells.length)}개 조건). 값이 문자열이므로 jsonb에도 문자열로 넣었다.</p>
      <table><thead><tr><th>조건</th><th>hstore<br />행당 저장</th><th>jsonb<br />행당 저장</th><th>hstore 저장 형태<br />(1번 행 기준)</th><th>hstore 전체</th><th>jsonb 전체</th><th>EAV 전체</th></tr></thead><tbody>
        {cells.map((c) => <tr key={`${c.keys}${c.profile}`}>
          <td>{label(c)} · {fmtNum(c.rows)}행</td>
          <td>{fmtBytes(c.hs.avg_column_bytes)}</td>
          <td>{fmtBytes(c.jb.avg_column_bytes)}</td>
          <td>{formName[c.formula.form]}</td>
          <td>{fmtBytes(c.hs.total_bytes)}</td>
          <td>{fmtBytes(c.jb.total_bytes)}</td>
          <td>{fmtBytes(c.eav.total_bytes)}</td>
        </tr>)}
      </tbody></table>
      <ChartBox type="bar" title="행당 저장 크기: hstore vs jsonb (로그 축)" height={320}
        data={{
          labels: cells.map(label),
          datasets: [
            { label: 'hstore', data: cells.map((c) => c.hs.avg_column_bytes), backgroundColor: C.tsv },
            { label: 'jsonb', data: cells.map((c) => c.jb.avg_column_bytes), backgroundColor: C.ok },
          ],
        }}
        options={{ scales: axes({ log: true, yTitle: '바이트 (log)' }) }}
        caption={`키가 적을 때(5·20개)는 두 타입의 크기가 같다. 키 100개 이상에서 갈라진다: 키 500개·값 종류 적음에서 hstore ${fmtBytes(low500.hs.avg_column_bytes)}, jsonb ${fmtBytes(low500.jb.avg_column_bytes)}(${ratio(low500.hs.avg_column_bytes, low500.jb.avg_column_bytes)}).`} />
      <ChartNotes items={[
        { label: `키 5개: ${fmtBytes(s5l.hs.avg_column_bytes)}~${fmtBytes(s5h.hs.avg_column_bytes)}, hstore=jsonb`, note: <>둘 다 압축 대상이 아닐 만큼 작아 헤더·엔트리 배열 오버헤드가 크기를 지배한다. 값 종류(낮음/무작위)에 따라 값 길이만큼만 차이 난다 — 압축이 끼어들 여지 자체가 없다.</> },
        { label: `키 20개: ${fmtBytes(s20l.hs.avg_column_bytes)}~${fmtBytes(s20h.hs.avg_column_bytes)}, hstore=jsonb`, note: <>키 5개보다 전체적으로 크지만 hstore·jsonb 격차는 여전히 0이다. 엔트리 배열이 20×8=160B로 아직 압축 시도(2KB TOAST 문턱)에 한참 못 미친다.</> },
        { label: `키 100개: hstore ${fmtBytes(s100l.hs.avg_column_bytes)}/${fmtBytes(s100h.hs.avg_column_bytes)}`, note: <>여기서부터 hstore와 jsonb가 갈라지기 시작한다(값 종류 적음일 때 jsonb {fmtBytes(s100l.jb.avg_column_bytes)}로 더 작음). 엔트리 배열이 800B로 1024B 문턱 아래라 압축 시도가 문자열까지 닿는다 — <Ref to="#toast">4절</Ref>에서 정확한 경계를 다룬다.</> },
        { label: `키 500개: hstore가 가장 크게 벌어진다(jsonb의 최대 ${ratio(low500.hs.avg_column_bytes, low500.jb.avg_column_bytes)})`, note: <>엔트리 배열만 4,000B로 1024B 문턱을 넘어, hstore는 압축을 거의 못 받는다(외부 미압축). jsonb는 같은 크기의 엔트리 배열인데도 대부분 압축된다 — 값 종류(무작위 {fmtBytes(s500h.hs.avg_column_bytes)})가 낮음({fmtBytes(low500.hs.avg_column_bytes)})보다 큰 것도 값 자체가 더 길어서다(12자리 해시 vs 반복 단어).</> },
      ]} />
      <ul>
        <li><strong>키 20개 이하:</strong> hstore와 jsonb의 행당 크기가 <strong>바이트까지 같았다</strong>. 두 형식 모두 쌍마다 8바이트(엔트리 2개)의 오버헤드를 쓴다.</li>
        <li><strong>EAV:</strong> 행마다 튜플 헤더와 인덱스 항목이 붙어 크다. 키 100개·값 종류 적음에서 hstore 전체 {fmtBytes(storageCell(100, 'low').hs.total_bytes)}, EAV {fmtBytes(storageCell(100, 'low').eav.total_bytes)}({ratio(storageCell(100, 'low').eav.total_bytes, storageCell(100, 'low').hs.total_bytes)}).</li>
        <li><strong>결정적:</strong> 크기는 {exp.storage.runs}회 반복에서 모든 조건이 같았다.</li>
      </ul>
      <SourceNote path="week04/hstore/experiments/01-storage-footprint/bench.py" />
    </Section>

    <Section id="toast" title="4. 2KB를 넘으면 TOAST — 그리고 hstore는 덜 압축된다">
      <p>PostgreSQL은 튜플이 약 2KB를 넘으면 큰 값을 압축하거나 별도 TOAST 테이블로 내보낸다. 위 표의 ‘저장 형태’가 그 결과다. 키 100개 이상에서 hstore는 이 경계를 넘는다.</p>
      <table><thead><tr><th>조건</th><th>hstore</th><th>jsonb</th></tr></thead><tbody>
        {cells.filter((c) => c.keys >= 100).map((c) => <tr key={`${c.keys}${c.profile}`}>
          <td>{label(c)}</td>
          <td>{fmtBytes(c.hs.avg_column_bytes)} · 압축된 행 {fmtNum(c.hs.compressed_rows)}/{fmtNum(c.rows)} · TOAST {fmtBytes(c.hs.toast_bytes)}</td>
          <td>{fmtBytes(c.jb.avg_column_bytes)} · 압축된 행 {fmtNum(c.jb.compressed_rows)}/{fmtNum(c.rows)} · TOAST {fmtBytes(c.jb.toast_bytes)}</td>
        </tr>)}
      </tbody></table>
      <p>같은 내용인데 hstore는 대부분 압축되지 않고 그대로 TOAST 테이블로 나간다. 같은 데이터를 <code>lz4</code>로 압축해도 차이는 남는다.</p>
      <h3>왜 갈릴까: 끝 위치 vs 길이</h3>
      <Clotho id="hstore-offsets-vs-lengths" />
      <p>hstore의 HEntry는 <strong>끝 위치</strong>(누적값)를 저장하고, jsonb의 JEntry는 <strong>대부분 길이</strong>를 저장한다. 끝 위치는 1, 3, 4, 7, 10처럼 계속 커져 반복이 없고, 길이는 같은 패턴이 되풀이된다. 압축은 반복을 찾으므로 길이 쪽이 잘 줄어든다. jsonb 소스(<code>jsonb.h</code>)의 주석도 같은 이유를 적고 있다: 처음엔 offset만 저장했다가 압축이 안 돼서 ‘길이 + 32번째마다 offset’으로 바꿨다.</p>
      <p>이것이 원인인지 가르려고 <strong>같은 문자열에 두 종류의 배열만 바꿔 붙여</strong> 압축해 봤다(키 500개 · 값 종류 적음, 행당 평균).</p>
      <table><thead><tr><th>측정</th><th>크기</th></tr></thead><tbody>
        <tr><td>실제 hstore (pglz) / 실제 jsonb (pglz)</td><td>{fmtBytes(low500.hs.avg_column_bytes)} / {fmtBytes(low500.jb.avg_column_bytes)}</td></tr>
        <tr><td>실제 hstore (lz4) / 실제 jsonb (lz4)</td><td>{fmtBytes(probe.lz4_hstore_avg)} / {fmtBytes(probe.lz4_jsonb_avg)}</td></tr>
        <tr><td>원본 (압축 전 바이트열)</td><td>{fmtBytes(probe.layout_raw_avg)}</td></tr>
        <tr><td>끝 위치 배열 + 문자열 (pglz / lz4)</td><td>{fmtBytes(probe.layout_offsets_pglz_avg)} / {fmtBytes(probe.layout_offsets_lz4_avg)}</td></tr>
        <tr><td>길이 배열 + 문자열 (pglz / lz4)</td><td>{fmtBytes(probe.layout_lengths_pglz_avg)} / {fmtBytes(probe.layout_lengths_lz4_avg)}</td></tr>
      </tbody></table>
      <Callout kind="ok" title="결론: 원인은 배열의 종류">
        <p>문자열이 같아도 끝 위치 배열은 {fmtBytes(probe.layout_offsets_lz4_avg)}, 길이 배열은 {fmtBytes(probe.layout_lengths_lz4_avg)}로 압축된다. 실제 hstore(lz4 {fmtBytes(probe.lz4_hstore_avg)})는 끝 위치 배열 합성본과 거의 같고, 실제 jsonb({fmtBytes(probe.lz4_jsonb_avg)})는 길이 배열 합성본과 같다. 이 대조는 hstore의 실제 바이트를 직접 조작한 것이 아니라 <strong>같은 정보를 두 방식으로 배치한 합성 데이터</strong>이므로, ‘배열의 종류가 압축률을 좌우한다’는 것까지가 확인된 범위다.</p>
      </Callout>

      <h3>왜 키 100개는 압축되고 키 500개는 안 되는가: pglz의 두 문턱값</h3>
      <p>PostgreSQL의 기본 TOAST 압축기(pglz)는 아무 조건 없이 압축을 시도하지 않는다. 소스(<code>src/common/pg_lzcompress.c</code>)의 기본 전략 <code>PGLZ_strategy_default</code>에 두 숫자가 박혀 있다.</p>
      <CodeBlock language="c" caption={<>src/common/pg_lzcompress.c · <a className="text-primary underline-offset-4 hover:underline" href="https://github.com/postgres/postgres/blob/REL_16_15/src/common/pg_lzcompress.c#L223-L235" target="_blank" rel="noreferrer">REL_16_15 223~235행</a></>}>{`static const PGLZ_Strategy strategy_default_data = {
    32,       /* Data chunks less than 32 bytes are not compressed */
    INT_MAX,  /* No upper limit on what we'll try to compress */
    25,       /* Require 25% compression rate, or not worth it */
    1024,     /* Give up if no compression in the first 1KB */
    128,      /* Stop history lookup if a match of 128 bytes is found */
    10        /* Lower good match size by 10% at every attempt */
};`}</CodeBlock>
      <p>중요한 두 값: <strong>25% 이상 줄어들지 않으면 압축한 걸 버리고 원본을 저장</strong>하고(<code>min_comp_rate</code>), <strong>맨 앞 1024바이트를 훑는 동안 단 하나도 줄일 거리를 못 찾으면 그 시점에서 아예 포기</strong>한다(<code>first_success_by</code>, pg_lzcompress.c 621~628행의 <code>if (!found_match &amp;&amp; bp - bstart &gt;= strategy-&gt;first_success_by) return -1;</code>).</p>
      <p>pglz는 varlena 헤더 바로 뒤, 즉 <code>size_</code>부터 스캔을 시작한다 — <Ref to="#layout">1절</Ref>의 구조 그대로라면 <strong>HEntry/JEntry 배열이 문자열보다 먼저</strong> 나온다는 뜻이다. 그래서 “처음 1024바이트”가 엔트리 배열 안에서 끝나는지, 문자열까지 넘어가는지가 압축 여부를 가른다. 엔트리 배열의 크기는 <strong>키 개수 × 2 × 4바이트</strong>(hstore·jsonb 동일한 계산)다.</p>
      <table><thead><tr><th>키 개수</th><th>엔트리 배열 크기</th><th>1024바이트 문턱</th><th>hstore 압축된 행 (실측)</th></tr></thead><tbody>
        <tr><td>100</td><td>100 × 2 × 4 = 800B</td><td>800 &lt; 1024 → <strong>문자열까지 스캔이 넘어간다</strong></td><td>5,000/5,000 (값 종류 적음) · 0/5,000 (값 무작위)</td></tr>
        <tr><td>500</td><td>500 × 2 × 4 = 4,000B</td><td>4,000 &gt; 1024 → <strong>엔트리 배열 안에서 문턱에 도달한다</strong></td><td>200/2,000 (값 종류 적음) · 0/2,000 (값 무작위)</td></tr>
      </tbody></table>
      <p>키 100개는 엔트리 배열이 800바이트로 1024바이트보다 작아서, pglz가 처음 1024바이트를 훑는 동안 <strong>문자열 영역까지 들어간다</strong>. 문자열이 반복되는 값(10종류)이면 그 안에서 압축 가능한 구간을 찾아 <code>first_success_by</code> 문턱을 통과하고, 전체적으로도 25% 이상 줄어들어(2,098→1,298B) 5,000행 전부 압축됐다. 문자열이 12자리 해시(사실상 무작위)라면 문자열 구간에 들어가도 압축할 거리가 없어 0행이 압축됐다 — <strong>엔트리 배열 크기와 무관하게, 순전히 문자열 내용의 반복 여부가 결정한다.</strong></p>
      <p>키 500개는 엔트리 배열만 4,000바이트라 <strong>처음 1024바이트가 전부 엔트리 배열 안</strong>에서 끝난다. hstore의 HEntry는 끝 위치를 담는데(<Ref to="#bytes">2절</Ref>에서 본 1, 1, 3, 4, 7, 10처럼 계속 커지는 4바이트 정수), 그 구간 안에서 반복되는 4바이트 패턴이 거의 없고, 대부분(1,800/2,000, 90%) <code>first_success_by</code>를 못 채워 포기한다. 나머지 200/2,000(10%)은 정수들이 우연히 만든 반복 패턴으로 문턱을 넘긴 사례로 보인다 — 이건 추정이며 이 실험에서 개별 확인하지 않았다.</p>
      <p>반면 jsonb는 같은 크기(4,000B)의 엔트리 배열인데도 K=500 두 프로파일 모두 100% 압축됐다(2,000/2,000). JEntry는 대부분 <strong>길이</strong>를 담는데, 이 데이터에서 키 이름은 전부 8자(<code>attr_XXX</code>), 값은 전부 12자(무작위 프로파일이어도 <em>길이</em>는 고정 12)라 <strong>JEntry 값 자체가 소수의 정수(대략 8과 12)만 반복</strong>한다. 문자열 내용이 무작위여도 엔트리 배열 수준에서 이미 반복이 있으니 <code>first_success_by</code>를 넘기고, 전체 압축률도 25%를 넘긴다. <strong>hstore의 압축 여부는 (엔트리 배열 크기, 문자열 내용) 둘 다에 좌우되지만, jsonb는 엔트리 배열 자체의 구조만으로 대개 문턱을 넘는다</strong> — 이게 2절의 데이터에서 K=100·무작위 값 조건에서만 hstore와 jsonb가 갈리는 이유이기도 하다(hstore 0/5,000, jsonb 5,000/5,000).</p>
      <Callout kind="info" title="확인 범위">
        <p>1024바이트 문턱과 4,000B/800B 엔트리 배열 크기, 25% 문턱은 소스 상수와 이 실험의 데이터 구조에서 정확히 계산된다. 다만 pglz의 실제 매치 탐색(해시 체인)이 “처음 1024바이트 안에서 어떤 4바이트 시퀀스가 우연히 반복되는가”까지는 이 페이지에서 바이트 단위로 재현하지 않았다 — K=500 저-엔트로피에서 10%가 압축된 이유는 그래서 “추정”으로 남겨 둔다.</p>
      </Callout>

      <p>실무 의미: 키가 많고 값이 반복되는 큰 맵은 hstore가 jsonb보다 디스크를 더 쓴다. 대신 압축을 풀 필요가 없어 읽기는 빠르다 (<Ref to="/hstore/updates#read">읽기 비교</Ref>). <code>ALTER TABLE ... SET COMPRESSION lz4</code>로 줄일 수는 있지만(위 표) jsonb만큼은 되지 않는다.</p>
    </Section>

    <Section id="limits" title="5. 한계">
      <table><thead><tr><th>항목</th><th>값</th><th>출처</th></tr></thead><tbody>
        <tr><td>키·값 하나의 최대 길이</td><td>0x3FFFFFFF (약 1GiB, HEntry 끝 위치 30비트)</td><td><code>HSTORE_MAX_KEY_LEN</code> · <code>HSTORE_MAX_VALUE_LEN</code></td></tr>
        <tr><td>쌍 개수</td><td>형식상 2<sup>28</sup>개, 실제로는 <code>MaxAllocSize</code>가 먼저 한계</td><td><code>hstore.h</code>의 주석</td></tr>
        <tr><td>키에 NULL</td><td>불가. 값만 NULL 가능</td><td>공식 문서</td></tr>
        <tr><td>값 하나를 읽을 때 필요한 것</td><td>값 전체의 압축 해제 또는 TOAST 조각 전부 읽기</td><td>실험 02 읽기 비용 · <code>PG_GETARG_HSTORE_P</code></td></tr>
      </tbody></table>
    </Section>
  </>
}
