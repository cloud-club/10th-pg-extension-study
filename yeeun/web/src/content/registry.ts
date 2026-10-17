export type NavItem = {
  to: string
  label: string
  hint: string
}

/** 사이드바 — 주차만. 문서/실습은 주차 페이지 안 탭 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', hint: 'All weeks' },
  { to: '/week02', label: 'week02', hint: 'pg_stat_statements' },
  { to: '/week03', label: 'week03', hint: 'pg_cron' },
  { to: '/week04', label: 'week04', hint: 'pg_repack' },
  { to: '/week05', label: 'week05', hint: 'postgres-json-schema' },
  { to: '/week06', label: 'week06', hint: 'btree_gist' },
]

export type WeekCard = {
  to: string
  labTo: string
  week: string
  extension: string
  category: string
  oneLiner: string
  status: 'done' | 'draft' | 'planned'
}

export const WEEK_INDEX: WeekCard[] = [
  {
    to: '/week02',
    labTo: '/week02/lab',
    week: 'week02',
    extension: 'pg_stat_statements',
    category: '운영 · 성능 진단',
    oneLiner: 'catalog 문서 + Docker lab 실측',
    status: 'done',
  },
  {
    to: '/week03',
    labTo: '/week03/lab',
    week: 'week03',
    extension: 'pg_cron',
    category: '자동화 · Job Scheduling',
    oneLiner: 'catalog 전문 + lab',
    status: 'done',
  },
  {
    to: '/week04',
    labTo: '/week04/lab',
    week: 'week04',
    extension: 'pg_repack',
    category: 'Maintenance · Bloat',
    oneLiner: 'MVCC → VACUUM → Bloat → Online repack (catalog + HANDS-ON)',
    status: 'done',
  },
  {
    to: '/week05',
    labTo: '/week05/lab',
    week: 'week05',
    extension: 'postgres-json-schema',
    category: 'Data Validation · JSON',
    oneLiner: 'JSONB + JSON Schema + CHECK (catalog + HANDS-ON)',
    status: 'done',
  },
  {
    to: '/week06',
    labTo: '/week06/lab',
    week: 'week06',
    extension: 'btree_gist',
    category: 'Indexing · Data Integrity',
    oneLiner: 'GiST + EXCLUDE · 예약 충돌 방지 (catalog + HANDS-ON)',
    status: 'done',
  },
]
