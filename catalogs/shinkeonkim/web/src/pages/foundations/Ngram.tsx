import { Link } from 'react-router-dom'
import { Ref } from '@/components/common/Ref'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Diagram } from '@/components/viz/Diagram'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const F = DATA.e02.fragments

export default function Ngram() {
  return (
    <>
      <PageHeader
        eyebrow="기초 개념"
        title="n-gram 이란 — 2와 3 사이에서 무엇이 갈리나"
        lede="확장 이야기를 걷어내고 개념 자체를 본다. 결론부터 말하면 n 은 “최소 검색어 길이”와 “조각 하나의 선택도”를 한꺼번에 정하는 값이다."
      />

      <EasyFirst>
        <p>
          긴 글에서 짧은 글자를 찾으려면 어떻게 할까요? 책 뒤 “찾아보기”는 낱말 단위라 <K>클럽하우스</K> 는 찾아도{' '}
          <K>클라우드클럽</K> 안의 <K>클럽</K> 은 못 찾습니다. 그래서 <strong>글자를 두세 개씩 잘라</strong> 그 조각들을
          전부 찾아보기에 넣습니다. <K>클라우드클럽</K> → <K>클라 · 라우 · 우드 · 드클 · 클럽</K>.
          이 조각이 <strong>n-gram</strong> 입니다.
        </p>
      </EasyFirst>

      <Section id="what" title="1. 무엇을 자르나">
        <p><strong>n-gram 은 문자열을 길이 n 짜리 조각으로 한 글자씩 밀어가며 자른 것</strong>이다.</p>
        <CodeBlock>{`"클라우드클럽"

2-gram:  클라  라우  우드  드클  클럽                (5개)
3-gram:  클라우  라우드  우드클  드클럽             (4개)`}</CodeBlock>
        <p>길이 <K>L</K> 인 문자열에서 나오는 조각 수는 <K>L - n + 1</K> 이다. 그러면 <K>'%클럽%'</K> 이 이렇게 풀린다.</p>
        <CodeBlock>{`"클럽" 의 2-gram = { 클럽 }
  -> 인덱스에서 "클럽" 조각의 행 목록을 꺼낸다
  -> 그 행들만 원문을 확인한다

"클럽" 의 3-gram = { }        ← 3글자가 안 되어 조각이 안 나온다!
  -> 조건이 하나도 없다`}</CodeBlock>
        <p>
          <strong>마지막 줄이 이 페이지 전체의 핵심이다.</strong> n 이 커지면 “검색어가 최소 n 글자여야 한다”는
          제약이 따라온다 — <Link to="/pg-trgm/two-char">2글자 함정</Link>.
        </p>
        <Clotho id="ngram-slice" />

        <h3>조각 집합은 정보를 잃는다</h3>
        <CodeBlock>{`"trial"   의 2-gram = { tr, ri, ia, al }
"trivial" 의 2-gram = { tr, ri, iv, vi, ia, al }`}</CodeBlock>
        <p>
          <K>trivial</K> 은 <K>trial</K> 의 조각 4개를 <strong>전부</strong> 포함한다. 인덱스만으로는 둘을 구분할 수
          없어서, 후보를 추린 뒤 원문을 다시 확인해야 한다 — <Link to="/foundations/recheck">Recheck</Link>.
        </p>
        <Callout kind="info">
          <p>
            <strong>n-gram 인덱스는 “정답을 주는 인덱스”가 아니라 “후보를 좁혀주는 필터”</strong>라고 이해하는 게
            정확하다.
          </p>
        </Callout>
      </Section>

      <Section id="padding" title="2. 패딩 — 단어 경계를 조각에 심어넣기">
        <p>
          그냥 자르면 “단어의 시작/끝”이라는 정보가 사라진다. 그래서 실제 구현은 <strong>앞뒤에 공백을 덧붙인 뒤</strong>{' '}
          자른다.
        </p>
        <Table>
          <THead><TR><TH></TH><TH>앞 패딩</TH><TH>뒤 패딩</TH><TH><K>클럽</K> 의 조각</TH></TR></THead>
          <TBody>
            <TR>
              <TD><Badge variant="bigm">pg_bigm</Badge> 2-gram</TD><TD>1</TD><TD>1</TD>
              <TD><K>" 클"</K> <K>클럽</K> <K>"럽 "</K> → <strong>3개</strong></TD>
            </TR>
            <TR>
              <TD><Badge variant="trgm">pg_trgm</Badge> 3-gram</TD><TD>2</TD><TD>1</TD>
              <TD><K>"  클"</K> <K>" 클럽"</K> <K>"클럽 "</K> → <strong>3개</strong></TD>
            </TR>
          </TBody>
          <TCaption>
            패딩까지 세면 길이 <K>L</K> 단어에서 나오는 조각 수가 <strong>양쪽 다 <K>L+1</K></strong> 로 같아진다.
          </TCaption>
        </Table>

        <h3 id="rpadding">왜 pg_trgm 은 뒤에 공백을 <em>하나만</em> 붙이나</h3>
        <p>앞은 2칸, 뒤는 1칸. 비대칭이라 자주 나오는 질문이다. 소스에는 값만 있고 이유는 안 적혀 있다.</p>
        <CodeBlock caption="contrib/pg_trgm/trgm.h">{`/* Options ... but note that trgm_regexp.c effectively assumes
 * these values of LPADDING and RPADDING. */
#define LPADDING		2
#define RPADDING		1`}</CodeBlock>

        <p><strong>답 (1) — 3글자를 채우는 데 앞은 2칸이 필요하고, 뒤는 1칸이면 이미 충분하다.</strong></p>
        <CodeBlock>{`단어 'club'  →  ␣␣club␣

␣␣c   ← "c 가 첫 글자다"        앞 패딩 2칸이 있어야 만들 수 있다
␣cl   ← "cl 로 시작한다"        앞 패딩 1칸
clu
lub
ub␣   ← "b 가 마지막 글자다"    뒤 패딩 1칸이면 충분하다

b␣␣   ← 뒤에 하나 더 붙여도 새 정보가 없다 — 조각 수만 늘고 인덱스만 커진다`}</CodeBlock>
        <p>
          끝을 표시하는 데는 공백 1칸이면 된다. 앞쪽이 2칸인 이유는 대칭이 아니라,{' '}
          <strong>첫 글자 하나만의 정보(<K>␣␣c</K>)를 담으려면 3글자 창의 나머지 두 칸을 공백으로 채워야 하기 때문</strong>이다.
        </p>

        <p><strong>답 (2) — 그래서 조각 개수가 <K>L+1</K> 로 딱 떨어진다.</strong></p>
        <CodeBlock>{`pg_trgm :  패딩한 길이 = L + 2 + 1 = L+3   →  조각 = (L+3) - 3 + 1 = L+1
pg_bigm :  패딩한 길이 = L + 1 + 1 = L+2   →  조각 = (L+2) - 2 + 1 = L+1`}</CodeBlock>
        <p>
          <strong>두 확장의 조각 개수가 같아지는 것이 우연이 아니다.</strong> 만약 <K>RPADDING = 2</K> 였다면 3-gram
          쪽만 조각이 <K>L+2</K> 개가 되어 하나 더 많아졌을 것이다.
        </p>

        <p><strong>답 (3) — <K>trgm_regexp.c</K> 가 이 값을 전제로 짜여 있다.</strong></p>
        <p>
          헤더 주석이 명시적으로 경고한다 — <em>“trgm_regexp.c effectively assumes these values”</em>. 정규식을
          트라이그램 조건으로 바꾸는 코드가 “앞 2 · 뒤 1”을 하드코딩된 가정으로 깔고 있어서,{' '}
          <strong>이 매크로는 사실상 고정값이다.</strong>
        </p>

        <Callout kind="ok" title="그래서 흔한 설명 하나가 틀렸다">
          <p>
            “2-gram 이라 조각이 더 많아서 인덱스가 크다”는 <strong>틀렸다.</strong> 실측에서도 생 조각 수가 한국어{' '}
            {nf(F[0].raw)} vs {nf(F[1].raw)} 로 비슷하다. 실제 크기 차이를 만드는 것은 조각 <em>개수</em> 가 아니라{' '}
            <strong>서로 다른 조각의 가짓수</strong>다 — <Ref to="#corpus">실제 말뭉치로 재본 것</Ref>.
          </p>
        </Callout>

        <h3 id="query-padding">패딩이 검색어에는 어떻게 적용되나</h3>
        <p>
          인덱싱할 때는 항상 패딩이 붙지만, <strong>검색 패턴에서는 붙을 때와 안 붙을 때가 있다.</strong>{' '}
          <K>%</K> 는 “여기에 아무 글자나 올 수 있다”는 뜻이라 패딩을 붙일 수 없다. <strong>여기가 실무에서 가장 중요한 표다.</strong>
        </p>
        <Table>
          <THead><TR><TH>패턴</TH><TH>앞 경계</TH><TH>뒤 경계</TH><TH>3-gram 을 만들 수 있나</TH></TR></THead>
          <TBody>
            <TR><TD><K>LIKE '%클클%'</K></TD><TD><K>%</K> → 패딩 불가</TD><TD><K>%</K> → 패딩 불가</TD><TD className="text-trgm"><strong>못 만든다</strong> (2글자)</TD></TR>
            <TR><TD><K>LIKE '클클%'</K></TD><TD>문자열 시작 → 패딩 2</TD><TD><K>%</K></TD><TD className="text-ok">만든다 (4글자 상당)</TD></TR>
            <TR><TD><K>LIKE '%클클'</K></TD><TD><K>%</K></TD><TD>문자열 끝 → 패딩 1</TD><TD className="text-ok">만든다 (3글자 상당)</TD></TR>
            <TR><TD><K>LIKE '% 클클 %'</K></TD><TD>공백(비단어 문자) → 패딩</TD><TD>공백 → 패딩</TD><TD className="text-ok">만든다</TD></TR>
          </TBody>
          <TCaption>
            마지막 줄이 실용적인 우회다 — 검색어를 공백으로 감싸면 2글자여도 3-gram 인덱스가 동작한다.
            대신 “부분 문자열 검색”이 “단어 검색”으로 의미가 바뀐다. 실측은{' '}
            <Link to="/foundations/whitespace">공백과 구두점</Link> 에 있다.
          </TCaption>
        </Table>
      </Section>

      <Section id="an" title="3. n 을 키우면 무엇이 달라지나">
        <p>핵심은 <strong>조합 수</strong>다. 알파벳 크기가 <K>A</K> 일 때 가능한 조각은 <K>A<sup>n</sup></K> 가지다.</p>
        <Table>
          <THead><TR><TH>문자 종류</TH><TH>A (대략)</TH><TH>가능한 2-gram</TH><TH>가능한 3-gram</TH></TR></THead>
          <TBody>
            <TR><TD>영문 소문자</TD><TD>26</TD><TD>676</TD><TD>17,576</TD></TR>
            <TR><TD>숫자</TD><TD>10</TD><TD>100</TD><TD>1,000</TD></TR>
            <TR><TD><strong>한글 완성형 음절</strong></TD><TD><strong>11,172</strong></TD><TD><strong>약 1.2억</strong></TD><TD><strong>약 1.4조</strong></TD></TR>
          </TBody>
        </Table>

        <h3>“가짓수가 많으면 검색이 나빠지지 않나?” — 추론을 따라가 본다</h3>
        <Diagram
          maxWidth={720}
          chart={`
flowchart LR
  s1["① 한국어는 문자 조합이 많다"] --> s2["② Aⁿ 이 커진다<br/>조각 가짓수가 많다"]
  s2 --> s3["③ '선택할 가짓수' 가 많아진다<br/>검색 효율이 떨어진다?"]
  s3 --> s4["④ 결과가 더 많이 나온다<br/>유사하지 않은 결과가 섞인다?"]
  classDef ok fill:#134e4a,stroke:#34d399,color:#d1fae5
  classDef doubt fill:#422006,stroke:#fbbf24,color:#fef3c7
  class s1,s2 ok
  class s3,s4 doubt
`}
          caption="초록 두 칸은 맞다. 주황 두 칸은 방향이 반대다 — 아래에서 하나씩 본다."
        />
        <p><strong>(1)과 (2)는 맞다. (3)과 (4)는 방향이 반대다.</strong></p>

        <h4>(1)(2) 맞다 — 다만 <K>A<sup>n</sup></K> 은 상한이지 실제 값이 아니다</h4>
        <Table>
          <THead><TR><TH></TH><TH>이론상 가짓수</TH><TH>실측 유니크 조각</TH><TH>이론 대비</TH></TR></THead>
          <TBody>
            <TR><TD>한국어 2-gram</TD><TD>124,812,624</TD><TD>{nf(F[0].uniq)}</TD><TD><strong>0.04%</strong></TD></TR>
            <TR><TD>한국어 3-gram</TD><TD>1.4 × 10<sup>12</sup></TD><TD>{nf(F[1].uniq)}</TD><TD><strong>거의 0</strong></TD></TR>
          </TBody>
          <TCaption>실제 언어는 조합을 균등하게 쓰지 않는다(지프 법칙). 그래서 <K>A<sup>n</sup></K> 으로 비용을 추정하면 안 된다 — 재야 한다.</TCaption>
        </Table>

        <h4>(3) 반대다 — 가짓수가 많으면 검색은 <em>빨라진다</em></h4>
        <Diagram
          maxWidth={760}
          chart={`
flowchart LR
  a["조각이 희귀하다"] --> b["포스팅 리스트가 짧다"] --> c["읽을 페이지가 적다"] --> d["후보 행이 적다"] --> e["힙에서 읽을 행이 적다"] --> f["검색이 빠르다"]
  classDef ok fill:#134e4a,stroke:#34d399,color:#d1fae5
  class f ok
`}
        />
        <ChartBox
          type="bar"
          height={280}
          title="3글자 검색어 · 선택도만 바꾼 것"
          data={{
            labels: DATA.e01.selectivity.map((r) => `${r.pct}%`),
            datasets: [
              { label: 'pg_bigm 버퍼', data: DATA.e01.selectivity.map((r) => r.bigm.buf), backgroundColor: alpha(C.bigm, 0.75) },
              { label: 'pg_trgm 버퍼', data: DATA.e01.selectivity.map((r) => r.trgm.buf), backgroundColor: alpha(C.trgm, 0.75) },
            ],
          }}
          options={{ scales: { y: { title: { display: true, text: '버퍼(8KB 페이지)' } } } }}
          caption={<><strong>모든 선택도에서 trgm 이 버퍼를 덜 읽는다.</strong> 선택도를 0.1%에서 30%까지 300배 흔들어도 순위가 안 바뀐다.</>}
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e01}`}>실험 01 선택도 축</SourceNote>
        <p>“선택할 가짓수가 많아지면 탐색 비용이 커지지 않나”가 걱정이라면 — <strong>그 트리는 B-tree 다.</strong></p>
        <CodeBlock>{`유니크 조각  50,000 개  →  log₂(50,000)  ≈ 15.6
유니크 조각 120,000 개  →  log₂(120,000) ≈ 16.9      2.4배로 늘어도 깊이는 1단계 남짓`}</CodeBlock>
        <p>실제 인덱스 버퍼 수가 한 자릿수(4~17)인 것이 이걸 보여준다. <strong>키 가짓수는 검색 비용의 병목이 아니다.</strong></p>

        <h4>그래도 비용은 있다 — 다만 <em>다른 곳</em>에 나타난다</h4>
        <Table>
          <THead><TR><TH>늘어나는 비용</TH><TH>왜</TH><TH>실측</TH></TR></THead>
          <TBody>
            <TR><TD><strong>인덱스 용량</strong></TD><TD>엔트리 트리는 유니크 조각 수에 비례하는 <strong>고정비</strong></TD>
              <TD>3-gram 인덱스가 <strong>25% 크다</strong> ({DATA.e06.size.trgmMB} MB vs {DATA.e06.size.bigmMB} MB, 100만 행)</TD></TR>
            <TR><TD><strong>빌드 시간</strong></TD><TD>만들 엔트리가 많다</TD>
              <TD>tsvector {DATA.e06.buildSec.tsv}s {'<'} trgm {DATA.e06.buildSec.trgm}s ≈ bigm {DATA.e06.buildSec.bigm}s</TD></TR>
            <TR><TD><strong>유사도 검색의 재현율</strong></TD><TD>조각이 희귀할수록 오타 하나가 점수를 크게 깎는다</TD>
              <TD><K>클둥이</K>→<K>클동이</K> 가 trgm 에서 <strong>0.1429</strong> — 임계값 미달</TD></TR>
          </TBody>
        </Table>

        <h4>(4) 반대다 — “유사하지 않은 결과가 섞이는” 일은 일어나지 않는다</h4>
        <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ok/30 bg-ok/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge variant="ok">LIKE 검색</Badge> 절대 안 섞인다</p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12px] leading-relaxed"><code>{`Bitmap Index Scan  →  후보 1,000,000행
Rows Removed by Index Recheck: 999,500
결과: 500행   ← 정답은 항상 정확하다`}</code></pre>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Recheck 이 원문을 다시 대보기 때문이다. 인덱스가 나쁘면 나타나는 증상은 <strong>“틀린 결과”가 아니라 “느림”</strong>이다.
            </p>
          </div>
          <div className="rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <p className="mb-2 text-[13px] font-semibold"><Badge variant="warn">유사도 검색</Badge> 문제는 있는데 방향이 반대다</p>
            <pre className="overflow-x-auto rounded-lg bg-[hsl(222_60%_5%)] p-3 text-[12px] leading-relaxed"><code>{`조각이 희귀해진다
  → 겹치는 조각이 줄어든다
  → 점수가 낮아진다
  → 임계값에 못 미쳐 탈락한다`}</code></pre>
            <p className="mt-2 text-[12px] text-muted-foreground">
              즉 “유사하지 않은 결과가 섞이는(정밀도 저하)”이 아니라 <strong>“유사한 결과를 놓치는(재현율 저하)”</strong> 쪽이다.
            </p>
          </div>
        </div>

        <Table>
          <THead><TR><TH>추론 단계</TH><TH>판정</TH><TH>실제로는</TH></TR></THead>
          <TBody>
            <TR><TD>(1) 한국어는 조합이 많다</TD><TD className="text-ok">맞다</TD><TD>음절 11,172자</TD></TR>
            <TR><TD>(2) <K>A<sup>n</sup></K> 이 커진다</TD><TD className="text-ok">맞다</TD><TD>단, 실제 유니크 조각은 그 <strong>0.04%</strong></TD></TR>
            <TR><TD>(3) 검색 효율이 떨어진다</TD><TD className="text-trgm"><strong>반대</strong></TD><TD>조각이 희귀해져 <strong>빨라진다.</strong> 엔트리 트리는 B-tree 라 <K>log</K> 로 늘 뿐</TD></TR>
            <TR><TD>(4) 유사하지 않은 결과가 섞인다</TD><TD className="text-trgm"><strong>반대</strong></TD><TD><K>LIKE</K> 는 Recheck 이 정확성을 보장한다. 유사도 검색에서는 오히려 <strong>놓친다</strong></TD></TR>
            <TR><TD>➕ 비용은 있다</TD><TD>—</TD><TD><strong>인덱스 용량 · 빌드 시간 · 유사도 재현율</strong> 에 나타난다</TD></TR>
          </TBody>
        </Table>

        <Callout kind="ok" title="한 줄로">
          <p>
            <K>n</K> 을 키우면 조각이 희귀해져 <strong>검색은 빨라지고 인덱스는 커지며, 짧은 검색어와 오탈자에는
            약해진다.</strong> 한국어는 알파벳이 커서 <K>n = 2</K> 로도 이미 충분히 희귀하므로,{' '}
            <strong><K>n</K> 을 키워 얻을 것보다 잃을 것이 크다.</strong>
          </p>
        </Callout>
      </Section>

      <Section id="corpus" title="4. 실제 말뭉치로 재본 것">
        <p>
          이론상 조합 수는 위와 같지만, <strong>실제 텍스트에서 몇 가지 조각이 나오는지</strong>는 또 다른 문제다.
          표본 20,000행에서 조각을 세었다.
        </p>
        <Callout kind="warn" title="세는 방법에 함정이 하나 있다">
          <p>
            <K>show_bigm()</K>/<K>show_trgm()</K> 은 <strong>문서별로 중복을 제거한</strong> 조각을 돌려준다
            (두 확장 모두 마지막에 <K>qsort</K> + unique 를 돌린다). 그래서 중복 제거 전 개수를 문자열 길이로
            따로 계산해 함께 낸다.
          </p>
        </Callout>
        <Table>
          <THead>
            <TR><TH>데이터</TH><TH>n-gram</TH><TH>중복 제거 전</TH><TH>중복 제거 후</TH><TH>손실률</TH><TH>유니크 조각</TH><TH>조각당 출현</TH></TR>
          </THead>
          <TBody>
            {F.map((r, i) => (
              <TR key={i}>
                <TD>{r.data}</TD><TD>{r.n}</TD><TD>{nf(r.raw)}</TD><TD>{nf(r.dedup)}</TD>
                <TD>{r.loss}%</TD><TD><strong>{nf(r.uniq)}</strong></TD><TD>{r.perFrag}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e02}`}>실험 02</SourceNote>

        <p><strong>읽을 것 네 가지.</strong></p>
        <ol>
          <li>
            <strong>생 조각 수는 비슷하다</strong> (한국어 {nf(F[0].raw)} vs {nf(F[1].raw)}).{' '}
            <Ref to="#padding">패딩</Ref> 에서 계산한{' '}
            <K>L + 1</K> 이 대체로 맞다.
          </li>
          <li>
            <strong>완전히 같지는 않은데, 두 확장이 “단어”를 다르게 나누기 때문이다.</strong> <K>pg_bigm</K> 은 공백만
            구분자로 쓰고(<K>!t_isspace</K>), <K>pg_trgm</K> 은 영숫자가 아니면 전부 구분자로 쓴다
            (<K>KEEPONLYALNUM</K>). 후자는 단어 개수가 늘지만 구두점 글자를 버리므로, 두 효과가 상쇄돼 총합이
            비슷해진다 — <Link to="/foundations/whitespace">직접 찍어본 조각들</Link>.
          </li>
          <li>
            <strong>중복 제거가 영문 2-gram 을 {F[2].loss}% 깎는다.</strong> 한 문장 안에 <K>th</K>·<K>he</K>·<K>in</K>{' '}
            같은 2-gram 이 여러 번 나오기 때문이다. 3-gram 은 {F[3].loss}% 만 깎인다. 그래서 중복 제거 후 숫자만 보면
            영문에서 3-gram 이 많아 보이는데, 이건 “3-gram 이 더 만든다”가 아니라{' '}
            <strong>“2-gram 이 더 많이 지워졌다”</strong>는 뜻이다.
          </li>
          <li>
            <strong>진짜 차이는 유니크 조각 수다.</strong> 한국어에서 3-gram 이 2.4배 많고
            ({nf(F[1].uniq)} vs {nf(F[0].uniq)}), 조각 하나가 그만큼 희귀하다(평균 출현 {F[1].perFrag}회 vs {F[0].perFrag}회).
            <strong> 영문에서는 2-gram 유니크 조각이 {nf(F[2].uniq)}개뿐이라</strong> 조각 하나가 평균 {F[2].perFrag}행에
            나타난다 — 필터로서 거의 쓸모가 없다. 같은 2-gram 인데 <strong>한국어 조각이 26배 다양하고 49배 희귀하다.</strong>
          </li>
        </ol>
        <p className="text-[12.5px] text-muted-foreground">
          영문 데이터는 어휘 12개를 조합해 만든 합성 데이터라 실제 영문보다 반복도가 훨씬 높다. 절대값은 과장돼 있고,
          읽어야 할 것은 <strong>한국어와 영문 사이의 방향 차이</strong>다.
        </p>

        <h3>용량은 “행 수 × 상수” 가 아니다</h3>
        <CodeBlock>{`엔트리 트리   : 서로 다른 조각의 목록        -> 유니크 조각 수에 비례  (고정비)
포스팅 리스트 : 각 조각이 어느 행에 있는지   -> 총 조각 수에 비례      (변동비, 압축됨)`}</CodeBlock>
        <ChartBox
          type="line"
          height={300}
          title="테이블 대비 인덱스 배수 — 행이 늘수록 떨어진다"
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
              <strong>btree 는 모든 값을 그대로 저장하므로 0.98× 로 일정하다</strong> — 이 대비가 n-gram 인덱스에만
              고정비가 있다는 것을 보여준다. 다만 이 데이터는 말뭉치를 순환 참조해 만든 것이라 유니크 조각이 아예 안
              늘었고, <strong>실제 서비스에서는 배수 감소가 이만큼 크지 않다.</strong>
            </>
          }
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e04}`}>실험 04</SourceNote>

        <Diagram
          chart={`
flowchart LR
  n["n 을 키우면"] --> u["유니크 조각이 는다"] --> r["조각 하나가 희귀해진다"]
  r --> good["선택도가 좋아진다"]
  r --> big["대신 인덱스가 커진다"]
  n --> minlen["최소 검색어 길이가 n 이 된다"]
  classDef ok fill:#134e4a,stroke:#34d399,color:#d1fae5
  classDef cost fill:#422006,stroke:#fbbf24,color:#fef3c7
  class good ok
  class big,minlen cost
`}
          caption="트레이드오프를 한 덩어리로. 한국어에서 2-gram 을 고르는 것은 초록 하나를 조금 포기하고 주황 하나를 지우는 거래다."
        />
        <p>
          한국어에서 2-gram 을 고르는 것은 <strong>“선택도를 조금 포기하고 최소 검색어 길이를 1 줄이는” 거래</strong>다.
          한글은 알파벳이 커서 선택도 손해가 영문만큼 크지 않고, 반대로 2글자 검색어는 매우 흔하므로 이 거래가 남는
          장사가 된다 — <Link to="/pg-bigm/korean">한국어에서 유리한 이유</Link>.
        </p>
      </Section>

      <Section id="lexeme" title="5. n-gram 이 아닌 대안 — 어휘 단위 색인">
        <CodeBlock>{`"클라우드클럽 스터디에 참여했다"

n-gram(문자 단위):  클라 라우 우드 드클 클럽 럽스 ...   (띄어쓰기와 무관)
tsvector(어휘 단위): '클라우드클럽' '스터디' '참여'      (형태소/토큰으로 자른다)`}</CodeBlock>
        <Table>
          <THead><TR><TH></TH><TH>n-gram</TH><TH>tsvector</TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">자르는 단위</TD><TD>문자</TD><TD>단어/형태소</TD></TR>
            <TR><TD className="text-muted-foreground">부분 문자열 검색</TD><TD className="text-ok"><strong>된다</strong></TD><TD>안 된다</TD></TR>
            <TR><TD className="text-muted-foreground">어간 추출 (running → run)</TD><TD>안 된다</TD><TD className="text-ok">된다</TD></TR>
            <TR><TD className="text-muted-foreground">관련도 랭킹</TD><TD>없다</TD><TD className="text-ok"><K>ts_rank</K></TD></TR>
            <TR><TD className="text-muted-foreground">한국어</TD><TD>별도 설정 없이 동작</TD><TD><strong>형태소 분석기가 없으면 사실상 공백 분리</strong></TD></TR>
            <TR><TD className="text-muted-foreground">인덱스 크기</TD><TD>크다</TD><TD>작다</TD></TR>
          </TBody>
          <TCaption>자세한 비교는 <Link to="/fulltext/tsvector">tsvector / tsquery</Link>.</TCaption>
        </Table>
      </Section>

      <Section id="summary" title="6. 정리 — 세 문장">
        <ol>
          <li><strong>n-gram 은 “부분 문자열 포함”을 “조각 집합의 포함 관계”로 바꿔 인덱싱 가능하게 만드는 기법이고, 그 대가로 Recheck 이 항상 따라온다.</strong></li>
          <li><strong>n 은 “최소 검색어 길이”와 “조각 하나의 선택도”를 동시에 정하는 값이라, 검색어 길이 분포가 짧은 한국어에서는 2가, 길이가 긴 영문 자연어에서는 3이 유리하다.</strong></li>
          <li><strong>패딩 규칙 때문에 검색어를 어떻게 감싸느냐(<K>%X%</K> / <K>X%</K> / <K>% X %</K>)에 따라 같은 검색어도 인덱스 동작이 완전히 달라진다.</strong></li>
        </ol>
      </Section>
    </>
  )
}
