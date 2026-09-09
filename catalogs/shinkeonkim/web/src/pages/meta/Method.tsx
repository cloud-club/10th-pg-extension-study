import { Link } from 'react-router-dom'
import { CodeBlock, K } from '@/components/common/Code'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { DATA } from '@/data/measurements'

const PRINCIPLES: { n: number; title: React.ReactNode; body: React.ReactNode }[] = [
  {
    n: 1,
    title: '벽시계 시간 대신 결정적 지표를 먼저 본다',
    body: (
      <>
        <K>EXPLAIN (ANALYZE, BUFFERS)</K> 의 <K>Bitmap Index Scan</K> 이 돌려준 <K>actual rows</K>,{' '}
        <K>Rows Removed by Index Recheck</K>, <K>Buffers: shared hit</K>. 같은 데이터·같은 쿼리면 실행마다 거의
        변하지 않는다. <strong>시간은 보조 지표로만 적는다.</strong>
      </>
    ),
  },
  {
    n: 2,
    title: <>난수 대신 <K>id</K> 나머지로 검색어를 주입한다</>,
    body: <>실행마다 정확히 같은 비율, 같은 물리적 배치가 나온다.</>,
  },
  {
    n: 3,
    title: '선택도를 통제 변수로 명시한다',
    body: <>실제 매치 비율을 먼저 재서 기록한다. 안 그러면 “길이 때문인가 선택도 때문인가”를 가를 수 없다.</>,
  },
  {
    n: 4,
    title: '정답 행 수를 미리 알고 설계한다',
    body: <>“인덱스가 후보를 정답까지 좁혔는가”를 판정하려면 정답을 알아야 한다.</>,
  },
  {
    n: 5,
    title: '실제로 돌려 나온 값만 적고, 쓴 인덱스도 플랜에서 읽는다',
    body: (
      <>
        추정치·기대값을 넣지 않는다. 그리고 <strong>어떤 인덱스를 썼는지도 가정하지 말고 플랜에서 읽는다</strong> —
        인덱스 두 개가 공존하면 플래너가 골라버리는데, <Link to="/fulltext/tsvector#speed">실험 06 이 실제로 그렇게
        틀렸다.</Link>
      </>
    ),
  },
  {
    n: 6,
    title: '설명되지 않는 값은 설명되지 않는다고 적는다',
    body: (
      <>
        그리고 그렇게 남겨둔 것도 다시 재본다 — <Link to="/experiments/planner">pg_bigm 실험 00</Link> 의
        “미해결” 칸은 재현 검증에서 실제로 해결됐다.
      </>
    ),
  },
  {
    n: 7,
    title: '결론을 적기 전에 두 번 돌린다',
    body: (
      <>
        이 원칙 자체가 재현성 검증에서 나왔다 — 실험 6건을 각각 두 번씩 돌려보니 <strong>GIN 기반 지표는 전부
        완전히 동일했지만, GiST 기반 지표는 재현되지 않았다.</strong>
      </>
    ),
  },
]

const REPRO_TABLE = [
  ['플랜 종류(Seq Scan / Bitmap Heap Scan)', '완전히 동일', true],
  ['GIN actual rows · Rows Removed by Index Recheck · 버퍼', '완전히 동일', true],
  ['GIN 인덱스 크기', '완전히 동일', true],
  ['조각 통계, 유사도 점수, 재현율', '완전히 동일', true],
  ['GiST 버퍼', '±5% 흔들린다 (KNN LIMIT 1 은 65~230 으로 3.5배)', false],
  ['GiST 인덱스 크기', '대체로 안정적이나 한 칸에서 10% 튀었다', false],
  ['실행 시간', '머신 부하에 따라 최대 2배', false],
] as const

const TRAPS: React.ReactNode[] = [
  <><strong><K>CREATE INDEX</K> 뒤에 <K>VACUUM</K> 을 안 하면</strong> 죽은 튜플이 인덱스에 남아 후보 수가 부풀려진다. 죽은 튜플은 가시성 검사에서 조용히 걸러지므로 <K>Rows Removed by Index Recheck</K> 에도 안 잡힌다.</>,
  <><strong><K>EXPLAIN ANALYZE</K> 노드 줄 형식이 <K>TIMING</K> 설정에 따라 다르다</strong> — <K>TIMING ON</K>: <K>(actual time=1.2..3.4 rows=200 loops=1)</K> / <K>TIMING OFF</K>: <K>(actual rows=200 loops=1)</K>.</>,
  <><strong>PostgreSQL 18 부터 <K>actual rows</K> 가 소수다</strong>(<K>rows=500.00</K>). <K>rows=[0-9]+</K> 로 파싱하면 조용히 잘린 값을 읽는다.</>,
  <><K>psql -tAc "SET ...; SELECT ..."</K> 는 <K>SET</K> 의 명령 태그까지 출력한다 → <K>| tail -1</K>.</>,
  <><K>VACUUM</K> 은 트랜잭션 블록 안에서 못 돈다 → <K>psql -c</K> 를 나눠야 한다.</>,
  <><strong>정답 행을 <K>LIKE</K> 로 골라내면 말뭉치가 섞인다</strong> → <K>id</K> 로 특정할 것.</>,
  <><K>word_similarity</K> 는 <strong>피연산자 순서가 인덱스 사용 여부를 바꾼다</strong> → <K>doc %{'>'} '검색어'</K> 여야 하고 <K>doc {'<%'} '검색어'</K> 는 <K>Seq Scan</K> 이다.</>,
  <><strong>psycopg3 는 다중 문장 + 파라미터를 거부한다</strong> — <K>SET ...; EXPLAIN ... %s</K> 가 통째로 에러가 난다.</>,
  <><strong>돌고 있는 <K>bench.sh</K> 를 편집하면 실행 중인 셸이 깨진다</strong> — bash 는 스크립트를 오프셋으로 읽어 나간다. 실제로 한 번 당했고 다시 돌려야 했다.</>,
]

export default function Method() {
  return (
    <>
      <PageHeader
        eyebrow="기록"
        title="측정 원칙과 재현"
        lede={
          <>
            <K>pg_bigm/experiments/02</K> 가 세 번째 실행에서 결과가 재현되지 않아 핵심 주장을 철회해야 했던
            경험에서 정한 것이다. <strong>원칙은 전부 실패에서 나왔다.</strong>
          </>
        }
        tags={[{ label: DATA.env.pg }, { label: DATA.env.host }, { label: '말뭉치 NSMC (CC0)' }]}
      />

      <Section id="principles" title="원칙 일곱">
        <ol className="not-prose space-y-3">
          {PRINCIPLES.map((p) => (
            <li key={p.n} className="flex gap-3.5 rounded-xl border border-border bg-card p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[12.5px] font-bold text-primary">
                {p.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{p.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="repro" title="어떤 지표가 재현되나">
        <Table>
          <THead><TR><TH>지표</TH><TH>재현성</TH></TR></THead>
          <TBody>
            {REPRO_TABLE.map(([k, v, ok]) => (
              <TR key={k}>
                <TD>{k}</TD>
                <TD className={ok ? 'text-ok' : 'text-warn'}>{v}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            <strong>GiST 인덱스 빌드가 완전히 결정적이지 않다</strong> — 데이터 삽입 순서를 고정해도 페이지 분할
            결과가 실행마다 달라진다. 그래서 GiST 수치는 <strong>범위로 적고, 자릿수 차이만 해석한다</strong> —{' '}
            <Link to="/pg-trgm/gist#determinism">직접 센 트리 구조</Link>.
          </TCaption>
        </Table>
      </Section>

      <Section id="isolation" title="인덱스 격리 — 5번 원칙을 코드로">
        <p>
          <K>LIKE</K> 는 bigm 으로도 trgm 으로도 풀 수 있어서, 둘을 함께 두면 <strong>플래너가 하나를 고른다.</strong>{' '}
          그래서 재는 쪽만 남기고 상대를 <strong>트랜잭션 안에서 치운 뒤 롤백</strong>한다 — 재생성 비용 없이
          격리된다.
        </p>
        <CodeBlock caption="lab-server/api/bench.py — 실험 스크립트도 같은 방식으로 고쳤다">{`conn.autocommit = False
try:
    for e in others:
        cur.execute(f"DROP INDEX IF EXISTS {tbl}_{e}")
    m = _explain(cur, tbl, pattern, engine)
finally:
    conn.rollback(); conn.autocommit = True

used = re.search(r"Index Scan on (\\S+)", m["plan"])
m["index_used"] = used.group(1) if used else None
m["index_ok"]   = (engine == "none" and m["index_used"] is None) or \\
                  (engine != "none" and m["index_used"] == f"{tbl}_{engine}")`}</CodeBlock>
        <Callout kind="warn" title="이 원칙은 이미 한 번 값을 냈다">
          <p>
            실험 12개를 다시 감사했더니 11개는 안전했고 <strong>실험 06 한 줄이 실제로 틀렸다.</strong> 버퍼가
            지문이 됐다 — <K>스토리</K> 줄의 옛 버퍼 22,854 는 다시 잰 trgm 값과 <strong>정확히 같고</strong>{' '}
            bigm(22,873)과는 다르다.
          </p>
        </Callout>
      </Section>

      <Section id="traps" title="실제로 걸린 함정들">
        <ul className="space-y-1.5">
          {TRAPS.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </Section>

      <Section id="corpus" title="데이터와 검색어 — 왜 이것을 골랐나">
        <h3>말뭉치</h3>
        <ul>
          <li>
            <a href="https://github.com/ko-nlp/Korpora">Korpora</a> 가 소개하는 한국어 말뭉치 중{' '}
            <a href="https://github.com/e9t/nsmc">NSMC(Naver Sentiment Movie Corpus)</a> 를 쓴다.{' '}
            <strong>CC0(퍼블릭 도메인)</strong> 이라 자동 다운로드·재배포에 제약이 없고, 로그인이나 동의 절차 없이
            raw URL 로 받을 수 있어서다. 규모는 <strong>199,993문장, 평균 35.3글자</strong>.
          </li>
          <li>
            <strong>말뭉치 파일은 커밋하지 않는다.</strong> 각 실험의 <K>bench.sh</K> 가 실행 시점에{' '}
            <K>.corpus/</K> 로 내려받아 캐시한다. 네트워크가 없으면 합성 데이터로 폴백하되,{' '}
            <strong>그 경우 결과에 반드시 “합성 데이터”라고 표시한다.</strong>
          </li>
        </ul>

        <h3>검색 대상 예시 문자열은 스터디 공용으로 통일한다</h3>
        <Table>
          <THead><TR><TH>문자열</TH><TH>글자 수</TH><TH>쓰임</TH></TR></THead>
          <TBody>
            <TR><TD><K>클라우드클럽</K></TD><TD>6</TD><TD>긴 검색어 — 두 확장 모두 잘 되는 대조군</TD></TR>
            <TR><TD><K>클둥이</K> · <K>김신건</K></TD><TD>3</TD><TD><strong>3-gram 이 조각을 만들 수 있는 최소 길이</strong></TD></TR>
            <TR><TD><K>클클</K> · <K>코아</K> · <K>신건</K> · <K>신컨</K></TD><TD>2</TD><TD><strong>3-gram 이 조각을 못 만드는 길이</strong> — 이 카탈로그의 핵심 구간</TD></TR>
          </TBody>
        </Table>
        <ul>
          <li><K>신건</K> / <K>신컨</K> 은 <strong>한 글자만 다른 오탈자 쌍</strong>이라 유사도 검색 예시로 그대로 쓴다.</li>
          <li>
            <K>클클</K> 은 <K>클라우드클럽</K> 의 부분 문자열이 <strong>아니다</strong>(<K>클</K>, <K>클럽</K> 은
            맞지만 <K>클클</K> 은 아니다) — <strong>“짧으니까 당연히 매치되겠지” 하는 직관이 틀리는 예시</strong>로 쓴다.
          </li>
          <li>
            말뭉치에 이 단어들이 원래 몇 건 들어있는지도 확인했다 — <K>신건</K> 65건, <K>코아</K> 11건, 나머지 0건.
            실험은 여기에 <strong>정해진 비율로 주입</strong>한 뒤 실제 선택도를 다시 재서 기록한다.
          </li>
        </ul>
        <Callout kind="warn" title="정답 행을 LIKE 로 골라내면 말뭉치가 섞인다">
          <p>
            <Link to="/pg-trgm/similarity">pg_trgm 실험 02</Link> 는 처음에 <K>WHERE doc LIKE '%클라%'</K> 로 정답을
            골라냈는데 말뭉치의 <K>클라스</K>·<K>클라라</K>·<K>클라이맥스</K> 가 수십 건 걸려들어 재현율 계산이
            무의미해졌다. 지금은 <strong><K>id</K> 로 특정</strong>한다.
          </p>
        </Callout>
      </Section>

      <Section id="reproduce" title="모든 숫자를 직접 재현하려면">
        <CodeBlock caption="Docker 만 있으면 된다.">{`cd catalogs/shinkeonkim/week02/bigm-vs-trgm/experiments/05-pattern-and-length
./bench.sh              # 빌드 → 적재 → 측정 → 정리까지 한 번에
ROWS=200000 ./bench.sh  # 작은 머신이면 행 수를 줄인다
./bench.sh down         # 컨테이너만 정리`}</CodeBlock>
        <p>
          말뭉치는 <a href="https://github.com/e9t/nsmc">NSMC(CC0)</a> 를 받아 <K>.corpus/</K> 에 캐시하며,
          네트워크가 없으면 합성 한국어 문장으로 자동 대체된다(그 경우 절대값은 달라지고 경향은 유지된다).
          이 사이트의 모든 수치는 <K>src/data/</K> 아래 한곳에 모여 있고, <strong>실제로 스크립트를 돌려 나온
          값만</strong> 들어간다.
        </p>
        <Table>
          <THead><TR><TH>항목</TH><TH>값</TH></TR></THead>
          <TBody>
            <TR><TD>PostgreSQL</TD><TD>{DATA.env.pg}</TD></TR>
            <TR><TD>확장</TD><TD>{DATA.env.bigm} · {DATA.env.trgm}</TD></TR>
            <TR><TD>호스트</TD><TD>{DATA.env.host}</TD></TR>
            <TR><TD>말뭉치</TD><TD><a href={DATA.env.corpusUrl}>{DATA.env.corpus}</a></TD></TR>
          </TBody>
        </Table>
      </Section>
    </>
  )
}
