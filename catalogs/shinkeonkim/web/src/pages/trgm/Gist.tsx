import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const T1 = DATA.trgm01
const SAT = T1.saturation

export default function Gist() {
  return (
    <>
      <PageHeader
        eyebrow="pg_trgm"
        title="GIN vs GiST — siglen 은 올릴수록 좋은 값이 아니다"
        lede="GiST 는 작고 KNN 을 할 수 있다. 대신 부정확하고, 빌드가 결정적이지 않으며, siglen 을 잘못 올리면 인덱스가 13배로 폭증한다."
        tags={[{ label: 'pg_trgm 실험 01', variant: 'ok' }, { label: 'GiST 지표는 재현되지 않는다', variant: 'warn' }]}
      />

      <EasyFirst>
        <p>
          GIN 은 “조각 → 그 조각을 가진 행 목록”을 <strong>정확히</strong> 담습니다. GiST 는 각 행의 조각들을{' '}
          <strong>비트맵 하나로 요약</strong>해 담습니다 — 작지만 뭉툭해서 헛걸음이 많습니다. 그 요약본의 분량이{' '}
          <K>siglen</K> 입니다.
        </p>
      </EasyFirst>

      <Section id="compare" title="1. 무엇이 다른가">
        <Table>
          <THead><TR><TH></TH><TH>GIN</TH><TH>GiST</TH></TR></THead>
          <TBody>
            <TR><TD className="text-muted-foreground">저장</TD><TD>조각 → 행 목록 (정확)</TD><TD>행 → <strong>비트 시그니처</strong> (손실 압축)</TD></TR>
            <TR><TD className="text-muted-foreground">크기</TD><TD>크다</TD><TD className="text-ok">작다</TD></TR>
            <TR><TD className="text-muted-foreground">검색</TD><TD className="text-ok">빠르다</TD><TD>느리다 (거짓 양성이 많다)</TD></TR>
            <TR><TD className="text-muted-foreground"><K>ORDER BY {'<->'}</K> (KNN)</TD><TD className="text-trgm"><strong>안 된다</strong></TD><TD className="text-ok"><strong>된다</strong></TD></TR>
            <TR><TD className="text-muted-foreground">쓰기</TD><TD>느리다 (펜딩 리스트로 완화)</TD><TD className="text-ok">빠르다</TD></TR>
            <TR><TD className="text-muted-foreground">측정 재현성</TD><TD className="text-ok"><strong>완전히 결정적</strong></TD><TD className="text-trgm">버퍼 ±5%, KNN <K>LIMIT 1</K> 65~230</TD></TR>
          </TBody>
        </Table>
        <p>
          GiST 는 각 행의 조각 집합을 고정 길이 비트맵(시그니처)으로 해싱해 담는다. 시그니처가 포화되면
          (<K>ALLISTRUE</K>) 그 페이지는 “전부 가능성 있음”이 되어 필터로 쓸모가 없어진다. <K>siglen</K> 옵션(PG13+)으로
          키우면 완화되지만 인덱스가 커진다.
        </p>
      </Section>

      <Section id="sweep" title="2. siglen 스윕 — 256 이 최적이고 그 위에서 무너진다">
        <ChartBox
          type="line"
          height={340}
          title="인덱스가 읽은 버퍼 (낮을수록 좋다)"
          data={{
            labels: T1.siglens.map(String),
            datasets: [
              { label: '짧은 문서 (42.7자)', data: [...T1.shortBuf], borderColor: C.bigm, backgroundColor: C.bigm, tension: 0.2 },
              { label: '긴 문서', data: [...T1.longBuf], borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
            ],
          }}
          options={{
            scales: {
              x: { title: { display: true, text: 'siglen' } },
              y: { type: 'logarithmic', title: { display: true, text: '버퍼 (로그)' } },
            },
          }}
          caption={
            <>
              <strong>두 테이블 모두 <K>siglen=256</K> 이 최적</strong>이고 그 위로는 무너진다. 긴 문서에서 버퍼
              2,855 → <strong>512 는 200,071(70배), 1024 는 67,213(24배)</strong>.
            </>
          }
        />
        <ChartBox
          type="line"
          height={320}
          title="인덱스 크기 (MB)"
          data={{
            labels: T1.siglens.map(String),
            datasets: [
              { label: '짧은 문서', data: [...T1.shortMB], borderColor: C.bigm, backgroundColor: C.bigm, tension: 0.2 },
              { label: '긴 문서', data: [...T1.longMB], borderColor: C.trgm, backgroundColor: C.trgm, tension: 0.2 },
            ],
          }}
          options={{ scales: { y: { type: 'logarithmic', title: { display: true, text: 'MB (로그)' } } } }}
          caption={<>긴 문서에서 143.7 MB → <strong>512 는 1,876 MB / 1024 는 1,480 MB</strong>.</>}
        />
        <SourceNote path={DATA.repo.trgm01}>pg_trgm 실험 01 · {T1.note}</SourceNote>

        <Callout kind="warn" title="문서 길이에 따라 양상이 다르다">
          <p>
            <strong>짧은 문서</strong>는 512 만 무너지고 1024 는 회복되지만(49.6 MB / 573 버퍼),{' '}
            <strong>긴 문서는 512·1024 둘 다 크게 나빠진다.</strong> 짧은 문서만 봤다면 “512 만 이상하다”고 잘못 읽었을
            것이다 — <strong>두 테이블을 나란히 두지 않았으면 놓쳤을 결론이다.</strong>
          </p>
        </Callout>
        <Callout kind="info" title="512 는 노이즈가 아니다 — 3회 재현됐다">
          <p>
            긴 문서 인덱스 {T1.repro512.longMB.join(' / ')} MB, 버퍼 {T1.repro512.longBuf.map(nf).join(' / ')}.
            반대로 1024 는 짧은 문서에서 {T1.repro1024.shortMB.join(' / ')} MB 로 크게 흔들린다 — GiST 빌드
            비결정성이다.
          </p>
        </Callout>
        <Callout kind="warn" title="가설 (확인하지 못했다)">
          <p>
            PostgreSQL 은 인덱스 값이 <K>TOAST_INDEX_TARGET</K>(<K>MaxHeapTupleSize / 16</K> ≈ 510바이트)보다
            크면 압축을 시도한다. <K>siglen=512</K> 짜리 키(≈517바이트)는 이 임계를 <strong>막 넘는데</strong>,
            그 크기의 시그니처는 비트가 촘촘해 잘 안 줄어든다. <K>siglen=1024</K> 는 같은 비트가 두 배 넓은 공간에
            흩어져 0 바이트가 많아 잘 압축된다 — 그래서 512보다 작아진다.{' '}
            <strong>임계값의 존재까지만 확인했고 압축 동작은 관측하지 못했다.</strong>
          </p>
        </Callout>
        <Callout kind="ok" title="실무 결론은 확실하다">
          <p>
            <strong>두 테이블 모두 256 이 최적</strong>이었다. “더 올리면 더 좋아지겠지”로 512 나 1024 를 골랐다면
            크게 손해였을 것이다. <strong>반드시 자기 데이터로, 그리고 실제 문서 길이로 스윕할 것.</strong>
          </p>
        </Callout>
      </Section>

      <Section id="saturation" title="3. ALLISTRUE 포화를 직접 세어 봤다">
        <p>
          “시그니처가 포화돼서 GiST 가 느리다”는 설명은 널리 쓰이지만, 이 카탈로그도 그동안 <strong>추론만</strong>{' '}
          했다. <K>pageinspect</K> 로 인덱스 페이지를 열어 <strong>키의 flag 바이트를 직접 세어</strong> 확인했다.
        </p>
        <CodeBlock caption="flag 바이트는 key_data 의 12번 오프셋이다 — gist_page_items_bytea 는 키 datum 이 아니라 IndexTuple 통째를 돌려준다 (IndexTuple 헤더 8 + varlena 4).">{`SELECT get_byte(key_data, 12) & 1 AS allistrue
FROM gist_page_items_bytea(get_raw_page('docs_gist', blk), 'docs_gist');`}</CodeBlock>
        <ChartBox
          type="bar"
          height={300}
          title="내부 노드 중 ALLISTRUE 비율"
          data={{
            labels: SAT.siglens.map(String),
            datasets: [
              { label: '짧은 문서', data: SAT.shortAllTrue.map((n, i) => (100 * n) / SAT.shortInternal[i]), backgroundColor: alpha(C.bigm, 0.8) },
              { label: '긴 문서', data: SAT.longAllTrue.map((n, i) => (100 * n) / SAT.longInternal[i]), backgroundColor: alpha(C.trgm, 0.8) },
            ],
          }}
          options={{ scales: { x: { title: { display: true, text: 'siglen' } }, y: { title: { display: true, text: '%' } } } }}
          caption="리프는 ARRKEY(트라이그램 배열)라 제외했다 — 모든 siglen 에서 정확히 200,001개(= 행 수)로 고정이다."
        />
        <SourceNote path={DATA.repo.trgm01}>pg_trgm 실험 01 · pageinspect</SourceNote>
        <Callout kind="warn" title="포화는 실재하지만 조건이 아주 좁다">
          <p>
            <strong>긴 문서 + 기본 <K>siglen=12</K></strong> 에서만 내부 노드의 <strong>94.7%</strong> 가 포화하고,{' '}
            <K>siglen</K> 을 24 로 <strong>한 단계만 올려도 0.0% 로 사라진다.</strong> 그런데{' '}
            <strong>짧은 문서(42.7자)는 어느 <K>siglen</K> 에서도 포화하지 않는데</strong>, 그런데도 GiST 는 GIN 보다
            버퍼를 <strong>345배</strong>({nf(T1.shortBuf[1])} vs {T1.shortBuf[0]}) 읽는다.{' '}
            <strong>거기서의 원인은 포화가 아니라 시그니처 충돌(거짓 양성)이다</strong> — 96비트에 수백 개
            트라이그램을 해싱하면 꽉 차지 않아도 서로 다른 문서가 비슷한 비트 패턴을 갖는다.
          </p>
        </Callout>
        <Callout kind="info" title="siglen=512 의 폭증도 포화가 아니었다">
          <p>
            포화율은 0.1% 뿐이다. 대신 <strong>내부 노드가 폭발</strong>하고 인덱스 크기가{' '}
            <strong>정확히 그 배수만큼</strong> 커진다: 긴 문서에서 내부 노드 {nf(SAT.longInternal[5])} →{' '}
            <strong>{nf(SAT.longInternal[6])}(12.71×)</strong>, 인덱스 143.74 → <strong>1,820.28 MB(12.66×)</strong>.{' '}
            <strong>두 자리까지 일치한다.</strong> 왜 폭발하는지는 확인하지 못했다.
          </p>
        </Callout>
      </Section>

      <Section id="determinism" title="4. GiST 빌드는 실제로 비결정적이다">
        <p>
          “GiST 지표가 ±5% 흔들린다”는 것까지는 알고 있었지만, <strong>구조가 달라지는 것인지 측정만 흔들리는
          것인지</strong>는 몰랐다. 같은 데이터로 세 번 빌드해 트리를 직접 셌다.
        </p>
        <Table>
          <THead><TR><TH>회차</TH><TH>페이지 수</TH><TH>엔트리 수</TH><TH>리프 페이지</TH></TR></THead>
          <TBody>
            {[0, 1, 2].map((i) => (
              <TR key={i}>
                <TD>{i + 1}</TD>
                <TD>{nf(T1.determinism.pages[i])}</TD>
                <TD>{nf(T1.determinism.entries[i])}</TD>
                <TD>{nf(T1.determinism.leaves[i])}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>docs_long · siglen=256 · 데이터도 삽입 순서도 설정도 같다.</TCaption>
        </Table>
        <Callout kind="warn">
          <p>
            <strong>세 값이 전부 다르다.</strong> “측정이 흔들린 것”이 아니라 <strong>“빌드 결과가 달라진
            것”</strong>이다 — 그래서 GiST 수치는 <strong>범위로만 적어야 하고 몇 % 차이를 해석하면 안 된다.</strong>{' '}
            다만 <strong>왜</strong> 달라지는지는 여전히 모른다. GIN 지표는 전부 완전히 재현됐다 —{' '}
            <Link to="/meta/method">측정 원칙</Link>.
          </p>
        </Callout>
      </Section>
    </>
  )
}
