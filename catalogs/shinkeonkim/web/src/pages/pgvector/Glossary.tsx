import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Term = { term: string; meaning: string; analogy?: string; group: (typeof GROUPS)[number]; to?: string }
const GROUPS = ['PostgreSQL 기본', '벡터', '인덱스', '측정'] as const

/** week05 용어. 페이지 본문에서 처음 나올 때도 풀어 쓰지만, 발표 중 다시 찾을 자리로 모았다. */
const TERMS: Term[] = [
  { group: 'PostgreSQL 기본', term: '확장(extension)', meaning: 'PostgreSQL에 타입·함수·인덱스를 덧붙이는 플러그인. CREATE EXTENSION 한 줄로 켠다', analogy: '스마트폰 앱 설치', to: '/pgvector/install' },
  { group: 'PostgreSQL 기본', term: '슈퍼유저', meaning: 'DB 서버 안의 모든 권한을 가진 계정. 보통 운영자만 갖는다', analogy: '건물 마스터키' },
  { group: 'PostgreSQL 기본', term: 'trusted 확장', meaning: '슈퍼유저가 아니어도 설치할 수 있다고 표시된 확장. pgvector·pgvectorscale은 아니다', to: '/pgvector/install#trusted' },
  { group: 'PostgreSQL 기본', term: '매니지드 DB', meaning: 'AWS RDS·Supabase처럼 클라우드 회사가 운영해 주는 PostgreSQL. 설치 가능한 확장이 정해져 있다', to: '/pgvector/when-to-use#managed' },
  { group: 'PostgreSQL 기본', term: '설정값(GUC)', meaning: 'PostgreSQL의 조절 손잡이. SET 이름 = 값 으로 지금 연결(세션)에서만 바꿀 수 있다', analogy: '자동차 운전석 설정', to: '/pgvector/install#gucs' },
  { group: 'PostgreSQL 기본', term: '플래너', meaning: 'SQL을 어떻게 실행할지(인덱스를 쓸지, 전부 읽을지) 고르는 부분. 더 싸다고 계산한 방법을 고른다', analogy: '내비게이션 경로 탐색' },
  { group: 'PostgreSQL 기본', term: 'EXPLAIN', meaning: '플래너가 고른 실행 계획을 보여 주는 명령. ANALYZE를 붙이면 실제로 실행하고 결과도 적는다', to: '/pgvector/install#explain' },
  { group: 'PostgreSQL 기본', term: 'Seq Scan / Index Scan', meaning: '테이블을 처음부터 끝까지 읽기 / 인덱스를 따라 필요한 행만 읽기', analogy: '책을 1쪽부터 넘기기 / 찾아보기로 바로 가기', to: '/pgvector/install#explain' },
  { group: 'PostgreSQL 기본', term: '버퍼(buffer)', meaning: 'PostgreSQL이 디스크를 읽는 단위인 8KB 페이지 하나. EXPLAIN의 Buffers: shared hit=266 은 페이지 266개를 읽었다는 뜻', analogy: '책장 한 장', to: '/pgvector/install#explain' },
  { group: 'PostgreSQL 기본', term: 'maintenance_work_mem / work_mem', meaning: '인덱스 만들기 같은 관리 작업 / 정렬 같은 질의 작업에 쓰는 메모리 한도', analogy: '작업대 크기' },
  { group: 'PostgreSQL 기본', term: 'REINDEX', meaning: '인덱스를 처음부터 다시 만드는 명령', analogy: '찾아보기 새로 만들기' },
  { group: 'PostgreSQL 기본', term: 'InitPlan', meaning: '바깥 행과 상관없는 서브쿼리를 한 번만 계산해 재사용하는 실행 방식. random()이 들어 있어도 한 번만 돈다', to: '/pgvector/ann#initplan' },

  { group: '벡터', term: '임베딩(embedding)', meaning: '문장·이미지를 모델에 넣어 얻은 실수 목록. 뜻이 비슷하면 숫자도 비슷하다', analogy: '문장의 좌표', to: '/pgvector/first' },
  { group: '벡터', term: '벡터 · 차원', meaning: '숫자 목록 · 그 목록의 길이. [1,2,3]은 3차원 벡터', analogy: '좌표 · 좌표 축의 개수', to: '/pgvector/first' },
  { group: '벡터', term: 'L2 거리 (<->)', meaning: '두 점 사이의 직선거리. 이 주차 실험은 전부 이것을 썼다', analogy: '자로 잰 거리', to: '/pgvector/install#operators' },
  { group: '벡터', term: '코사인 거리 (<=>)', meaning: '두 벡터의 방향이 얼마나 다른가. 길이는 무시한다', analogy: '같은 쪽을 가리키나', to: '/pgvector/install#operators' },
  { group: '벡터', term: '내적 (<#>)', meaning: '두 벡터를 칸마다 곱해 더한 값. pgvector는 작을수록 가깝게 보이도록 부호를 뒤집어 돌려준다', to: '/pgvector/install#operators' },
  { group: '벡터', term: 'halfvec', meaning: '숫자 하나를 4바이트 대신 2바이트로 저장하는 벡터 타입. 크기가 절반, 정밀도는 조금 떨어진다', analogy: '사진 해상도 낮추기', to: '/pgvector/cost#halfvec' },
  { group: '벡터', term: '양자화 · SBQ', meaning: '숫자를 더 적은 비트로 거칠게 줄이는 것. SBQ는 pgvectorscale이 쓰는 방식으로, 4바이트 숫자 하나를 비트 단위로 줄여 먼저 비교에 쓴다', analogy: '흑백 스케치로 먼저 비교하기', to: '/pgvector/diskann#what' },

  { group: '인덱스', term: 'k-NN · ANN', meaning: '가장 가까운 k개 찾기 · 그것을 근사로(가끔 놓치는 대신 빠르게) 하기', to: '/pgvector/ann' },
  { group: '인덱스', term: 'HNSW', meaning: '점들을 여러 층의 그래프로 이어 두고, 위층에서 크게 이동한 뒤 아래층에서 세밀하게 찾는 인덱스', analogy: '고속도로 → 국도 → 골목길', to: '/pgvector/hnsw' },
  { group: '인덱스', term: 'ef_search', meaning: 'HNSW가 찾는 동안 들고 다니는 후보 수. 크면 정확하고 느리다(기본 40)', analogy: '후보 명단의 길이', to: '/pgvector/tuning' },
  { group: '인덱스', term: 'm · ef_construction', meaning: 'HNSW를 만들 때 점마다 이을 이웃 수 · 이웃을 고를 때 보는 후보 수', to: '/pgvector/hnsw#knobs' },
  { group: '인덱스', term: 'IVFFlat', meaning: '점들을 lists개 동네로 나눠 두고, 질문과 가까운 probes개 동네만 뒤지는 인덱스', analogy: '도서관 서가 분류', to: '/pgvector/ivfflat' },
  { group: '인덱스', term: 'k-means', meaning: '점들을 k개 무리로 나누고 무리마다 중심을 정하는 방법. IVFFlat이 동네를 나눌 때 쓴다', to: '/pgvector/ivfflat#build' },
  { group: '인덱스', term: 'lists · probes', meaning: 'IVFFlat의 동네 개수 · 질의 때 뒤지는 동네 개수(기본 1)', to: '/pgvector/ivfflat#lists-probes' },
  { group: '인덱스', term: 'DiskANN', meaning: 'pgvectorscale이 추가하는 그래프 인덱스. 한 층짜리 그래프에 일부러 먼 길도 남겨 두고, 압축한 벡터로 먼저 비교한다', to: '/pgvector/diskann' },
  { group: '인덱스', term: 'query_search_list_size · rescore', meaning: 'DiskANN의 후보 수(HNSW의 ef_search에 해당) · 압축 비교 후 원본으로 다시 잴 후보 수', to: '/pgvector/diskann#build' },
  { group: '인덱스', term: 'iterative_scan', meaning: 'HNSW가 WHERE 조건 때문에 결과가 모자라면 탐색을 이어서 더 찾게 하는 설정(기본 off)', to: '/pgvector/filtering#iterative' },
  { group: '인덱스', term: '라벨 인덱스', meaning: 'DiskANN에 벡터와 함께 smallint[] 라벨을 넣어 인덱스 안에서 조건을 거르는 방식', to: '/pgvector/filtering#diskann' },

  { group: '측정', term: 'recall@10', meaning: '인덱스가 돌려준 10개 중 진짜 정답 10개에 든 비율. 1.0이면 완벽', analogy: '시험 10문제 중 맞힌 개수', to: '/pgvector/ann#recall' },
  { group: '측정', term: '정답(ground truth)', meaning: '인덱스를 끄고 모든 행을 계산해 구한 진짜 가장 가까운 k개. recall의 기준', to: '/pgvector/ann#recall' },
  { group: '측정', term: '버퍼/질의', meaning: '질문 하나에 읽은 페이지 수. 시간보다 실행마다 덜 흔들려서 비용 지표로 쓴다', to: '/pgvector/ann#recall' },
  { group: '측정', term: '빌드 시간 · 인덱스 크기', meaning: 'CREATE INDEX에 걸린 시간 · 만들어진 인덱스가 디스크에서 차지하는 크기', to: '/pgvector/cost' },
  { group: '측정', term: '거리 집중', meaning: '차원이 아주 높고 무작위인 데이터에서는 모든 점이 거의 같은 거리에 놓이는 현상', to: '/pgvector/ann#concentration' },
]

export default function Glossary() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>('전체')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return TERMS.filter((t) => (group === '전체' || t.group === group) && (!needle || (t.term + t.meaning + (t.analogy ?? '')).toLowerCase().includes(needle)))
  }, [q, group])

  return <>
    <PageHeader eyebrow="Week 05 · 용어 사전" title={`막히면 여기로 — ${TERMS.length}개 용어`}
      lede="본문에서도 처음 나올 때 풀어 쓰지만, 발표 중 다시 찾을 수 있게 한곳에 모았다. 비유 열은 정확한 정의가 아니라 감을 잡기 위한 것이다." />
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="용어 · 뜻 · 비유로 검색"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13.5px] outline-none placeholder:text-muted-foreground focus:border-primary/50" />
      </div>
      {(['전체', ...GROUPS] as const).map((g) => (
        <button key={g} type="button" onClick={() => setGroup(g)}
          className={cn('rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
            group === g ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>{g}</button>
      ))}
    </div>
    <div className="space-y-2">
      {rows.map((t) => (
        <div key={t.term} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold">{t.term}</span>
            <Badge variant="outline">{t.group}</Badge>
            {t.to && <Link to={t.to} className="ml-auto text-[12px] text-primary underline-offset-4 hover:underline">더 읽기 →</Link>}
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed">{t.meaning}</p>
          {t.analogy && <p className="mt-1 text-[12.5px] text-muted-foreground">비유: {t.analogy}</p>}
        </div>
      ))}
      {rows.length === 0 && <p className="py-10 text-center text-[13px] text-muted-foreground">그런 용어는 아직 없습니다.</p>}
    </div>
  </>
}
