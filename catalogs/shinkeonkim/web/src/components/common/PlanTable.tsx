import type { Row } from '@/data/ilike'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { nf } from '@/lib/utils'

const ENG_LABEL: Record<Row['eng'], { text: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  none: { text: '없음', variant: 'outline' },
  bigm: { text: 'bigm', variant: 'bigm' },
  trgm: { text: 'trgm', variant: 'trgm' },
  lbigm: { text: 'lower+bigm', variant: 'bigm' },
  ltrgm: { text: 'lower+trgm', variant: 'trgm' },
}

/**
 * 측정 한 판을 그대로 옮긴 표.
 * "쓴 인덱스" 열이 이 카탈로그의 5번 원칙을 화면에서 강제하는 자리다 —
 * 라벨이 아니라 플랜에서 읽은 값이고, 기대와 다르면 ✘ 로 남는다.
 */
export function PlanTable({ rows, caption }: { rows: Row[]; caption?: React.ReactNode }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>엔진</TH><TH>조건</TH><TH>정답</TH><TH>플랜</TH><TH>쓴 인덱스</TH>
          <TH>후보</TH><TH>recheck 제거</TH><TH>버퍼</TH><TH>ms</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r, i) => {
          const e = ENG_LABEL[r.eng]
          const seq = r.plan.includes('Seq')
          return (
            <TR key={i}>
              <TD><Badge variant={e.variant}>{e.text}</Badge></TD>
              <TD className="font-mono text-[12.5px]">{r.label}</TD>
              <TD>{nf(r.answer)}</TD>
              <TD className={seq ? 'text-warn' : ''}>{r.plan}</TD>
              <TD>
                {r.used
                  ? <><code className="text-[12px]">{r.used}</code> <span className="text-ok">✔</span></>
                  : <span className="text-muted-foreground">— {r.eng !== 'none' && <span className="text-trgm">✘</span>}</span>}
              </TD>
              <TD className={r.idxRows && r.idxRows > r.answer ? 'text-warn' : ''}>{nf(r.idxRows)}</TD>
              <TD className={r.recheck > 0 ? 'text-warn font-medium' : ''}>{nf(r.recheck)}</TD>
              <TD className={r.buf > 3000 ? 'text-warn' : r.buf < 1000 ? 'text-ok' : ''}>{nf(r.buf)}</TD>
              <TD className={r.ms > 10 ? 'text-warn' : 'text-ok'}>{r.ms}</TD>
            </TR>
          )
        })}
      </TBody>
      {caption && <TCaption>{caption}</TCaption>}
    </Table>
  )
}
