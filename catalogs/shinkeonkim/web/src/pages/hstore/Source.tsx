import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import src from '@/data/hstore-source.json'

type Key = keyof typeof src.excerpts

function Excerpt({ id }: { id: Key }) {
  const e = src.excerpts[id]
  return <CodeBlock language="c" caption={<>
    <code>{e.file}</code> {e.start}~{e.end}행 · {e.note} · <a className="text-primary underline-offset-4 hover:underline" href={e.url} target="_blank" rel="noreferrer">GitHub에서 보기</a>
  </>}>{e.code}</CodeBlock>
}

export default function Source() {
  return <>
    <PageHeader eyebrow="Week 04 · 소스 지도" title="contrib/hstore 소스 읽기"
      lede={`hstore는 C 파일 몇 개와 SQL 스크립트로 이루어진 작은 확장이다. 이 페이지는 PostgreSQL ${src.tag}(커밋 ${src.commit.slice(0, 7)})의 contrib/hstore를 기준으로 저장 형식·병합·인덱스·첨자 구현의 위치를 행 번호와 함께 안내한다.`}
      tags={[{ label: src.tag }, { label: `커밋 ${src.commit.slice(0, 7)}` }, { label: 'hstore 1.8' }]} />

    <Section id="files" title="1. 파일 지도">
      <table><thead><tr><th>파일</th><th>맡은 일</th><th>이 자료에서 쓰는 곳</th></tr></thead><tbody>
        <tr><td><code>hstore.h</code></td><td>HEntry·HStore 구조, 크기 계산 매크로, 전략 번호</td><td><Ref to="/hstore/storage">저장 방식</Ref></td></tr>
        <tr><td><code>hstore_io.c</code></td><td>입력 파서(<code>hstore_in</code>), 정렬·중복 제거, 출력, 배열·레코드·JSON 변환</td><td><Ref to="/hstore/install-syntax">문법</Ref>, <Ref to="/hstore/vs-jsonb#convert">변환</Ref></td></tr>
        <tr><td><code>hstore_op.c</code></td><td>키 찾기, <code>-&gt;</code> <code>?</code> <code>@&gt;</code> <code>||</code> <code>-</code>, <code>each</code>, 비교·해시</td><td><Ref to="/hstore/updates">갱신 비용</Ref></td></tr>
        <tr><td><code>hstore_gin.c</code></td><td>GIN 연산자 클래스 (추출·일관성 검사)</td><td><Ref to="/hstore/indexes#gin">인덱스</Ref></td></tr>
        <tr><td><code>hstore_gist.c</code></td><td>GiST 연산자 클래스(서명, <code>siglen</code> 옵션)</td><td><Ref to="/hstore/indexes#gist">GiST</Ref></td></tr>
        <tr><td><code>hstore_subs.c</code></td><td>첨자 <code>h['k']</code> 읽기·쓰기 (1.8에서 추가)</td><td><Ref to="/hstore/install-syntax#subscript">첨자</Ref></td></tr>
        <tr><td><code>hstore_compat.c</code></td><td>PostgreSQL 9.0 이전 형식 값의 읽기 호환 (<code>hstoreUpgrade</code>)</td><td><Ref to="/hstore/operations#upgrade">업그레이드</Ref></td></tr>
        <tr><td><code>hstore--1.4.sql</code> 외</td><td>타입·연산자·함수·연산자 클래스 정의와 버전별 변경</td><td><Ref to="/hstore/indexes#matrix">지원 연산자</Ref></td></tr>
      </tbody></table>
    </Section>

    <Section id="header" title="2. 저장 형식: hstore.h">
      <Excerpt id="entry" />
      <p>HEntry 하나는 32비트다. 최상위 비트가 <code>ISFIRST</code>, 그다음이 <code>ISNULL</code>, 나머지 30비트가 <strong>끝 위치</strong>다. 길이는 없다. <code>HSE_LEN</code>은 ‘내 끝 위치 − 앞 항목의 끝 위치’로 계산한다. 이 한 줄이 <Ref to="/hstore/storage#toast">압축 실험</Ref>의 원인이다.</p>
      <Excerpt id="header" />
      <ul>
        <li><code>HS_COUNT</code>는 <code>size_</code>의 하위 28비트, <code>HS_FLAG_NEWVERSION</code>은 최상위 비트다. <code>CALCDATASIZE(x, lenstr)</code>는 <code>x*2*sizeof(HEntry) + 헤더 + 문자열</code>, 즉 <Ref to="/hstore/storage#bytes">크기 공식</Ref>이다.</li>
        <li><code>ARRPTR</code>는 헤더 바로 뒤, <code>STRPTR</code>는 HEntry 배열 뒤를 가리킨다. 키 i는 <code>HEntry[2i]</code>, 값 i는 <code>HEntry[2i+1]</code>다.</li>
        <li><code>HSTORE_MAX_KEY_LEN</code>·<code>HSTORE_MAX_VALUE_LEN</code>은 0x3FFFFFFF다(hstore.h 41행 근처).</li>
      </ul>
    </Section>

    <Section id="io" title="3. 입력과 정렬: hstore_io.c">
      <table><thead><tr><th>함수</th><th>행</th><th>하는 일</th></tr></thead><tbody>
        <tr><td><code>get_val</code> · <code>parse_hstore</code></td><td>93 · 215</td><td>리터럴을 상태 기계로 파싱한다 (따옴표·이스케이프·공백 무시)</td></tr>
        <tr><td><code>comparePairs</code></td><td>326</td><td>키 길이 우선, 같으면 <code>memcmp</code></td></tr>
        <tr><td><code>hstoreUniquePairs</code></td><td>356</td><td><code>qsort</code> 후 중복 키 제거</td></tr>
        <tr><td><code>hstorePairs</code></td><td>446</td><td>정렬된 쌍으로 HEntry 배열과 문자열 영역을 만든다</td></tr>
        <tr><td><code>hstore_in</code> · <code>hstore_out</code> · <code>hstore_send</code></td><td>477 · 1223 · 1294</td><td>텍스트·바이너리 입출력</td></tr>
        <tr><td><code>hstore_from_arrays</code> · <code>hstore_populate_record</code></td><td>600 · 991</td><td>배열·레코드 변환</td></tr>
        <tr><td><code>hstore_to_json</code> · <code>hstore_to_jsonb(_loose)</code></td><td>1395 · 1440 · 1483</td><td>JSON 변환 (loose는 숫자·불리언 추측)</td></tr>
      </tbody></table>
      <Excerpt id="compare" />
      <p>정렬 기준이 (길이, 바이트)인 것이 여기서 정해진다. <code>hstoreUniquePairs</code>는 이 순서로 <code>qsort</code>한 뒤 인접한 같은 키를 걷어낸다. 같은 키끼리의 순서는 <code>needfree</code> 플래그로만 갈리므로, <strong>어느 값이 남는지는 정렬 구현에 달려 있고 문서도 보장하지 않는다</strong>.</p>
    </Section>

    <Section id="op" title="4. 조회·병합: hstore_op.c">
      <table><thead><tr><th>함수</th><th>행</th><th>역할</th></tr></thead><tbody>
        <tr><td><code>hstoreFindKey</code></td><td>36</td><td>정렬된 키에서 이진 탐색</td></tr>
        <tr><td><code>hstore_fetchval</code> · <code>hstore_exists</code></td><td>128 · 149</td><td><code>-&gt;</code>, <code>?</code></td></tr>
        <tr><td><code>hstore_delete</code> · <code>hstore_delete_array</code> · <code>hstore_delete_hstore</code></td><td>245 · 292 · 371</td><td><code>-</code> 세 가지 오른쪽 피연산자</td></tr>
        <tr><td><code>hstore_concat</code></td><td>471</td><td><code>||</code></td></tr>
        <tr><td><code>hstore_contains</code> · <code>hstore_contained</code></td><td>962 · 1010</td><td><code>@&gt;</code>, <code>&lt;@</code></td></tr>
        <tr><td><code>hstore_each</code> · <code>hstore_akeys</code> · <code>hstore_avals</code></td><td>1021 · 692 · 726</td><td>펼치기</td></tr>
        <tr><td><code>hstore_cmp</code> · <code>hstore_eq</code> · <code>hstore_hash</code></td><td>1082 · 1163 · 1230</td><td>btree·hash 연산자 클래스용</td></tr>
      </tbody></table>
      <Excerpt id="findkey" />
      <p><code>lowbound</code> 인자는 ‘오름차순 키를 연달아 찾을 때 이전 위치부터 이어 탐색’하려는 캐시다. <code>hstore_contains</code>가 이를 써서 오른쪽 hstore의 키를 왼쪽에서 차례로 찾는다. 한 번 찾는 데 O(log n)이다.</p>
      <Callout kind="info" title="읽기 비용의 직관">
        <p>이진 탐색 자체는 빠르다. 다만 함수가 <code>PG_GETARG_HSTORE_P</code>로 인자를 받으므로 <strong>값 전체가 detoast(압축 해제·TOAST 조각 조합)된 뒤</strong> 탐색이 시작된다. 키 500개 hstore의 읽기 비용은 탐색이 아니라 이 준비 단계가 지배한다 (<Ref to="/hstore/updates#read">읽기 비용 측정</Ref>).</p>
      </Callout>
      <div id="concat" />
      <Excerpt id="concat" />
      <p><code>||</code>는 두 hstore를 <strong>정렬된 두 배열의 병합</strong>으로 합친다. 같은 키는 오른쪽(s2)이 이기고, 결과는 새 <code>palloc</code> 공간에 <strong>모든 쌍</strong>이 다시 복사된다. 왼쪽에서 바뀌지 않은 쌍도 복사되므로, 키 하나를 바꿔도 결과가 값 전체 크기인 이유가 이 루프다 (<Ref to="/hstore/updates">갱신 비용</Ref>).</p>
    </Section>

    <Section id="gin" title="5. GIN: hstore_gin.c">
      <Excerpt id="gin_extract" />
      <p><code>KEYFLAG 'K'</code>·<code>VALFLAG 'V'</code>·<code>NULLFLAG 'N'</code>이 20~22행에 정의돼 있다. 쌍 하나가 항목 두 개(키용, 값용)가 되어 <code>*nentries = 2 * count</code>다. 값이 NULL이면 <code>N</code> 항목이다.</p>
      <Excerpt id="gin_consistent" />
      <p><code>@&gt;</code>(<code>HStoreContainsStrategyNumber</code>)에서만 <code>*recheck = true</code>다. 인덱스가 ‘키 항목과 값 항목이 다 있다’까지만 알기 때문이다. <code>?</code>·<code>?|</code>는 키 항목 하나면 충분하고 <code>?&amp;</code>는 모든 키 항목이 있으면 정확하므로 recheck가 없다. 그래서 <Ref to="/hstore/indexes#gin">decoy 행 실험</Ref>에서 재검사 탈락이 <code>@&gt;</code>에서만 나타난다.</p>
      <p>GiST(<code>hstore_gist.c</code>)는 키·값의 해시를 비트 서명에 찍는다. 기본 <code>siglen</code>은 <code>sizeof(int32) * 4</code> = 16바이트(22행)이고 최대는 <code>GISTMaxIndexKeySize</code>다. 서명이 짧을수록 서로 다른 값의 비트가 겹쳐 후보가 넘치고 재검사가 늘어난다 (<Ref to="/hstore/indexes#benchmark">실측</Ref>).</p>
    </Section>

    <Section id="subs" title="6. 첨자와 호환: hstore_subs.c · hstore_compat.c">
      <Excerpt id="subs_handler" />
      <p><code>hstore_subscript_handler</code>가 <code>ALTER TYPE hstore SET (SUBSCRIPT = …)</code>로 타입에 연결된다 (<code>hstore--1.7--1.8.sql</code>). 읽기(94행)와 쓰기(143행)는 각각 <code>hstore_subscript_fetch</code>와 <code>hstore_subscript_assign</code>이다. <code>hstoreUpgrade</code>(hstore_compat.c 236행)는 모든 <code>PG_GETARG_HSTORE_P</code>가 거치는 관문으로, 새 형식이면 곧바로 반환한다.</p>
    </Section>

    <Section id="reproduce" title="7. 같은 판으로 읽으려면">
      <CodeBlock language="bash">{`git clone --depth 1 --branch ${src.tag} --filter=blob:none --sparse https://github.com/postgres/postgres.git pgsrc
git -C pgsrc sparse-checkout set --no-cone /contrib/hstore/ /doc/src/sgml/hstore.sgml
python3 catalogs/shinkeonkim/web/scripts/extract-hstore-source.py pgsrc   # 이 페이지의 발췌를 다시 만든다`}</CodeBlock>
      <table><thead><tr><th>파일</th><th>git blob 해시</th></tr></thead><tbody>
        {Object.entries(src.files).map(([f, h]) => <tr key={f}><td><code>{f}</code></td><td><code>{h}</code></td></tr>)}
      </tbody></table>
      <p>{src.tag} 태그의 각 파일과 바이트 단위로 같은지 위 해시로 확인한다. 나머지 파일(<code>hstore_io.c</code>의 함수 위치 등)의 행 번호도 같은 태그 기준이다.</p>
    </Section>
  </>
}
