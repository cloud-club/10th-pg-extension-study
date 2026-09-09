import { Link } from 'react-router-dom'
import { ChartBox } from '@/components/charts/ChartBox'
import { CodeBlock, K } from '@/components/common/Code'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { C, alpha } from '@/lib/chart'
import { IMAGE_SCANS, MUSL_VS_GLIBC, SCAN_ENV } from '@/data/images'
import { DATA } from '@/data/measurements'

const B = IMAGE_SCANS[0]
const T = IMAGE_SCANS[1]
const A = IMAGE_SCANS[4]

export default function Environment() {
  return (
    <>
      <PageHeader
        eyebrow="기록"
        title="환경과 베이스 이미지"
        lede={
          <>
            에디터가 <K>FROM postgres:16-bookworm</K> 에 “critical 5건, high 32건”을 띄운다. 두 가지를 물었다 —{' '}
            <strong>로컬에서도 문제가 되나</strong>, 그리고 <strong>같은 버전 안에서 바꿔 쓸 태그가 있나</strong>.
            직접 스캔해서 답한다.
          </>
        }
        tags={[{ label: SCAN_ENV.tool }, { label: SCAN_ENV.date }, { label: '실측', variant: 'ok' }]}
      />

      <Callout kind="warn" title="먼저 — 숫자가 에디터와 다르다">
        <p>
          Docker Scout 은 Docker Hub 로그인을 요구해서 쓰지 못했다. 그래서{' '}
          <strong>{SCAN_ENV.tool}</strong> 로 쟀고, 같은 이미지에서 <strong>critical {B.critical}건 / high {B.high}건</strong>이
          나왔다. 에디터가 말한 5/32 와 다르다 — <strong>스캐너가 다르면 세는 기준도 DB 도 다르다.</strong>{' '}
          그래서 아래에서는 <strong>절대 개수가 아니라 태그 사이의 차이</strong>를 본다.
        </p>
      </Callout>

      <Section id="local" title="1. 로컬에서라도 문제가 될 수 있나">
        <EasyFirst>
          <p>
            취약점은 <strong>“그 코드가 실행되고, 공격자가 입력을 넣을 수 있을 때”</strong> 문제가 됩니다. 이
            컨테이너는 벤치마크를 돌리려고 잠깐 띄우는 것이고 바깥에 열려 있지 않으니, <strong>현실적 위험은
            낮습니다.</strong> 다만 0은 아닙니다.
          </p>
        </EasyFirst>
        <p>실제로 무엇이 걸려 있는지를 보면 판단이 쉬워진다.</p>
        <Table>
          <THead><TR><TH>걸린 항목</TH><TH>건수</TH><TH>이 워크플로에서</TH></TR></THead>
          <TBody>
            <TR>
              <TD><K>gosu</K> (Go stdlib)</TD>
              <TD>{B.gosu}</TD>
              <TD>공식 postgres 이미지의 엔트리포인트 헬퍼. <strong>모든 변종에 똑같이 들어 있다</strong> — 베이스를 바꿔도 안 사라진다</TD>
            </TR>
            <TR>
              <TD><K>perl</K> 계열</TD>
              <TD>32</TD>
              <TD>이 카탈로그의 실험은 perl 을 실행하지 않는다</TD>
            </TR>
            <TR>
              <TD>기타 Debian 패키지</TD>
              <TD>{B.critical + B.high - B.gosu - 32}</TD>
              <TD><K>bsdutils</K>·<K>libc</K> 등. 대부분 로컬 권한 상승 계열이라 <strong>이미 컨테이너에 들어와 있어야</strong> 쓸 수 있다</TD>
            </TR>
          </TBody>
        </Table>
        <Callout kind="warn" title="그래도 지켜야 할 것 — 이쪽이 CVE 목록보다 현실적인 위험이다">
          <ul>
            <li><strong>포트를 <K>0.0.0.0</K> 에 열지 말 것.</strong> <K>ports: "127.0.0.1:15984:5432"</K> 로 묶는다.</li>
            <li><strong><K>POSTGRES_PASSWORD</K> 를 <K>postgres</K> 로 두고 외부에 노출하지 말 것.</strong> 이 카탈로그의 컴포즈 파일은 전부 실험용이고, 그래서 저장소에 “접속 정보는 절대 커밋 금지”가 걸려 있다.</li>
            <li><strong>실험이 끝나면 <K>./bench.sh down</K> 으로 지운다.</strong> 오래 떠 있는 컨테이너가 잊힌 채 남는 것이 실제 사고 경로다.</li>
            <li><strong>호스트 디렉터리를 쓰기 가능하게 마운트하지 말 것.</strong> 말뭉치는 읽기 전용으로 복사해 넣는다.</li>
          </ul>
        </Callout>
      </Section>

      <Section id="tags" title="2. 같은 버전 안에서 바꿔 쓸 태그가 있나">
        <p>
          있다 — <K>-bookworm</K>(Debian 12), <K>-trixie</K>(Debian 13), <K>-alpine</K>. 셋을 같은 도구로 나란히
          스캔했다.
        </p>
        <ChartBox
          type="bar"
          height={300}
          title="CRITICAL + HIGH (낮을수록 좋다)"
          data={{
            labels: IMAGE_SCANS.map((s) => s.tag.replace('postgres:', '')),
            datasets: [
              { label: 'CRITICAL', data: IMAGE_SCANS.map((s) => s.critical), backgroundColor: alpha(C.trgm, 0.85) },
              { label: 'HIGH', data: IMAGE_SCANS.map((s) => s.high), backgroundColor: alpha(C.warn, 0.8) },
            ],
          }}
          options={{ scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: '건수' } } } }}
          caption={
            <>
              <strong>trixie 는 bookworm 과 사실상 같다</strong>(critical {B.critical}→{T.critical}, high {B.high}→{T.high}).{' '}
              <strong>alpine 만 자릿수가 다르다</strong>(critical {A.critical} / high {A.high}).
            </>
          }
        />
        <Table>
          <THead>
            <TR><TH>태그</TH><TH>베이스</TH><TH>CRITICAL</TH><TH>HIGH</TH><TH>패치가 있는 것</TH><TH>패치 없음</TH><TH>pg_bigm 빌드</TH></TR>
          </THead>
          <TBody>
            {IMAGE_SCANS.map((s) => (
              <TR key={s.tag}>
                <TD><K>{s.tag}</K></TD>
                <TD>{s.base}</TD>
                <TD className={s.critical > 5 ? 'text-trgm' : 'text-ok'}>{s.critical}</TD>
                <TD className={s.high > 50 ? 'text-warn' : 'text-ok'}>{s.high}</TD>
                <TD>{s.fixableC + s.fixableH}</TD>
                <TD className={s.critical + s.high - s.fixableC - s.fixableH > 0 ? 'text-warn' : 'text-ok'}>
                  {s.critical + s.high - s.fixableC - s.fixableH}
                </TD>
                <TD>{s.buildsPgBigm ? <Badge variant="ok">된다</Badge> : <Badge variant="warn">안 된다</Badge>}
                  {s.note && <span className="ml-2 text-[12px] text-muted-foreground">{s.note}</span>}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>{SCAN_ENV.tool} · <K>{SCAN_ENV.flags}</K> · {SCAN_ENV.date}. 취약점 DB 는 매일 바뀐다.</TCaption>
        </Table>

        <Callout kind="warn" title="여기가 핵심 — Debian 쪽은 “고칠 수 없는” 것이 대부분이다">
          <p>
            bookworm 의 {B.critical + B.high}건 중 패치가 나와 있는 것은 <strong>{B.fixableC + B.fixableH}건</strong>뿐이고,
            그 {B.fixableC + B.fixableH}건이 <strong>전부 <K>gosu</K></strong> 다. 즉{' '}
            <strong><K>apt-get upgrade</K> 를 해도 Debian 패키지 쪽 {B.critical + B.high - B.gosu}건은 하나도 안 줄어든다</strong> —
            Debian 보안팀이 “minor issue”로 분류해 별도 업데이트를 내지 않은 것들이다. 반대로 alpine 은{' '}
            <strong>패치 없는 항목이 0건</strong>이다.
          </p>
        </Callout>

        <Callout kind="info" title="내가 먼저 틀렸던 것">
          <p>
            이 질문을 받고 <strong>먼저 40개 Dockerfile 을 trixie 로 옮겼다.</strong> “새 Debian 이니 나아지겠지”
            라는 <strong>추측이었고, 재보니 나아지지 않았다</strong>(critical {B.critical}→{T.critical}, high{' '}
            {B.high}→{T.high}). trixie 를 유지하는 이유는 CVE 가 아니라 <strong>현재 stable 이라 보안 지원 기간이
            더 길다</strong>는 것뿐이다. 이 카탈로그의 5번 원칙 — <strong>“재기 전에는 적지 않는다”</strong> — 을
            내가 어긴 자리라 그대로 남긴다. <Link to="/meta/method">측정 원칙</Link>
          </p>
        </Callout>
      </Section>

      <Section id="alpine" title="3. 그럼 alpine 으로 갈아타야 하나">
        <p>
          <strong>이 카탈로그에서는 갈아타지 않는다.</strong> 취약점만 보면 alpine 이 압도적이지만, 여기서 재는
          것이 하필 <strong>문자 처리</strong>다.
        </p>
        <Table>
          <THead><TR><TH>고려</TH><TH>내용</TH></TR></THead>
          <TBody>
            <TR>
              <TD className="text-ok">취약점</TD>
              <TD>critical {B.critical} → {A.critical}, high {B.high} → {A.high}. 패치 없는 항목 {B.critical + B.high - B.fixableC - B.fixableH} → 0</TD>
            </TR>
            <TR>
              <TD className="text-warn">libc</TD>
              <TD><strong>musl vs glibc.</strong> 이 카탈로그의 주제가 <K>t_isspace</K>·ICU·정렬 순서라 <strong>측정값이 흔들릴 수 있는 변인</strong>이다 — 그래서 아래에서 직접 대조했다</TD>
            </TR>
            <TR>
              <TD className="text-warn">빌드</TD>
              <TD>이미지에 빌드에 쓰인 clang 이 없어 <K>with_llvm=no</K> 로 JIT 비트코드 생성을 꺼야 한다</TD>
            </TR>
            <TR>
              <TD className="text-muted-foreground">이미지 크기</TD>
              <TD>훨씬 작다 — CI 에서는 이쪽이 더 실질적인 이득일 수 있다</TD>
            </TR>
          </TBody>
        </Table>

        <h3>musl 에서 값이 달라지나 — 재봤다</h3>
        <p>
          “libc 가 다르니 위험하다”도 추측이라, alpine 이미지를 실제로 띄워 조각 생성과 유사도를 대조했다.
        </p>
        <Table>
          <THead><TR><TH>확인한 것</TH><TH>trixie (glibc)</TH><TH>alpine (musl)</TH><TH></TH></TR></THead>
          <TBody>
            {MUSL_VS_GLIBC.map((r) => (
              <TR key={r.probe}>
                <TD><K>{r.probe}</K></TD>
                <TD className="font-mono text-[12px]">{r.trixie}</TD>
                <TD className="font-mono text-[12px]">{r.alpine}</TD>
                <TD className={r.same ? 'text-ok' : 'text-trgm'}>{r.same ? '같다' : '다르다'}</TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            <strong>다섯 칸 모두 글자까지 같다.</strong> 조각 생성과 유사도 계산은 <K>t_isspace</K>·
            <K>pg_mblen</K> 처럼 PostgreSQL 이 자체 구현한 경로라 libc 에 안 걸리는 것으로 보인다(해석이고,
            소스로 확인하지는 않았다).
          </TCaption>
        </Table>
        <Callout kind="ok" title="그래서 결론이 바뀌었다 — 다만 갈아타지는 않는다">
          <p>
            처음에는 “musl 이라 측정이 흔들릴 수 있다”를 alpine 을 배제하는 이유로 적으려 했는데,{' '}
            <strong>재보니 이 실험들이 쓰는 값은 전부 같았다.</strong> 그래도 이 카탈로그는 trixie 를 유지한다 —
            이유는 안전성이 아니라 <strong>이미 발행한 모든 수치가 glibc 판에서 나온 것</strong>이라서다.
            베이스를 바꾸면 전부 다시 재고 재현성을 다시 확인해야 한다.{' '}
            <strong>아직 재보지 않은 것은 콜레이션·정렬(<K>ORDER BY</K>)과 ICU 경로</strong>이고, 그쪽은 musl 에서
            다를 수 있다.
          </p>
        </Callout>
        <CodeBlock caption="alpine 에서 pg_bigm 을 빌드하려면">{`FROM postgres:16-alpine AS build
RUN apk add --no-cache build-base git icu-dev
RUN git clone --branch v1.2-20250903 --depth 1 https://github.com/pgbigm/pg_bigm.git /build/pg_bigm
WORKDIR /build/pg_bigm
# 이 이미지는 LLVM 21 로 빌드됐는데 alpine 저장소에는 그 clang 이 없다 -> JIT 비트코드 생성을 끈다
RUN make USE_PGXS=1 with_llvm=no PG_CONFIG=/usr/local/bin/pg_config \\
 && make USE_PGXS=1 with_llvm=no PG_CONFIG=/usr/local/bin/pg_config install`}</CodeBlock>
      </Section>

      <Section id="pinning" title="4. 이 카탈로그가 실제로 쓰는 것">
        <CodeBlock>{`ARG PGTAG=16-trixie
FROM postgres:\${PGTAG} AS build
ARG PGVER=16

RUN apt-get update \\
 && apt-get install -y --no-install-recommends \\
      build-essential git ca-certificates \\
      postgresql-server-dev-\${PGVER} libicu-dev postgresql-contrib-\${PGVER} \\
 && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v1.2-20250903 --depth 1 \\
      https://github.com/pgbigm/pg_bigm.git /build/pg_bigm
WORKDIR /build/pg_bigm
RUN make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/\${PGVER}/bin/pg_config \\
 && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/\${PGVER}/bin/pg_config install`}</CodeBlock>
        <p>두 줄이 실제로 물렸던 함정이다.</p>
        <ul>
          <li>
            <strong><K>libicu-dev</K></strong> 가 없으면 trixie 에서 빌드가 깨진다 —{' '}
            <K>utils/pg_locale.h:24:10: fatal error: unicode/ucol.h: No such file or directory</K>.
          </li>
          <li>
            <strong><K>pg_config</K> 를 버전 경로로 고정</strong>해야 한다. <K>/usr/bin/pg_config</K> 는 Debian 의
            alternatives 가 고르는 것이라, 버전 없는 <K>postgresql-contrib</K> 가 더 새 메이저를 끌어오면{' '}
            <strong>PGVER=16 인데 <K>-I/usr/include/postgresql/18/server</K> 로 컴파일된다</strong> — 그리고{' '}
            <K>postgres.h: No such file or directory</K> 로 죽는다. 실제로 PG16·17 빌드가 이것 때문에 깨졌다.
          </li>
        </ul>
        <Callout kind="info" title="PostgreSQL 19 는 아직 안 된다">
          <p>
            {DATA.e07.pg19.cause} 이 카탈로그의 버전 축이 16~18 인 이유다 —{' '}
            <Link to="/experiments/versions">실험 07</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="limits" title="한계">
        <ul>
          <li>스캐너 하나({SCAN_ENV.tool})로만 쟀다. Docker Scout 은 로그인이 필요해 쓰지 못했고, <strong>그래서 에디터가 띄운 5/32 와 이 페이지의 숫자를 직접 비교할 수 없다.</strong></li>
          <li>취약점 DB 는 매일 바뀐다. <strong>{SCAN_ENV.date} 기준</strong>이고, 절대 수치가 아니라 태그 사이의 차이만 읽어야 한다.</li>
          <li>arm64 호스트에서 스캔했다. amd64 이미지의 패키지 구성은 조금 다를 수 있다.</li>
          <li>alpine 에서는 <strong>빌드와 조각·유사도 다섯 칸까지</strong> 확인했다. <strong>콜레이션·정렬과 ICU 경로는 재보지 않았다</strong> — musl 에서 다를 수 있다.</li>
        </ul>
      </Section>
    </>
  )
}
