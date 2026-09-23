import { Link } from 'react-router-dom'
import { K } from '@/components/common/Code'
import { SourceNote } from '@/components/common/SourceNote'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { DATA } from '@/data/measurements'
import { nf } from '@/lib/utils'

const B0 = DATA.bigm00

export default function Planner() {
  return (
    <>
      <PageHeader
        eyebrow="pg_bigm 실험 00"
        title="플랜 전환점 — 언제부터 인덱스를 쓰기 시작하나"
        lede={
          <>
            <K>enable_seqscan</K> 을 건드리지 않고, <strong>플래너가 스스로 무엇을 고르는지</strong>만 본다.
            인덱스가 있다고 항상 쓰이는 것이 아니다.
          </>
        }
        tags={[{ label: '15칸 전부 2회 동일', variant: 'ok' }]}
      />

      <EasyFirst>
        <p>
          인덱스를 만들어도 데이터베이스가 <strong>안 쓰기로 결정할 때가 있습니다.</strong> 찾을 게 너무 많으면
          (예: 전체의 30%) 찾아보기를 오가는 것보다 그냥 처음부터 끝까지 읽는 게 빠르기 때문입니다. 그 판단이
          어디서 뒤집히는지를 봅니다.
        </p>
      </EasyFirst>

      <Section id="grid" title="플랜 격자">
        <Table>
          <THead><TR><TH>행 수</TH><TH>검색어</TH><TH>선택도</TH><TH>인덱스 없음</TH><TH>인덱스 있음</TH></TR></THead>
          <TBody>
            {B0.grid.map((r, i) => (
              <TR key={i}>
                <TD>{nf(r.rows)}</TD>
                <TD><K>{r.kw}</K></TD>
                <TD>{r.sel}%</TD>
                <TD className="text-muted-foreground">{r.noIdx}</TD>
                <TD className={r.withIdx.includes('Bitmap') ? 'text-ok font-medium' : 'text-warn'}>{r.withIdx}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>{B0.note}</TCaption>
        </Table>
        <SourceNote path={DATA.repo.bigm00}>pg_bigm 실험 00</SourceNote>
      </Section>

      <Section id="read" title="읽는 법">
        <ul>
          <li>
            <strong>행이 적으면 인덱스를 안 쓴다.</strong> 100행에서는 선택도가 1%든 30%든 <K>Seq Scan</K> 이다 —
            테이블이 한 페이지에 들어가는데 인덱스를 오갈 이유가 없다.
          </li>
          <li>
            <strong>선택도가 높으면 인덱스를 안 쓴다.</strong> 1,000행에서 0.2% 는 인덱스를 타지만 30% 는 안 탄다.
            같은 30% 도 10,000행에서는 인덱스를 탄다 — 절대 이득이 커지기 때문이다.
          </li>
          <li>
            <strong>둘은 독립 변수다.</strong> “행이 많으면 무조건 인덱스”도, “선택도가 낮으면 무조건 인덱스”도
            아니다. 플래너는 <em>둘의 곱</em> 을 본다.
          </li>
        </ul>
        <Callout kind="warn" title="벤치마크에서 이걸 놓치면 엉뚱한 것을 잰다">
          <p>
            작은 테이블에서 “인덱스를 만들었는데 안 빨라진다”는 대부분 이 현상이다. 그리고 반대로{' '}
            <K>SET enable_seqscan=off</K> 로 억지로 인덱스를 태우면 <strong>실서비스에서 일어나지 않을 플랜</strong>을
            재게 된다. 이 카탈로그는 <strong>“인덱스 경로의 비용”을 재려는 실험에서만</strong> 그 설정을 쓰고,
            쓸 때는 README 에 적는다 — <Link to="/meta/method">측정 원칙</Link>.
          </p>
        </Callout>
      </Section>
    </>
  )
}
