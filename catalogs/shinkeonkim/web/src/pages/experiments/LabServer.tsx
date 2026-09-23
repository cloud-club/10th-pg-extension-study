import { CodeBlock, K } from '@/components/common/Code'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'

export default function LabServer() {
  return (
    <>
      <PageHeader
        eyebrow="실험 서버"
        title="직접 돌려보기"
        lede={
          <>
            이 사이트의 숫자는 <strong>미리 정해둔 조건</strong>을 잰 것이다. <strong>조건을 바꿔가며 그 자리에서
            재고 싶다면</strong> 실험 서버를 띄운다 — 검색어·패턴·행 수·PG 버전을 골라 돌리면 결과가 표와 차트로 나온다.
          </>
        }
        tags={[{ label: 'FastAPI + psycopg3' }, { label: 'PG 16 · 17 · 18' }]}
      />

      <EasyFirst>
        <p>
          실험이 오래 걸릴 수 있어서 <strong>작업을 큐에 넣고 비동기로 돌립니다.</strong> 브라우저를 닫아도 계속
          돌고, 다시 열면 상태가 그대로 보입니다.
        </p>
      </EasyFirst>

      <Section id="run" title="띄우기">
        <CodeBlock caption="Docker 만 있으면 된다.">{`cd catalogs/shinkeonkim/week02/lab-server
./run.sh              # 빌드 + 기동  →  http://localhost:8000
./run.sh logs         # 로그
./run.sh down         # 정리`}</CodeBlock>
        <p>
          <K>PG_VERSIONS</K> 환경변수로 띄울 버전을 고른다(기본 <K>16,17,18</K>). PostgreSQL 19 는 pg_bigm 이
          빌드되지 않아 뺐다.
        </p>
      </Section>

      <Section id="what" title="무엇을 고를 수 있나">
        <Table>
          <THead><TR><TH>변인</TH><TH>고를 수 있는 값</TH></TR></THead>
          <TBody>
            <TR><TD>PostgreSQL 버전</TD><TD>16 · 17 · 18 (동시 선택 가능)</TD></TR>
            <TR><TD>엔진</TD><TD>인덱스 없음 · <K>gin_bigm_ops</K> · <K>gin_trgm_ops</K></TD></TR>
            <TR><TD>검색어</TD><TD>자유 입력 (길이 제한 없음)</TD></TR>
            <TR><TD>패턴</TD><TD><K>%X%</K> · <K>X%</K> · <K>%X</K> · <K>% X %</K></TD></TR>
            <TR><TD>행 수</TD><TD>1만 ~ 200만</TD></TR>
          </TBody>
          <TCaption>결과에는 플랜·후보 행·recheck 제거·버퍼·실행 시간과 <strong>“실제로 쓴 인덱스”</strong>가 함께 나온다.</TCaption>
        </Table>
      </Section>

      <Section id="pitfalls" title="만들면서 걸린 함정 셋">
        <ol>
          <li>
            <strong>인덱스 두 개가 공존하면 플래너가 하나를 골라버린다.</strong> trgm 2글자가 멀쩡해 보였는데
            실제로는 bigm 을 타고 있었다. 지금은 <strong>상대 인덱스를 트랜잭션 안에서 치우고 재고 롤백</strong>하며,
            플랜에서 <K>Index Scan on</K> 을 읽어 검증 열에 기록한다. 이 발견이 기존 실험 12개의 재감사로
            이어졌고 <strong>실험 06 한 줄이 실제로 틀렸다</strong>는 것을 찾아냈다.
          </li>
          <li>
            <strong>psycopg3 는 다중 문장 + 파라미터를 거부한다.</strong> <K>SET ...; EXPLAIN ... %s</K> 가 통째로
            에러가 난다 — <K>execute()</K> 를 나눠야 한다.
          </li>
          <li>
            <strong>재시작하면 <K>CREATE INDEX</K> 가 경쟁한다.</strong> 중단된 작업을 다시 큐에 넣는 순간 워커
            둘이 같은 인덱스를 만들려다 <K>UniqueViolation</K> 이 났다.{' '}
            <K>pg_advisory_lock(hashtext(name))</K> + <K>IF NOT EXISTS</K> + <K>indisvalid</K> 확인으로 막았다.
          </li>
        </ol>
        <Callout kind="info" title="구조">
          <p>
            FastAPI + psycopg3, 작업 큐는 SQLite. 워커는 asyncio 루프 하나이고, 재시작하면 <K>running</K> 상태로
            남은 작업을 <K>pending</K> 으로 되돌린다. 정적 UI 는 의존성 없는 순수 JS 한 장이다.
          </p>
          <CodeBlock>{`week02/lab-server/
  Dockerfile.pg        # PGVER/PGTAG 로 pg_bigm 을 버전별로 빌드
  docker-compose.yml   # pg16 · pg17 · pg18 + api
  api/
    main.py            # 엔드포인트 + 워커 루프
    bench.py           # 측정 코어 (인덱스 격리 · 플랜 검증)
    store.py           # SQLite 큐
    static/            # 화면`}</CodeBlock>
        </Callout>
      </Section>
    </>
  )
}
