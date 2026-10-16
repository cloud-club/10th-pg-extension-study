/** week03 meta for Home / nav — 본문은 content/pg_cron.md */

export const week03Meta = {
  week: 'week03',
  extension: 'pg_cron',
  category: '자동화 · Job Scheduling',
  person: '김예은',
  oneLiner:
    'PostgreSQL 안에서 SQL·Function·Procedure를 정해진 시간·주기로 자동 실행하는 Job Scheduler Extension',
  summary:
    'upstream 1.6.7 · PG18 지원은 1.6.6부터. preload + Background Worker. catalog 전문은 웹 week03 페이지에 그대로 렌더.',
  linkFromWeek02: 'pg_stat_statements(진단) → pg_cron(자동화)',
  env: {
    postgres: '16 (Docker lab) / 조사 기준 PG18',
    package: 'postgresql-*-cron · upstream 1.6.7',
    preload: 'pg_cron',
    databaseName: 'study (lab)',
  },
}
