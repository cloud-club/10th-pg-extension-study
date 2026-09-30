import { CodeBlock, K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { Callout, EasyFirst } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TCaption, TD, TH, THead, TR } from '@/components/ui/table'
import { ANALYZERS, FALLBACKS } from '@/content/analyzers'

const INTEGRATE_VARIANT = {
  tsvector: 'ok',
  '별도 인덱스': 'warn',
  '별도 엔진': 'warn',
} as const

export default function KoreanAnalyzer() {
  return (
    <>
      <PageHeader
        eyebrow="전문검색"
        title="한국어 형태소 분석기는 없나"
        lede={
          <>
            <Ref to="/fulltext/korean-recall">재현율 7~38%</Ref> 의 원인은 <K>simple</K> 설정이 조사를 못 떼어내는
            것이다. 그러면 떼어낼 수 있게 만드는 방법은 없나 — <strong>있다.</strong> 다만 전부 서버에 무언가를
            설치해야 한다.
          </>
        }
        tags={[{ label: '이 카탈로그가 재보지 않은 영역', variant: 'warn' }]}
      />

      <Callout kind="warn" title="먼저 — 이 페이지는 실측이 아니다">
        <p>
          이 카탈로그의 다른 페이지와 달리, 여기는 <strong>공개 문서를 읽고 정리한 것</strong>이다.
          직접 설치해 재보지 않았으므로 <strong>성능 수치를 싣지 않는다</strong> —{' '}
          <Ref to="/meta/method">측정 원칙 5번</Ref>. 각 항목의 원문 링크로 직접 확인할 수 있게 두었다.
        </p>
      </Callout>

      <EasyFirst>
        <p>
          한국어는 낱말 뒤에 조사가 붙습니다 — <K>영화</K>, <K>영화는</K>, <K>영화지만</K>. 이걸 떼어내려면{' '}
          <strong>“이 글자 덩어리가 어떤 낱말 + 어떤 조사인지”를 아는 사전</strong>이 필요합니다. PostgreSQL 에
          기본으로 들어 있지 않을 뿐, <strong>붙일 수 있는 방법은 있습니다.</strong> 대표적인 게 일본어에서 온{' '}
          <strong>MeCab</strong> 을 한국어로 학습시킨 <strong>mecab-ko</strong> 입니다.
        </p>
      </EasyFirst>

      <Section id="options" title="선택지 셋">
        <Table>
          <THead>
            <TR><TH>방법</TH><TH>무엇인가</TH><TH>기존 <K>tsvector</K> 를</TH></TR>
          </THead>
          <TBody>
            {ANALYZERS.map((a) => (
              <TR key={a.name}>
                <TD className="font-medium">{a.name}</TD>
                <TD>{a.what}</TD>
                <TD>
                  <Badge variant={INTEGRATE_VARIANT[a.integrates]}>
                    {a.integrates === 'tsvector' ? '그대로 쓴다' : a.integrates}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
          <TCaption>
            첫 줄만 <strong>쿼리를 안 고쳐도 된다.</strong> 나머지는 전용 인덱스·연산자를 쓰므로 기존{' '}
            <K>@@</K> · <K>ts_rank</K> 코드를 그대로 이어가지 못한다.
          </TCaption>
        </Table>

        {ANALYZERS.map((a) => (
          <div key={a.name} className="my-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[16px] font-semibold">{a.name}</h3>
              {a.license && <Badge variant="outline">{a.license}</Badge>}
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground">{a.what}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed">{a.how}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-ok">좋은 점</p>
                <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                  {a.pros.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-warn">걸리는 점</p>
                <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                  {a.cons.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            </div>
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
              {a.source.map((s) => (
                <a key={s.url} href={s.url} className="text-primary underline-offset-4 hover:underline">
                  {s.label} ↗
                </a>
              ))}
            </p>
          </div>
        ))}
      </Section>

      <Section id="textsearch-ko" title="가장 직접적인 답 — textsearch_ko">
        <p>
          이 페이지의 질문(“<K>simple</K> 대신 조사를 떼어내는 설정을 쓸 수 없나”)에 <strong>정확히 대응하는</strong>{' '}
          것은 <K>textsearch_ko</K> 다. 코어의 전문검색을 그대로 두고 <strong>사전만 바꿔 끼운다.</strong>
        </p>
        <CodeBlock caption="설치 흐름 (원문: i0seph/textsearch_ko)">{`# 1) 형태소 분석기와 사전을 먼저 깐다
mecab-ko  +  mecab-ko-dic

# 2) 확장을 PGXS 로 빌드한다 — pg_bigm 과 같은 방식이다
make USE_PGXS=1 install`}</CodeBlock>
        <CodeBlock>{`CREATE EXTENSION textsearch_ko;
SET default_text_search_config = korean;

SELECT to_tsvector('무궁화꽃이 피었습니다.');
--  '꽃':2 '무궁화':1 '피':3        ← 조사와 어미가 떨어진다`}</CodeBlock>
        <p>
          <Ref to="/fulltext/korean-recall">재현율 페이지</Ref> 에서 <K>영화지만</K>·<K>이영화</K> 를 놓치던 것이
          이 단계에서 달라진다 — <K>영화지만</K> 은 <K>영화</K> + 조사로 갈라지므로 잡힌다.{' '}
          <strong>다만 <K>이영화</K>(앞에 붙은 복합어)는 분석기가 어떻게 자르느냐에 달렸고, 그건 재봐야 안다.</strong>
        </p>
      </Section>

      <Section id="reality" title="현실의 제약 — 대부분 여기서 막힌다">
        <p>세 방법 모두 <strong>서버에 파일을 설치</strong>해야 한다. 그게 안 되는 환경이 흔하다.</p>
        <Table>
          <THead><TR><TH>환경</TH><TH>형태소 분석기를 붙일 수 있나</TH></TR></THead>
          <TBody>
            <TR><TD>직접 운영하는 PostgreSQL (Docker 포함)</TD><TD className="text-ok">된다 — 이 카탈로그의 실험 환경도 여기다</TD></TR>
            <TR><TD>매니지드 DB (RDS · Cloud SQL 등)</TD><TD className="text-trgm">제공 확장 목록에 없으면 못 쓴다. <K>pg_trgm</K> 은 contrib 이라 대부분 있고, <K>pg_bigm</K> 도 지원이 갈린다</TD></TR>
            <TR><TD>수퍼유저 권한이 없는 계정</TD><TD className="text-warn"><K>pg_trgm</K> 은 <K>trusted</K> 라 되고, 나머지는 안 된다</TD></TR>
          </TBody>
          <TCaption>
            <strong>이 제약이 이 카탈로그가 n-gram 을 다루는 이유이기도 하다.</strong> “형태소 분석기를 붙이면
            되지 않나”는 맞는 말이지만, 붙일 수 없는 자리가 많다.
          </TCaption>
        </Table>

        <h3>붙일 수 없다면</h3>
        <Table>
          <THead><TR><TH>선택지</TH><TH>언제</TH><TH>대가</TH></TR></THead>
          <TBody>
            {FALLBACKS.map((f) => (
              <TR key={f.name}>
                <TD><Ref to={f.to}>{f.name}</Ref></TD>
                <TD>{f.when}</TD>
                <TD className="text-[12.5px] text-muted-foreground">{f.note}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section id="verdict" title="정리">
        <ul>
          <li>
            <strong>없지 않다.</strong> <K>textsearch_ko</K>(mecab-ko)가 코어 전문검색에 사전을 꽂는 가장 직접적인
            답이고, <K>PGroonga</K> 는 토크나이저를 고를 수 있는 별도 인덱스, <K>pg_search</K> 는 BM25 랭킹 쪽이다.
          </li>
          <li>
            <strong>다만 전부 서버 설치가 필요하다.</strong> 매니지드 DB 나 권한이 없는 환경에서는 여전히
            n-gram 이 유일한 선택지에 가깝다.
          </li>
          <li>
            <strong>그리고 형태소 분석을 붙여도 부분 문자열 검색은 안 된다.</strong> 낱말을 정확히 자르는 것과
            낱말 <em>안</em> 을 찾는 것은 다른 문제다 —{' '}
            <Ref to="/experiments/ilike#f">실험 09 F절</Ref> 에서 <K>우드클럽</K> 이 0행으로 나오는 것이 그 예다.
          </li>
          <li>
            <strong>이 페이지는 재보지 않았다.</strong> 설치해서 재현율이 실제로 얼마나 회복되는지는{' '}
            <strong>이 카탈로그가 답하지 못하는 부분</strong>이다.
          </li>
        </ul>
      </Section>
    </>
  )
}
