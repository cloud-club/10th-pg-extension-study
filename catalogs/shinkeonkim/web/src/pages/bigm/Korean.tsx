import { Link } from 'react-router-dom'
import { Ref } from '@/components/common/Ref'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { SIM_PAIRS } from '@/data/operators'
import { nf } from '@/lib/utils'

const F = DATA.e02.fragments
const TW = DATA.e05.twoChar

export default function Korean() {
  return (
    <>
      <PageHeader
        eyebrow="pg_bigm"
        title="한국어에서 유리한 이유 — 다섯 가지"
        lede={
          <>
            “한글이니까 2-gram”이라고 한 줄로 넘어가지만, 실제로는 서로 다른 근거가 겹쳐 있다.{' '}
            <strong>둘은 언어의 성질이고, 셋은 구현의 성질이다.</strong>
          </>
        }
      />

      <EasyFirst>
        <p>근거는 크게 둘입니다.</p>
        <ol>
          <li>
            <strong>한글은 두 글자면 이미 낱말입니다</strong> — <K>서울</K>·<K>배송</K>·<K>결제</K>·<K>클클</K>.
            그런데 세 글자씩 자르는 <K>pg_trgm</K> 은 <strong>두 글자 검색어에서 조각을 하나도 못 만듭니다.</strong>
          </li>
          <li>
            <strong>한글은 글자 종류가 많습니다</strong> — 음절이 11,172자라 두 글자 조합만으로도 충분히 다양합니다.
            영어는 알파벳이 26자뿐이라 두 글자 조합이 너무 흔해서 쓸모가 없습니다(영문 2-gram 조각 하나가 평균{' '}
            <strong>{F[2].perFrag}행</strong>, 한국어는 <strong>{F[0].perFrag}행</strong>).
          </li>
        </ol>
      </EasyFirst>

      <Section id="table" title="한 장으로">
        <Table>
          <THead><TR><TH></TH><TH>근거</TH><TH>실측 / 소스</TH></TR></THead>
          <TBody>
            <TR>
              <TD><Badge>언어</Badge></TD>
              <TD><strong>2-gram 으로도 선택도가 충분하다</strong> — 음절 문자 체계라 알파벳이 크다</TD>
              <TD>한국어 2-gram 유니크 <strong>{nf(F[0].uniq)}</strong>개 / 조각당 {F[0].perFrag}행<br />영문 2-gram 은 <strong>{nf(F[2].uniq)}</strong>개 / 조각당 {F[2].perFrag}행 — 필터로 못 쓴다</TD>
            </TR>
            <TR>
              <TD><Badge>언어</Badge></TD>
              <TD><strong>짧은 검색어가 흔하다</strong> — 음절 하나가 형태소 크기라 2음절이면 이미 낱말이다</TD>
              <TD><K>서울</K>·<K>강남</K>·<K>배송</K>·<K>결제</K>·<K>클클</K>·<K>코아</K><br /><span className="text-[12px] text-muted-foreground">이건 언어학적 추론이고 이 카탈로그가 측정한 것이 아니다</span></TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">구현</Badge></TD>
              <TD><strong>조각을 해싱하지 않는다 → 1글자도 인덱스를 탄다</strong></TD>
              <TD>엔트리가 사전순이라 <K>comparePartial()</K> 을 등록할 수 있다. trgm 은 CRC32 해시라 접두어 구간이 성립하지 않는다</TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">구현</Badge></TD>
              <TD><strong>구두점에서 단어를 끊지 않는다</strong></TD>
              <TD><K>192.168.0.1</K> → trgm 은 <K>192/168/0/1</K> 네 단어, bigm 은 통째로 — <Link to="/foundations/whitespace">직접 찍어본 조각</Link></TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">구현</Badge></TD>
              <TD><strong>오탈자에 더 관대하다</strong></TD>
              <TD>같은 오타에 0.5000 vs 0.1429 — <Ref to="#a5">오탈자에 더 관대하다</Ref></TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section id="a1" title="1. 언어 — 2-gram 으로도 선택도가 충분하다">
        <p>
          n-gram 인덱스가 쓸모 있으려면 <strong>조각 하나가 충분히 희귀해야</strong> 한다. 조각 하나가 테이블의
          절반에 나타나면 필터로서 의미가 없다. 그 희귀함은 <strong>알파벳 크기 <K>A</K></strong> 가 결정한다.
        </p>
        <ChartBox
          type="bar"
          height={280}
          title="조각 하나가 평균 몇 행에 나타나나 — 낮을수록 좋은 필터"
          data={{
            labels: F.map((r) => `${r.data} ${r.n}`),
            datasets: [{
              label: '조각당 평균 출현 행',
              data: F.map((r) => r.perFrag),
              backgroundColor: F.map((r) => (r.n === '2-gram' ? alpha(C.bigm, 0.8) : alpha(C.trgm, 0.8))),
            }],
          }}
          options={{
            indexAxis: 'y' as const,
            plugins: { legend: { display: false } },
            scales: { x: { type: 'logarithmic', title: { display: true, text: '행 (로그)' } } },
          }}
          caption={
            <>
              <strong>같은 2-gram 인데 한국어 조각이 영문보다 {Math.round(F[2].perFrag / F[0].perFrag)}배 희귀하다.</strong>{' '}
              영문 2-gram 은 조각 하나가 {F[2].perFrag}행에 나타나 필터로 거의 쓸모가 없고, 그래서 영문권에서
              3-gram 이 표준이 된 것은 자연스럽다.
            </>
          }
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e02}`}>실험 02 · 표본 20,000행</SourceNote>
        <Callout kind="ok">
          <p>
            <strong>이 표본의 한국어 bigram은 종류가 많고 각 조각의 출현 빈도가 낮았다.</strong>
            이런 분포에서는 2-gram으로도 검색 후보를 좁힐 수 있다.
          </p>
        </Callout>
      </Section>

      <Section id="a2" title="2. 언어 — 짧은 검색어가 흔하다">
        <CodeBlock caption="trgm_op.c — make_trigrams()">{`if (charlen < 3)
    return tptr;      /* 포기한다 */`}</CodeBlock>
        <p>
          조각이 0개면 GIN 은 <Link to="/foundations/gin#search-mode-all"><K>GIN_SEARCH_MODE_ALL</K></Link> 로
          떨어진다 — 인덱스 엔트리를 전부 읽고 힙까지 훑는다.{' '}
          <strong>실측에서 인덱스 없는 시퀀셜 스캔보다 {Math.round(TW[0].ms / DATA.e05.ms.none.infix[0])}배 느렸다</strong>
          ({TW[0].ms} ms vs {DATA.e05.ms.none.infix[0]} ms, 100만 행).
        </p>
        <p>
          한국어에서는 이 구간에 자주 들어간다. 한글은 <strong>음절 하나가 형태소 크기에 가까워서</strong>, 2음절이면
          이미 온전한 낱말이다 — <K>서울</K>, <K>강남</K>, <K>클클</K>, <K>코아</K>, <K>신건</K>, <K>배송</K>,{' '}
          <K>결제</K>. 영어에서 2글자 검색어(<K>ab</K>)가 거의 무의미한 것과 대조적이다.
        </p>
        <Callout kind="warn" title="이건 측정한 것이 아니다">
          <p>
            “한국어 검색어는 짧다”는 <strong>이 카탈로그가 측정한 것이 아니다.</strong> 음절이 형태소 크기라는
            언어학적 성질에서 나온 추론이고, 서비스마다 검색어 길이 분포는 다르다. 실제로 확인하려면 자기 서비스의
            검색 로그를 봐야 한다.
          </p>
        </Callout>
      </Section>

      <Section id="a3" title="3. 구현 — 조각을 해싱하지 않는다">
        <p>이게 “2-gram 이라서” 보다 더 근본적인 차이다.</p>
        <Table>
          <THead><TR><TH></TH><TH><Badge variant="bigm">pg_bigm</Badge></TH><TH><Badge variant="trgm">pg_trgm</Badge></TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">조각 타입</TD><TD><K>{'{bool pmatch; int8 bytelen; char str[8];}'}</K></TD><TD><K>typedef char trgm[3]</K> — <strong>고정 3바이트</strong></TD></TR>
            <TR><TD className="text-muted-foreground">멀티바이트</TD><TD><strong>원본 바이트 그대로</strong></TD><TD>9바이트 한글 조각을 3바이트에 못 담아 <strong>CRC32 해싱</strong></TD></TR>
            <TR><TD className="text-muted-foreground">GIN 엔트리 정렬</TD><TD><strong>사전순</strong></TD><TD>해시값 순 (원문 순서와 무관)</TD></TR>
            <TR><TD className="text-muted-foreground"><K>comparePartial</K></TD><TD className="text-ok"><strong>있다</strong></TD><TD>등록할 수 없다</TD></TR>
          </TBody>
          <TCaption>
            GIN 의 엔트리 트리는 B-tree 라 정렬된 키에 대한 접두어 구간 탐색이 된다 — <Link to="/foundations/gin">GIN 인덱스</Link>.
          </TCaption>
        </Table>
      </Section>

      <Section id="a4" title="4. 구현 — 구두점에서 단어를 끊지 않는다">
        <CodeBlock>{`'192.168.0.1'  →  pg_trgm : "192" / "168" / "0" / "1" 네 단어로 쪼갠다 (점은 버린다)
               →  pg_bigm : "192.168.0.1" 통째로 (공백만 경계다)`}</CodeBlock>
        <p>
          IP·버전·경로·식별자·이메일처럼 <strong>구두점이 의미를 갖는 검색</strong>이면, 길이와 무관하게{' '}
          <K>pg_bigm</K> 이다. 조각을 그대로 찍어본 것은{' '}
          <Link to="/foundations/whitespace">공백과 구두점</Link> 에 있다.
        </p>
        <Callout kind="warn" title="널리 퍼진 설명 하나는 틀렸다">
          <p>
            “<K>KEEPONLYALNUM</K> 때문에 <K>pg_trgm</K> 이 한글을 걸러낸다”는 <strong>틀렸다.</strong>{' '}
            <K>show_trgm('가나다라')</K> 는 조각 5개를 정상 생성한다 — <K>ISWORDCHR</K> 가 쓰는{' '}
            <K>t_isalnum_with_len()</K> 은 멀티바이트를 인식한다. 실제 문제는 구두점이다.{' '}
            <Link to="/meta/corrections">정정 목록</Link>에 기록해 두었다.
          </p>
        </Callout>
      </Section>

      <Section id="a5" title="5. 구현 — 오탈자에 더 관대하다">
        <p>
          한 글자가 틀어지면 <strong>2-gram 은 조각 2개가, 3-gram 은 조각 3개가</strong> 깨진다. 게다가 유사도 공식의
          분모가 다르다.
        </p>
        <Table>
          <THead>
            <TR><TH></TH><TH>공식</TH><TH><K>클라우드클럽</K> → <K>클라으드클럽</K></TH><TH><K>클둥이</K> → <K>클동이</K></TH></TR>
          </THead>
          <TBody>
            <TR>
              <TD><K>bigm_similarity()</K></TD>
              <TD>겹친 수 / <strong>max(조각 수)</strong></TD>
              <TD className="text-ok"><strong>5 / 7 = 0.7143</strong></TD>
              <TD className="text-ok"><strong>0.5000</strong></TD>
            </TR>
            <TR>
              <TD><K>similarity()</K></TD>
              <TD>겹친 수 / <strong>합집합 크기</strong> (자카드)</TD>
              <TD className="text-warn"><strong>4 / 10 = 0.4000</strong></TD>
              <TD className="text-trgm"><strong>0.1429</strong></TD>
            </TR>
          </TBody>
          <TCaption>
            6글자 쌍은 겹친 조각이 <strong>5 대 4 로 한 개 차이</strong>인데 점수가 0.71 대 0.40 으로 벌어진다 —
            분모가 만든 차이다. <strong>3글자 쌍에서는 그 차이가 기본 임계값 0.3 을 사이에 두고 갈린다</strong>
            (한쪽은 매칭, 한쪽은 탈락). 임계값을 그대로 옮기면 안 된다 —{' '}
            <Ref to="/pg-trgm/similarity">유사도와 KNN</Ref>.
          </TCaption>
        </Table>
        <ChartBox
          type="bar"
          height={330}
          title="같은 오탈자, 다른 점수"
          data={{
            labels: SIM_PAIRS.map((p) => `${p.from} → ${p.to}`),
            datasets: [
              { label: 'bigm_similarity()', data: SIM_PAIRS.map((p) => p.bigm), backgroundColor: alpha(C.bigm, 0.8) },
              { label: 'similarity()', data: SIM_PAIRS.map((p) => p.trgm), backgroundColor: alpha(C.trgm, 0.8) },
            ],
          }}
          options={{
            indexAxis: 'y' as const,
            scales: { x: { max: 1, title: { display: true, text: '유사도 (기본 임계값 0.3)' } } },
          }}
          caption={
            <>
              <strong>한글 오탈자에서는 pg_bigm 이 항상 높다</strong>(1.1× ~ 3.5×). 마지막 줄만 반대다 —{' '}
              <K>CloudClub</K> vs <K>cloudclub</K> 에서 pg_trgm 은 1.0(완전 동일), pg_bigm 은 0.6667.{' '}
              <K>pg_trgm</K> 만 <K>IGNORECASE</K> 로 소문자화하기 때문이다.
            </>
          }
        />
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e03}`}>실험 03</SourceNote>
        <p>
          <K>클둥이</K> → <K>클동이</K> 에서 3.5배로 가장 크게 벌어진다. 3글자 단어에서 가운데 한 글자가 틀리면
          3-gram 은 겹치는 조각이 거의 남지 않는다(0.1429 = 임계값 0.3 미달 → <strong>검색에 안 걸린다</strong>). 짧은 한국어
          이름·별명의 오탈자 검색에서는 <K>pg_bigm</K> 이 아니면 안 된다는 뜻이다.
        </p>
      </Section>

      <Section id="balance" title="6. 그런데 pg_trgm 이 이기는 칸도 있다">
        <Callout kind="warn" title="“pg_bigm 이 무조건 빠르다”는 틀렸다">
          <ul>
            <li><strong>3글자 이상</strong>에서는 실측상 <K>pg_trgm</K> 이 버퍼를 <strong>덜</strong> 읽은 경우가 있다(4 vs 7). 조각이 2.4배 희귀하니 포스팅 리스트가 짧아서다.</li>
            <li><strong>지원하는 기능이 훨씬 많다</strong> — <K>ILIKE</K>, 정규식(영문), <K>=</K>, KNN(<K>{'<->'}</K>), <K>word_similarity</K>. <K>pg_bigm</K> 은 <K>LIKE</K>/<K>=%</K> 만 되고 나머지는 Seq Scan 이다 — <Link to="/pg-bigm/operators">연산자 커버리지</Link>.</li>
            <li><strong>설치가 쉽다</strong> — contrib 이고 <K>trusted</K> 라 수퍼유저 없이도 되고, 매니지드 DB 지원이 훨씬 넓다.</li>
          </ul>
          <p>
            <strong><K>pg_bigm</K> 의 이점을 확인할 주요 조건은 “2글자 이하 검색어”다.</strong> 다만 한국어에서는
            짧은 검색어가 자주 쓰이며, 이 실험의 해당 조건에서는 읽은 버퍼 수가 1,274배 차이 났다.
          </p>
        </Callout>
      </Section>
    </>
  )
}
