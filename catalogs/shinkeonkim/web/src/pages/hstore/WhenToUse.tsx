import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import { exp, fmtBytes, fmtMs, fmtNum } from './stats'

const read5 = exp.update.cases['5'].read_ms_1000_rows
const read500 = exp.update.cases['500'].read_ms_1000_rows
const upd500 = exp.update.cases['500']

export default function WhenToUse() {
  return <>
    <PageHeader eyebrow="Week 04 · 선택 기준" title="hstore를 쓸 때와 피할 때"
      lede="hstore, jsonb, 속성별 열, EAV, Redis 해시는 모두 ‘속성 묶음’을 담을 수 있다. 무엇이 다른지는 값의 모양, 바뀌는 빈도, 조회 방식, 필요한 보장에서 갈린다." />

    <Section id="flow" title="1. 다섯 가지 질문으로 고르기">
      <Diagram chart={`flowchart TD
        q1{"자주 필터·정렬·조인하는\n핵심 속성인가?"}
        q1 -->|"예"| col["속성별 열\n타입·제약·통계 사용"]
        q1 -->|"아니오"| q2{"데이터가 캐시·세션·카운터처럼\n잃어도 되거나 TTL이 필요한가?"}
        q2 -->|"예"| redis["Redis 해시 등\n별도 저장소"]
        q2 -->|"아니오"| q3{"값에 숫자·불리언·배열·\n중첩이 필요한가?"}
        q3 -->|"예"| jsonb["jsonb"]
        q3 -->|"아니오"| q4{"묶음이 작고\n한 행에 한 번에 읽는가?\n(키 수십 개 이하)"}
        q4 -->|"예"| hstore["hstore"]
        q4 -->|"아니오"| eav["EAV 또는 열 분리\n(키가 많고 자주 바뀜)"]
      `} caption="이 흐름은 이 자료의 실험 결과에서 이끌어 낸 규칙이다. 예외는 있고, 마지막 질문의 ‘수십 개’는 값 크기 2KB 근처(TOAST 경계)를 기준으로 잡은 것이다." />
    </Section>

    <Section id="good" title="2. hstore가 잘 맞는 경우">
      <table><thead><tr><th>상황</th><th>이유</th></tr></thead><tbody>
        <tr><td>상품·게시물의 <strong>부가 속성</strong>이 종류마다 다르고, 값이 전부 문자열이다</td><td>스키마 변경 없이 속성을 더한다. <code>@&gt;</code>·<code>?</code>로 조회하고 GIN 인덱스가 도와준다.</td></tr>
        <tr><td>지도 데이터의 태그처럼 <strong>키가 제각각인 문자열 메타데이터</strong></td><td>대표 사례: osm2pgsql의 <code>--hstore</code> 옵션은 별도 열이 없는 태그를 hstore 컬럼 <code>tags</code>에 담는다.</td></tr>
        <tr><td>사용자 설정·기능 플래그처럼 <strong>작은 문자열 맵</strong></td><td>한 행을 읽으면 전부 온다. ORM 지원이 있다: Rails는 <code>store_accessor</code>, Django는 <code>HStoreField</code>.</td></tr>
        <tr><td>변경 이력에서 <strong>바뀐 필드만</strong> 기록</td><td><code>hstore(row)</code>와 <code>-</code>·<code>#=</code>로 두 행의 차이를 만들고 되돌릴 수 있다.</td></tr>
        <tr><td>단순한 키-값 읽기가 <strong>큰 값(키 수백 개)에서도 빨라야</strong> 한다</td><td>실험에서 키 500개 읽기는 hstore {fmtMs(read500.hstore.median)}, jsonb {fmtMs(read500.jsonb.median)}였다(행 1000개). hstore가 압축되지 않아 풀 필요가 없기 때문이다. 대신 저장 공간이 크다.</td></tr>
      </tbody></table>
    </Section>

    <Section id="bad" title="3. 피해야 하는 경우">
      <table><thead><tr><th>상황</th><th>이유와 대안</th></tr></thead><tbody>
        <tr><td>값이 숫자·불리언이거나 배열·중첩이 있다</td><td>hstore는 text만 담는다. 비교·정렬이 문자열 기준이 된다 (<Ref to="/hstore/vs-jsonb#types">타입 차이</Ref>). → <strong>jsonb</strong></td></tr>
        <tr><td>자주 필터·정렬·조인하는 속성</td><td>열이 타입·통계·제약·B-tree를 제대로 쓴다. 식 인덱스로 버틸 수는 있지만 통계는 없다. → <strong>열로 승격</strong></td></tr>
        <tr><td>키가 수백 개이거나 자주 바뀌는 큰 맵</td><td>키 500개에서 UPDATE 1건이 WAL {fmtBytes(upd500.hstore_concat.wal_bytes_per_update.median)}를 쓴다 (EAV {fmtBytes(upd500.eav_row.wal_bytes_per_update.median)}). GIN이 있으면 {fmtBytes(upd500.hstore_concat_gin.wal_bytes_per_update.median)}. → <Ref to="/hstore/updates">갱신 비용</Ref></td></tr>
        <tr><td>같은 행을 여러 클라이언트가 자주 갱신하는 카운터</td><td>행 잠금에서 줄을 서고 처리량이 늘지 않는다 (<Ref to="/hstore/concurrency#contention">경합 실험</Ref>). → 카운터 테이블 분리 또는 Redis</td></tr>
        <tr><td>키마다 TTL이 필요하다</td><td>hstore에는 필드 단위 만료가 없다. → Redis의 필드 만료, 또는 <code>expires_at</code> 열과 정리 작업 (<Ref to="/hstore/vs-redis">비교</Ref>)</td></tr>
        <tr><td>속성에 FK·CHECK·NOT NULL 같은 제약이 필요하다</td><td>hstore 안의 키에는 제약을 걸 수 없다. → 열</td></tr>
      </tbody></table>
      <Callout kind="warn" title="jsonb가 있는데 왜 hstore인가?">
        <p>이 자료의 측정으로는 저장 크기(키 20개 이하), UPDATE 비용(키 50개 이하), GIN 인덱스 크기가 hstore와 jsonb에서 사실상 같았다. 키 5개 기준 행당 hstore {fmtBytes(exp.storage.cells[0].hs.avg_column_bytes)}, jsonb {fmtBytes(exp.storage.cells[0].jb.avg_column_bytes)}다. hstore를 고를 이유는 <strong>값이 문자열뿐임을 타입으로 강제하고 싶을 때</strong>, 이미 hstore를 쓰는 시스템을 유지할 때, 큰 맵을 압축 없이 빠르게 읽고 싶을 때 정도다. 새로 시작하면서 다른 이유가 없다면 <Ref to="/hstore/vs-jsonb">jsonb와의 차이</Ref>를 읽고 jsonb를 먼저 검토한다. 이는 Citus 블로그 등 외부 글의 일반적 권고와도 같은 방향이다.</p>
      </Callout>
    </Section>

    <Section id="compare" title="4. 한눈에 비교">
      <table><thead><tr><th></th><th>속성별 열</th><th>EAV</th><th>hstore</th><th>jsonb</th><th>Redis 해시</th></tr></thead><tbody>
        <tr><td>스키마 유연성</td><td>낮음 (DDL)</td><td>높음</td><td>높음</td><td>높음</td><td>높음</td></tr>
        <tr><td>값 타입</td><td>열마다 정확</td><td>보통 text</td><td>text만</td><td>JSON 타입</td><td>문자열만</td></tr>
        <tr><td>중첩</td><td>—</td><td>—</td><td>없음</td><td>있음</td><td>없음</td></tr>
        <tr><td>제약(FK·CHECK)</td><td>가능</td><td>일부</td><td>키 안은 불가</td><td>키 안은 불가</td><td>없음</td></tr>
        <tr><td>키 하나만 갱신</td><td>그 열만</td><td>그 행만</td><td>값 전체 재기록</td><td>값 전체 재기록</td><td>필드만</td></tr>
        <tr><td>동시 갱신 단위</td><td>행</td><td>속성 행</td><td>행</td><td>행</td><td>명령 하나(원자적)</td></tr>
        <tr><td>트랜잭션·SQL 조인</td><td>완전</td><td>완전</td><td>완전</td><td>완전</td><td>제한적</td></tr>
        <tr><td>영속성</td><td>WAL</td><td>WAL</td><td>WAL</td><td>WAL</td><td>설정에 따라 다름</td></tr>
      </tbody></table>
      <p>읽기 비교에서 참고할 수치: 행 1000개에서 키 하나를 읽을 때 키 5개 hstore는 {fmtMs(read5.hstore.median)}, jsonb는 {fmtMs(read5.jsonb.median)}였다. 행당 1마이크로초 미만이라 병목이 될 일은 드물다. 저장 크기는 {fmtNum(exp.storage.cells.length)}개 조건으로 <Ref to="/hstore/storage#footprint">저장 방식 페이지</Ref>에 있다.</p>
    </Section>
  </>
}
