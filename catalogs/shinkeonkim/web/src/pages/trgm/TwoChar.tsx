import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { BY_LENGTH, ONECHAR_ENV } from '@/data/onechar'
import { nf } from '@/lib/utils'

const TW = DATA.e05.twoChar
const E5 = DATA.e05

export default function TwoChar() {
  return (
    <>
      <PageHeader
        eyebrow="pg_trgm"
        title="짧은 검색어 함정 — 1글자와 2글자"
        lede={
          <>
            각 확장의 “조각 만들기” 함수에서 <strong>딱 한 줄씩</strong>만 비교하면 된다. 그 한 줄이 100만 행에서{' '}
            {TW[0].ms} ms 와 {E5.ms.bigm.infix[0]} ms 를 가른다. <strong>1글자와 2글자 둘 다 여기서 갈린다</strong> —{' '}
            <K>pg_trgm</K> 은 두 길이 모두 사실상 못 쓰고, <K>pg_bigm</K> 은 두 길이 모두 인덱스를 탄다.
          </>
        }
        tags={[{ label: `${nf(E5.rows)}행` }, { label: '실험 05', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          세 글자씩 자르는 <K>pg_trgm</K> 에 <strong>두 글자를 주면 조각이 하나도 안 나옵니다.</strong> 조각이
          없으면 찾아보기를 쓸 수가 없죠. 한 글자면 더 그렇습니다. 한국어는 <K>서울</K>·<K>배송</K>처럼 두 글자면
          이미 낱말이라 이 함정에 자주 걸립니다.
        </p>
        <p>
          <K>pg_bigm</K> 은 두 글자면 조각이 나오고, <strong>한 글자일 때는 조각 대신 “이 글자로 시작하는 조각을
          전부” 라는 조건을 넘깁니다</strong>(부분 일치) — 그래서 1글자도 인덱스를 탑니다.
        </p>
      </EasyFirst>

      <Section id="oneline" title="1. 소스에서 한 줄씩">
        <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-trgm/30 bg-trgm/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold">
              <Badge variant="trgm">pg_trgm</Badge> <code className="ml-1 text-[12px]">trgm_op.c — make_trigrams()</code>
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px] leading-relaxed"><code>{`if (charlen < 3)
    return tptr;      /* 포기한다 */`}</code></pre>
          </div>
          <div className="rounded-xl border border-bigm/30 bg-bigm/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold">
              <Badge variant="bigm">pg_bigm</Badge> <code className="ml-1 text-[12px]">bigm_op.c — make_bigrams()</code>
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12.5px] leading-relaxed"><code>{`if (charlen < 2) {
    compact_bigram(bptr, ptr, pg_mblen(str));
    bptr->pmatch = true;   /* 부분 일치로 전환 */
}`}</code></pre>
          </div>
        </div>
        <p>
          조각이 0개면 GIN 은 <Link to="/foundations/gin#search-mode-all"><K>GIN_SEARCH_MODE_ALL</K></Link> 로
          떨어진다. 이것은 <strong>“인덱스를 안 쓴다”가 아니라 “인덱스 엔트리를 전부 읽는다”</strong>는 뜻이라,
          인덱스 읽기 비용 + 시퀀셜 스캔 비용을 <strong>둘 다</strong> 낸다.
        </p>
        <Clotho id="two-char-trap" />
      </Section>

      <Section id="numbers" title="2. 숫자로">
        <StatGrid>
          <Stat tone="trgm" value={`${TW[0].ms} ms`} label={<><K>{TW[0].pattern}</K> — trgm</>} />
          <Stat tone="bigm" value={`${E5.ms.bigm.infix[0]} ms`} label={<>같은 검색어 — bigm</>} />
          <Stat tone="warn" value={`${Math.round(TW[0].ms / E5.ms.none.infix[0])}×`} label="인덱스 없는 Seq Scan 보다도 느리다" />
          <Stat tone="ok" value={`${Math.round(TW[0].ms / TW[1].ms)}×`} label={<>같은 검색어, <strong>패턴 모양만</strong> 바꿔서 얻은 차이</>} />
        </StatGrid>
        <ChartBox
          type="line"
          height={320}
          title="검색어 길이별 실행 시간 — 2글자 칸 하나만 다르다"
          data={{
            labels: [...E5.lengths].map((n) => `${n}글자`),
            datasets: [
              { label: '인덱스 없음', data: [...E5.ms.none.infix], borderColor: C.none, backgroundColor: C.none, borderDash: [6, 4], tension: 0.2 },
              { label: 'pg_bigm', data: [...E5.ms.bigm.infix], borderColor: C.bigm, backgroundColor: C.bigm, tension: 0.2 },
              { label: 'pg_trgm', data: [...E5.ms.trgm.infix], borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } } }}
          caption={<>로그 스케일. 3글자부터는 두 확장이 사실상 같다 — <strong>차이는 왼쪽 끝 한 칸이 전부다.</strong></>}
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e05}`}>실험 05 · 45칸 전부 정답 {E5.answer}행 일치</SourceNote>
      </Section>

      <Section id="lengths" title="3. 1글자 · 2글자 · 3글자를 나란히">
        <p>
          같은 데이터에서 검색어 길이만 바꿔 잰 것이다. <strong>1·2글자에서는 <K>pg_trgm</K> 이 인덱스를 아예 쓰지
          않고, 3글자에서 두 확장이 만난다.</strong>
        </p>
        <Table>
          <THead><TR><TH>길이</TH><TH>패턴</TH><TH>정답</TH><TH>인덱스 없음</TH><TH>pg_bigm</TH><TH>pg_trgm</TH></TR></THead>
          <TBody>
            {['1글자', '2글자', '3글자'].map((len) => {
              const row = (e: string) => BY_LENGTH.find((r) => r.len === len && r.eng === e)!
              const cell = (e: 'none' | 'bigm' | 'trgm') => {
                const r = row(e)
                const seq = r.plan.includes('Seq')
                return <span className={seq ? 'text-warn' : 'text-ok'}>{seq ? 'Seq ' : ''}{nf(r.buf)}버퍼 · {r.ms} ms</span>
              }
              return (
                <TR key={len}>
                  <TD className={len === '3글자' ? '' : 'font-semibold'}>{len}</TD>
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
            <K>pg_trgm</K> 의 1·2글자 칸은 <strong>인덱스가 있는데도 Seq Scan</strong> 이다 — 플래너가 전체 인덱스
            스캔보다 그게 싸다고 판단했다. 100만 행에서는 전체 인덱스 스캔이 나오기도 하는데,{' '}
            <strong>어느 쪽이든 “필터로 동작하지 않는다”는 같다.</strong>
          </TCaption>
        </Table>
        <SourceNote path={ONECHAR_ENV.repo}>실험 10 · 결정적 지표 2회 실행 동일</SourceNote>
        <Callout kind="info" title="1글자가 되는 이유는 2-gram 이라서가 아니다">
          <p>
            2-gram 이어도 1글자로는 조각을 만들 수 없다. 되는 이유는 <K>pg_bigm</K> 이 <strong>조각을 해싱하지
            않아 GIN 엔트리가 사전순으로 정렬돼 있고, 그래서 “<K>클</K> 로 시작하는 조각 전부”를 구간으로 훑을 수
            있기</strong> 때문이다. 카탈로그를 직접 읽어 확인한 사슬은{' '}
            <Ref to="/foundations/gin#sorted">정렬돼 있으면 왜 1글자 검색이 되나</Ref> 에 있다.
          </p>
        </Callout>
      </Section>

      <Section id="why-bigm" title="4. 왜 pg_bigm 만 부분 일치로 전환할 수 있나">
        <p><strong>조각을 어떻게 저장하느냐</strong>가 그것을 결정한다.</p>
        <Table>
          <THead><TR><TH></TH><TH><Badge variant="bigm">pg_bigm</Badge></TH><TH><Badge variant="trgm">pg_trgm</Badge></TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">조각 타입</TD><TD><K>{'{bool pmatch; int8 bytelen; char str[8];}'}</K></TD><TD><K>typedef char trgm[3]</K> — 고정 3바이트</TD></TR>
            <TR><TD className="text-muted-foreground">멀티바이트 처리</TD><TD>원본 바이트 그대로</TD><TD><strong>CRC32 로 해싱</strong> (9바이트를 3바이트에 담아야 하므로)</TD></TR>
            <TR><TD className="text-muted-foreground">GIN 엔트리 타입</TD><TD><K>text</K></TD><TD><K>int32</K></TD></TR>
            <TR><TD className="text-muted-foreground">엔트리 정렬 순서</TD><TD className="text-ok"><strong>사전순 — 접두어 구간이 성립</strong></TD><TD>해시값 순 — 의미 없음</TD></TR>
            <TR><TD className="text-muted-foreground"><K>comparePartial</K></TD><TD className="text-ok"><strong>있다</strong></TD><TD>등록할 수 없다</TD></TR>
            <TR><TD className="text-muted-foreground">해시 충돌</TD><TD>없다</TD><TD>가능 (Recheck 이 잡아준다)</TD></TR>
          </TBody>
          <TCaption>
            <strong>“2-gram 이라 짧은 키워드에 강하다”는 설명은 절반만 맞다.</strong> 나머지 절반은{' '}
            <strong>조각을 해싱하지 않아서 접두어 탐색이 가능하다</strong>는 것이고, 이쪽이 1글자 검색까지 되는
            진짜 이유다.
          </TCaption>
        </Table>
      </Section>

      <Section id="rescue" title="5. 그런데 pg_trgm 도 패딩을 얻어내면 산다">
        <p>
          <K>%</K> 로 감싸면 그 자리에 무슨 글자가 올지 몰라 패딩을 못 붙이지만, 경계가{' '}
          <strong>문자열의 끝</strong>이거나 <strong>비단어 문자</strong>면 붙는다.
        </p>
        <ChartBox
          type="bar"
          height={280}
          title="같은 2글자, 패턴 모양만 바꿨다"
          data={{
            labels: TW.map((t) => t.pattern),
            datasets: [
              { label: '인덱스가 돌려준 후보 행', data: TW.map((t) => t.idx), backgroundColor: TW.map((t) => (t.idx > 1000 ? alpha(C.trgm, 0.85) : alpha(C.ok, 0.8))) },
            ],
          }}
          options={{
            scales: { y: { type: 'logarithmic', title: { display: true, text: '후보 행 (로그)' } } },
            plugins: { legend: { display: false } },
          }}
          caption={
            <>
              접미 패턴만 문자열 끝 2글자라 검색어가 <K>클럽</K> 이다. 후보가 {nf(TW[0].idx)}행에서 {nf(TW[1].idx)}행으로
              줄고, 시간은 {TW[0].ms} ms → {TW[1].ms} ms.
            </>
          }
        />
        <Table>
          <THead><TR><TH>패턴</TH><TH>패딩이 붙나</TH><TH>후보 행</TH><TH>recheck 제거</TH><TH>버퍼</TH><TH>ms</TH></TR></THead>
          <TBody>
            {TW.map((t) => (
              <TR key={t.pattern}>
                <TD><K>{t.pattern}</K></TD>
                <TD className={t.idx > 1000 ? 'text-trgm' : 'text-ok'}>
                  {t.idx > 1000 ? '✗ 양쪽이 와일드카드' : t.pattern.endsWith('%') ? '✓ 앞이 문자열 시작' : '✓ 뒤가 문자열 끝'}
                </TD>
                <TD>{nf(t.idx)}</TD><TD>{nf(t.recheck)}</TD><TD>{nf(t.buf)}</TD><TD>{t.ms}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Callout kind="ok" title="실무 처방">
          <p>
            <K>pg_trgm</K> 을 써야 하는데 검색어가 짧다면, 패턴을 <K>'키워드%'</K> 나 <K>'% 키워드 %'</K> 로 바꾸는
            것만으로 500배 이상 얻는다. 다만 <K>% 키워드 %</K> 는 <strong>의미가 “낱말 검색”으로 바뀐다</strong> —
            그 대가를 실제로 잰 것이{' '}
            <Ref to="/foundations/whitespace#wrap">2글자를 공백으로 감싸면 trgm 이 살아나는가</Ref> 다(250행 → 203행).
          </p>
        </Callout>
      </Section>

      <Section id="version" title="6. 버전을 올리면 나아지나">
        <Callout kind="warn">
          <p>
            <strong>아니다.</strong> PG 16·17·18 에서 인덱스 스캔 행·recheck·버퍼가 한 자리도 다르지 않다.{' '}
            <K>GIN_SEARCH_MODE_ALL</K> 은 플래너의 선택이 아니라 <K>extractQuery()</K> 가 조건을 하나도 못 만든
            결과라, 코어가 할 수 있는 일이 없다 — <Link to="/experiments/versions">실험 07</Link>.
          </p>
        </Callout>
      </Section>
    </>
  )
}
