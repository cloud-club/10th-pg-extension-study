import { PageHeader, Section } from '@/components/layout/PageHeader'
import { CodeBlock } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'

const aws = 'https://docs.aws.amazon.com/ko_kr/AmazonRDS/latest/UserGuide/PostgreSQL_pg_cron.html'

export default function Rds() {
  return <>
    <PageHeader eyebrow="Week 03 · 관리형 서비스" title="Amazon RDS for PostgreSQL에서 pg_cron 사용하기" lede="RDS에서는 운영체제 파일을 직접 바꾸지 않는다. 사용자 지정 파라미터 그룹에 preload 설정을 넣고 재부팅한 뒤, DB 안에서 확장을 만들고 사용자 권한과 실행 이력을 관리한다." />
    <Section title="RDS에서 달라지는 준비 절차">
      <ol><li>사용 중인 RDS PostgreSQL 버전이 pg_cron을 지원하는지 확인한다. AWS 문서는 PostgreSQL 12.5 이상에서 지원한다고 안내한다.</li><li>인스턴스에 연결한 사용자 지정 DB 파라미터 그룹의 <code>shared_preload_libraries</code>에 <code>pg_cron</code>을 추가한다.</li><li><code>rds.allowed_extensions</code>로 설치 가능 확장을 제한했다면 그 목록에도 <code>pg_cron</code>을 넣는다.</li><li>파라미터 적용을 위해 DB 인스턴스를 재부팅한다.</li><li><code>rds_superuser</code> 권한 사용자가 기본 <code>postgres</code> DB에서 확장을 만든다.</li></ol>
      <CodeBlock language="sql" output={'CREATE EXTENSION\nGRANT'} outputCaption="AWS 절차를 SQL 부분만 표시">{`CREATE EXTENSION pg_cron;
GRANT USAGE ON SCHEMA cron TO app_scheduler;`}</CodeBlock>
      <p>스키마 USAGE만으로 대상 테이블을 바꿀 수 있는 것은 아니다. 예약 SQL은 등록한 사용자 권한으로 실행되므로 대상 스키마·테이블·함수 권한도 필요하다.</p>
    </Section>
    <Section title="설정 값과 실행 자원을 함께 확인한다">
      <CodeBlock language="sql">{`SHOW shared_preload_libraries;
SHOW cron.database_name;
SHOW cron.max_running_jobs;
SHOW max_worker_processes;`}</CodeBlock>
      <p>AWS 문서는 worker 모드를 사용할 때 <code>max_worker_processes</code>를 <code>cron.max_running_jobs</code>보다 크게 두라고 안내한다. 실제 계산에는 상주 launcher와 다른 worker 사용처의 여유까지 더해야 한다. 슬롯이 부족하면 잡 실행이 실패할 수 있다.</p>
    </Section>
    <Section title="권한과 이력에서 자주 놓치는 부분">
      <table><thead><tr><th>항목</th><th>RDS에서 확인할 내용</th></tr></thead><tbody>
        <tr><td>보이는 예약</td><td>일반 사용자는 자기 예약을 조회한다. rds_superuser는 전체 예약을 관리할 수 있다.</td></tr>
        <tr><td>권한 실패</td><td>잡 사용자가 대상 객체 권한이 없으면 실행 이력에 failed와 오류 이유가 남는다.</td></tr>
        <tr><td>직접 테이블 변경</td><td>AWS는 cron 테이블의 INSERT·UPDATE 권한을 사용자에게 주지 말고 제공된 함수를 사용하라고 안내한다. username을 바꾸는 권한 상승 위험을 피하기 위해서다.</td></tr>
        <tr><td>이력 저장</td><td><code>cron.log_run=on</code>이면 job_run_details에 남는다. off이면 그 테이블에 기록되지 않아 PostgreSQL 로그를 확인해야 한다.</td></tr>
        <tr><td>이력 크기</td><td>실행 이력은 계속 늘 수 있으므로 보존 기간에 맞춘 정리 잡을 둔다.</td></tr>
      </tbody></table>
      <CodeBlock language="sql" output={' schedule\n----------\n       42\n(1 row)'} outputCaption="예시 · 매일 실행 이력을 7일치만 남기는 잡">{`SELECT cron.schedule(
  'delete-cron-history',
  '0 0 * * *',
  $$DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days'$$
);`}</CodeBlock>
    </Section>
    <Section title="문서를 적용할 때 구분할 점">
      <p>AWS 문서는 RDS의 파라미터 그룹, <code>rds_superuser</code>, 허용 확장 목록을 설명한다. 로컬 Docker 실습의 설정 파일 경로와 계정 이름을 그대로 RDS에 적용하지 않는다. 예약 저장 방식과 <code>cron.job</code>·<code>cron.job_run_details</code>의 의미는 같다.</p>
      <p><a href={aws}>AWS 공식 문서 · Amazon RDS for PostgreSQL에서 pg_cron 예약</a> · <Ref to="/pg-cron/failures">실패 이력 읽기</Ref> · <Ref to="/pg-cron/limits">운영 한계</Ref></p>
    </Section>
  </>
}
