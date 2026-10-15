import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { PlanTable } from '@/components/common/PlanTable'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { A_CASE, B_TWOCHAR, C_KOREAN, D_LOWER, E_REGEX, F_ASCII, F_INSIDE, F_KOREAN, IDX_SIZE_MB, ILIKE_ENV, SEED } from '@/data/ilike'
import { nf } from '@/lib/utils'

const pick = (rows: typeof A_CASE, eng: string, label: string) =>
  rows.find((r) => r.eng === eng && r.label.startsWith(label))!

const noneILike = pick(A_CASE, 'none', "ILIKE")
const trgmILike = pick(A_CASE, 'trgm', "ILIKE")
const bigmKoLike = pick(C_KOREAN, 'bigm', "LIKE '%클")
const bigmKoILike = pick(C_KOREAN, 'bigm', "ILIKE '%클")
const noneKoLike = pick(C_KOREAN, 'none', "LIKE '%클")
const noneKoILike = pick(C_KOREAN, 'none', "ILIKE '%클")
const trgmLike = pick(A_CASE, 'trgm', "LIKE '%C")

export default function E09() {
  return (
    <>
      <PageHeader
        eyebrow="실험 09"
        title="ILIKE 는 실제로 빨라지는가"
        lede={
          <>
            <Link to="/pg-bigm/operators">실험 03</Link> 은 <K>enable_seqscan=off</K> 로 강제해서 “연산자가 인덱스를
            타는가”를 봤다. 그건 <strong>인덱스 경로가 존재하는가</strong>이지 <strong>그게 이득인가</strong>가
            아니다. 여기서는 <strong>플래너를 건드리지 않고</strong> 시간·버퍼를 잰다.
          </>
        }
        tags={[{ label: ILIKE_ENV.pg }, { label: `${nf(ILIKE_ENV.rows)}행` }, { label: '2회 실행 동일', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          <K>ILIKE</K> 는 대소문자를 무시하는 <K>LIKE</K> 입니다. <K>pg_trgm</K> 은 조각을 만들 때{' '}
          <strong>미리 소문자로 바꿔</strong> 넣기 때문에, 대소문자를 무시하는 검색이 오히려{' '}
          <strong>인덱스에게 자연스러운 질문</strong>입니다. 실측에서 <K>ILIKE</K> 는 인덱스 없이 돌릴 때보다{' '}
          <strong>38배 빨랐고 헛걸음이 한 건도 없었습니다.</strong> 반대로 <K>pg_bigm</K> 은 <K>ILIKE</K> 를 아예
          인덱스로 못 풀어서, <strong>한글 검색어에서도</strong> 인덱스가 통째로 무시됩니다 — 대소문자가 없는
          한글인데도요.
        </p>
      </EasyFirst>

      <StatGrid>
        <Stat tone="trgm" value={`${Math.round(noneILike.ms / trgmILike.ms)}×`}
              label={<>pg_trgm <K>ILIKE</K> — 인덱스 없이 대비</>} />
        <Stat tone="ok" value={nf(trgmILike.recheck)}
              label={<><K>ILIKE</K> 에서 Recheck 이 버린 행 — 인덱스가 정답까지 좁혔다</>} />
        <Stat tone="warn" value={nf(trgmLike.recheck)}
              label={<>같은 인덱스로 <K>LIKE</K> 를 풀 때 버려지는 행 (정답 {trgmLike.answer})</>} />
        <Stat tone="bigm" value={`${Math.round(bigmKoILike.ms / bigmKoLike.ms)}×`}
              label={<>pg_bigm 한글 <K>LIKE</K> → <K>ILIKE</K> 로 바꿨을 때</>} />
      </StatGrid>

      <Section id="design" title="설계 — 정답 행 수가 설계로 달라지게 심었다">
        <p>
          대소문자 변형을 <K>id</K> 나머지로 심어 <strong><K>LIKE</K> 와 <K>ILIKE</K> 의 정답 행 수가 달라지게</strong>{' '}
          했다. 그래야 “ILIKE 가 더 많이 찾는데 더 빠른가”를 정직하게 물을 수 있다.
        </p>
        <Table>
          <THead><TR><TH><K>id % 1000</K></TH><TH>심은 문자열</TH><TH>걸리는 조건</TH></TR></THead>
          <TBody>
            {SEED.map((s) => (
              <TR key={s.mod}><TD>{s.mod}</TD><TD><K>{s.text}</K></TD><TD>{s.hit}</TD></TR>
            ))}
          </TBody>
          <TCaption>
            인덱스는 한 번에 하나만 두고, 상대 인덱스를 트랜잭션 안에서 치운 뒤 롤백한다. 플랜에서 실제로 쓴
            인덱스 이름을 읽어 표의 “쓴 인덱스” 열에 기록했다 — <Link to="/meta/method">측정 원칙</Link>.
          </TCaption>
        </Table>
        <Table>
          <THead><TR><TH>인덱스</TH><TH>정의</TH><TH>크기</TH></TR></THead>
          <TBody>
            {IDX_SIZE_MB.map((x) => (
              <TR key={x.name}>
                <TD><code className="text-[12.5px]">{x.name}</code></TD>
                <TD><K>{x.what}</K></TD>
                <TD className={x.mb <= 32 ? 'text-ok' : ''}>{x.mb} MB</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="a" title="A. LIKE vs ILIKE — ASCII">
        <PlanTable rows={A_CASE} />
        <ChartBox
          type="bar"
          height={300}
          title="같은 질의를 세 엔진으로 — 버퍼 (로그)"
          data={{
            labels: ['LIKE (대소문자 구분)', 'ILIKE (무시)'],
            datasets: [
              { label: '인덱스 없음', data: [A_CASE[0].buf, A_CASE[3].buf], backgroundColor: alpha(C.none, 0.7) },
              { label: 'pg_bigm', data: [A_CASE[1].buf, A_CASE[4].buf], backgroundColor: alpha(C.bigm, 0.85) },
              { label: 'pg_trgm', data: [A_CASE[2].buf, A_CASE[5].buf], backgroundColor: alpha(C.trgm, 0.85) },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '버퍼 (로그)' } } } }}
          caption={
            <>
              오른쪽 묶음에서 <strong>pg_bigm 막대가 “인덱스 없음”과 정확히 같은 높이</strong>다 — 인덱스가 있으나
              없으나 같다는 뜻이다.
            </>
          }
        />
        <SourceNote path={ILIKE_ENV.repo}>실험 09 · A절</SourceNote>

        <h3>(a) 이 실험에서 pg_trgm의 ILIKE가 빨랐다</h3>
        <p>
          {noneILike.ms} ms → {trgmILike.ms} ms(<strong>{Math.round(noneILike.ms / trgmILike.ms)}배</strong>),
          버퍼 {nf(noneILike.buf)} → {nf(trgmILike.buf)}. 그리고{' '}
          <strong><K>Rows Removed by Index Recheck</K> 가 0</strong> 이다 — 인덱스가 후보를 정답까지 정확히 좁혔다.
        </p>

        <h3>(b) 그런데 같은 인덱스에서 LIKE 는 오히려 덜 정확하다</h3>
        <p>
          정답이 {trgmLike.answer}행인데 인덱스는 <strong>{nf(trgmLike.idxRows)}행을 올리고 {nf(trgmLike.recheck)}행을
          Recheck 이 걷어낸다.</strong> 이유는 <K>pg_trgm</K> 이 조각을 만들 때 소문자화하기 때문이다.
        </p>
        <CodeBlock caption="contrib/pg_trgm/trgm.h">{`#define IGNORECASE`}</CodeBlock>
        <Callout kind="tip" title="인덱스 입장에서 자연스러운 연산은 ILIKE 다">
          <p>
            <K>LIKE</K> 쪽이 오히려 “추가 필터가 붙은” 질의다. 대소문자를 구분해야 하는 검색이라면{' '}
            <K>pg_trgm</K> 인덱스는 <strong>후보를 좁히는 데까지만</strong> 도와주고 마지막 판정은 힙에서 한다.
            거꾸로 말하면 <strong>대소문자 구분 검색에는 <K>pg_bigm</K> 이 낫다</strong> — 후보 {nf(A_CASE[1].idxRows)}행,
            recheck 0.
          </p>
        </Callout>

        <h3>(c) pg_bigm 은 ILIKE 에서 인덱스를 통째로 못 쓴다</h3>
        <p>
          연산자 클래스에 <K>~~*</K> 가 등록돼 있지 않아서다(<Link to="/pg-bigm/operators">연산자 커버리지</Link>).
          인덱스가 있으나 없으나 같다({A_CASE[4].ms} vs {A_CASE[3].ms} ms).
        </p>
      </Section>

      <Section id="b" title="B. 2글자 함정은 ILIKE 에도 오는가 — 온다">
        <PlanTable
          rows={B_TWOCHAR}
          caption={
            <>
              <strong>세 칸이 전부 같다.</strong> <K>pg_trgm</K> 은 2글자라 조각을 하나도 못 만들고,{' '}
              <K>pg_bigm</K> 은 <K>ILIKE</K> 자체를 못 받는다. <strong><K>ILIKE</K> 를 쓴다고 2글자 함정이
              없어지지 않는다</strong> — <Link to="/pg-trgm/two-char">2글자 함정</Link>.
            </>
          }
        />
      </Section>

      <Section id="c" title="C. 대소문자가 없는 한글에서도 ILIKE 대가를 치르는가 — 치른다">
        <PlanTable rows={C_KOREAN} />
        <ChartBox
          type="bar"
          height={300}
          title="한글 검색어 · LIKE 한 글자를 ILIKE 로 바꿨을 때 (ms, 로그)"
          data={{
            labels: ['인덱스 없음', 'pg_bigm', 'pg_trgm'],
            datasets: [
              { label: "LIKE '%클라우드클럽%'", data: [noneKoLike.ms, bigmKoLike.ms, C_KOREAN[2].ms], backgroundColor: alpha(C.ok, 0.8) },
              { label: "ILIKE '%클라우드클럽%'", data: [noneKoILike.ms, bigmKoILike.ms, C_KOREAN[5].ms], backgroundColor: alpha(C.trgm, 0.85) },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } } }}
          caption={
            <>
              <strong>pg_bigm 만 두 막대가 갈라진다</strong>({bigmKoLike.ms} → {bigmKoILike.ms} ms,{' '}
              {Math.round(bigmKoILike.ms / bigmKoLike.ms)}배). pg_trgm 은 거의 같고, 인덱스 없는 쪽도{' '}
              {Math.round((noneKoILike.ms / noneKoLike.ms) * 10) / 10}배 벌어진다.
            </>
          }
        />
        <SourceNote path={ILIKE_ENV.repo}>실험 09 · C절</SourceNote>

        <Callout kind="warn" title="이 카탈로그에서 가장 비싼 오해">
          <p>
            <strong>“한글만 검색하니까 <K>LIKE</K> 든 <K>ILIKE</K> 든 상관없겠지”</strong> — <K>pg_bigm</K> 에서
            한 글자 차이가 <strong>{Math.round(bigmKoILike.ms / bigmKoLike.ms)}배</strong>다
            ({bigmKoLike.ms} → {bigmKoILike.ms} ms). 검색어가 한글이라 <strong>대소문자 개념이 아예 없는데도</strong>{' '}
            그렇다. 플래너는 “대소문자를 무시하라”는 요청을 받으면 그 컬럼의 <K>gin_bigm_ops</K> 인덱스를 쓸 방법이
            없고, 문자 종류를 따지지 않는다.
          </p>
          <p>
            ORM 이 기본값으로 <K>ILIKE</K> 를 내보내는 경우가 흔하다(예: Django 의 <K>icontains</K>, Prisma 의{' '}
            <K>mode: 'insensitive'</K>). 그러면 <K>pg_bigm</K> 인덱스는 <strong>조용히 무시된다</strong> — 에러도
            경고도 없다.
          </p>
        </Callout>
        <Callout kind="info" title="ILIKE 는 인덱스가 없어도 비싸다">
          <p>
            순수 Seq Scan 에서 {noneKoLike.ms} → {noneKoILike.ms} ms,{' '}
            <strong>{Math.round((noneKoILike.ms / noneKoLike.ms) * 10) / 10}배</strong>다. 대소문자 폴딩을 행마다
            하기 때문이다. 즉 <K>ILIKE</K> 는 <strong>인덱스를 못 쓰게 만드는 비용 + 비교 자체가 비싼 비용</strong>을
            둘 다 낸다.
          </p>
        </Callout>
      </Section>

      <Section id="d" title="D. pg_bigm 의 대안 — lower() 함수 인덱스">
        <p>
          <K>pg_bigm</K> 에는 <K>ILIKE</K> 가 없다. 그러면 대소문자 무시 검색을 포기해야 하나?{' '}
          <strong>아니다.</strong> 인덱스를 <K>lower(doc)</K> 에 걸고 질의도 소문자로 맞추면 된다.
        </p>
        <CodeBlock>{`CREATE INDEX docs_lbigm ON docs USING gin (lower(doc) gin_bigm_ops);
SELECT count(*) FROM docs WHERE lower(doc) LIKE '%cloudclub%';`}</CodeBlock>
        <PlanTable
          rows={D_LOWER}
          caption={
            <>
              <strong><K>pg_trgm</K> 의 네이티브 <K>ILIKE</K>({trgmILike.ms} ms)와 사실상 같다.</strong> 그리고
              인덱스가 <strong>32 MB vs 54 MB</strong> 로 오히려 작다.
            </>
          }
        />
        <Callout kind="warn" title="대신 대가가 있다">
          <ul>
            <li><strong>질의를 고쳐야 한다</strong> — <K>doc ILIKE '%X%'</K> → <K>lower(doc) LIKE lower('%X%')</K>. ORM 이 만들어 주는 쿼리라면 손대기 어렵다.</li>
            <li><strong>대소문자 구분 검색을 포기한다</strong> — 같은 컬럼에 둘 다 필요하면 인덱스를 두 개 둬야 한다.</li>
            <li><strong><K>lower()</K> 는 로케일에 의존한다</strong> — 터키어 <K>I</K>/<K>ı</K> 같은 경계 사례가 있다. <strong>이 실험은 그 부분을 재지 않았다.</strong></li>
            <li><strong>쓰기 비용을 재지 않았다</strong> — <K>lower()</K> 를 매 INSERT 마다 계산해야 한다.</li>
          </ul>
        </Callout>
      </Section>

      <Section id="e" title="E. 정규식 ~*">
        <PlanTable
          rows={E_REGEX}
          caption={
            <>
              ASCII 정규식은 <K>pg_trgm</K> 만 가속한다 — <strong>한글 정규식은 두 확장 모두 안 된다</strong>
              (정규식 엔진의 <K>MAX_SIMPLE_CHR = 0x7FF</K>).
            </>
          }
        />
      </Section>

      <Section id="f" title="F. 코어 전문검색(tsvector + GIN)과 견주면">
        <p>
          같은 GIN 인덱스인데 넣는 것이 <strong>조각이 아니라 어휘소</strong>인 쪽이다. 같은 표에 놓고 재봤다 —
          다만 <strong>tsquery 는 “낱말”을 찾고 <K>LIKE</K> 는 “부분 문자열”을 찾는다.</strong> 속도만 떼어 보면
          잘못 읽게 되므로 <strong>정답 행 수를 반드시 같이 본다.</strong>
        </p>

        <h3>F1. ASCII — 정답이 같아지도록 만든 구간</h3>
        <p>
          마커를 <strong>낱말로</strong> 심어서(<K>'CloudClub 모임 ' || 본문</K>) 세 방식의 정답이 우연히
          600행으로 같아진다. 속도만 나란히 보려고 만든 조건이다.
        </p>
        <PlanTable rows={F_ASCII} />
        <ChartBox
          type="bar"
          height={280}
          title="정답 600행이 같을 때 — 버퍼와 시간"
          data={{
            labels: F_ASCII.map((r) => (r.eng === 'tsv' ? 'tsvector @@' : r.eng === 'trgm' ? 'pg_trgm ILIKE' : 'lower + pg_bigm')),
            datasets: [
              { label: '버퍼', data: F_ASCII.map((r) => r.buf), backgroundColor: alpha(C.none, 0.6), yAxisID: 'y' },
              { label: 'ms', data: F_ASCII.map((r) => r.ms), backgroundColor: alpha(C.tsv, 0.85), yAxisID: 'y1' },
            ],
          }}
          options={{
            scales: {
              y: { title: { display: true, text: '버퍼' }, beginAtZero: true },
              y1: { position: 'right' as const, title: { display: true, text: 'ms' }, beginAtZero: true, grid: { drawOnChartArea: false } },
            },
          }}
          caption={
            <>
              <strong>버퍼는 거의 같은데(604 vs 622) tsvector 가 2~3배 빠르다.</strong> 읽는 페이지 수가 같으니
              차이는 그 앞단에 있다 — 어휘소 하나를 찾는 것과 조각 여러 개의 포스팅을 AND 하는 것의 차이다.
            </>
          }
        />

        <h3>F2. 한글 — 여기서는 사실상 같다</h3>
        <PlanTable
          rows={F_KOREAN}
          caption={<>{F_KOREAN[0].ms} ms vs {F_KOREAN[1].ms} ms. <strong>정답 200행으로 같고 속도도 갈리지 않는다.</strong></>}
        />

        <h3>F3. 낱말 “가운데”를 찾으면 — 여기서 갈린다</h3>
        <p>
          <K>클라우드클럽</K> 안의 <K>우드클럽</K> 을 찾아본다. 이게 <strong>부분 문자열 검색의 본래 질문</strong>이다.
        </p>
        <PlanTable rows={F_INSIDE} />
        <Callout kind="warn" title="tsvector 가 제일 빠른데 답이 0행이다">
          <p>
            버퍼 <strong>{nf(F_INSIDE[0].buf)}장에 {F_INSIDE[0].ms} ms</strong> — 이 표에서 압도적으로 빠르다.
            그런데 <strong>찾은 행이 0개</strong>다. 어휘소는 <K>클라우드클럽</K> 하나뿐이고 그 <em>안</em> 은 볼 수
            없기 때문이다. 같은 질의를 <K>pg_bigm</K> 은 {nf(F_INSIDE[1].answer)}행을 {F_INSIDE[1].ms} ms 에 찾는다.
          </p>
          <p>
            <strong>“빠르다”를 정답 수와 떼어 읽으면 이런 표를 거꾸로 읽게 된다.</strong> 이 카탈로그가 속도표마다 정답
            행 수를 같이 싣는 이유다.
          </p>
        </Callout>

        <h3>인덱스 크기</h3>
        <ChartBox
          type="bar"
          height={260}
          title="같은 테이블에 건 다섯 인덱스"
          data={{
            labels: IDX_SIZE_MB.map((x) => x.name),
            datasets: [{
              label: 'MB',
              data: IDX_SIZE_MB.map((x) => x.mb),
              backgroundColor: IDX_SIZE_MB.map((x) =>
                x.name.includes('tsv') ? alpha(C.tsv, 0.85) : x.name.includes('bigm') ? alpha(C.bigm, 0.85) : alpha(C.trgm, 0.85)),
            }],
          }}
          options={{ indexAxis: 'y' as const, plugins: { legend: { display: false } } }}
          caption={
            <>
              <K>gin (tsvector)</K> 44 MB 는 <K>gin_bigm_ops</K> 35 MB 보다 크다 —{' '}
              <strong>게다가 <K>tsv</K> 생성 컬럼의 저장 비용은 여기 포함되지 않았다.</strong> 전문검색 쪽이
              항상 작다는 통념이 이 데이터에서는 성립하지 않는다.
            </>
          }
        />
        <SourceNote path={ILIKE_ENV.repo}>실험 09 · F절 · 결정적 지표 2회 실행 동일</SourceNote>

        <Callout kind="info" title="그래서 전문검색과 견주면">
          <ul>
            <li><strong>찾는 것이 “낱말”이면 tsvector 가 빠르다</strong> — 같은 정답에서 2~3배, 버퍼는 비슷하다.</li>
            <li><strong>찾는 것이 “부분 문자열”이면 비교가 성립하지 않는다</strong> — tsvector 는 답을 못 찾는다(0행).</li>
            <li><strong>인덱스는 오히려 더 크다</strong>(44 MB vs bigm 35 MB) — 생성 컬럼 비용까지 더하면 격차가 벌어진다.</li>
            <li>
              한국어에서는 <Ref to="/fulltext/korean-recall">재현율이 7~38%</Ref> 라, 이 표의 “같은 정답” 조건이
              실제 데이터에서는 거의 성립하지 않는다.
            </li>
          </ul>
        </Callout>
      </Section>

      <Section id="choose" title="정리 — 고르는 표">
        <Table>
          <THead><TR><TH>상황</TH><TH>답</TH><TH>근거</TH></TR></THead>
          <TBody>
            <TR>
              <TD>대소문자 무시 검색이 필요하고 <strong>쿼리를 고칠 수 있다</strong></TD>
              <TD><Badge variant="bigm">pg_bigm + lower() 인덱스</Badge></TD>
              <TD>{D_LOWER[1].ms} ms · 인덱스 32 MB (trgm 54 MB)</TD>
            </TR>
            <TR>
              <TD>대소문자 무시 검색이 필요하고 <strong>쿼리를 못 고친다</strong>(ORM 등)</TD>
              <TD><Badge variant="trgm">pg_trgm</Badge></TD>
              <TD>네이티브 <K>ILIKE</K> {trgmILike.ms} ms</TD>
            </TR>
            <TR>
              <TD><strong>대소문자를 구분해야 한다</strong></TD>
              <TD><Badge variant="bigm">pg_bigm</Badge></TD>
              <TD>trgm 은 후보 {nf(trgmLike.idxRows)}행 중 {nf(trgmLike.recheck)}을 Recheck 으로 버린다</TD>
            </TR>
            <TR>
              <TD>2글자 검색어</TD>
              <TD><Badge variant="bigm">pg_bigm + LIKE</Badge></TD>
              <TD><K>ILIKE</K> 로는 어느 쪽도 안 된다</TD>
            </TR>
            <TR>
              <TD>ASCII 정규식</TD>
              <TD><Badge variant="trgm">pg_trgm</Badge></TD>
              <TD>대안 없음</TD>
            </TR>
          </TBody>
        </Table>
        <Callout kind="ok" title="한 줄로">
          <p>
            <K>ILIKE</K> 자체는 <K>pg_trgm</K> 에서 잘 동작하고 오히려 <K>LIKE</K> 보다 인덱스에 잘 맞는다. 문제는{' '}
            <strong><K>pg_bigm</K> 을 쓰면서 <K>ILIKE</K> 를 보내는 조합</strong>이고, 한글이라 안전할 것 같아도
            그렇지 않다.
          </p>
        </Callout>
      </Section>

      <Section id="limits" title="한계">
        <ul>
          <li>200,000행 한 규모, 검색어 한 종류(<K>cloudclub</K> / <K>클라우드클럽</K>)로만 쟀다.</li>
          <li><K>lower()</K> 의 로케일 의존성을 재지 않았다 — 터키어 <K>I</K> 문제 등.</li>
          <li>함수 인덱스의 <strong>쓰기 비용</strong>을 재지 않았다.</li>
          <li><K>gist_trgm_ops</K> 는 재지 않았다. GIN 두 종류와 함수 인덱스만 봤다.</li>
          <li>시간은 머신 부하에 좌우된다 — <strong>자릿수 차이만 해석할 것.</strong> 결정적 지표는 2회 실행 전부 동일했다.</li>
        </ul>
      </Section>
    </>
  )
}
