import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C } from '@/lib/chart'
import { DATA } from '@/data/measurements'

const E5 = DATA.e05
const round = (n: number) => Math.round(n)
const avg = (a: number[]) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10

export default function Overview() {
  return (
    <>
      <PageHeader
        eyebrow="개요"
        title="한국어 부분 문자열 검색, 무엇을 써야 하나"
        lede={
          <>
            <K>LIKE '%검색어%'</K> 를 인덱스로 푸는 세 갈래 — <K>pg_bigm</K>, <K>pg_trgm</K>, 그리고 코어의{' '}
            <K>tsvector</K>. 이 사이트의 모든 숫자는 <strong>이 저장소의 스크립트를 실제로 돌려서</strong> 얻었고,
            대부분 <strong>두 번씩 돌려 재현성을 확인</strong>했으며, 그러지 못한 것은 그렇다고 적었다.
          </>
        }
        tags={[
          { label: DATA.env.pg },
          { label: DATA.env.bigm, variant: 'bigm' },
          { label: DATA.env.trgm, variant: 'trgm' },
          { label: DATA.env.host },
        ]}
      />

      <StatGrid>
        <Stat tone="bigm" value={`${round(E5.ms.trgm.infix[0] / E5.ms.bigm.infix[0])}×`}
              label={<>2글자 <K>%검색어%</K> 에서 bigm 이 trgm 보다 빠른 배수</>} />
        <Stat tone="ok" value={`${round(E5.ms.none.infix[0] / E5.ms.bigm.infix[0])}×`}
              label={<>인덱스 없는 <K>LIKE</K> 대비 bigm</>} />
        <Stat tone="warn" value={`${DATA.e04.series[0].ratio[2]}×`}
              label="100만행에서 bigm 인덱스 / 테이블 크기" />
        <Stat tone="tsv" value={`${avg(DATA.e06.recall.map((r) => r.tsPct))}%`}
              label={<>한국어에서 <K>tsquery</K> 평균 재현율</>} />
      </StatGrid>

      <Section title="결론부터">
        <Table>
          <THead><TR><TH>상황</TH><TH>선택</TH><TH>근거</TH></TR></THead>
          <TBody>
            <TR>
              <TD><strong>한국어 · 검색어가 2글자일 수 있다</strong></TD>
              <TD><Badge variant="bigm">pg_bigm</Badge></TD>
              <TD><K>pg_trgm</K> 은 이 구간에서 인덱스가 무력화된다 — <Link to="/pg-trgm/two-char">2글자 함정</Link></TD>
            </TR>
            <TR>
              <TD>영문 자연어 · 검색어가 대체로 3글자 이상</TD>
              <TD><Badge variant="trgm">pg_trgm</Badge></TD>
              <TD>조각의 선택도가 높고 유사도·정규식 지원이 있다</TD>
            </TR>
            <TR>
              <TD>오탈자 허용 / 유사도 정렬</TD>
              <TD><Badge variant="trgm">pg_trgm</Badge></TD>
              <TD><K>%</K>, <K>{'<->'}</K>, <K>word_similarity</K> — bigm 에는 대응이 없다</TD>
            </TR>
            <TR>
              <TD>단어 단위 검색 + 관련도 랭킹 + 구절 검색</TD>
              <TD><Badge variant="tsv">tsvector</Badge></TD>
              <TD>위치와 <K>ts_rank</K> 를 가진 유일한 쪽 — <Link to="/fulltext/tsvector">전문검색</Link></TD>
            </TR>
            <TR>
              <TD>한국어에서 “빠짐없이 찾기”가 요구사항</TD>
              <TD><Badge variant="warn">tsvector 부적합</Badge></TD>
              <TD>정확 일치 재현율 7~38% (사전 없는 <K>simple</K> 설정)</TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section title="한눈에 보는 차이">
        <Table>
          <THead>
            <TR>
              <TH></TH>
              <TH><Badge variant="bigm">pg_bigm</Badge></TH>
              <TH><Badge variant="trgm">pg_trgm</Badge></TH>
              <TH><Badge variant="tsv">tsvector</Badge></TH>
            </TR>
          </THead>
          <TBody>
            {([
              ['설치', <K key="a">CREATE EXTENSION</K>, <K key="b">CREATE EXTENSION</K>, <strong key="c" className="text-ok">코어 — 불필요</strong>],
              ['단위', '2문자 조각', '3문자 조각', '어휘소'],
              ['조각 저장', '원본 바이트', 'CRC32 해시', '정규화된 단어'],
              ['1~2글자 검색', <strong key="d" className="text-ok">된다</strong>, '인덱스 무력화', '단어면 된다'],
              ['인덱스', 'GIN 만', 'GIN · GiST', 'GIN · GiST'],
              ['유사도 / 오탈자', '있음(단순)', <strong key="e" className="text-ok">풍부</strong>, '없음'],
              ['정규식 ~ 가속', '없음', '영문만 (U+07FF 상한)', '없음'],
              ['랭킹 / 구절', '없음', '없음', <strong key="f" className="text-ok">있음</strong>],
              ['ILIKE', 'Seq Scan (한글이어도)', '인덱스 사용 — 오히려 LIKE 보다 정확하다', '해당 없음'],
            ] as const).map((row, i) => (
              <TR key={i}>
                <TD className="font-medium text-muted-foreground">{row[0]}</TD>
                <TD>{row[1]}</TD><TD>{row[2]}</TD><TD>{row[3]}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            ILIKE 한 줄은 카탈로그 상식이 아니라 <Link to="/pg-bigm/operators">연산자 카탈로그(<K>pg_amop</K>)를 직접 읽어</Link>{' '}
            확인했고, <Link to="/experiments/ilike">실제로 얼마나 차이 나는지도 쟀다</Link> — pg_bigm 은 한글 검색어에서도
            <K>ILIKE</K> 한 글자에 51배를 잃는다.
          </TCaption>
        </Table>
      </Section>

      <Section title="그 차이가 실제로 얼마나 나나">
        <ChartBox
          type="line"
          height={330}
          data={{
            labels: [...E5.lengths].map((n) => `${n}글자`),
            datasets: [
              { label: '인덱스 없음', data: [...E5.ms.none.infix], borderColor: C.none, backgroundColor: C.none, borderDash: [6, 4], tension: 0.2 },
              { label: 'pg_bigm', data: [...E5.ms.bigm.infix], borderColor: C.bigm, backgroundColor: C.bigm, tension: 0.2 },
              { label: 'pg_trgm', data: [...E5.ms.trgm.infix], borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
            ],
          }}
          options={{
            scales: { y: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } },
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y} ms` } } },
          }}
          caption={
            <>
              100만행에서 검색어 길이별 실행 시간(로그 스케일, <K>%검색어%</K>).{' '}
              <strong>2글자 한 칸을 빼면 두 확장은 사실상 같다</strong> — 그 한 칸이 선택을 가른다.
            </>
          }
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e05}`}>실험 05 · {DATA.e05.rows.toLocaleString('ko-KR')}행</SourceNote>
      </Section>

      <Callout kind="tip" title="어디서부터 읽을까">
        <p>
          용어가 낯설면 <Link to="/start/first">처음이라면</Link> 다섯 단계를 먼저 보라. 3분이면 이 카탈로그의 논지가
          전부 들어온다. 무엇을 쓸지만 정하면 되는 상황이면 위의 “결론부터” 표와{' '}
          <Link to="/pg-bigm/korean">한국어에서 유리한 이유</Link> 두 쪽으로 충분하다.
        </p>
      </Callout>
    </>
  )
}
