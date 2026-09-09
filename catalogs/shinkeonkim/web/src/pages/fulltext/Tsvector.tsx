import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { Clotho } from '@/components/viz/Clotho'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const E6 = DATA.e06

export default function Tsvector() {
  return (
    <>
      <PageHeader
        eyebrow="전문검색 (코어)"
        title="tsvector / tsquery — 어휘소 vs 조각"
        lede={
          <>
            <K>tsvector</K> 는 <strong>“단어를 아는 대신 문자를 모르고”</strong>, n-gram 은{' '}
            <strong>“문자를 아는 대신 단어를 모른다.”</strong> 둘은 같은 질문에 답하지 않는다.
          </>
        }
        tags={[{ label: `${nf(E6.rows)}행` }, { label: '실험 06', variant: 'ok' }, { label: '확장이 아니다', variant: 'tsv' }]}
      />

      <EasyFirst>
        <p>
          지금까지는 <strong>글자</strong>를 잘라 찾았습니다. 그런데 PostgreSQL 에는 원래 <strong>낱말</strong>을
          찾는 기능이 따로 있습니다 — 그게 <K>tsvector</K> 입니다. 검색엔진처럼 문장을 낱말로 쪼개고, 관련도순
          정렬도 해 줍니다.
        </p>
        <p>
          <strong>그런데 한국어에서는 잘 안 맞습니다.</strong> <K>영화</K> 를 찾으면 <K>영화는</K>·<K>영화지만</K>·
          <K>이영화</K> 를 놓칩니다 — 조사가 붙으면 <strong>다른 낱말</strong>이 되기 때문입니다.{' '}
          <Link to="/fulltext/korean-recall">실측으로 찾아야 할 것의 20% 밖에 못 찾습니다.</Link>
        </p>
      </EasyFirst>

      <Section id="not-extension" title="0. 먼저 정정 — 이것은 확장이 아니다">
        <Callout kind="warn">
          <p>
            <strong><K>tsvector</K>/<K>tsquery</K> 는 익스텐션이 아니라 PostgreSQL 코어에 내장된 타입·연산자다.</strong>{' '}
            <K>CREATE EXTENSION</K> 이 필요 없다. <K>pg_extension</K> 에는 <K>plpgsql</K>·<K>pg_bigm</K>·
            <K>pg_trgm</K> 만 있고 <K>tsvector</K> 는 없다(<K>pg_type</K> 에 있다).
          </p>
        </Callout>
        <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge>확장이 필요한 쪽</Badge></p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px]"><code>{`CREATE EXTENSION pg_bigm;
CREATE EXTENSION pg_trgm;
-- 없으면 연산자 클래스도 없다`}</code></pre>
          </div>
          <div className="rounded-xl border border-tsv/30 bg-tsv/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge variant="tsv">그냥 되는 쪽</Badge></p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px]"><code>{`SELECT to_tsvector('simple', '클라우드클럽 스터디');
-- 아무 설치 없이 동작한다`}</code></pre>
          </div>
        </div>
        <p>
          그래서 “<K>pg_bigm</K> 대신 <K>tsvector</K> 를 쓰면 확장 설치를 줄일 수 있다”는 말은 맞지만,{' '}
          <strong>둘이 같은 질문에 답하지 않는다</strong>는 게 이 페이지의 요점이다.
        </p>
      </Section>

      <Section id="unit" title="1. 무엇을 인덱싱하는가">
        <Clotho id="lexeme-vs-ngram" />
        <Table>
          <THead><TR><TH></TH><TH><Badge variant="tsv">tsvector</Badge></TH><TH>n-gram (bigm / trgm)</TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">인덱스에 들어가는 단위</TD><TD><strong>어휘소(lexeme)</strong> — 단어를 정규화한 것</TD><TD><strong>고정 길이 문자 조각</strong></TD></TR>
            <TR><TD className="text-muted-foreground">단위를 정하는 주체</TD><TD>파서 + 사전(<K>text search configuration</K>)</TD><TD>기계적 분할 — 사전이 없다</TD></TR>
            <TR><TD className="text-muted-foreground">위치 정보</TD><TD className="text-ok"><strong>저장한다</strong> (구절 검색이 가능한 이유)</TD><TD>저장하지 않는다</TD></TR>
            <TR><TD className="text-muted-foreground">답하는 질문</TD><TD>“이 <em>단어</em>가 들어 있는 문서”</TD><TD>“이 <em>문자열</em>이 들어 있는 문서”</TD></TR>
            <TR><TD className="text-muted-foreground">랭킹</TD><TD className="text-ok"><K>ts_rank</K>, <K>ts_rank_cd</K></TD><TD>없다 (trgm 의 유사도는 랭킹이 아니다)</TD></TR>
            <TR><TD className="text-muted-foreground">결과의 정확성</TD><TD>정의상 정확 (어휘소 일치)</TD><TD>Recheck 후 정확</TD></TR>
          </TBody>
        </Table>
        <Callout kind="warn" title="한국어에는 형태소 사전이 기본 제공되지 않는다">
          <p>
            실험은 <K>'simple'</K> 설정을 쓰는데, 이것은 공백으로 자르고 소문자화만 한다. 그래서 <K>영화</K>·
            <K>영화는</K>·<K>영화지만</K> 이 <strong>전부 다른 어휘소</strong>가 된다.{' '}
            <Link to="/fulltext/korean-recall">재현율 숫자</Link>는 그 결과다. 사전을 바꿔 끼우는 방법은{' '}
            <Ref to="/fulltext/korean-analyzer">한국어 형태소 분석기는 없나</Ref> 에 정리했다.
          </p>
        </Callout>
      </Section>

      <Section id="pipeline" title="1-b. 파서 → 사전 → 어휘소">
        <p>
          <K>tsvector</K> 가 문장을 어휘소로 바꾸는 과정은 두 단계다. 먼저 <strong>파서</strong>가 토큰을 잘라내며{' '}
          <strong>종류까지 붙이고</strong>, 그다음 <strong>사전</strong>이 각 토큰을 정규화한다.
        </p>
        <CodeBlock>{`SELECT alias, token
FROM ts_debug('simple', '클라우드클럽 스터디에 v1.2 참여했다 192.168.0.1');`}</CodeBlock>
        <Table>
          <THead><TR><TH>alias</TH><TH>token</TH></TR></THead>
          <TBody>
            <TR><TD>word</TD><TD>클라우드클럽</TD></TR>
            <TR><TD>word</TD><TD>스터디에</TD></TR>
            <TR><TD className="text-tsv font-semibold">file</TD><TD className="font-semibold">v1.2</TD></TR>
            <TR><TD>word</TD><TD>참여했다</TD></TR>
            <TR><TD className="text-tsv font-semibold">version</TD><TD className="font-semibold">192.168.0.1</TD></TR>
          </TBody>
          <TCaption>
            <strong>파서가 토큰 종류를 구분한다.</strong> <K>v1.2</K> 를 <K>file</K>, <K>192.168.0.1</K> 을{' '}
            <K>version</K> 이라는 <strong>하나의 토큰</strong>으로 인식한다 — <K>pg_trgm</K> 이{' '}
            <K>KEEPONLYALNUM</K> 때문에 <K>192</K>/<K>168</K>/<K>0</K>/<K>1</K> 로 쪼개버리는 것과 정반대다.
          </TCaption>
        </Table>
        <Callout kind="tip" title="IP·버전·경로에서는 오히려 전문검색이 낫다 — 부분 일치만 포기하면">
          <p>
            <Link to="/foundations/whitespace">공백과 구두점</Link> 에서 본 것처럼 <K>pg_trgm</K> 은 구두점을 버리고{' '}
            <K>pg_bigm</K> 은 조각 안에 남긴다. 그런데 <K>tsvector</K> 는 아예 <strong>토큰 종류로 인식해
            통째로</strong> 다룬다. 세 방식이 같은 문자열에 서로 다른 답을 내는 자리다.
          </p>
        </Callout>
        <p>그다음 각 토큰이 사전을 거쳐 어휘소가 된다. <strong>여기가 n-gram 이 절대 못 하는 일이다.</strong></p>
        <CodeBlock>{`SELECT to_tsvector('english', 'running runs ran runner databases');
--  'databas':5 'ran':3 'run':1,2 'runner':4              ← 어간 추출 + 위치 병합

SELECT to_tsvector('simple',  'running runs ran runner databases');
--  'databases':5 'ran':3 'runner':4 'running':1 'runs':2  ← 소문자화만`}</CodeBlock>
        <p>
          <K>english</K> 설정은 <K>running</K>/<K>runs</K> 를 같은 <K>run</K> 으로 묶는다. n-gram 은 문자만 보므로
          이런 일을 할 수 없다. <strong>그리고 한국어에는 이 사전이 없다</strong> — 그래서 <K>simple</K> 을 쓰고,{' '}
          <Link to="/fulltext/korean-recall">재현율이 거기서 무너진다</Link>.
        </p>
      </Section>

      <Section id="only" title="2. 각자만 할 수 있는 것">
        <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-tsv/30 bg-tsv/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge variant="tsv">tsvector 만</Badge> 구절 검색</p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px] leading-relaxed"><code>{`phraseto_tsquery('simple','영화 연기')  -- 인접
to_tsquery('simple','영화 & 연기')      -- 같은 문서`}</code></pre>
            <div className="mt-3 flex gap-4 text-[13px]">
              <span><strong className="text-tsv">{nf(E6.phrase.adjacent)}</strong> <span className="text-muted-foreground">인접</span></span>
              <span><strong>{nf(E6.phrase.and)}</strong> <span className="text-muted-foreground">같은 문서 아무 데나</span></span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              어휘소의 <strong>위치</strong>를 저장하기 때문에 가능하다. n-gram 인덱스는 위치를 저장하지 않으므로
              대응하는 기능이 없다.
            </p>
          </div>
          <div className="rounded-xl border border-bigm/30 bg-bigm/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge variant="bigm">n-gram 만</Badge> 어휘 경계를 가로지르는 부분 문자열</p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px] leading-relaxed"><code>{`doc LIKE '%화가%'                     -- '영화가' 안의 '화가'
tsv @@ to_tsquery('simple','화가')`}</code></pre>
            <div className="mt-3 flex gap-4 text-[13px]">
              <span><strong className="text-bigm">{nf(E6.crossLexeme.like)}</strong> <span className="text-muted-foreground">LIKE</span></span>
              <span><strong className="text-tsv">{nf(E6.crossLexeme.ts)}</strong> <span className="text-muted-foreground">tsquery</span></span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              전문검색은 어휘소 <em>전체</em>가 일치해야 하므로 <strong>단어 중간</strong>은 원리상 접근할 수 없다.
            </p>
          </div>
        </div>
        <Callout kind="warn" title="similarity() 를 관련도 랭킹으로 쓰면 안 된다">
          <p>
            <K>ts_rank</K> 는 tsvector 쪽에만 있다. <K>pg_trgm</K> 의 <K>similarity()</K> 가 랭킹처럼 보이지만,
            그것은 “질의와 문서가 <strong>얼마나 닮았나</strong>”이지 “질의에 대해 이 문서가{' '}
            <strong>얼마나 관련 있나</strong>”가 아니다 — 긴 문서일수록 유사도가 떨어지므로 관련도 정렬로 쓰면
            오히려 해롭다(<Link to="/pg-trgm/similarity#three">실측</Link>: 45글자 문서에서 0.25).
          </p>
        </Callout>
      </Section>

      <Section id="syntax" title="2-b. 문법 — 무엇을 쓸 것인가">
        <CodeBlock caption="검색 컬럼을 생성 컬럼으로 유지하는 게 가장 깔끔하다 (PostgreSQL 12+)">{`ALTER TABLE docs ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', doc)) STORED;
CREATE INDEX docs_tsv ON docs USING gin (tsv);`}</CodeBlock>
        <Table>
          <THead><TR><TH>함수</TH><TH>용도</TH><TH>입력 예</TH></TR></THead>
          <TBody>
            <TR><TD><K>to_tsquery</K></TD><TD>연산자를 직접 쓴다. <strong>입력이 문법에 안 맞으면 에러</strong></TD><TD><K>'클럽 &amp; 스터디'</K></TD></TR>
            <TR><TD><K>plainto_tsquery</K></TD><TD>공백을 전부 AND 로</TD><TD><K>'클럽 스터디'</K></TD></TR>
            <TR><TD><K>phraseto_tsquery</K></TD><TD>순서까지 맞아야 한다 (<K>{'<->'}</K>)</TD><TD><K>'클라우드 클럽'</K></TD></TR>
            <TR>
              <TD className="text-ok font-semibold"><K>websearch_to_tsquery</K></TD>
              <TD><strong>검색엔진 문법</strong>(<K>"따옴표"</K>, <K>or</K>, <K>-제외</K>). 사용자 입력을 그대로 받기에 가장 안전하다</TD>
              <TD><K>'클럽 -야구 "스터디 모임"'</K></TD>
            </TR>
          </TBody>
          <TCaption>
            <strong>사용자 입력을 받는 API 라면 <K>websearch_to_tsquery</K> 를 쓴다.</strong> <K>to_tsquery</K> 에
            날것의 입력을 넣으면 사용자가 <K>&amp;</K> 하나만 쳐도 에러가 난다.
          </TCaption>
        </Table>
        <CodeBlock caption="관련도 랭킹 — n-gram 에는 대응물이 없다">{`SELECT doc, ts_rank(tsv, q) AS rank
FROM docs, websearch_to_tsquery('simple', '클라우드클럽 스터디') q
WHERE tsv @@ q
ORDER BY rank DESC
LIMIT 10;`}</CodeBlock>
      </Section>

      <Section id="cost" title="3. 비용 — 인덱스 크기와 빌드 시간">
        <div className="not-prose grid gap-4 lg:grid-cols-2">
          <ChartBox
            type="bar"
            height={260}
            title={`인덱스 크기 — 테이블 ${E6.size.tableMB} MB 대비`}
            data={{
              labels: ['gin (tsvector)', 'gin_bigm_ops', 'gin_trgm_ops'],
              datasets: [{
                label: 'MB',
                data: [E6.size.tsvMB, E6.size.bigmMB, E6.size.trgmMB],
                backgroundColor: [alpha(C.tsv, 0.8), alpha(C.bigm, 0.8), alpha(C.trgm, 0.8)],
              }],
            }}
            options={{ plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'MB' } } } }}
          />
          <ChartBox
            type="bar"
            height={260}
            title="인덱스 생성 시간 (초)"
            data={{
              labels: ['tsvector', 'pg_bigm', 'pg_trgm'],
              datasets: [{
                label: '초',
                data: [E6.buildSec.tsv, E6.buildSec.bigm, E6.buildSec.trgm],
                backgroundColor: [alpha(C.tsv, 0.8), alpha(C.bigm, 0.8), alpha(C.trgm, 0.8)],
              }],
            }}
            options={{ plugins: { legend: { display: false } } }}
            caption={<><K>tsvector</K> 가 가장 빠른데, <strong>생성해야 할 엔트리 자체가 적기 때문</strong>이다 — 어휘소는 문자 조각보다 훨씬 성기다.</>}
          />
        </div>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e06}`}>실험 06</SourceNote>
        <Callout kind="warn" title="이 크기 비교는 tsvector 에 유리하게 기울어 있다">
          <p>
            <K>tsvector</K> 컬럼은 <K>GENERATED ALWAYS AS (to_tsvector('simple', doc)) STORED</K> 로 만들었다.{' '}
            <strong>위 인덱스 크기에는 이 생성 컬럼 자체의 저장 비용이 포함되어 있지 않다</strong> — n-gram 쪽은
            인덱스만 있으면 되므로, 총 소유 비용은 표에 보이는 것보다 tsvector 쪽이 불리하다.
          </p>
        </Callout>
      </Section>

      <Section id="speed" title="4. 속도는 이 비교의 주인공이 아니다">
        <Table>
          <THead><TR><TH>키워드</TH><TH>방식</TH><TH>쓴 인덱스</TH><TH>매치 행수</TH><TH>버퍼</TH><TH>실행 시간</TH></TR></THead>
          <TBody>
            {E6.speed.map((r, i) => (
              <TR key={i}>
                <TD>{r.kw}</TD>
                <TD>{r.방식}</TD>
                <TD><code className="text-[12px]">{r.idx}</code> <span className="text-ok">✔</span></TD>
                <TD>{nf(r.hits)}</TD>
                <TD>{nf(r.buf)}</TD>
                <TD>{r.ms} ms</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>“쓴 인덱스” 열은 플랜에서 <K>Index Scan on</K> 을 읽어 기록한 것이다 — 라벨을 믿지 않는다.</TCaption>
        </Table>
        <Callout kind="warn" title="이 표는 한 번 잘못 쟀다가 다시 쟀다">
          <p>
            1차 판은 세 인덱스를 <strong>동시에 둔 채</strong> <K>LIKE</K> 를 재고 “bigm 인덱스”라고 적었는데,{' '}
            <K>LIKE</K> 는 bigm 으로도 trgm 으로도 풀 수 있어 <strong>플래너가 골랐다.</strong> 버퍼가 지문이
            됐다 — <strong>스토리 줄의 옛 버퍼 22,854 는 trgm 값과 정확히 같고</strong> bigm(22,873)과는 다르다.
            같은 표에서 영화는 bigm, 스토리는 trgm 을 타고 있었다.{' '}
            <Link to="/meta/corrections">정정 목록</Link>
          </p>
        </Callout>
        <Callout kind="ok" title="다시 재면서 덤으로 알게 된 것">
          <p>
            <K>영화</K>(2글자)를 <K>pg_trgm</K> 으로 풀면 버퍼가 <strong>2배</strong>({nf(E6.speed[1].buf)} →{' '}
            {nf(E6.speed[2].buf)}), 시간이 <strong>17배</strong>다. 2글자라 조각을 못 만들어{' '}
            <K>GIN_SEARCH_MODE_ALL</K> 로 떨어지기 때문이다.{' '}
            <strong>이 카탈로그의 <Link to="/pg-trgm/two-char">2글자 함정</Link>이 전문검색 비교 안에서도 그대로 나타난다.</strong>
          </p>
        </Callout>
        <Callout kind="warn" title="매치 행수가 다르다 — 같은 일을 하고 있지 않다">
          <p>
            <K>'영화'</K> 에서 tsquery 가 찾은 행은 <K>LIKE</K> 의 <strong>1/3</strong>이다. 속도만 떼어 비교하면
            “전문검색이 비슷하네”라고 잘못 읽게 된다. <strong>절대 시간은 이 표 안에서만 비교할 것</strong> — 이
            실행은 머신 부하가 높아 전반적으로 크다. <strong>버퍼는 두 실행에서 거의 같다</strong>(tsquery 영화{' '}
            {nf(E6.speed[0].buf)} 그대로) — 그래서 시간 대신 버퍼를 본다.
          </p>
        </Callout>
      </Section>

      <Section id="choose" title="5. 그래서 무엇을 골라야 하나">
        <Table>
          <THead><TR><TH>요구사항</TH><TH>선택</TH><TH>이유</TH></TR></THead>
          <TBody>
            <TR>
              <TD>“입력창에 친 <strong>부분 문자열</strong>이 들어간 행을 빠짐없이”</TD>
              <TD><Badge variant="bigm">pg_bigm</Badge> / <Badge variant="trgm">pg_trgm</Badge></TD>
              <TD>전문검색은 한국어에서 7~38%밖에 못 찾는다</TD>
            </TR>
            <TR><TD>영문/서구어 문서의 <strong>단어</strong> 검색 + 관련도 정렬</TD><TD><Badge variant="tsv">tsvector</Badge></TD><TD>사전이 제대로 붙고, 인덱스가 작고, <K>ts_rank</K> 가 있다</TD></TR>
            <TR><TD>“A 다음에 바로 B” <strong>구절</strong> 검색</TD><TD><Badge variant="tsv">tsvector</Badge></TD><TD>위치를 저장하는 유일한 쪽</TD></TR>
            <TR>
              <TD>한국어 <strong>단어</strong> 검색을 제대로</TD>
              <TD><Badge variant="warn">형태소 분석기</Badge></TD>
              <TD>코어의 <K>simple</K> 설정으로는 조사를 못 떼어낸다 — <Ref to="/fulltext/korean-analyzer">textsearch_ko · PGroonga</Ref></TD>
            </TR>
            <TR><TD>오탈자 허용 검색</TD><TD><Badge variant="trgm">pg_trgm</Badge></TD><TD>tsvector 에는 유사도 개념이 없다</TD></TR>
            <TR><TD>영문 <K>running</K> / <K>runs</K> 를 같이 찾아야 한다</TD><TD><Badge variant="tsv">tsvector</Badge></TD><TD>어간 추출은 문자만 보는 n-gram 이 못 하는 일이다</TD></TR>
            <TR><TD>구두점·IP·버전을 <strong>통째로</strong> 다뤄야 한다</TD><TD><Badge variant="tsv">tsvector</Badge></TD><TD>파서가 토큰 종류로 인식한다 — 단, 부분 일치는 안 된다</TD></TR>
            <TR><TD>기존 <K>LIKE</K> 쿼리를 안 바꾸고 빠르게만</TD><TD><Badge variant="bigm">n-gram</Badge></TD><TD>전문검색은 <K>@@</K>·<K>to_tsquery</K> 로 쿼리를 다 고쳐야 한다</TD></TR>
          </TBody>
        </Table>
        <Callout kind="info" title="한 문장으로">
          <p>
            <K>tsvector</K> 는 <strong>“단어를 아는 대신 문자를 모르고”</strong>, n-gram 은{' '}
            <strong>“문자를 아는 대신 단어를 모른다.”</strong> 한국어에 형태소 사전을 붙이지 않은 상태라면 앞의
            “단어를 안다”가 성립하지 않으므로, 부분 문자열 검색 요구에는 n-gram 이 사실상 유일한 답이다.
          </p>
        </Callout>
      </Section>
    </>
  )
}
