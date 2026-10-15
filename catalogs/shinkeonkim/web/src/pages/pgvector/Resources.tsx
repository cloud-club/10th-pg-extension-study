import { PageHeader, Section } from '@/components/layout/PageHeader'
import { envTags } from './stats'
import { Recap } from './guide'

const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a href={href} target="_blank" rel="noreferrer">{children}</a>

export default function Resources() {
  return <>
    <PageHeader eyebrow="Week 05 · 참고 자료" title="참고 자료"
      lede="공식 저장소·문서, 클라우드 사업자 문서, 제작사 블로그를 출처의 성격과 함께 정리했다. 저장소 안의 실습·실험 경로도 함께 둔다."
      tags={envTags} />

    <Section id="official" title="1. 공식 저장소와 문서">
      <ul>
        <li><A href="https://github.com/pgvector/pgvector">pgvector GitHub</A> — README가 사실상 공식 문서. 인덱스 옵션·iterative scan·권장값</li>
        <li><A href="https://github.com/pgvector/pgvector/blob/v0.8.0/src/hnswscan.c">pgvector src/hnswscan.c (v0.8.0)</A> — iterative scan의 종료 조건을 이 자료에서 직접 읽은 파일</li>
        <li><A href="https://github.com/timescale/pgvectorscale">pgvectorscale GitHub</A> — 설치, 라벨 필터링 문법(PostgreSQL License)</li>
        <li><A href="https://www.tigerdata.com/docs/reference/pgvectorscale">TigerData pgvectorscale 문서</A></li>
      </ul>
    </Section>

    <Section id="cloud" title="2. 클라우드 사업자 문서 (1차 출처)">
      <ul>
        <li><A href="https://aws.amazon.com/blogs/database/running-pgvector-in-production-on-amazon-aurora-postgresql/">AWS Database Blog — Running pgvector in production on Amazon Aurora PostgreSQL</A> — HNSW 기본값, ef_search 100부터, iterative_scan, 재빌드 전략, 모니터링</li>
        <li><A href="https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.VectorDB.html">Aurora PostgreSQL 벡터 DB 가이드</A> — 지원 버전</li>
      </ul>
    </Section>

    <Section id="vendor" title="3. 제작사 자료 (편향 가능성 명시)">
      <ul>
        <li><A href="https://www.tigerdata.com/blog/pgvector-vs-qdrant">TigerData — pgvector vs Qdrant</A> — 5천만 행 벤치마크. 단일 노드·배치 모드 끔·파라미터 튜닝 비대칭을 저자도 인정. <a href="#/pgvector/diskann-details">DiskANN 페이지</a>에 수치와 한계를 함께 실었다</li>
      </ul>
    </Section>

    <Section id="repo" title="4. 이 저장소">
      <table><thead><tr><th>경로</th><th>내용</th></tr></thead><tbody>
        <tr><td><code>catalogs/shinkeonkim/pgvector.md</code> · <code>pgvectorscale.md</code></td><td>카탈로그 요약(TEMPLATE 형식)</td></tr>
        <tr><td><code>week05/README.md</code></td><td>주차 개요(마크다운판)</td></tr>
        <tr><td><code>week05/pgvector/labs/01·02</code>, <code>week05/pgvectorscale/labs/01</code></td><td>Docker 실습 — 각 디렉터리에서 <code>./run.sh</code></td></tr>
        <tr><td><code>week05/experiments/01~07</code></td><td>실험 — 각 README에 왜·가설·검증·한계</td></tr>
        <tr><td><code>web/scripts/sync-pgvector-results.py</code> · <code>capture-pgvector-demo.py</code></td><td>이 사이트의 수치·SQL 출력을 만드는 스크립트</td></tr>
      </tbody></table>
    </Section>

    <Recap
      points={[
        <>수치는 공식 문서·클라우드 사업자 문서·제작사 자료(한계 명시)에서만 인용했다.</>,
        <>직접 돌려 보려면 <code>week05/</code>의 실습부터 — Docker만 있으면 된다.</>,
      ]}
      next={{ to: '/pgvector/about', title: '처음으로', why: '전체 순서를 다시 본다.' }} />
  </>
}
