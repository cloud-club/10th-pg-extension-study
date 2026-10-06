import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

const LABS = [
  { title: '01. pgvector 설치와 거리 연산자', path: 'pgvector/labs/01-install-and-distance-ops', what: 'vector·halfvec·sparsevec·bit 타입, 거리 연산자, 인덱스 생성과 설치 권한을 확인합니다.' },
  { title: '02. HNSW vs IVFFlat', path: 'pgvector/labs/02-hnsw-vs-ivfflat', what: 'IVFFlat의 빌드 순서와 probes, HNSW의 ef_search를 바꾸면서 실행 계획을 읽습니다.' },
  { title: '03. pgvectorscale 설치와 DiskANN', path: 'pgvectorscale/labs/01-install-and-diskann', what: 'pgvector에 의존하는 확장의 설치, DiskANN 설정과 라벨 인덱스를 확인합니다.' },
]

export default function Labs() {
  return <>
    <PageHeader eyebrow="Week 05 · 실습" title="Lab 목록과 실행 순서"
      lede="기본 학습에서 본 개념을 직접 확인하는 실습 3개입니다. Docker를 준비하고 저장소 루트에서 아래 순서대로 실행합니다." />
    {LABS.map((lab, i) => <Section key={lab.path} id={`lab-${i + 1}`} title={lab.title}>
      <p>{lab.what}</p>
      <p>실습 안내: <code>{`catalogs/shinkeonkim/week05/${lab.path}/README.md`}</code></p>
      <CodeBlock language="bash">{`cd catalogs/shinkeonkim/week05/${lab.path}\n./run.sh       # 자동 실행\n./run.sh psql  # 수동 실습용 접속`}</CodeBlock>
      <p>각 명령은 저장소 루트를 기준으로 실행합니다. 다음 실습으로 이동하기 전에 저장소 루트로 돌아옵니다.</p>
    </Section>)}
    <Section id="next" title="SQL 출력과 실험 결과">
      <ul>
        <li><Ref to="/pgvector/install">설치와 SQL 실습</Ref> — 실제 실행 결과와 EXPLAIN 해설.</li>
        <li><Ref to="/pgvector/experiments">실험 질문과 결과</Ref> — 문법 확인을 넘어 정확도와 비용을 측정합니다.</li>
      </ul>
    </Section>
  </>
}
