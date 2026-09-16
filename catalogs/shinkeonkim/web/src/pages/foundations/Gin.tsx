import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Diagram } from '@/components/viz/Diagram'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { BY_LENGTH, CHAIN, EXTRACT_VALUE, ONE_CHAR, ONECHAR_ENV, OPCLASS } from '@/data/onechar'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const TW = DATA.e05.twoChar
const BG = DATA.e05.twoCharBigm

export default function Gin() {
  return (
    <>
      <PageHeader
        eyebrow="기초 개념"
        title="GIN 인덱스 — 결국 전부 이것이다"
        lede={
          <>
            <K>pg_bigm</K>·<K>pg_trgm</K>·전문검색이 전부 GIN 위에 얹혀 있다. 확장이 하는 일은{' '}
            <strong>“문자열을 조각으로 분해하는 함수”를 GIN 에 등록하는 것</strong>뿐이고, 자료구조는 전부 코어가 갖고 있다.
          </>
        }
        tags={[{ label: '이 사이트에서 가장 어려운 페이지', variant: 'warn' }]}
      />

      <EasyFirst>
        <p>
          앞 페이지들에서 <strong>“글자를 쪼개 찾아보기에 넣는다”</strong>고 했습니다. 그{' '}
          <strong>찾아보기를 실제로 만들어 주는 것</strong>이 GIN 입니다. 보통 인덱스는{' '}
          <strong>행 하나 → 값 하나</strong>인데(“3번 상품의 이름은 클라우드클럽”), 조각으로 쪼개면{' '}
          <strong>행 하나가 값을 여러 개</strong> 만듭니다(“3번 상품은 클라·라우·우드·드클·클럽 을 갖고 있다”).{' '}
          <strong>그 뒤집힌 상황을 위한 인덱스가 GIN</strong> 입니다.
        </p>
        <p>
          <Link to="/foundations/ngram">n-gram</Link> 을 먼저 보고 오는 편이 낫고, 용어가 막히면{' '}
          <Link to="/start/glossary">용어 사전</Link>을 보세요.
        </p>
      </EasyFirst>

      <Section id="all-gin" title="0. 그래서 결국 다 GIN 인가">
        <Callout kind="ok">
          <p>
            <strong>그렇다.</strong> 두 확장의 성능 차이는 <strong>“어떤 조각을 만들어 주느냐”</strong> 하나에서 갈린다.
            트리·포스팅 리스트·펜딩 리스트·Recheck 흐름은 전부 PostgreSQL 코어의 것이다.
          </p>
        </Callout>
        <Table>
          <THead><TR><TH>확장 / 타입</TH><TH>행 하나가 만드는 키</TH><TH>등록하는 함수</TH></TR></THead>
          <TBody>
            <TR><TD>B-tree on <K>text</K></TD><TD><strong>1개</strong> — 값 그 자체</TD><TD>—</TD></TR>
            <TR><TD><K>text[]</K> (코어)</TD><TD>배열 원소 수</TD><TD><K>array_ops</K></TD></TR>
            <TR><TD><K>jsonb</K> (코어)</TD><TD>키/값 쌍 수</TD><TD><K>jsonb_ops</K></TD></TR>
            <TR><TD><Badge variant="tsv">tsvector</Badge> (코어)</TD><TD>어휘소 수</TD><TD><K>tsvector_ops</K></TD></TR>
            <TR><TD><Badge variant="bigm">pg_bigm</Badge></TD><TD><strong>글자 수 + 1</strong></TD><TD><K>gin_bigm_ops</K></TD></TR>
            <TR><TD><Badge variant="trgm">pg_trgm</Badge></TD><TD><strong>글자 수 + 1</strong></TD><TD><K>gin_trgm_ops</K></TD></TR>
          </TBody>
        </Table>
        <p>
          <strong>GIN = <u>G</u>eneralized <u>In</u>verted Index.</strong> “값 하나가 여러 개의 검색 가능한 조각으로
          분해되는” 상황을 위한 일반화된 역인덱스다. B-tree 의 전제(행 하나 → 키 하나)가 뒤집힌 자리에 GIN 이 온다.
        </p>
        <CodeBlock caption="GIN 이 확장에 요구하는 함수 (gin-extensibility)">{`extractValue()     -- 저장할 값을 키 배열로 분해     ← gin_extract_value_bigm()
extractQuery()     -- 질의를 키 배열로 분해         ← gin_extract_query_bigm()
consistent()       -- "이 키들이 있으면 매칭인가?"  ← 확장이 판정한다
comparePartial()   -- 접두어 매칭 (선택)            ← pg_bigm 에만 있다`}</CodeBlock>
      </Section>

      <Section id="structure" title="1. 구조 — 세 층">
        <Clotho
          id="gin-structure"
          caption={
            <>
              장이 바뀔 때마다 카메라가 그 층으로 옮겨간다. 2장의 “키가 정렬돼 있다 = 접두어 구간 탐색이
              가능하다”가 왜 그런지는 아래{' '}
              <Ref to="#sorted">정렬돼 있으면 왜 1글자 검색이 되나</Ref> 에서 카탈로그를 직접 읽어 확인한다.
            </>
          }
        />
        <Diagram
          chart={`
flowchart TB
  subgraph ENTRY["① 엔트리 트리 (B-tree) — 키를 정렬해 담는다"]
    direction LR
    e1["'␣클'"] --- e2["'드클'"] --- e3["'라우'"] --- e4["'클라'"] --- e5["'클럽'"] --- e6["…"]
  end
  ENTRY --> rare["② 포스팅 리스트<br/>엔트리 옆에 인라인<br/>varbyte 델타 압축<br/><br/>드문 키"]
  ENTRY --> common["② 포스팅 트리<br/>별도 B-tree<br/><br/>흔한 키 — TID 가<br/>한 페이지에 안 들어갈 때"]
  PEND["③ 펜딩 리스트<br/>아직 본체에 병합되지 않은 최근 INSERT (FASTUPDATE)"]
  PEND -. "VACUUM · 한도 초과 · gin_clean_pending_list()" .-> ENTRY
  classDef key fill:#1e293b,stroke:#60a5fa,color:#e2e8f0
  classDef post fill:#134e4a,stroke:#34d399,color:#d1fae5
  classDef big fill:#422006,stroke:#fbbf24,color:#fef3c7
  class e1,e2,e3,e4,e5,e6 key
  class rare post
  class common,PEND big
`}
          caption="세 층이 한 인덱스 안에 있다. 용량은 ①(유니크 조각 수 — 고정비)과 ②(총 조각 수 — 압축된 변동비)로 나뉘고, ③ 은 쓰기를 미뤄 모으는 완충 장치다."
        />

        <h3>① 엔트리 트리 — 그냥 B-tree 다</h3>
        <p>키(= 조각)를 <strong>정렬해서</strong> 담는 B-tree다. 여기서 이 카탈로그의 핵심 차이 하나가 나온다.</p>
        <Callout kind="ok" title="엔트리가 정렬돼 있으므로 접두어 구간 탐색이 가능하다">
          <p>
            <K>pg_bigm</K> 은 조각을 <strong>원본 바이트 그대로</strong> 저장하니 엔트리가 사전순이고, 그래서{' '}
            <K>comparePartial()</K> 을 등록해 “<K>클</K> 로 시작하는 모든 2-gram”을 구간으로 훑을 수 있다 —{' '}
            <strong>1글자 검색이 인덱스를 타는 근거가 이것이다.</strong> <K>pg_trgm</K> 은 조각을{' '}
            <strong>CRC32 로 해싱</strong>해 <K>int32</K> 로 저장하므로(3바이트 고정 배열에 9바이트 한글 조각을 담을 수
            없다) 해시값 순서가 원문 순서와 무관해 접두어 구간이 성립하지 않는다.
          </p>
        </Callout>

        <h3 id="sorted">정렬돼 있으면 왜 1글자 검색이 되나</h3>
        <p>
          <K>pg_bigm</K> 은 두 글자씩 자르니 <strong>한 글자짜리 검색어로는 조각을 만들 수 없다.</strong> 그런데도
          인덱스를 탄다. 조각을 하나 넘기는 대신 <strong>“<K>클</K> 로 시작하는 조각을 전부 가져와라”</strong> 라고
          넘기기 때문이다. 그게 가능한 사슬을 한 칸씩 따라가면 이렇다.
        </p>
        <ol className="not-prose my-5 space-y-2">
          {CHAIN.map((c, i) => (
            <li key={i} className="flex gap-3.5 rounded-xl border border-border bg-card px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[11.5px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{c.step}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{c.evidence}</p>
              </div>
            </li>
          ))}
        </ol>

        <h4>먼저 흔한 오해 하나를 걷어낸다</h4>
        <p>
          <K>show_bigm('클')</K> 과 <K>show_trgm('클')</K> 은 <strong>둘 다 조각을 돌려준다.</strong> 1글자짜리{' '}
          <em>낱말</em> 이면 앞뒤에 패딩을 붙일 수 있어서다.
        </p>
        <Table>
          <THead><TR><TH>입력</TH><TH>show_bigm</TH><TH>show_trgm</TH></TR></THead>
          <TBody>
            {EXTRACT_VALUE.map((e) => (
              <TR key={e.src}>
                <TD><K>{e.src}</K></TD>
                <TD className="font-mono text-[12.5px]">{e.bigm.map((f) => f.replace(/ /g, '␣')).join(' · ')}</TD>
                <TD className="text-muted-foreground">해시 {e.trgmCount}개 (CRC32 라 눈으로 못 읽는다)</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            이 함수들은 <strong>색인하는 쪽</strong>(<K>extractValue</K>)이다. 갈리는 것은{' '}
            <strong>질의하는 쪽</strong>(<K>extractQuery</K>) 이다.
          </TCaption>
        </Table>
        <Table>
          <THead><TR><TH></TH><TH><K>LIKE '%클%'</K> 이 질의로 만드는 것</TH></TR></THead>
          <TBody>
            <TR>
              <TD><Badge variant="trgm">pg_trgm</Badge></TD>
              <TD><strong>없다.</strong> 양옆이 <K>%</K> 라 패딩을 못 붙이고 3글자를 못 채운다 → <Ref to="#search-mode-all"><K>GIN_SEARCH_MODE_ALL</K></Ref></TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">pg_bigm</Badge></TD>
              <TD>조각 대신 <strong><K>클</K> 을 부분 일치(partial match) 키로</strong> 넘긴다</TD>
            </TR>
          </TBody>
        </Table>

        <h4>그 부분 일치가 가능한 이유 — 카탈로그를 직접 읽었다</h4>
        <CodeBlock>{`SELECT o.opcname,
       coalesce(kt.typname, it.typname || ' (opckeytype=0)') AS 엔트리_타입,
       (SELECT string_agg(ap.amproc::text, ', ')
        FROM pg_amproc ap
        WHERE ap.amprocfamily = o.opcfamily AND ap.amprocnum = 5) AS compare_partial
FROM pg_opclass o
JOIN pg_type it ON it.oid = o.opcintype
LEFT JOIN pg_type kt ON kt.oid = o.opckeytype
WHERE o.opcname IN ('gin_bigm_ops','gin_trgm_ops');`}</CodeBlock>
        <Table>
          <THead><TR><TH>연산자 클래스</TH><TH>엔트리 타입</TH><TH>엔트리 트리의 정렬</TH><TH><K>comparePartial</K> (지원 함수 5번)</TH></TR></THead>
          <TBody>
            {OPCLASS.map((o) => (
              <TR key={o.name}>
                <TD><K>{o.name}</K></TD>
                <TD className={o.entryType === 'text' ? 'text-ok' : ''}>
                  <strong>{o.entryType}</strong>
                  <span className="ml-1.5 text-[12px] text-muted-foreground">{o.entryNote}</span>
                </TD>
                <TD>{o.sorted}</TD>
                <TD className={o.comparePartial ? 'text-ok' : 'text-trgm'}>
                  {o.comparePartial ? <code className="text-[12px]">{o.comparePartial}</code> : '없음'}
                </TD>
              </TR>
            ))}
          </TBody>
          <TCaption>두 칸이 사슬의 양 끝이다 — 엔트리 타입이 정렬 순서를 정하고, 정렬 순서가 구간 탐색의 가능 여부를 정한다.</TCaption>
        </Table>
        <Diagram
          maxWidth={540}
          chart={`
flowchart TD
  subgraph T["엔트리 트리 (사전순)"]
    direction TB
    a["…"] --> b["'클␣'"] --> c["'클가'"] --> d["'클나'"] --> e["…"] --> f["'클힣'"] --> g["'킁…'"] --> h["…"]
  end
  q(["질의 '클' — 부분 일치 키"]) -.-> b
  cp(["comparePartial 이<br/>'여기까지' 를 판정한다"]) -.-> f
  classDef hit fill:#1e3a8a,stroke:#60a5fa,color:#dbeafe
  classDef out fill:#0f172a,stroke:#334155,color:#94a3b8
  class b,c,d,e,f hit
  class a,g,h out
`}
          caption="엔트리가 text 라 '클' 로 시작하는 bigram 이 한 덩어리로 모인다. pg_trgm 은 이 자리에 CRC32 해시가 들어가므로 이런 덩어리가 생기지 않는다."
        />
        <Callout kind="warn" title="pg_trgm 이 등록하지 않은 것은 게을러서가 아니다">
          <p>
            <strong>등록할 수가 없다.</strong> 엔트리가 CRC32 해시(<K>int4</K>)라 정렬 순서가 원문 순서와 무관하다 —
            <K>클</K> 로 시작하는 트라이그램들의 해시값은 정수 축 위에 흩어진다. <strong>연속 구간이 아예 존재하지
            않으므로 “어디까지 훑을지”를 판정할 방법이 없다.</strong>
          </p>
          <p>
            이것이 <K>pg_bigm</K> 이 <strong>조각을 해싱하지 않는 대가로 얻는 것</strong>이다. 해싱하지 않으니
            엔트리가 커지고(9바이트 한글 조각 그대로) 인덱스도 커지지만, 순서가 살아남는다 —{' '}
            <Ref to="/experiments/storage">저장 비용</Ref> 에서 그 대가를 잰다.
          </p>
        </Callout>

        <h4>그래서 1글자 검색이 실제로 인덱스를 타는가 — 탄다</h4>
        <Table>
          <THead><TR><TH>엔진</TH><TH>패턴</TH><TH>정답</TH><TH>플랜</TH><TH>후보</TH><TH>recheck 제거</TH><TH>버퍼</TH><TH>ms</TH></TR></THead>
          <TBody>
            {ONE_CHAR.map((r, i) => (
              <TR key={i}>
                <TD><Badge variant={r.eng === 'bigm' ? 'bigm' : r.eng === 'trgm' ? 'trgm' : 'outline'}>{r.eng}</Badge></TD>
                <TD><K>{r.pattern}</K></TD>
                <TD>{nf(r.answer)}</TD>
                <TD className={r.plan.includes('Seq') ? 'text-warn' : 'text-ok'}>{r.plan}</TD>
                <TD>{nf(r.idxRows)}</TD>
                <TD>{nf(r.recheck)}</TD>
                <TD className={r.buf > 3000 ? 'text-warn' : 'text-ok'}>{nf(r.buf)}</TD>
                <TD className={r.ms > 10 ? 'text-warn' : 'text-ok'}>{r.ms}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            버퍼 <strong>8배</strong>, 시간 <strong>19배</strong>. 그리고 <strong>후보 400 = 정답 400, recheck 0</strong> —
            부분 일치가 후보를 정답까지 정확히 좁혔다. 주입 문자는 말뭉치에 없는 <K>{ONECHAR_ENV.marker}</K> 를 써서
            정답 행 수를 통제했다.
          </TCaption>
        </Table>
        <SourceNote path={ONECHAR_ENV.repo}>실험 10 · 결정적 지표 2회 실행 동일</SourceNote>
        <h4>길이를 늘려가며 — 3글자에서 두 확장이 만난다</h4>
        <Table>
          <THead><TR><TH>길이</TH><TH>패턴</TH><TH>정답</TH><TH>인덱스 없음</TH><TH>pg_bigm</TH><TH>pg_trgm</TH></TR></THead>
          <TBody>
            {['1글자', '2글자', '3글자'].map((len) => {
              const row = (e: string) => BY_LENGTH.find((r) => r.len === len && r.eng === e)!
              const cell = (e: 'none' | 'bigm' | 'trgm') => {
                const r = row(e)
                const seq = r.plan.includes('Seq')
                return (
                  <span className={seq ? 'text-warn' : 'text-ok'}>
                    {seq ? 'Seq ' : ''}{nf(r.buf)}버퍼 · {r.ms} ms
                  </span>
                )
              }
              return (
                <TR key={len}>
                  <TD>{len}</TD>
                  <TD><K>{row('bigm').pattern}</K></TD>
                  <TD>{nf(row('bigm').answer)}</TD>
                  <TD className="text-muted-foreground">{cell('none')}</TD>
                  <TD>{cell('bigm')}</TD>
                  <TD>{cell('trgm')}</TD>
                </TR>
              )
            })}
          </TBody>
          <TCaption>
            <strong>1·2글자 구간이 <K>pg_bigm</K> 을 쓸 이유의 전부다.</strong> 그 구간에서 <K>pg_trgm</K> 은
            인덱스를 아예 쓰지 않는다 — 본편은 <Ref to="/pg-trgm/two-char">2글자 함정</Ref> 에 있다.
          </TCaption>
        </Table>

        <h3>② 포스팅 리스트 / 포스팅 트리 — 용량이 여기서 갈린다</h3>
        <p>
          각 엔트리는 “이 키를 가진 행들의 TID 목록”을 가리킨다. 목록이 짧으면 <strong>엔트리 옆에 인라인</strong>,
          한 페이지에 안 들어갈 만큼 길어지면 <strong>별도 B-tree 로 승격</strong>된다. TID 는 PostgreSQL 9.4 부터{' '}
          <strong>varbyte 델타 압축</strong>으로 저장된다.
        </p>
        <ChartBox
          type="line"
          height={300}
          title="용량은 두 부분으로 나뉜다"
          data={{
            labels: DATA.e04.scales.map((n) => nf(n)),
            datasets: DATA.e04.series.map((s) => ({
              label: s.name,
              data: [...s.ratio],
              borderColor: s.name.includes('bigm') ? C.bigm : s.name.includes('trgm') ? C.trgm : s.name.includes('tsvector') ? C.tsv : C.none,
              backgroundColor: 'transparent',
              borderDash: s.name.includes('btree') ? [6, 4] : undefined,
              tension: 0.25,
            })),
          }}
          options={{ scales: { y: { title: { display: true, text: '인덱스 / 테이블 (배)' } } } }}
          caption={
            <>
              엔트리 트리는 <em>유니크 조각 수</em>(고정비), 포스팅은 <em>총 조각 수</em>(압축된 변동비). 그래서 행이
              늘수록 테이블 대비 배수가 떨어지고, 고정비가 없는 <K>btree</K> 만 평평하다.
            </>
          }
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e04}`}>실험 04</SourceNote>

        <h3>③ 펜딩 리스트 — GIN 의 쓰기 문제에 대한 답</h3>
        <p>
          행 하나가 키 수십 개를 만든다는 것은 <strong>INSERT 한 번에 트리를 수십 번 건드려야 한다</strong>는 뜻이다.
          그래서 GIN 은 기본적으로 새 항목을 <strong>정렬되지 않은 펜딩 리스트에 append 만</strong> 해두고, 나중에
          한꺼번에 본체로 병합한다(<K>FASTUPDATE = on</K>).
        </p>
        <Table>
          <THead><TR><TH></TH><TH>쓰기</TH><TH>검색</TH></TR></THead>
          <TBody>
            <TR>
              <TD><K>FASTUPDATE = on</K> (기본)</TD>
              <TD className="text-ok">빠르다. 단 <strong>가끔 한 건이 아주 느리다</strong>(병합을 뒤집어쓴 세션)</TD>
              <TD>펜딩 리스트를 <strong>매번 순차 스캔</strong>한다</TD>
            </TR>
            <TR>
              <TD><K>FASTUPDATE = off</K></TD>
              <TD className="text-trgm"><strong>3~4배 느리다</strong> (실측)</TD>
              <TD>지연이 고르다</TD>
            </TR>
          </TBody>
          <TCaption>
            병합 시점은 셋 중 하나다 — 펜딩 리스트가 <K>gin_pending_list_limit</K>(기본 4MB)를 넘을 때 /{' '}
            <K>VACUUM</K> / <K>gin_clean_pending_list()</K> 직접 호출.{' '}
            <strong>지연의 평균이 아니라 꼬리가 중요한 서비스라면 <K>FASTUPDATE = off</K> 가 답일 수 있다.</strong>
          </TCaption>
        </Table>
        <ChartBox
          type="bar"
          height={280}
          title="INSERT 10,000행 — 인덱스별 쓰기 비용"
          data={{
            labels: DATA.e02.write.map((w) => w.idx),
            datasets: [{
              label: '초',
              data: DATA.e02.write.map((w) => w.sec),
              backgroundColor: DATA.e02.write.map((w) =>
                w.idx.includes('bigm') ? alpha(C.bigm, 0.8) : w.idx.includes('trgm') ? alpha(C.trgm, 0.8) : alpha(C.none, 0.6)),
            }],
          }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: '초' } } } }}
          caption={<><K>FASTUPDATE=off</K> 두 줄이 위쪽 넷과 3~4배 차이 난다 — 펜딩 리스트가 없으면 INSERT 마다 트리를 직접 건드린다.</>}
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e02}`}>실험 02</SourceNote>
      </Section>

      <Section id="search" title="2. 검색은 이렇게 흐른다">
        <Diagram
          chart={`
flowchart TD
  q(["LIKE '%클둥이%'"]) --> ex["extractQuery()<br/>질의를 조각으로 분해<br/>'␣클' '클둥' '둥이' '이␣'"]
  ex -->|"조각이 0개면"| all["GIN_SEARCH_MODE_ALL<br/>엔트리를 전부 읽는다"]
  ex --> find["엔트리 트리에서 각 조각을 찾는다<br/>→ 각각의 포스팅"]
  all --> find
  find --> cons["consistent() / triConsistent()<br/>비트맵으로 결합"]
  cons --> bm["후보 TID 비트맵"]
  bm --> heap["Bitmap Heap Scan<br/>후보 행의 원문을 힙에서 읽는다"]
  heap --> rc["Recheck<br/>원문에 실제로 '클둥이' 가 있는지 다시 본다"]
  rc --> out(["결과 — 항상 정확하다"])
  classDef bad fill:#4c0519,stroke:#fb7185,color:#ffe4e6
  classDef warn fill:#422006,stroke:#fbbf24,color:#fef3c7
  classDef ok fill:#134e4a,stroke:#34d399,color:#d1fae5
  class all bad
  class heap,rc warn
  class out ok
`}
          caption="조각이 0개인 갈래(붉은 칸)가 2글자 함정이다 — 인덱스를 건너뛰는 게 아니라 엔트리를 전부 읽고 힙까지 훑는다."
        />
        <Clotho id="gin-pipeline" />
        <Callout kind="warn">
          <p>
            <strong>GIN 은 “어느 행이 후보인지”까지만 답한다. 정확한 판정은 힙에서 원문을 보고 다시 한다.</strong>{' '}
            그게 <Link to="/foundations/recheck">Recheck</Link> 이고, n-gram 인덱스에서는 <strong>항상</strong> 붙는다.
          </p>
        </Callout>

        <h3 id="search-mode-all">GIN_SEARCH_MODE_ALL — “인덱스를 안 쓴다”가 아니다</h3>
        <p>
          <K>extractQuery()</K> 가 조각을 하나도 못 만들면(<K>pg_trgm</K> 에 2글자 <K>%X%</K> 를 주면 그렇다) GIN 은{' '}
          <K>GIN_SEARCH_MODE_ALL</K> 로 떨어진다. 이것은{' '}
          <strong>“인덱스를 건너뛴다”가 아니라 “인덱스 엔트리를 전부 읽고, 그 결과 나온 전체 행을 힙에서 다시 읽는다”</strong>는 뜻이다.
        </p>
        <StatGrid className="lg:grid-cols-3">
          <Stat tone="trgm" value={nf(TW[0].idx)} label={<>후보로 올라온 행 — 테이블 전체다 (<K>{TW[0].pattern}</K>)</>} />
          <Stat tone="warn" value={nf(TW[0].recheck)} label="Recheck 이 걷어낸 행" />
          <Stat tone="bigm" value={`${TW[0].ms} ms`} label={<>같은 검색어를 <K>{TW[1].pattern}</K> 로 바꾸면 {TW[1].ms} ms</>} />
        </StatGrid>
        <ChartBox
          type="bar"
          height={280}
          title="100만 행 · 2글자 · 패턴 모양만 바꿨다"
          data={{
            labels: TW.map((t) => t.pattern),
            datasets: [
              { label: '실행 시간 (ms)', data: TW.map((t) => t.ms), backgroundColor: [alpha(C.trgm, 0.85), alpha(C.ok, 0.8), alpha(C.ok, 0.8)] },
            ],
          }}
          options={{
            scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } },
            plugins: { legend: { display: false } },
          }}
          caption={
            <>
              <strong>인덱스를 태웠더니 시퀀셜 스캔보다 느려졌다</strong> — 인덱스 읽기 비용을 낸 뒤에 힙까지 훑기
              때문이다. 같은 2글자라도 패딩을 얻는 <K>클둥%</K>·<K>%클럽</K> 은 정상이다.
            </>
          }
        />
        <Table>
          <THead><TR><TH></TH><TH>인덱스 스캔이 돌려준 행</TH><TH>버퍼</TH><TH>시간</TH></TR></THead>
          <TBody>
            <TR>
              <TD><Badge variant="trgm">trgm</Badge> <K>{TW[0].pattern}</K></TD>
              <TD className="text-trgm font-semibold">{nf(TW[0].idx)} (전체)</TD>
              <TD className="text-warn">{nf(TW[0].buf)}</TD>
              <TD className="text-trgm font-semibold">{TW[0].ms} ms</TD>
            </TR>
            <TR>
              <TD>인덱스 없음 (Seq Scan)</TD>
              <TD className="text-muted-foreground">—</TD>
              <TD>{nf(DATA.e05.noneBuffers)}</TD>
              <TD>{DATA.e05.ms.none.infix[0]} ms</TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">bigm</Badge> <K>{BG.pattern}</K></TD>
              <TD className="text-ok">{nf(BG.idx)}</TD>
              <TD className="text-ok">{nf(BG.buf)}</TD>
              <TD className="text-ok font-semibold">{BG.ms} ms</TD>
            </TR>
          </TBody>
          <TCaption>
            <strong>인덱스를 태웠더니 시퀀셜 스캔보다 느려졌다.</strong> 인덱스 읽기 비용을 낸 뒤에 힙까지 훑기
            때문이다 — 이것이 “인덱스를 안 쓴다”와 <K>GIN_SEARCH_MODE_ALL</K> 이 다른 지점이다.
          </TCaption>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e05}`}>실험 05 · 2글자 패턴 축</SourceNote>
        <Callout kind="info" title="버전을 올려도 안 나아진다">
          <p>
            PG 16·17·18 에서 인덱스 스캔 행·recheck·버퍼가 <strong>한 자리도 다르지 않다.</strong>{' '}
            <K>GIN_SEARCH_MODE_ALL</K> 은 플래너의 선택이 아니라 <K>extractQuery()</K> 가 조건을 하나도 못 만든
            결과라, 코어가 할 수 있는 일이 없다 — <Link to="/experiments/versions">실험 07</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="params" title="3. 실무에서 알아둘 파라미터">
        <Table>
          <THead><TR><TH>파라미터</TH><TH>기본</TH><TH>의미</TH></TR></THead>
          <TBody>
            <TR><TD><K>gin_pending_list_limit</K></TD><TD>4MB</TD>
              <TD>펜딩 리스트가 이만큼 차면 병합. 인덱스별로 <K>WITH (fastupdate=off, gin_pending_list_limit=…)</K> 도 된다</TD></TR>
            <TR><TD><K>gin_fuzzy_search_limit</K></TD><TD>0 (무제한)</TD>
              <TD>결과가 이보다 많으면 <strong>일부만 돌려준다</strong>. 정확도를 포기하고 지연을 잡는 안전판</TD></TR>
            <TR><TD><K>maintenance_work_mem</K></TD><TD>64MB</TD>
              <TD>GIN 빌드에 크게 영향. 이 카탈로그는 <strong>256MB</strong> 로 올려 쟀다</TD></TR>
            <TR><TD><K>work_mem</K></TD><TD>4MB</TD>
              <TD>모자라면 비트맵이 페이지 단위로 낮아진다(<K>lossy</K>) — <Link to="/foundations/recheck">Recheck</Link></TD></TR>
            <TR><TD><K>pg_bigm.enable_recheck</K></TD><TD>on</TD>
              <TD><strong>끄지 말 것.</strong> 거짓 양성이 결과에 섞인다</TD></TR>
          </TBody>
        </Table>
        <p className="text-[12.5px] text-muted-foreground">
          더 읽기 · <a href="https://www.postgresql.org/docs/16/gin.html">PostgreSQL 문서 — GIN</a> ·{' '}
          <a href="https://kwanok.me/blog/postgresql-gin-index/">Kwanok — GIN Index 소개</a>
        </p>
      </Section>
    </>
  )
}
