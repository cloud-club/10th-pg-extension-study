import { PageHeader, Section } from '@/components/layout/PageHeader'
import { EasyFirst } from '@/components/layout/Callout'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { useState } from 'react'

function clamp(value: string, max: number) { return Math.min(max, Math.max(1, Math.trunc(Number(value)) || 1)) }

export default function Network() {
  const [rows, setRows] = useState(10000)
  const [fetch, setFetch] = useState(100)
  const [rtt, setRtt] = useState(20)
  return <>
    <PageHeader eyebrow="Week 07 · postgres_fdw" title="한 번에 몇 행을 가져올까" lede="왕복 지연과 전송량을 분리해서 생각하는 교육용 계산기다." />
    <p className="mb-6 text-sm"><Ref to="/postgres-fdw/network-basics">RTT·대역폭·fetch 기본 설명</Ref>을 읽은 뒤 값을 바꿔 본다.</p>
    <EasyFirst>전화 한 통으로 책 한 권씩 요청하면 통화를 많이 해야 한다. 한 번에 여러 권을 받으면 통화 횟수는 줄지만 묶음이 커진다.</EasyFirst>
    <Section id="model" title="fetch_size와 RTT의 관계">
      <p>RTT는 요청이 갔다가 응답이 오는 왕복 시간이다. 아래는 모든 행을 끝까지 읽는 단순 모델이다. 실제 구현의 종료 확인·커서 생성·계획·TLS·원격 연산·재조회 비용을 제외하므로 벤치마크가 아니다.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label>반환 행 수<input className="block w-full rounded border bg-background p-2" type="number" min="1" max="1000000" value={rows} onChange={e => setRows(clamp(e.target.value, 1000000))} /></label>
        <label>fetch_size<input className="block w-full rounded border bg-background p-2" type="number" min="1" max="100000" value={fetch} onChange={e => setFetch(clamp(e.target.value, 100000))} /></label>
        <label>RTT (ms)<input className="block w-full rounded border bg-background p-2" type="number" min="1" max="1000" value={rtt} onChange={e => setRtt(clamp(e.target.value, 1000))} /></label>
      </div>
      <p aria-live="polite">가정한 데이터 묶음 수: {Math.ceil(rows / fetch).toLocaleString()}회 · 순차 왕복 대기 성분: {(Math.ceil(rows / fetch) * rtt / 1000).toFixed(2)}초</p>
      <p>모델: ceil(반환 행 수 / fetch_size) × RTT. 전체 시간은 여기에 계획·원격 처리·전송 바이트/유효 대역폭·로컬 처리를 함께 고려한다. 실행 중 겹치는 구간이 있으므로 단순 합산은 근사다.</p>
    </Section>
    <Section id="tradeoff" title="fetch_size를 계속 키우면 될까">
      <p>기본값은 100행이다. 넓은 text 열과 여러 동시 세션에서는 큰 배치가 메모리와 불필요한 선취를 늘릴 수 있다. 행 폭·LIMIT·전체 반환 행 수를 고정하고 비교한다. SELECT * 대신 필요한 열만 선택하고 필터·집계를 원격에 보내 전송량을 먼저 줄인다.</p>
      <CodeBlock language="sql">{`ALTER SERVER school_remote OPTIONS (ADD fetch_size '1000');
-- 이미 설정한 옵션은 SET으로 변경한다.
ALTER SERVER school_remote OPTIONS (SET fetch_size '100');`}</CodeBlock>
    </Section>
    <Section id="tls" title="네트워크가 끊기거나 느릴 때">
      <p>connect_timeout은 연결 수립 시간에 관한 설정이다. 쿼리 전체 제한과는 다르다. 운영 연결에는 sslmode=verify-full과 서버가 읽을 수 있는 CA 인증서 경로를 구성한다. 원격 호스트 이름 검증과 접근 허용은 각각 확인한다.</p>
      <a href="https://www.postgresql.org/docs/18/libpq-connect.html">libpq 연결·TLS·타임아웃 옵션</a>
    </Section>
    <p className="mt-10 text-sm text-muted-foreground">근거: <a href="https://www.postgresql.org/docs/18/postgres-fdw.html">PostgreSQL 18 postgres_fdw 공식 문서</a></p>
  </>
}
