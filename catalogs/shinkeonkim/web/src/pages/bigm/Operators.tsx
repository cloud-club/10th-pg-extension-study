import { Link } from 'react-router-dom'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { SupportCell } from '@/components/common/SupportCell'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { CHOOSE_BY_FEATURE, DIRECTION_TRAP, OP_ENV, OP_ROWS } from '@/data/operators'
import { nf } from '@/lib/utils'

const WHO_BADGE = { bigm: 'bigm', trgm: 'trgm', both: 'ok', neither: 'warn' } as const

export default function Operators() {
  return (
    <>
      <PageHeader
        eyebrow="pg_bigm · 실험 03"
        title="연산자 커버리지 — 애초에 되는가"
        lede={
          <>
            성능 비교는 두 확장이 같은 일을 할 수 있을 때만 의미가 있다. 그런데 <strong>할 수 있는 일 자체가 다르다.</strong>{' '}
            게다가 “지원한다”고 적힌 연산자도 실제로 인덱스를 타는지는 별개 문제다.
          </>
        }
        tags={[{ label: `${nf(OP_ENV.rows)}행` }, { label: '실험 03', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          <K>LIKE</K> 말고도 “대소문자 무시(<K>ILIKE</K>)”, “정규식(<K>~</K>)”, “비슷한 것 찾기” 같은 검색이 있습니다.
          <strong>인덱스가 그걸 전부 도와주지는 않습니다.</strong> 어떤 건 도와주고, 어떤 건 인덱스를 못 쓰고
          처음부터 끝까지 훑습니다. 이 페이지는 그걸 하나씩 실제로 돌려본 표입니다.
        </p>
      </EasyFirst>

      <Section id="matrix" title="1. 연산자 지원 행렬">
        <Table>
          <THead>
            <TR>
              <TH>조건</TH>
              <TH><Badge variant="bigm">gin_bigm_ops</Badge></TH>
              <TH><Badge variant="trgm">gin_trgm_ops</Badge></TH>
              <TH><Badge variant="trgm">gist_trgm_ops</Badge></TH>
            </TR>
          </THead>
          <TBody>
            {OP_ROWS.map((r) => (
              <TR key={r.op}>
                <TD>
                  <K>{r.op}</K>
                  {r.note && <span className="ml-1.5 text-[12px] text-muted-foreground">{r.note}</span>}
                </TD>
                <TD><SupportCell s={r.bigm} rows={OP_ENV.rows} /></TD>
                <TD><SupportCell s={r.trgm} rows={OP_ENV.rows} /></TD>
                <TD><SupportCell s={r.gist} rows={OP_ENV.rows} /></TD>
              </TR>
            ))}
          </TBody>
          <TCaption>인덱스는 한 번에 하나만 두고 쟀다. 연산자를 아예 지원하지 않아 쿼리가 에러 나는 것도 결과로 기록한다.</TCaption>
        </Table>
        <SourceNote path={OP_ENV.repo}>실험 03 · 2회 실행 동일</SourceNote>
        <Callout kind="warn" title="이 표는 “되는가”만 답한다 — “이득인가”는 다른 질문이다">
          <p>
            위 측정은 <K>enable_seqscan=off</K> 로 인덱스 경로를 <strong>강제</strong>해서 잰 것이다. 플래너를
            풀어놓고 시간·버퍼까지 재면 다른 그림이 나온다 — 특히 <K>ILIKE</K> 는{' '}
            <Link to="/experiments/ilike">실험 09</Link> 에서 따로 쟀다. 요약하면{' '}
            <strong>pg_trgm 의 <K>ILIKE</K> 는 진짜로 빠르고(38배, recheck 0), pg_bigm 은 한글 검색어에서도
            <K>ILIKE</K> 한 글자에 51배를 잃는다.</strong>
          </p>
        </Callout>

        <h3>(a) pg_bigm 은 LIKE 와 =% 두 가지만 한다</h3>
        <p><K>ILIKE</K>, 정규식, <K>=</K> 모두 <K>Seq Scan</K> 이다. 표면적이 좁다는 것이 숫자로 확인된다.</p>
        <Callout kind="ok" title="공식 문서도 같은 말을 한다 — 실측과 어긋나지 않는다">
          <p>
            <a href="https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md">pg_bigm 공식 문서</a>의
            비교표는 이용 가능한 텍스트 검색 연산자를 pg_bigm 은 <em>“LIKE only”</em>, pg_trgm 은{' '}
            <em>“LIKE (~~), ILIKE (~~*), ~, ~*”</em> 로 적는다.{' '}
            <a href="https://www.postgresql.org/docs/16/pgtrgm.html">pg_trgm 공식 문서</a>도{' '}
            <em>“additionally support trigram-based index searches for <K>LIKE</K>, <K>ILIKE</K>, <K>~</K>,{' '}
            <K>~*</K> and <K>=</K> queries”</em> 라고 적는다. <strong>연산자 카탈로그(<K>pg_amop</K>)를 직접 읽은
            결과도 같다</strong> — <K>gin_bigm_ops</K> 에는 <K>~~</K> 와 <K>=%</K> 둘뿐이고, <K>gin_trgm_ops</K> 에는
            8개 전략이 등록돼 있다.
          </p>
        </Callout>

        <h3>(b) pg_trgm 은 전부 되지만, 두 칸에서 “된다”가 함정이다</h3>
        <p>
          <K>LIKE '%클클%'</K> 와 <K>~ '클라우드클럽'</K> 이 <K>Index Cond</K> 를 달고 있으면서{' '}
          <strong>후보로 테이블 전체({nf(OP_ENV.rows)}행)를 올린다.</strong>{' '}
          <Link to="/foundations/gin#search-mode-all"><K>GIN_SEARCH_MODE_ALL</K></Link> 상태다.
        </p>
        <Callout kind="warn">
          <p>
            <strong>표에서 “인덱스 사용”만 보면 안 되는 이유가 이것이다.</strong> 반드시 <strong>후보 행 수</strong>를
            함께 봐야 한다.
          </p>
        </Callout>

        <h3>(c) <K>= '클둥이'</K> 를 pg_trgm 만 인덱스로 처리한다</h3>
        <p>
          pg_trgm 1.6(PostgreSQL 14)에서 연산자 패밀리에 <K>OPERATOR 11 =</K> 이 추가됐기 때문이다. 실용성은
          낮지만(B-tree 가 훨씬 낫다), 이미 trgm 인덱스가 있는 컬럼에 동등 비교가 섞여 들어올 때 별도 인덱스 없이
          처리된다는 의미는 있다.
        </p>

        <h3>(d) KNN 은 GiST 만 가능하다</h3>
        <p><K>pg_bigm</K> 에는 <K>{'<->'}</K> 에 대응하는 연산자가 없어서 쿼리 자체를 쓸 수 없다 — <Link to="/pg-trgm/gist">GIN vs GiST</Link>.</p>
      </Section>

      <Section id="direction" title="2. 함정 — 피연산자 순서가 인덱스 사용을 바꾼다">
        <p>
          처음에 <K>doc {'<%'} '클라우드클럽'</K> 로 재봤더니 <K>Seq Scan</K> 이 나왔다. 연산자를 지원하지 않는 줄
          알았는데, <strong>쓰는 방향이 틀렸던 것</strong>이다.
        </p>
        <Table>
          <THead><TR><TH>쿼리</TH><TH>GIN</TH><TH>GiST</TH></TR></THead>
          <TBody>
            {DIRECTION_TRAP.map((r) => (
              <TR key={r.q}>
                <TD><K>{r.q}</K></TD>
                <TD className={r.ok ? 'text-ok' : 'text-trgm'}>{r.gin}</TD>
                <TD>{r.gist}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p>이유가 두 가지 겹쳐 있다.</p>
        <ol>
          <li>
            <strong>의미</strong>: <K>word_similarity(a, b)</K> 는 “a 가 b 의 <strong>어떤 부분</strong>과 얼마나
            닮았나”다. 문서에서 검색어를 찾으려면 <K>'검색어' {'<%'} doc</K> 가 의미상 맞다.
          </li>
          <li>
            <strong>인덱스</strong>: <K>pg_trgm</K> 1.2 는 연산자 패밀리에 <strong><K>%{'>'}</K> 만</strong> 등록했다.
            인덱스를 타려면 인덱스 컬럼이 왼쪽에 와야 하므로 <K>doc %{'>'} '검색어'</K> 형태여야 하고,{' '}
            <K>'검색어' {'<%'} doc</K> 는 플래너가 교환해 그 형태로 만들어준다.
          </li>
        </ol>
        <Callout kind="warn">
          <p>
            <K>doc {'<%'} '검색어'</K> 는 <strong>의미도 다르고 인덱스도 안 탄다</strong> — 두 가지가 동시에 틀리는데
            에러는 안 나므로 발견하기 어렵다.
          </p>
        </Callout>
      </Section>

      <Section id="choose" title="3. 기능으로 고르는 표">
        <Table>
          <THead><TR><TH>필요한 것</TH><TH>답</TH></TR></THead>
          <TBody>
            {CHOOSE_BY_FEATURE.map((r) => (
              <TR key={r.need}>
                <TD>{r.need}</TD>
                <TD>
                  <Badge variant={WHO_BADGE[r.who]}>{r.answer.split(' — ')[0]}</Badge>
                  {r.answer.includes(' — ') && (
                    <span className="ml-2 text-[12.5px] text-muted-foreground">{r.answer.split(' — ')[1]}</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="limits" title="한계">
        <ul>
          <li>100,000행 한 규모, 한국어 말뭉치 하나로만 쟀다.</li>
          <li>후보 행 수만 보고 실행 시간은 재지 않았다 — 시간 비교는 <Link to="/experiments/length-selectivity">실험 01</Link> 에 있다.</li>
          <li><K>strict_word_similarity</K> 는 점수와 인덱스 사용 여부만 봤고 성능(버퍼·시간)은 재지 않았다.</li>
          <li><K>ILIKE</K> 가 <K>pg_bigm</K> 에서 인덱스를 안 탄다는 것은 이 환경(PostgreSQL 16 / pg_bigm <K>v1.2-20250903</K>)에서의 관측이다 — 다만 공식 문서와도 일치한다.</li>
        </ul>
      </Section>
    </>
  )
}
