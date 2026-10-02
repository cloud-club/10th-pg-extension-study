import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { exp, fmtBytes, fmtMs, fmtNum, fmtTps, storageCell } from './stats'

const s500 = storageCell(500, 'low')
const u = exp.update.cases['500']
const ix = exp.index.configs
const cc = exp.concurrency
const rd = exp.redis.configs

export default function Experiments() {
  return <>
    <PageHeader eyebrow="Week 04 · 실험" title="다섯 개 실험: 질문, 방법, 결과, 한계"
      lede="이 자료의 주장은 모두 격리된 임시 컨테이너에서 반복 측정한 결과에 근거한다. 각 실험이 무엇을 확인하고 무엇은 확인하지 못했는지 함께 적었다."
      tags={[{ label: exp.environment.postgres.split(' (')[0] }, { label: `hstore ${exp.environment.hstore_version}` }, { label: `Docker · CPU ${exp.environment.cpu_count}개` }, { label: exp.environment.redis?.split(' sha')[0] ?? 'Redis' }]} />

    <Section id="overview" title="1. 한눈에 보기">
      <table><thead><tr><th>실험</th><th>질문</th><th>반복</th><th>핵심 결과</th></tr></thead><tbody>
        <tr><td><Ref to="/hstore/storage#footprint">01 · 저장 크기</Ref></td><td>같은 속성 묶음이 hstore·jsonb·EAV에서 얼마나 차지하나? 왜 갈리나?</td><td>{exp.storage.runs}회 (결정적)</td><td>키 20개 이하는 hstore = jsonb. 키 500개·값 종류 적음에서 {fmtBytes(s500.hs.avg_column_bytes)} vs {fmtBytes(s500.jb.avg_column_bytes)}. 원인은 HEntry의 끝 위치 배열</td></tr>
        <tr><td><Ref to="/hstore/updates">02 · 갱신 비용</Ref></td><td>키 하나를 바꾸면 얼마나 쓰나? GIN이 있으면?</td><td>{exp.update.runs}회</td><td>키 500개 UPDATE 1건 WAL {fmtBytes(u.hstore_concat.wal_bytes_per_update.median)} (EAV {fmtBytes(u.eav_row.wal_bytes_per_update.median)}). GIN 있으면 {fmtBytes(u.hstore_concat_gin.wal_bytes_per_update.median)}</td></tr>
        <tr><td><Ref to="/hstore/indexes#benchmark">03 · 인덱스</Ref></td><td>GIN·GiST·btree 식 인덱스의 크기·조회·삽입 비용은?</td><td>{exp.index.runs}회</td><td>GIN {fmtBytes(ix.hstore_gin.index_bytes.median)}, GiST(16) {fmtBytes(ix.hstore_gist16.index_bytes.median)}, btree 식 {fmtBytes(ix.btree_brand.index_bytes.median)}. 0.1% 조건에서 GIN {fmtMs(ix.hstore_gin.queries.contain_rare_value.ms.median)} / 순차 {fmtMs(ix.none.queries.contain_rare_value.ms.median)}</td></tr>
        <tr><td><Ref to="/hstore/concurrency">04 · 동시성</Ref></td><td>같은 행을 동시에 갱신하면 유실되나? 어떻게 막나?</td><td>{cc.runs}회</td><td>읽고-쓰기는 {fmtNum(cc.key_add.rmw_autocommit.attempted)}건 중 키 {fmtNum(cc.key_add.rmw_autocommit.keys_present.median)}개만 남음. 원자적 <code>||</code>·<code>FOR UPDATE</code>는 {cc.runs}회 모두 유실 0</td></tr>
        <tr><td><Ref to="/hstore/vs-redis#benchmark">05 · Redis 비교</Ref></td><td>같은 일을 시키면 어느 쪽이 얼마나 빠른가?</td><td>{exp.redis.runs}회</td><td>쓰기(클라이언트 8): 영속화 없음 Redis {fmtTps(rd.none.redis.write_one_field_c8.ops_per_sec.median)} / hstore {fmtTps(rd.none.postgres.write_one_field_c8.ops_per_sec.median)}, 엄격 {fmtTps(rd.strict.redis.write_one_field_c8.ops_per_sec.median)} / {fmtTps(rd.strict.postgres.write_one_field_c8.ops_per_sec.median)}</td></tr>
      </tbody></table>
    </Section>

    <Section id="method" title="2. 공통 방법">
      <ul>
        <li><strong>격리:</strong> 실험마다 새 컨테이너와 새 볼륨(<code>docker compose up --force-recreate</code> → <code>down --volumes</code>). 회차끼리 상태를 공유하지 않는다.</li>
        <li><strong>환경 고정:</strong> PostgreSQL 16.15(이미지 다이제스트 고정), <code>shared_buffers=256MB</code>, 체크포인트가 측정에 끼지 않도록 <code>max_wal_size=8GB</code>·<code>checkpoint_timeout=1h</code>. fsync 경로가 살도록 tmpfs가 아닌 볼륨을 쓴다.</li>
        <li><strong>결정적 데이터:</strong> 값은 <code>md5</code>와 인덱스로 생성한다. 무작위 시드에 의존하지 않는다.</li>
        <li><strong>정합성 검사:</strong> 조회 실험은 모든 인덱스 설정에서 결과 행 수가 같은지, 동시성 실험은 유실이 없어야 하는 시나리오에서 실제로 없는지 assert한다. 조건을 어기면 그 회차는 게시되지 않는다.</li>
        <li><strong>요약:</strong> 웹에는 중앙값과 최소~최대만 싣는다. 회차별 원본은 <code>results/</code>에 생기며 Git에서 제외한다.</li>
      </ul>
      <CodeBlock language="bash">{`cd catalogs/shinkeonkim/week04/hstore/experiments
python3 01-storage-footprint/bench.py         # 3회
python3 02-update-write-amplification/bench.py  # 5회
python3 03-index-and-query/bench.py           # 5회
python3 04-concurrency-lost-update/bench.py   # 10회
python3 05-redis-comparison/bench.py          # 5회 (Redis 7.4 컨테이너 사용)
cd ../../../web && python3 scripts/sync-hstore-results.py   # 웹 요약 게시`}</CodeBlock>
      <p>모든 실험은 같은 Compose 프로젝트(<code>runtime/</code>)를 쓰므로 <strong>동시에 실행하지 않는다</strong>.</p>
    </Section>

    <Section id="limits" title="3. 이 실험이 확인하지 않은 것">
      <table><thead><tr><th>한계</th><th>영향</th></tr></thead><tbody>
        <tr><td>Docker Desktop(macOS)의 Linux VM, 공유 CPU {exp.environment.cpu_count}개. 클라이언트와 서버가 같은 CPU를 쓴다</td><td>절대 TPS·지연은 일반화하지 않는다. 방식 사이의 상대 비교와 인과 확인에 쓴다.</td></tr>
        <tr><td>가상 디스크의 fsync 지연</td><td>엄격한 내구성 쌍(Redis AOF always ↔ PG sync=on)의 순위는 실제 SSD에서 다를 수 있다.</td></tr>
        <tr><td>데이터 크기: 20만 행(인덱스), 5만 객체(Redis), 1000행(갱신)</td><td>훨씬 큰 데이터의 캐시 밖 I/O는 재지 않았다. GIN의 이득은 커질 것으로 예상하지만 측정하지 않았다.</td></tr>
        <tr><td>값 분포: 낮은/높은 엔트로피 두 가지, 키 이름 길이 8자</td><td>압축률은 데이터에 크게 좌우된다. 실제 데이터로 <code>pg_column_size</code>를 재 봐야 한다.</td></tr>
        <tr><td>복제·장애 조치·크래시 복구, Redis Cluster</td><td>다루지 않았다. 내구성은 설정(fsync 정책)만 맞췄고 실제 크래시를 주입하지 않았다.</td></tr>
        <tr><td>Redis 8 계열의 메모리 최적화(compact hash 등)</td><td>Redis 7.4로만 측정했다.</td></tr>
        <tr><td>다른 PostgreSQL 버전(17·18)</td><td>hstore 1.8은 같지만 실행기·TOAST 세부는 다를 수 있다. 16.15에서만 측정했다.</td></tr>
      </tbody></table>
    </Section>

    <Section id="corrections" title="4. 측정 중에 바로잡은 것">
      <p>처음 가정이 틀렸던 부분을 남긴다. 결과를 믿기 위한 검사가 어디서 걸렸는지 보여 준다.</p>
      <table><thead><tr><th>처음 가정</th><th>실제</th><th>어떻게 알았나</th></tr></thead><tbody>
        <tr><td>hstore 크기 = 4 + 4 + 8 × 쌍 + 문자열</td><td>130바이트 이하는 1바이트 짧은 헤더라 <strong>3바이트 적다</strong>. TOAST 테이블로 나간 값은 <code>pg_column_size</code>가 4바이트 적게 보고한다</td><td>공식 검증 assert가 실패했다. 저장 형태를 4가지로 분류해 모든 조건이 설명되도록 고쳤다</td></tr>
        <tr><td>pgbench에서 <code>:'old'</code>로 값을 인용할 수 있다</td><td>pgbench는 이 문법을 지원하지 않아 읽고-쓰기 시나리오가 <strong>한 건도 실행되지 않았다</strong></td><td>성공 0건·TPS 없음. 이제 하네스가 ‘거래 0건’이면 예외를 낸다</td></tr>
        <tr><td>GiST가 <code>&lt;@</code>도 지원한다</td><td>연산자 클래스에서 주석 처리돼 있다. 카탈로그에도 없다</td><td>소스(<code>hstore--1.4.sql</code>)와 <code>pg_amop</code> 조회로 확인해 문서·표를 고쳤다</td></tr>
        <tr><td><code>heap_page_items</code>의 <code>t_data</code>를 <code>t_hoff</code> 뒤부터 읽으면 된다</td><td><code>t_data</code>는 이미 튜플 헤더를 뺀 사용자 데이터라 <strong>앞 4바이트(id) 뒤</strong>가 hstore다. 잘못 자르면 디코딩이 엉뚱한 곳을 읽는다</td><td>해독 쿼리가 ‘index out of range’로 실패했다. 실제 바이트(<code>4f 03000080 …</code>)를 보고 위치를 바로잡았다</td></tr>
        <tr><td><code>attrs - 'key'</code>는 키를 지운다</td><td>따옴표 리터럴은 <strong>hstore로 해석</strong>돼 오류가 난다. <code>::text</code>가 필요하다</td><td>예제 캡처가 <code>syntax error in hstore</code>로 실패했다. 오류를 그대로 페이지에 싣고 실습에도 넣었다</td></tr>
        <tr><td>NULL 값은 빈 문자열보다 작다</td><td>둘의 크기가 <strong>같다</strong>(모두 문자열 영역을 쓰지 않는다). 차이는 ISNULL 비트뿐이다</td><td><code>pg_column_size</code>로 17 = 17 확인</td></tr>
        <tr><td><code>hstore_to_jsonb_loose</code>는 <code>true</code>를 불리언으로 만든다</td><td>불리언은 <strong><code>t</code>·<code>f</code> 한 글자</strong>만 변환된다. <code>true</code>는 문자열로 남는다</td><td>실제 실행 결과를 보고 애니메이션·본문을 고쳤다</td></tr>
        <tr><td>식 인덱스를 만들면 추정이 정확해진다</td><td>통계는 <strong>ANALYZE 이후</strong>에 생긴다. 만든 직후에는 기본 추정이라 5배 어긋났다</td><td>추정 행 수와 실제 행 수를 비교하다 발견. 전·후를 모두 실었다</td></tr>
        <tr><td>hstore도 jsonb만큼 압축될 것이다</td><td>키가 100개 이상이면 크게 덜 압축된다</td><td>실험 01. 원인은 합성 데이터 대조로 좁혔다 (<Ref to="/hstore/storage#toast">저장 방식</Ref>)</td></tr>
      </tbody></table>
    </Section>
  </>
}
