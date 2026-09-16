import { Link } from 'react-router-dom'
import { CodeBlock, K } from '@/components/common/Code'
import { Callout } from '@/components/layout/Callout'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { Clotho } from '@/components/viz/Clotho'
import { DATA } from '@/data/measurements'

const STEPS: { n: number; title: React.ReactNode; body: React.ReactNode }[] = [
  {
    n: 1,
    title: <>쇼핑몰 검색창에 <K>클럽</K> 이라고 쳤습니다.</>,
    body: (
      <>
        <K>클럽하우스</K>·<K>강남 클럽</K>·<K>클라우드클럽</K> 이 다 나와야 합니다. SQL 로는{' '}
        <K>WHERE name LIKE '%클럽%'</K> 인데, <strong>상품이 100만 개면 100만 개를 전부 열어 봅니다.</strong>{' '}
        <K>%</K> 는 “여기에 아무 글자나 몇 개든 와도 된다”는 뜻이라, <K>'%클럽%'</K> 은 “어디든 클럽이 들어간 것”입니다.
      </>
    ),
  },
  {
    n: 2,
    title: <>인덱스는 책 뒤의 “찾아보기”입니다.</>,
    body: (
      <>
        “이 값은 몇 번째 행에 있다”를 미리 적어둔 표라, 100만 행을 다 안 보고 몇 행만 봅니다.
        그런데 <strong>찾아보기는 가나다순</strong>입니다.
      </>
    ),
  },
  {
    n: 3,
    title: <>그래서 “<K>클럽</K>으로 <em>시작</em>”은 쉽고 “<K>클럽</K>이 <em>들어간</em>”은 어렵습니다.</>,
    body: (
      <>
        앞의 것은 한 덩어리로 모여 있지만, 뒤의 것은 <K>강남클럽</K>(ㄱ)·<K>클럽하우스</K>(ㅋ)·<K>한국클럽</K>(ㅎ)
        처럼 <strong>가나다순 어디에나 흩어져</strong> 있어서 어디서 시작해 어디서 멈출지 정할 수가 없습니다.
        결국 찾아보기를 처음부터 끝까지 다 읽게 됩니다.
      </>
    ),
  },
  {
    n: 4,
    title: <>그래서 글자를 잘게 쪼개 찾아보기에 넣습니다.</>,
    body: (
      <>
        <K>클라우드클럽</K> → <K>클라 · 라우 · 우드 · 드클 · 클럽</K>. 이제 <K>클럽</K> 찾기는{' '}
        <strong>찾아보기의 한 줄을 보는 일</strong>이 됩니다. 이 조각을 <strong>n-gram</strong> 이라 하고,
        두 글자면 <K>pg_bigm</K>, 세 글자면 <K>pg_trgm</K> 입니다.
      </>
    ),
  },
  {
    n: 5,
    title: <>공짜는 아닙니다 — 대가가 셋 있습니다.</>,
    body: (
      <>
        ① 조각이 다 있어도 원래 단어가 없을 수 있어 <strong>원문을 다시 확인</strong>해야 하고
        (<Link to="/foundations/recheck">Recheck</Link>), ② <strong>검색어가 짧으면 조각을 아예 못 만듭니다</strong>
        (<Link to="/pg-trgm/two-char">2글자 함정</Link>), ③ <strong>찾아보기가 커지고 저장이 느려집니다</strong>
        (<Link to="/experiments/storage">저장 비용</Link>). 한국어는 <K>서울</K>·<K>배송</K>처럼{' '}
        <strong>두 글자면 이미 낱말</strong>이라 ②에 자주 걸립니다.
      </>
    ),
  },
]

export default function FirstSteps() {
  return (
    <>
      <PageHeader
        eyebrow="처음이라면"
        title="3분 안에 따라오는 이야기"
        lede="전문용어를 하나도 모른다고 가정하고 씁니다. 여기까지가 이 카탈로그의 논지 전부이고, 나머지는 그게 실제로 얼마나 차이 나는지를 잰 것입니다."
      />

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-4 rounded-xl border border-border bg-card p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
              {s.n}
            </span>
            <div className="prose-doc min-w-0 flex-1 text-[14.5px]">
              <p className="mt-0 font-semibold text-foreground">{s.title}</p>
              <p className="mb-0">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Section title="1단계를 SQL 로 보면">
        <CodeBlock caption="이 한 줄이 느린 이유가 이 카탈로그 전체의 출발점이다.">
{`SELECT * FROM products WHERE name LIKE '%클럽%';`}
        </CodeBlock>
      </Section>

      <Section title="3·4단계를 그림으로">
        <p>
          정렬된 찾아보기가 접두어는 풀고 부분 문자열은 못 푸는 장면, 그리고 조각으로 바꾸면 무엇이 달라지는지를
          한 편에 담았다.
        </p>
        <Clotho id="btree-vs-inverted" />
      </Section>

      <Section title="4단계 — 조각으로 자르는 장면">
        <Clotho id="ngram-slice" />
      </Section>

      <Callout kind="warn" title="대가 ①을 한 문장으로">
        <p>
          찾는 말 <K>trial</K> 의 조각은 <K>tri · ria · ial</K> 인데, <K>arterial triage</K> 라는 문장은
          이 셋을 전부 갖고 있으면서 <K>trial</K> 을 담고 있지 않습니다. 그래서 데이터베이스는 후보를 추린 뒤
          <strong>원문을 다시 읽어 조건에 맞는지 확인</strong>합니다.
        </p>
      </Callout>

      <Section title="그래서 무엇을 고르나 — 3분 요약">
        <ul>
          <li>한국어이고 <strong>두 글자 검색어가 흔하다</strong> → <K>pg_bigm</K></li>
          <li>영문이고 검색어가 대체로 세 글자 이상 → <K>pg_trgm</K></li>
          <li>오탈자도 잡아주고 싶다 → <K>pg_trgm</K> (유사도 기능이 풍부)</li>
          <li>설치가 까다로우면 안 된다 → <K>pg_trgm</K> (PostgreSQL 에 딸려 옴)</li>
          <li>“단어” 단위로 찾고 관련도순 정렬이 필요하다 → <K>tsvector</K> (코어 기능)</li>
        </ul>
        <p>
          그 차이가 실제로 얼마인지는 <Link to="/start/overview">개요</Link>의 차트가,
          왜 그런지는 <Link to="/foundations/ngram">n-gram</Link> 과{' '}
          <Link to="/foundations/gin">GIN</Link> 이 이어받는다.
        </p>
      </Section>

      <Callout kind="info" title="이 카탈로그를 읽는 태도">
        <p>
          ① <strong>숫자는 전부 직접 돌려서 나온 것만</strong> 싣는다 — 각 그림에 재현 경로가 붙어 있다.
          ② <strong>모르는 것은 모른다고 적는다</strong> — “확인하지 못했다”가 여러 곳에 나오는데, 미완성이 아니라
          의도된 표시다. 널리 알려진 설명 중 재보니 틀렸던 것은{' '}
          <Link to="/meta/corrections">{DATA.corrections.length}건</Link> 이다.
        </p>
      </Callout>
    </>
  )
}
