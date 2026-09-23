import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { ONE_CHAR, ONECHAR_ENV } from '@/data/onechar'
import { nf } from '@/lib/utils'

export default function Recheck() {
  return (
    <>
      <PageHeader
        eyebrow="기초 개념"
        title="Recheck 과 손실 인덱스"
        lede="n-gram 인덱스는 정답을 주지 않는다 — 후보를 준다. 그 후보를 힙에서 다시 대보는 단계가 Recheck 이고, 이 카탈로그의 지표 절반이 여기서 나온다."
      />

      <EasyFirst>
        <p>
          찾아보기에서 쪽수를 보고 갔는데 그 쪽에 원하는 말이 없을 수 있습니다. 조각이 다 있다고 원래 단어가 있는 건
          아니거든요. 그래서 데이터베이스는 <strong>찾아보기로 후보를 추린 다음, 그 후보들의 원문을 다시 읽어
          진짜인지 확인</strong>합니다. 이 확인 단계가 <strong>Recheck</strong> 입니다.
        </p>
      </EasyFirst>

      <Section id="what" title="1. Recheck 이란">
        <Callout kind="info">
          <p><strong>인덱스가 후보로 올린 행을, 힙에서 원문을 읽어 조건에 다시 대보는 것이다.</strong></p>
        </Callout>
        <CodeBlock caption="EXPLAIN 에서 이렇게 보인다">{`Bitmap Heap Scan on docs  (actual rows=500 loops=1)
  Recheck Cond: (doc ~~ '%클둥이%'::text)          ← 다시 평가할 조건
  Rows Removed by Index Recheck: 1200              ← 인덱스가 틀리게 올린 후보
  Heap Blocks: exact=498
  ->  Bitmap Index Scan on docs_bigm  (actual rows=1700 loops=1)
        Index Cond: (doc ~~ '%클둥이%'::text)      ← 인덱스가 돌려준 후보 1,700행`}</CodeBlock>
      </Section>

      <Section id="why" title="2. 왜 피할 수 없나 — 조각의 집합은 문자열이 아니다">
        <p>
          <K>LIKE '%trial%'</K> 를 3-gram 으로 찾는다고 하자. <K>%</K> 로 감싸여 패딩이 안 붙으니 조각은 셋이다.
        </p>
        <Diagram
          chart={`
flowchart TD
  q(["질의 'trial'"]) --> qf["tri · ria · ial"]
  subgraph DOC["문서 'arterial triage'"]
    direction TB
    w1["arterial<br/>art · rte · ter · eri · <b>ria</b> · <b>ial</b>"]
    w2["triage<br/><b>tri</b> · ria · iag · age"]
  end
  qf -->|"tri 있나"| w2
  qf -->|"ria · ial 있나"| w1
  w1 --> hit["조각 셋이 전부 있다 → 후보로 올라간다"]
  w2 --> hit
  hit --> no["그런데 'trial' 이라는 연속된 문자열은 없다"]
  no --> rc["Recheck 이 걸러낸다"]
  classDef bad fill:#4c0519,stroke:#fb7185,color:#ffe4e6
  classDef warn fill:#422006,stroke:#fbbf24,color:#fef3c7
  class no bad
  class hit,rc warn
`}
          caption="조각은 순서를 잃는다. 두 낱말에 흩어진 조각이 우연히 다 모이면 인덱스는 '있다'고 답한다."
        />
        <Callout kind="warn" title="흔히 드는 예 하나는 틀렸다">
          <p>
            <K>trial</K> vs <K>trivial</K> 은 <strong>3-gram 에서는 거짓 양성이 아니다</strong> — <K>trivial</K> 의
            조각은 <K>tri, riv, ivi, via, ial</K> 이라 <K>ria</K> 가 없어 인덱스 단계에서 이미 탈락한다.{' '}
            <strong>2-gram</strong>(<K>tr, ri, ia, al</K>)에서는 맞는 예다.{' '}
            <Link to="/meta/corrections">정정 목록</Link>에 기록해 두었다.
          </p>
        </Callout>
        <p>
          <K>pg_trgm</K> 에는 이유가 하나 더 있다 — 조각을 CRC32 로 해싱하므로 <strong>해시 충돌</strong>이 가능하고,
          Recheck 이 그것도 잡아준다.
        </p>
      </Section>

      <Section id="skip" title="3. pg_bigm 은 Recheck 을 건너뛸 때가 있다">
        <CodeBlock caption="bigm_gin.c — gin_extract_query_bigm(), LikeStrategyNumber">{`if (bgmlen == 1 && !removeDups)      /* 조각이 딱 하나 나왔다 */
{
    *recheck = false;
    for (sp = str; (sp - str) < slen;)
    {
        if (t_isspace(sp))            /* 공백이 있으면 얘기가 달라진다 */
        {
            *recheck = true;
            break;
        }
        sp += IS_HIGHBIT_SET(*sp) ? pg_mblen(sp) : 1;
    }
}
else
    *recheck = true;`}</CodeBlock>
        <p>
          조각 하나가 검색어 전체이므로 <strong>순서를 잃을 여지가 없다</strong> → 인덱스 판정이 곧 정답이다.
          실측에서 <K>bigm</K> 이 2글자 검색어에서 <K>recheck 제거 0</K> 으로 나오는 이유다 —{' '}
          <Link to="/experiments/length-selectivity">실험 01</Link>.
        </p>
        <p>
          그리고 <strong>공백이 있으면 이 최적화가 꺼진다</strong>는 조건이 코드에 그대로 있다. 공백이 든 패턴을
          실제로 재본 것은 <Link to="/foundations/whitespace">공백과 구두점</Link> 에 있다 — <K>%드 클%</K> 에서
          bigm 도 recheck 이 24행 붙는다.
        </p>
        <Callout kind="warn" title="pg_bigm.enable_recheck 를 끄면 안 된다">
          <p>
            인덱스가 정확하다고 <em>알려주는</em> 스위치가 아니라 검증을 <em>건너뛰는</em> 스위치라, 끄는 순간
            거짓 양성이 결과에 그대로 섞여 나온다.
          </p>
        </Callout>
      </Section>

      <Section id="cost" title="4. Recheck 은 왜 빠른가 — 결국 원문을 읽는 것 아닌가">
        <p>
          당연한 의문이다. <strong>Recheck 도 결국 힙에서 원문을 읽는다.</strong> 그러면 시퀀셜 스캔과 뭐가 다른가?
          답은 <strong>“얼마나 읽느냐”가 다르다</strong>이고, 정확히는 <strong>몇 행이 아니라 몇 페이지를 읽느냐</strong>가
          다르다.
        </p>

        <h3>① 후보 행만 읽는다 — 테이블 전체가 아니라</h3>
        <p>
          <K>Bitmap Heap Scan</K> 은 인덱스가 만든 비트맵에 켜진 행만 읽는다. 20만 행 테이블에서 후보가 400행이면
          400행만 읽는다.
        </p>
        <ChartBox
          type="bar"
          height={280}
          title="1글자 검색 — 읽은 버퍼 (로그)"
          data={{
            labels: ONE_CHAR.map((r) => (r.eng === 'none' ? '인덱스 없음 (Seq Scan)' : r.eng === 'bigm' ? 'pg_bigm (Bitmap Heap Scan)' : 'pg_trgm (Seq Scan)')),
            datasets: [{
              label: '버퍼',
              data: ONE_CHAR.map((r) => r.buf),
              backgroundColor: ONE_CHAR.map((r) => (r.eng === 'bigm' ? alpha(C.ok, 0.85) : alpha(C.none, 0.7))),
            }],
          }}
          options={{ plugins: { legend: { display: false } }, scales: { y: { type: 'logarithmic', title: { display: true, text: '버퍼 (로그)' } } } }}
          caption={
            <>
              같은 정답 400행인데 <strong>{nf(ONE_CHAR[0].buf)}장 vs {nf(ONE_CHAR[1].buf)}장</strong>을 읽는다.
              Recheck 이 읽는 것은 <strong>후보가 들어 있는 페이지</strong>뿐이다.
            </>
          }
        />
        <SourceNote path={ONECHAR_ENV.repo}>실험 10</SourceNote>

        <h3>② 진짜 비용 단위는 “행”이 아니라 “페이지”다</h3>
        <p>
          위 실측에서 후보 <strong>{nf(ONE_CHAR[1].idxRows)}행</strong>을 읽는 데 버퍼가{' '}
          <strong>{nf(ONE_CHAR[1].buf)}장</strong> 들었다 — 거의 <strong>행 하나에 페이지 하나</strong>다. 주입을{' '}
          <K>id % 1000</K> 으로 흩어 놓아서 400행이 400개의 서로 다른 페이지에 앉아 있기 때문이다. 반대로 시퀀셜
          스캔은 페이지 한 장에서 60행쯤을 한꺼번에 본다(20만 행 / {nf(ONE_CHAR[0].buf)}장).
        </p>
        <Callout kind="info" title="그래서 손익분기가 생긴다">
          <p>
            후보가 흩어져 있으면 <strong>후보 행 수가 페이지 수에 가까워지고</strong>, 그 수가 테이블의 총 페이지
            수에 다가가는 순간 인덱스 경로가 시퀀셜 스캔보다 비싸진다 — 인덱스 읽는 비용을 <em>더</em> 내기 때문이다.
            플래너가 계산하는 것이 정확히 이 손익분기이고, <Ref to="/experiments/planner">플랜 전환점</Ref> 에서
            그 경계를 실측했다.
          </p>
        </Callout>

        <h3>③ 비트맵이라 읽는 순서가 정렬돼 있다</h3>
        <p>
          이름이 <K>Bitmap</K> Heap Scan 인 이유가 여기 있다. 인덱스가 돌려준 TID 를 <strong>바로 따라가지 않고</strong>{' '}
          비트맵에 모아 <strong>물리적 페이지 순서로 정렬한 뒤</strong> 읽는다. 그래서 같은 페이지를 두 번 읽지
          않고, 디스크 접근이 앞뒤로 튀지 않는다. <strong>“후보를 무작위로 흩어 읽는다”가 아니다.</strong>
        </p>

        <h3>④ 행 하나를 확인하는 비용 자체는 아주 싸다</h3>
        <p>
          이미 버퍼에 올라온 튜플에서 문자열 하나를 꺼내 <K>LIKE</K> 를 한 번 돌리는 일이다. 비싼 것은{' '}
          <strong>페이지를 가져오는 쪽</strong>이지 비교하는 쪽이 아니다 —{' '}
          <Ref to="/pg-trgm/similarity#threshold">임계값 스윕</Ref> 이 그걸 반대편에서 보여준다. 임계값을 0.3 →
          0.05 로 낮추면 인덱스 버퍼는 38에서 그대로인데 실행 시간만 377배가 된다. 늘어난 것은 전부{' '}
          <strong>힙 재확인</strong>이다.
        </p>

        <h3>⑤ 그래서 후보가 전부가 되면 정말로 느려진다</h3>
        <p>
          질문의 직관이 맞는 경우가 실제로 있다 — <Ref to="/foundations/gin#search-mode-all"><K>GIN_SEARCH_MODE_ALL</K></Ref> 이다.
        </p>
        <Table>
          <THead><TR><TH></TH><TH>후보</TH><TH>버퍼</TH><TH>시간</TH></TR></THead>
          <TBody>
            <TR>
              <TD><Badge variant="trgm">trgm</Badge> <K>{DATA.e05.twoChar[0].pattern}</K></TD>
              <TD className="text-trgm font-semibold">{nf(DATA.e05.twoChar[0].idx)} (테이블 전체)</TD>
              <TD className="text-warn">{nf(DATA.e05.twoChar[0].buf)}</TD>
              <TD className="text-trgm font-semibold">{DATA.e05.twoChar[0].ms} ms</TD>
            </TR>
            <TR>
              <TD>인덱스 없음 (Seq Scan)</TD>
              <TD className="text-muted-foreground">—</TD>
              <TD>{nf(DATA.e05.noneBuffers)}</TD>
              <TD>{DATA.e05.ms.none.infix[0]} ms</TD>
            </TR>
            <TR>
              <TD><Badge variant="bigm">bigm</Badge> <K>{DATA.e05.twoCharBigm.pattern}</K></TD>
              <TD className="text-ok">{nf(DATA.e05.twoCharBigm.idx)}</TD>
              <TD className="text-ok">{nf(DATA.e05.twoCharBigm.buf)}</TD>
              <TD className="text-ok font-semibold">{DATA.e05.twoCharBigm.ms} ms</TD>
            </TR>
          </TBody>
          <TCaption>
            100만 행. 후보가 테이블 전체면 Recheck 은 <strong>정말로 전부를 읽고</strong>, 거기에 인덱스 읽는
            비용까지 더해져 시퀀셜 스캔보다 느려진다.
          </TCaption>
        </Table>

        <Callout kind="ok" title="한 문단으로 답하면">
          <p>
            <strong>그렇다 — 후보군을 줄여놨기 때문에 빠른 것이 맞다.</strong> 다만 두 가지를 덧붙여야 정확하다.
            첫째, 줄어드는 단위는 행이 아니라 <strong>읽어야 할 8KB 페이지 수</strong>다. 둘째, 비트맵이 그 페이지들을{' '}
            <strong>물리 순서로 정렬해</strong> 읽으므로 무작위 접근이 아니다. 그리고 후보가 줄지 않으면{' '}
            <strong>이 구조는 이득이 아니라 손해가 된다</strong> — 그 경계가 이 카탈로그가 계속 재는 값이다.
          </p>
        </Callout>
      </Section>

      <Section id="lossy" title="5. lossy 와 손실 인덱스는 다른 말이다">
        <p>둘 다 “Recheck 이 붙는 이유”지만 원인이 달라서, 섞어 보면 엉뚱한 데를 고치게 된다.</p>
        <Table>
          <THead><TR><TH>관찰</TH><TH>원인</TH><TH>대응</TH></TR></THead>
          <TBody>
            <TR>
              <TD><K>Heap Blocks: lossy=8000</K></TD>
              <TD>비트맵이 <K>work_mem</K> 을 넘어 <strong>페이지 단위</strong>로 낮아졌다</TD>
              <TD><K>work_mem</K> 을 올린다 (인덱스 성질과 무관)</TD>
            </TR>
            <TR>
              <TD>비트맵은 <K>exact</K> 인데 recheck 이 있다</TD>
              <TD><strong>인덱스가 애초에 손실 인덱스</strong> — n-gram 이 여기 해당</TD>
              <TD>없앨 수 없다. 봐야 할 것은 <strong>버려진 행 수</strong></TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section id="read" title="6. Recheck 숫자를 읽는 법">
        <Table>
          <THead><TR><TH>Recheck 제거 행 수</TH><TH>뜻</TH><TH>대응</TH></TR></THead>
          <TBody>
            <TR><TD className="text-ok">≈ 0</TD><TD>인덱스가 후보를 정답까지 좁혔다</TD><TD>이상적</TD></TR>
            <TR><TD>정답의 몇 배</TD><TD>조각의 선택도가 낮다 (흔한 조각)</TD><TD>검색어를 늘리거나 n 을 키운다</TD></TR>
            <TR><TD className="text-trgm">≈ 전체 행 수</TD><TD><K>GIN_SEARCH_MODE_ALL</K> — 조각을 하나도 못 만들었다</TD><TD>패턴을 바꾸거나 <K>pg_bigm</K></TD></TR>
          </TBody>
          <TCaption>
            세 번째 줄이 실제로 나온 예 — 100만 행에서 <K>{DATA.e05.twoChar[0].pattern}</K> 는 후보{' '}
            {nf(DATA.e05.twoChar[0].idx)}행을 올리고 {nf(DATA.e05.twoChar[0].recheck)}행을 걷어낸다.
          </TCaption>
        </Table>
        <SourceNote path={`${DATA.repo.base}/${DATA.repo.exp.e05}`}>실험 05</SourceNote>
        <Callout kind="ok" title="정확성은 절대 안 깨진다">
          <p>
            인덱스가 아무리 나빠도 <strong>결과는 항상 정확하다</strong> — Recheck 이 원문을 다시 대보기 때문이다.
            인덱스가 나쁘면 나타나는 증상은 “틀린 결과”가 아니라 <strong>“느림”</strong>이다. 유사도 검색은 얘기가
            다르다 — 거기서는 <Link to="/pg-trgm/similarity">임계값에 못 미쳐 놓치는</Link> 쪽으로 나타난다.
          </p>
        </Callout>
      </Section>

      <Section id="faq" title="7. 자주 헷갈리는 것">
        <h4>“Recheck 이 있으면 인덱스가 잘못된 것 아닌가?”</h4>
        <p>
          아니다. n-gram 인덱스에서 Recheck 은 <strong>정상 동작</strong>이다. 없앨 수 없고, 없애려 하면 안 된다.
          봐야 할 것은 존재 여부가 아니라 <strong>버려진 행 수</strong>다.
        </p>
        <h4>“<K>Index Cond</K> 랑 <K>Recheck Cond</K> 가 같은데 왜 두 번 하나?”</h4>
        <p>
          <K>Index Cond</K> 는 인덱스가 <em>자기 방식으로</em> 근사 평가한 것이고, <K>Recheck Cond</K> 는 힙의
          원문으로 <em>정확히</em> 평가한 것이다. 문자열이 같아 보여도 <strong>평가 대상이 다르다.</strong>
        </p>
        <h4>“<K>Index Scan</K> 에는 왜 Recheck 이 안 보이나?”</h4>
        <p>
          <K>Bitmap Heap Scan</K> 에서만 이 줄이 나온다. 순수 <K>Index Scan</K> 경로는 비트맵을 만들지 않는다.
          <strong>GIN 은 항상 비트맵 경로를 쓴다</strong> — 정렬된 결과를 못 돌려주기 때문이다.
        </p>
      </Section>
    </>
  )
}
