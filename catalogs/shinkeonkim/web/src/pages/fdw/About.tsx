import { PageHeader, Section } from '@/components/layout/PageHeader'
import { EasyFirst } from '@/components/layout/Callout'
import { Ref } from '@/components/common/Ref'
import { Diagram } from '@/components/viz/Diagram'

const basics = [
 ['databases','01. DB 두 개를 함께 읽는다는 것','테이블·SQL·스키마부터 시작한다.'],
 ['objects','02. FDW와 네 가지 객체','접근 구현·주소·계정·표 정의를 나눈다.'],
 ['install','03. 연결·권한·첫 조회','요청 경로와 오류 단계를 구분한다.'],
 ['select-joins','04. SELECT와 JOIN의 데이터 흐름','최종 행 수와 중간 데이터 이동을 나눈다.'],
 ['plans','05. 실행 계획과 pushdown','Remote SQL·Filter·rows·loops를 읽는다.'],
 ['network-basics','06. RTT·대역폭·fetch','왕복 횟수와 전송량을 따로 생각한다.'],
 ['load','07. 연결·세션·동시 부하','연결 예산·처리량·꼬리 지연의 의미를 배운다.'],
 ['transactions','08. 트랜잭션·스냅샷·장애','정상 롤백과 분산 장애 보장을 구분한다.'],
 ['related','09. 관련 확장과 설계 선택','dblink·file_fdw·검색·관측·캐시를 비교한다.'],
 ['glossary','10. 용어집과 진단 순서','증상에서 관측·가설·실험으로 넘어간다.'],
]
const advanced = [
 ['planner','planner와 shippability','실행 가능성·함수 volatility·extension·JOIN 후보'],
 ['costs','비용·통계·JOIN','로컬 통계·원격 EXPLAIN·계획 오차·버전 차이'],
 ['cursors','cursor·fetch·메모리','묶음 버퍼·EOF·첫 행 지연·비동기 실행'],
 ['observability','연결·관측·부하','양쪽 대기·앱 풀·쿼리 통계·벤치마크 범위'],
 ['writes','쓰기·잠금·재시도','direct modify·batch·타임아웃·커밋 불확실성'],
 ['source','소스와 운영 설계','고정 버전 함수 지도·권한·스키마·캐시·운영 판단'],
]
export default function About() {
 return <>
  <PageHeader eyebrow="Week 07 · postgres_fdw" title="원격 데이터를 읽는 통로부터 운영의 경계까지"
   lede="기본 학습 10장 → Lab 5개와 반복 실험 → 심화 6장. 처음 읽을 때 필요한 정의부터 쌓고, SQL 결과와 구현을 이어서 확인한다." />
  <EasyFirst>우리 학교의 관심 책 목록과 다른 학교의 책 정보를 함께 읽고 싶다고 하자. postgres_fdw는 우리 학교 DB가 다른 학교에 SQL을 보내 결과를 받아오는 통로다. 데이터의 위치와 처리 위치를 이해하면 지연·부하·정확성도 차례로 설명할 수 있다.</EasyFirst>
  <Diagram chart={'flowchart LR\n App[앱 또는 psql] --> Local[local PostgreSQL / study]\n Local -->|원격 SQL| Remote[remote PostgreSQL / school]\n Remote -->|결과 행| Local'} caption="연결은 로컬 PostgreSQL에서 출발한다. foreign table은 원격 표 정의이며 데이터를 로컬에 전부 복사하지 않는다." />
  <Section id="industry" title="국내 기업 사례: 왜 쓰고 무엇을 조사할까">
   <p>실제 적용 경험과 클라우드 서비스 가이드를 바탕으로 학습 질문을 정했다. 아래의 조사 방향은 이 자료의 해석이며, 클라우드 가이드는 해당 기업 내부 서비스의 도입 규모를 나타내지는 않는다.</p>
   <table><thead><tr><th>기업·근거</th><th>공개된 사용 방식</th><th>따라서 조사할 것</th></tr></thead><tbody>
    <tr><td><a href="https://techblog.woowahan.com/20371/">우아한형제들 · 실제 이관 사례</a></td><td>상품 DB 통합에 SQL 이관·전처리·별도 이관 DB 활용</td><td><Ref to="/postgres-fdw/plans">원격 JOIN·필터</Ref>, <Ref to="/postgres-fdw/costs">staging 비용</Ref>, <Ref to="/postgres-fdw/transactions">읽기 시점·실패 경계</Ref></td></tr>
    <tr><td><a href="https://guide.ncloud-docs.com/docs/clouddbforpostgresql-postgresqlfdw">네이버클라우드 · 공식 가이드</a></td><td>VPC의 DB 사이 ACG·접근제어·FDW 설정</td><td><Ref to="/postgres-fdw/install">서버 간 접속·인증·객체 권한</Ref></td></tr>
    <tr><td><a href="https://docs.kakaocloud.com/service/data-store/postgresql/how-to-guides/postgresql-extension#postgres_fdw">카카오클라우드 · 공식 가이드</a></td><td>create_fdw_server를 경유해 연결과 계정 매핑</td><td><Ref to="/postgres-fdw/objects">객체·템플릿·생성 권한</Ref>, <Ref to="/postgres-fdw/source">서비스별 운영 절차</Ref></td></tr>
    <tr><td><a href="https://tech.madup.com/data-mart-1/">매드업 · 관련 확장 비교 사례</a></td><td>Redshift → PostgreSQL 데이터마트, 실제 조회는 dblink</td><td><Ref to="/postgres-fdw/related">FDW·dblink의 역할 차이</Ref>, <Ref to="/postgres-fdw/observability">작업 중복·잠금·관측</Ref></td></tr>
   </tbody></table>
   <p><Ref to="/postgres-fdw/industry-cases">사례의 전제·근거·조사 질문 자세히 읽기</Ref> — 기업의 결과를 그대로 일반화하지 않고 이관·상시 조회·정기 수집의 차이를 배운다.</p>
   <p><Ref to="/postgres-fdw/blog-review">블로그 주의사항 검토와 실제 실험</Ref>에서 JOIN·CTE·쓰기 차단·트랜잭션·정리의 적용 조건을 확인한다.</p>
  </Section>
  <Section id="basic" title="처음이라면: 기본 학습 10장">
   <p>각 장은 학습 목표 → 용어와 예제 → 비용이나 보장 경계 → 복습 해설 → 다음 장 순서다. SQL·서버·연결을 처음 접해도 앞에서 배운 개념을 다음 장에 사용하도록 구성했다.</p>
   <table><thead><tr><th>장</th><th>배울 것</th></tr></thead><tbody>{basics.map(([slug,title,hint]) => <tr key={slug}><td><Ref to={'/postgres-fdw/'+slug}>{title}</Ref></td><td>{hint}</td></tr>)}</tbody></table>
  </Section>
  <Section id="related" title="관련 확장: 대안·검색·관측·캐시">
   <p>기본 09 다음에 책임과 운영 비용을 확장별로 읽는다. 쉬운 정의부터 SQL·성능·실습 연결까지 구성했다.</p>
   <ul><li><Ref to="/postgres-fdw/related-dblink">dblink: 직접 SQL·cursor·트랜잭션 관리</Ref></li><li><Ref to="/postgres-fdw/related-file-fdw">file_fdw: 서버 파일·COPY·데이터 계약</Ref></li><li><Ref to="/postgres-fdw/related-remote-search">pg_trgm: 조건 전송과 원격 인덱스</Ref></li><li><Ref to="/postgres-fdw/related-observability">pg_stat_statements·auto_explain: 양쪽 관측</Ref></li><li><Ref to="/postgres-fdw/related-cache-cron">pg_cron: 캐시 갱신·신선도·실패 운영</Ref></li></ul>
  </Section>
  <Section id="labs" title="직접 확인: Lab과 실제 결과">
   <p><Ref to="/postgres-fdw/labs">Lab 목록과 실행 순서</Ref>에서 시작한다. 웹에 수동 명령·예상 관찰·해석·복습을 모았고 week07에는 실행용 SQL·스크립트와 실제 결과를 둔다.</p>
   <ol><li><Ref to="/postgres-fdw/lab-connect">연결·정의·읽기 권한</Ref></li><li><Ref to="/postgres-fdw/lab-pushdown">필터·JOIN·pg_trgm의 처리 위치</Ref></li><li><Ref to="/postgres-fdw/lab-fetch">실제 FETCH 횟수와 종료 확인</Ref></li><li><Ref to="/postgres-fdw/lab-transactions">스냅샷·정상 롤백·잠금 대기 취소</Ref></li><li><Ref to="/postgres-fdw/lab-connections">세션별 연결·dblink·file_fdw</Ref></li></ol>
   <p><Ref to="/postgres-fdw/join-comparison">JOIN·전처리·staging 준비 포함 비교 Lab</Ref>과 <Ref to="/postgres-fdw/experiments">기존 반복 실험 3개와 해석</Ref>은 실제 원시 결과를 사용한다. <Ref to="/postgres-fdw/network">네트워크 계산기</Ref>는 가정 모델이며 실측과 구분한다.</p>
  </Section>
  <Section id="advanced" title="원리를 더 깊게: 심화 6장">
   <p>기본 용어를 알고 있다는 전제에서 구현·계측·운영 판단을 상세히 설명한다. 관심 있는 질문에 맞춰 들어가도 앞선 기본 장과 Lab으로 돌아갈 수 있다.</p>
   <table><thead><tr><th>주제</th><th>이어 볼 내용</th></tr></thead><tbody>{advanced.map(([slug,title,hint]) => <tr key={slug}><td><Ref to={'/postgres-fdw/'+slug}>{title}</Ref></td><td>{hint}</td></tr>)}</tbody></table>
  </Section>
  <Section id="evidence" title="이 자료가 확인한 것과 다음 보강">
   <p>PostgreSQL 18.6의 전용 Docker 두 DB에서 Lab 5개와 조건당 10회 반복 실험을 실행했다. 내부 네트워크 결과이며 WAN·앱 전체 p99·메모리 한계·분산 커밋 장애까지 검증한 것은 아니다.</p>
   <p>질문이 생기면 관련 개념의 정의·예제·관찰을 함께 보강한다. 기존 설명 순서가 맞지 않으면 구조부터 재구성한다. 공식 보장, 실험의 실제 결과, 설명용 가정값을 구분해 남긴다.</p>
  </Section>
 </>
}
