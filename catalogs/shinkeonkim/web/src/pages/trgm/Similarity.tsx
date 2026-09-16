import { Link } from 'react-router-dom'
import { Ref } from '@/components/common/Ref'
import { ChartBox } from '@/components/charts/ChartBox'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Stat, StatGrid } from '@/components/common/Stat'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { SIM_PAIRS, THREE_SIMS, THRESHOLD_RANK } from '@/data/operators'
import { DEFAULT_RECALL, KNN, KNN_NOINDEX, TH_ENV, THREE_SIM_RECALL, THRESHOLD_SWEEP } from '@/data/threshold'
import { nf } from '@/lib/utils'

export default function Similarity() {
  return (
    <>
      <PageHeader
        eyebrow="pg_trgm"
        title="유사도와 KNN — 두 확장은 다른 자로 잰다"
        lede={
          <>
            <K>LIKE</K> 만 보면 두 확장은 “빠르냐”의 문제지만, <strong>유사도 검색에서는 결과 자체가 갈린다.</strong>{' '}
            같은 오타에 한쪽은 매칭되고 한쪽은 탈락한다.
          </>
        }
        tags={[{ label: `${nf(TH_ENV.rows)}행` }, { label: '실험 03 · pg_trgm 실험 02', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          “비슷한 것 찾기”에는 <strong>점수</strong>가 필요합니다. 그런데 <K>pg_bigm</K> 과 <K>pg_trgm</K> 은{' '}
          <strong>점수를 매기는 공식이 다릅니다.</strong> 공식이 다른데 <strong>기본 임계값은 둘 다 0.3</strong> 이라,
          같은 오타에 한쪽은 걸리고 한쪽은 안 걸립니다.
        </p>
      </EasyFirst>

      <Section id="anim" title="1. 같은 오타, 다른 점수">
        <Clotho id="similarity-compare" />
        <p>
          <K>클라우드클럽</K> 과 <K>클라으드클럽</K> — <strong>6글자 중 가운데 한 글자만 다르다.</strong>{' '}
          두 확장이 이 한 쌍에 매기는 점수를 끝까지 따라가 본다.
        </p>
        <Table>
          <THead>
            <TR><TH></TH><TH>조각</TH><TH>겹친 것</TH><TH>공식</TH><TH>점수</TH></TR>
          </THead>
          <TBody>
            <TR>
              <TD><Badge variant="bigm">bigm</Badge></TD>
              <TD>각각 <strong>7개</strong></TD>
              <TD className="text-ok"><strong>5개</strong></TD>
              <TD><K>겹친 수 / max(조각 수)</K></TD>
              <TD className="text-ok"><strong>5 / 7 = 0.7143</strong></TD>
            </TR>
            <TR>
              <TD><Badge variant="trgm">trgm</Badge></TD>
              <TD>각각 <strong>7개</strong></TD>
              <TD className="text-warn"><strong>4개</strong></TD>
              <TD><K>겹친 수 / 합집합 크기</K> (자카드)</TD>
              <TD className="text-trgm"><strong>4 / (7+7−4) = 0.4000</strong></TD>
            </TR>
          </TBody>
          <TCaption>
            <strong>겹친 조각은 5 대 4 로 한 개 차이인데 점수는 0.71 대 0.40 으로 벌어진다.</strong> 조각 수가
            아니라 <strong>분모</strong>가 만든 차이다 — 자카드는 안 겹친 6개를 전부 분모에 넣는다.
          </TCaption>
        </Table>
        <Callout kind="info" title="같은 이름의 매크로, 반대 결과">
          <p>
            두 확장 모두 소스에 <K>DIVUNION</K> 이라는 <strong>같은 이름의 매크로</strong>로 공식을 분기하는데,{' '}
            <K>pg_trgm</K> 만 그 매크로를 <K>#define</K> 해뒀다. 한쪽은 <K>max</K> 로, 한쪽은 합집합으로 나눈다.
          </p>
        </Callout>

        <h3>짧은 말에서는 그 차이가 임계값 선을 넘는다</h3>
        <p>
          위 6글자 예시는 <strong>0.7143 과 0.4000 — 둘 다 기본 임계값 0.3 을 넘는다.</strong> 그래서 결과가
          갈리지 않는다. 그런데 같은 성질을 <strong>3글자</strong>에 적용하면 선을 넘어간다.
        </p>
        <StatGrid className="lg:grid-cols-3">
          <Stat tone="bigm" value="0.5000 ≥ 0.3" label={<><K>클둥이</K>→<K>클동이</K> · <K>bigm_similarity</K> — <strong>매칭된다</strong></>} />
          <Stat tone="trgm" value="0.1429 < 0.3" label={<>같은 쌍 · <K>similarity</K> — <strong>탈락한다</strong></>} />
          <Stat tone="warn" value="같은 오타" label="같은 임계값, 반대 결과" />
        </StatGrid>
        <Callout kind="warn">
          <p>
            <strong>임계값 0.3 을 한쪽에서 다른 쪽으로 그대로 옮기면 안 된다.</strong> 우연히 값이 같을 뿐{' '}
            <strong>재는 자가 다르다.</strong> 그리고 <strong>검색어가 짧을수록 그 차이가 결과를 갈라놓는다</strong> —
            분모에 들어가는 조각이 적어 한 개 차이가 크게 작용하기 때문이다.
          </p>
        </Callout>

        <ChartBox
          type="bar"
          height={330}
          title="여덟 쌍을 나란히"
          data={{
            labels: SIM_PAIRS.map((p) => `${p.from} → ${p.to}`),
            datasets: [
              { label: 'bigm_similarity()', data: SIM_PAIRS.map((p) => p.bigm), backgroundColor: alpha(C.bigm, 0.8) },
              { label: 'similarity()', data: SIM_PAIRS.map((p) => p.trgm), backgroundColor: alpha(C.trgm, 0.8) },
            ],
          }}
          options={{ indexAxis: 'y' as const, scales: { x: { max: 1, title: { display: true, text: '유사도 (기본 임계값 0.3)' } } } }}
          caption={
            <>
              <strong>짧은 쌍일수록 두 막대가 벌어진다.</strong> <K>클둥이</K>→<K>클동이</K> 한 칸만 임계값
              선(0.3)을 사이에 두고 갈리고, 6글자 <K>클라우드클럽</K> 쌍은 둘 다 선 위에 있다. 마지막{' '}
              <K>CloudClub</K> 칸은 반대다 — 대소문자만 다르면 trgm 은 <K>IGNORECASE</K> 라 1.0 이고, pg_bigm 은
              대소문자를 구분한다.
            </>
          }
        />
        <SourceNote path="../../week02/bigm-vs-trgm/experiments/03-operator-coverage-and-correctness">실험 03</SourceNote>
      </Section>

      <Section id="rank" title="2. 임계값을 같은 0.3 으로 두면 — 결과는 같고 순위가 다르다">
        <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">
          {(['bigm', 'trgm'] as const).map((eng) => (
            <div key={eng} className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-[13px] font-semibold">
                <Badge variant={eng}>{eng === 'bigm' ? 'pg_bigm  =%' : 'pg_trgm  %'}</Badge>
              </p>
              <ol className="space-y-1.5 text-[13.5px]">
                {THRESHOLD_RANK[eng].map((r, i) => (
                  <li key={r.doc} className="flex items-baseline justify-between gap-3">
                    <span className={r.mark ? 'font-semibold text-warn' : ''}>{i + 1}. {r.doc}</span>
                    <span className="font-mono text-[12.5px] text-muted-foreground">{r.sim.toFixed(4)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p>
          <strong>결과 집합은 같지만 순위가 다르다.</strong> <K>pg_bigm</K> 은 오탈자(<K>클라으드클럽</K>)를 3위로,{' '}
          <K>pg_trgm</K> 은 접미 확장(<K>클라우드클럽스터디</K>)을 3위로 올린다. bigm 은 “사용자가 틀리게 쳤을
          것”이라는 가정에 맞고, trgm 은 자카드라 길이 차이에 민감하다.
        </p>
      </Section>

      <Section id="three" title="3. pg_trgm 의 유사도는 셋이다 — 그리고 뜻이 다르다">
        <Table>
          <THead><TR><TH>문서</TH><TH><K>similarity</K></TH><TH><K>word_similarity</K></TH><TH><K>strict_word_similarity</K></TH></TR></THead>
          <TBody>
            {THREE_SIMS.map((r) => (
              <TR key={r.doc}>
                <TD>{r.doc}</TD>
                <TD>{r.sim.toFixed(4)}</TD>
                <TD className={r.word > r.sim ? 'font-semibold text-ok' : ''}>{r.word.toFixed(4)}</TD>
                <TD>{r.strict.toFixed(4)}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>검색어는 <K>클럽</K> 하나. 읽는 법이 셋 다 다르다.</TCaption>
        </Table>
        <ul>
          <li>
            <strong><K>similarity</K></strong> 는 <strong>문서 전체</strong>와 비교한다. 그래서 문서가 길어질수록
            점수가 떨어진다(0.25 → 0.09). <strong>검색 랭킹으로 쓰면 안 되는 이유가 이것이다</strong> — 긴 문서에
            벌점을 준다.
          </li>
          <li>
            <strong><K>word_similarity</K></strong> 는 문서 안 <strong>아무 부분 문자열</strong>과 비교한다. 문서
            길이에 영향받지 않고, <K>클라우드클럽</K> 안의 <K>클럽</K> 처럼 <strong>단어 중간에서 시작하는 부분</strong>도
            인정한다.
          </li>
          <li>
            <strong><K>strict_word_similarity</K></strong> 는 <strong>단어 경계에 맞춘 부분</strong>하고만 비교한다.
            <K>클럽 하우스</K> 의 <K>클럽</K> 은 1.0 이지만, <K>클라우드클럽</K> 안의 <K>클럽</K> 은 단어 중간이라 0.25 다.
          </li>
        </ul>
        <Callout kind="warn" title="한국어에서는 이 차이가 특히 크다">
          <p>
            띄어쓰기가 불규칙하고 복합어가 흔해서, <K>strict</K> 판은 <K>클라우드클럽</K> 같은 붙여쓴 복합어 안의
            부분을 계속 놓친다. <strong>한국어 부분 문자열 검색에는 <K>word_similarity</K>(strict 아님) 쪽이
            맞다.</strong> <K>pg_bigm</K> 에는 이 계열이 아예 없다 — <K>bigm_similarity()</K> 하나뿐이고 성질은{' '}
            <K>similarity</K> 와 같다.
          </p>
        </Callout>
      </Section>

      <Section id="threshold" title="4. 임계값을 낮추면 무슨 일이 일어나나">
        <ChartBox
          type="line"
          height={300}
          title="임계값 스윕 — 인덱스 버퍼는 그대로인데 시간만 폭증한다"
          data={{
            labels: THRESHOLD_SWEEP.map((r) => r.t.toString()),
            datasets: [
              { label: '실행 시간 (ms)', data: THRESHOLD_SWEEP.map((r) => r.ms), borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2, yAxisID: 'y' },
              { label: '인덱스 버퍼', data: THRESHOLD_SWEEP.map((r) => r.buf), borderColor: C.ok, backgroundColor: C.ok, borderDash: [5, 4], tension: 0.2, yAxisID: 'y' },
              { label: '인덱스가 돌려준 행', data: THRESHOLD_SWEEP.map((r) => r.idxRows), borderColor: C.warn, backgroundColor: C.warn, tension: 0.2, yAxisID: 'y' },
            ],
          }}
          options={{
            scales: {
              x: { title: { display: true, text: 'similarity_threshold (왼쪽이 엄격)' } },
              y: { type: 'logarithmic', title: { display: true, text: '로그' } },
            },
          }}
          caption={
            <>
              0.3 → 0.05 로 낮추면 후보가 <strong>1,348배</strong>(9행 → 12,130행), 시간은 <strong>377배</strong>{' '}
              (0.43 → 162 ms). <strong>그런데 인덱스 버퍼는 38에서 거의 안 변한다</strong> — 비용이 늘어나는 곳은
              인덱스가 아니라 <strong>힙 재확인</strong>이다.
            </>
          }
        />
        <SourceNote path={TH_ENV.repo}>pg_trgm 실험 02 · 4회 실행 전부 동일</SourceNote>
        <Callout kind="ok" title="실무 처방">
          <p>
            <strong>임계값을 사용자 입력으로 그대로 받지 말고 서버에서 하한(예: 0.2)을 강제할 것.</strong>{' '}
            “결과가 안 나오면 임계값을 낮춰보자”가 위험한 이유 — 0.05 에서 매치가 51건으로 늘지만 정답은 여전히
            6건이고 나머지 45건은 노이즈다. 그리고 <strong>인덱스 버퍼가 그대로인데 느려지면 임계값을 의심</strong>할 것.
          </p>
        </Callout>
      </Section>

      <Section id="recall" title="5. 어느 연산자가 무엇을 놓치나">
        <Table>
          <THead><TR><TH>문서</TH><TH>글자 수</TH><TH><K>similarity</K></TH><TH><K>word_similarity</K></TH><TH><K>strict</K></TH></TR></THead>
          <TBody>
            {THREE_SIM_RECALL.map((r) => (
              <TR key={r.doc}>
                <TD>{r.doc}</TD><TD>{r.len}</TD>
                <TD className={r.sim < 0.3 ? 'text-trgm' : ''}>{r.sim.toFixed(4)}</TD>
                <TD className={r.word < 0.6 ? 'text-trgm' : ''}>{r.word.toFixed(4)}</TD>
                <TD className={r.strict < 0.5 ? 'text-trgm' : ''}>{r.strict.toFixed(4)}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            <K>similarity()</K> 는 문서가 길어질수록 단조 감소한다 — <strong>검색어가 문서 안에 온전히 그대로
            들어있는데도</strong> 그렇다.
          </TCaption>
        </Table>
        <Table>
          <THead><TR><TH>연산자</TH><TH>기본 임계값</TH><TH>정답 6건 중</TH><TH>놓친 것</TH></TR></THead>
          <TBody>
            {DEFAULT_RECALL.map((r) => (
              <TR key={r.op}>
                <TD><K>{r.op}</K> <span className="text-[12px] text-muted-foreground">{r.name}</span></TD>
                <TD>{r.threshold}</TD>
                <TD className={r.caught === 6 ? 'text-ok font-semibold' : ''}>{r.caught} / 6</TD>
                <TD className="text-[12.5px] text-muted-foreground">{r.missed ?? '없다'}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            <strong>“길어서 놓치는 것”과 “틀려서 놓치는 것”은 다른 문제다.</strong> 세 연산자의 기본 임계값이 각각
            달라서 어느 것을 쓰느냐에 따라 놓치는 대상이 달라진다. 긴 본문에서 짧은 검색어를 찾는다면 <K>%</K> 를
            쓰면 안 된다.
          </TCaption>
        </Table>
      </Section>

      <Section id="knn" title="6. KNN — LIMIT 1 과 5 사이에 절벽이 있다">
        <ChartBox
          type="line"
          height={300}
          title="GiST KNN 비용 (siglen=256) · 4회 관측의 중앙값"
          data={{
            labels: KNN.map((k) => `LIMIT ${k.limit}`),
            datasets: [
              { label: '버퍼 (중앙값)', data: KNN.map((k) => k.buffers[Math.floor(k.buffers.length / 2)]), borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
              { label: '인덱스 없이 전체 정렬', data: KNN.map(() => KNN_NOINDEX.buffers), borderColor: C.none, backgroundColor: C.none, borderDash: [6, 4], tension: 0 },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: '버퍼 (로그)' } } } }}
          caption={
            <>
              <strong>절벽은 네 번 모두 재현됐지만 배수는 실행마다 다르다</strong>(25~60배). 5 이후로는 거의
              평평하다 — <strong><K>LIMIT</K> 을 아껴봐야 얻는 게 없다.</strong> 대신 후보를 먼저 좁혀야 한다.
            </>
          }
        />
        <Table>
          <THead><TR><TH>LIMIT</TH><TH>버퍼 (4회 관측)</TH><TH>실행 시간</TH></TR></THead>
          <TBody>
            {KNN.map((k) => (
              <TR key={k.limit}>
                <TD>{k.limit}</TD>
                <TD className={k.note ? 'text-warn' : ''}>{k.buffers.map(nf).join(' / ')} {k.note && <span className="text-[12px]">← {k.note}</span>}</TD>
                <TD>{k.ms} ms 수준</TD>
              </TR>
            ))}
            <TR>
              <TD className="text-muted-foreground">인덱스 없이</TD>
              <TD>{nf(KNN_NOINDEX.buffers)} (전부 동일)</TD>
              <TD>{KNN_NOINDEX.ms} ms 수준</TD>
            </TR>
          </TBody>
          <TCaption>{KNN_NOINDEX.note}</TCaption>
        </Table>
        <Callout kind="warn" title="LIMIT 1 은 재현되지 않는다">
          <p>
            <K>LIMIT 5</K> 이상은 실행 간 편차가 0.3~0.8% 인데 <K>LIMIT 1</K> 만 65~156 으로 3.5배 흔들린다.
            삽입 순서를 고정해도 그렇다 — <strong>GiST 인덱스 빌드 자체가 결정적이지 않다</strong>(
            <Link to="/pg-trgm/gist">GIN vs GiST</Link>). 절대 페이지 수가 작을 때 그 흔들림이 상대적으로 크게
            보이는 것으로 해석했다.
          </p>
        </Callout>
        <Callout kind="warn" title="절대 성능은 좋지 않다">
          <p>
            <K>LIMIT 10</K> 에 60 ms 는 대화형 자동완성으로 쓰기엔 느리다. 실무에서는 후보를 먼저 좁히고(예:
            카테고리·<K>LIKE</K> 접두어) 그 안에서 KNN 을 돌리는 구성이 필요하다.
          </p>
        </Callout>
      </Section>

      <Section id="direction" title="7. 방향 함정 — 잊지 말 것">
        <p>
          인덱스를 타려면 인덱스 컬럼이 왼쪽이어야 한다 — <K>doc %{'>'} '검색어'</K>(= <K>'검색어' {'<%'} doc</K>).{' '}
          <K>doc {'<%'} '검색어'</K> 는 <strong>의미도 다르고 <K>Seq Scan</K> 이 된다.</strong> 자세한 것은{' '}
          <Ref to="/pg-bigm/operators#direction">피연산자 순서가 인덱스 사용을 바꾼다</Ref>.
        </p>
      </Section>
    </>
  )
}
