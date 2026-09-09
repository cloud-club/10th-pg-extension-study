import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
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
        <Clotho id="gin-structure" />
        <CodeBlock>{`┌─ 엔트리 트리 (B-tree) ────────────────────────────────────┐
│   "␣클"  │  "드클"  │  "라우"  │  "클라"  │  "클럽"  │ ... │  ← 키를 정렬해 담는다
└─────┬─────────┬─────────────────────────────────────────┘
      │         │
      │         └──▶ 포스팅 트리 (별도 B-tree)
      │                흔한 키 — TID 가 한 페이지에 안 들어갈 때
      │
      └──▶ 포스팅 리스트 (엔트리 옆에 인라인, varbyte 델타 압축)
             드문 키

┌─ 펜딩 리스트 ─────────────────────────────────────────────┐
│  아직 본체에 병합되지 않은 최근 INSERT 들 (FASTUPDATE)     │
└───────────────────────────────────────────────────────────┘`}</CodeBlock>

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
        <CodeBlock>{`LIKE '%클둥이%'
   │
   ├─ extractQuery()  질의를 조각으로 분해            "␣클","클둥","둥이","이␣"
   │                  ※ 조각이 0개면 GIN_SEARCH_MODE_ALL — 엔트리 전체를 읽는다
   │
   ├─ 엔트리 트리에서 각 조각을 찾는다                → 각각의 포스팅
   │
   ├─ consistent() / triConsistent() 로 비트맵 결합   → 후보 TID 비트맵
   │
   ├─ Bitmap Heap Scan — 후보 행의 원문을 힙에서 읽는다
   │
   └─ Recheck — 원문에 실제로 '클둥이' 가 있는지 다시 본다`}</CodeBlock>
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
