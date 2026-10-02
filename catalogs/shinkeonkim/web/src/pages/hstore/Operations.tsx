import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Callout } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { demo } from './stats'

export default function Operations() {
  return <>
    <PageHeader eyebrow="Week 04 · 운영" title="관리형 DB, 이전, ORM, 모니터링"
      lede="hstore는 shared_preload_libraries가 필요 없는 가벼운 확장이라 도입 장벽은 낮다. 운영에서 신경 쓸 것은 서비스별 지원 버전, 업그레이드, ORM의 타입 변환, 그리고 값이 커질 때의 부풀음(bloat)과 통계다." />

    <Section id="managed" title="1. 관리형 PostgreSQL 지원 현황 (2026-09-21 확인)">
      <table><thead><tr><th>서비스</th><th>지원</th><th>hstore 버전</th><th>확인 근거</th></tr></thead><tbody>
        <tr><td>AWS RDS for PostgreSQL</td><td>○</td><td>PostgreSQL 16~19에서 1.8</td><td>AWS 확장 버전 표. <code>CREATE EXTENSION hstore</code></td></tr>
        <tr><td>Azure Database for PostgreSQL 유연 서버</td><td>○</td><td>PG 14~18에서 1.8 (PG 13은 1.7, 12는 1.6, 11은 1.5)</td><td>Microsoft Learn 확장 목록</td></tr>
        <tr><td>Google Cloud SQL for PostgreSQL</td><td>○</td><td>PG 14 이상 1.8</td><td>Cloud SQL 확장 문서</td></tr>
        <tr><td>Neon</td><td>○</td><td>PG 16·17에서 1.8</td><td>Neon 확장 문서</td></tr>
        <tr><td>Supabase</td><td>확인 못 함</td><td>—</td><td>공식 문서에서 hstore 항목을 찾지 못했다. 대시보드의 확장 목록에서 확인해야 한다</td></tr>
      </tbody></table>
      <p>Aurora PostgreSQL은 RDS 확장 표에 함께 있는 호환 서비스이나 별도로 확인하지 않았다. 표의 링크와 확인 내용은 <Ref to="/hstore/resources#managed">참고 자료</Ref>에 있다. 지원 현황은 바뀌므로 도입 전 각 서비스 문서를 다시 확인한다.</p>
      <Callout kind="info" title="권한과 설정">
        <p>hstore는 <strong>trusted</strong> 확장이라 DB에 CREATE 권한이 있는 사용자면 슈퍼유저 없이도 설치할 수 있다(<Ref to="/hstore/trusted">trusted 확장이란</Ref>). 재시작·<code>shared_preload_libraries</code>·파라미터 그룹 변경이 필요 없다는 점이 pg_cron·pg_stat_statements(<Ref to="/pg-cron/shared-preload-libraries">preload가 필요한 확장</Ref>)와 다르다.</p>
      </Callout>
    </Section>

    <Section id="upgrade" title="2. 업그레이드와 이전">
      <table><thead><tr><th>상황</th><th>알아둘 점</th></tr></thead><tbody>
        <tr><td><code>pg_dump</code> / 복원</td><td>덤프에는 <code>CREATE EXTENSION hstore</code>가 들어가고 데이터는 텍스트 표현으로 옮겨진다. 대상 서버에 hstore가 <strong>설치 가능해야</strong> 한다.</td></tr>
        <tr><td>확장 버전 올리기</td><td><code>ALTER EXTENSION hstore UPDATE</code>. 1.7 → 1.8은 첨자 지원 추가와 <code>@</code>·<code>~</code> 연산자 제거다 (<code>hstore--1.7--1.8.sql</code>).</td></tr>
        <tr><td>옛 저장 형식(PostgreSQL 9.0 이전)</td><td>공식 문서: 옛 형식 데이터를 읽을 수는 있으나 새 코드로 수정되지 않은 값은 약간 느리다. <code>UPDATE t SET h = h || ''</code>로 새 형식으로 다시 쓸 수 있다.</td></tr>
        <tr><td>jsonb·열로 옮기기</td><td>hstore → jsonb는 <code>hstore_to_jsonb</code>, 열 승격은 아래 4절.</td></tr>
      </tbody></table>
    </Section>

    <Section id="orm" title="3. ORM과 드라이버">
      <table><thead><tr><th>환경</th><th>지원</th><th>주의</th></tr></thead><tbody>
        <tr><td>Rails (ActiveRecord)</td><td><code>hstore</code> 컬럼 타입, <code>store_accessor</code>로 키를 속성처럼 접근</td><td>값은 문자열로 캐스팅된다. 숫자·불리언은 직접 변환하거나 접근자 타입을 지정하는 gem을 쓴다</td></tr>
        <tr><td>Django</td><td><code>django.contrib.postgres.fields.HStoreField</code></td><td>값이 문자열로 저장된다. 마이그레이션에 hstore 확장 생성이 필요하다</td></tr>
        <tr><td>기타</td><td>드라이버마다 hstore를 map으로 다루는 방식이 다르다</td><td>사용하는 드라이버 문서를 확인한다. 이 자료에서는 검증하지 않았다</td></tr>
      </tbody></table>
      <p>ORM이 읽어 수정해서 저장하는 모델 객체 패턴은 <Ref to="/hstore/concurrency#lost">동시성 페이지</Ref>의 유실 갱신과 정확히 같은 구조다. 카운터·집합성 키는 ORM의 저장 대신 원자적 UPDATE를 직접 쓴다.</p>
    </Section>

    <Section id="promote" title="4. 자주 쓰는 키는 열로 승격한다">
      <p>필터·정렬·조인에 자주 쓰이거나 자주 바뀌는 키는 열이 낫다. 승격은 복사하고 hstore에서 빼면 된다.</p>
      <CodeBlock language="sql">{demo.ops_promote_setup}</CodeBlock>
      <CodeBlock language="sql" output={demo.ops_promote.output} outputCaption="실제 실행 결과 · 앞 5행만 승격했다">{demo.ops_promote.sql}</CodeBlock>
      <p>실서비스에서는 배치로 나눠 실행하고(값 전체 재기록이므로 한 번에 큰 UPDATE는 WAL과 bloat가 크다), 앱이 새 열을 먼저 읽도록 배포한 뒤 hstore의 키를 제거한다.</p>
    </Section>

    <Section id="stats" title="5. 통계: 키별 통계가 없다">
      <p>hstore 컬럼에는 <strong>키·값별 통계가 없다</strong>. ANALYZE는 컬럼 전체 값 단위로만 통계를 모으고, <code>@&gt;</code>·<code>?</code>의 선택도는 <code>matchingsel</code>(hstore 1.7에서 지정)이 그 통계에 연산자를 적용해 추정한다. 어느 키가 얼마나 흔한지 직접 알 수는 없다. 이 데이터에서 추정과 실제가 얼마나 맞는지 직접 봤다 (<code>rows=</code>가 추정, <code>actual rows=</code>가 실제).</p>
      <p>앞 페이지에서 만든 GiST 인덱스를 지우고(GIN과 식 인덱스만 남긴다) 실행했다.</p>
      <CodeBlock language="sql">{demo.ops_cleanup}</CodeBlock>
      <CodeBlock language="sql" output={demo.ops_estimate_contains.output} outputCaption="? 와 @> 의 추정 행 수와 실제 행 수 · 실제 실행 결과">{demo.ops_estimate_contains.sql}</CodeBlock>
      <p>이 출력에서 <code>@&gt;</code> 두 개는 추정이 실제와 같은 자릿수였지만, 키 <code>promo</code>(전체의 0.1%)의 존재 검사(<code>?</code>)는 자릿수가 틀렸다. 추정은 ANALYZE가 뽑은 표본에 따라 <strong>실행마다 달라질 수 있고 과대·과소의 방향도 보장되지 않는다</strong>. 그래서 ‘맞을 것’이라고 기대하지 말고 중요한 쿼리는 <code>EXPLAIN ANALYZE</code>로 직접 확인한다.</p>
      <h3>식 인덱스는 ANALYZE 이후에 통계가 생긴다</h3>
      <CodeBlock language="sql" output={demo.ops_estimate_expr_before.output} outputCaption="식 인덱스를 만든 직후 · 실제 실행 결과">{demo.ops_estimate_expr_before.sql}</CodeBlock>
      <CodeBlock language="sql">{demo.ops_analyze}</CodeBlock>
      <CodeBlock language="sql" output={demo.ops_estimate_expr_after.output} outputCaption="ANALYZE 뒤 · 실제 실행 결과">{demo.ops_estimate_expr_after.sql}</CodeBlock>
      <p>식 인덱스를 만든 직후에는 그 식의 통계가 없어 기본 추정값(위 결과의 <code>rows=</code>)이 실제와 몇 배 어긋난다. <strong>ANALYZE를 실행하면</strong> 식 값의 분포가 수집되어 추정이 실제와 거의 같아진다. 식 인덱스를 새로 만든 뒤에는 ANALYZE를 실행하는 습관이 필요하다.</p>
    </Section>

    <Section id="monitor" title="6. 모니터링 질의">
      <p>값이 커지면 TOAST와 죽은 튜플, HOT 비율이 문제의 신호가 된다.</p>
      <CodeBlock language="sql" output={demo.ops_monitor.output} outputCaption="테이블·TOAST 크기, 죽은 튜플, HOT 갱신 비율 · 실제 실행 결과 (이 예제 테이블은 갱신이 없어 HOT이 비어 있다)">{demo.ops_monitor.sql}</CodeBlock>
      <CodeBlock language="sql" output={demo.ops_key_width.output} outputCaption="hstore 값의 저장 크기와 키 개수 분포 · 실제 실행 결과">{demo.ops_key_width.sql}</CodeBlock>
      <table><thead><tr><th>신호</th><th>의미와 조치</th></tr></thead><tbody>
        <tr><td><code>pg_column_size(attrs)</code>의 중앙값이 2KB에 근접·초과</td><td>TOAST로 나가기 시작한다. <Ref to="/hstore/updates">갱신 비용</Ref>이 급격히 커진다.</td></tr>
        <tr><td>HOT 비율(<code>n_tup_hot_upd / n_tup_upd</code>) 하락</td><td>값이 커졌거나 GIN 등 인덱스 열이 바뀌고 있다. <code>fillfactor</code> 조정·키 분리를 검토한다.</td></tr>
        <tr><td><code>n_dead_tup</code> 증가와 테이블·TOAST 크기 증가</td><td>autovacuum이 못 따라간다. TOAST 테이블의 통계는 <code>pg_stat_all_tables</code>에서 따로 본다.</td></tr>
        <tr><td>GIN 삽입·갱신 지연</td><td>인덱스 유지 비용. 자주 바뀌는 키를 hstore에서 빼는 방법이 가장 효과적이었다 (실험 02).</td></tr>
      </tbody></table>
    </Section>

    <Section id="security" title="7. 보안과 호환성 메모">
      <ul>
        <li>공식 문서: hstore와 함께 쓰는 <strong>transform 확장</strong>(hstore_plpython 등)은 hstore와 같은 스키마에 설치하라고 권고한다. 다른 스키마에 두면 적대적 사용자가 만든 객체를 통한 설치 시점 위험이 생길 수 있다.</li>
        <li>키·값은 이스케이프 없는 문자열이 아니라 <strong>파라미터로</strong> 전달한다. 리터럴을 SQL 문자열에 이어 붙이면 큰따옴표·백슬래시 처리가 SQL 인젝션과 데이터 손상의 원인이 된다. 드라이버의 파라미터 바인딩 또는 <code>hstore(text[], text[])</code>를 쓴다.</li>
        <li><code>||</code>·<code>-</code>·<code>#=</code>는 요청 본문 전체를 그대로 저장소에 병합하는 용도로 쓰지 않는다. 허용할 키를 서버가 정한다.</li>
      </ul>
    </Section>
  </>
}
