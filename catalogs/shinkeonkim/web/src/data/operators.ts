/* ===========================================================================
 * 실험 03 — 연산자 지원 행렬 · 유사도 점수 대조
 * 재현: week02/bigm-vs-trgm/experiments/03-operator-coverage-and-correctness
 * 측정: PostgreSQL 16 / pg_bigm 1.2 / pg_trgm 1.6 / 100,014행 (변형 문자열 14개 주입)
 * =========================================================================== */

export type Support =
  | { kind: 'index'; candidates: number }
  | { kind: 'seq' }
  | { kind: 'none' }        // 연산자 자체가 없다
  | { kind: 'knn' }         // Index Scan ... Order By
  | { kind: 'nosort' }      // 인덱스는 있는데 정렬을 못 한다

export const OP_ROWS: { op: string; note?: string; bigm: Support; trgm: Support; gist: Support }[] = [
  { op: "LIKE '%클라우드클럽%'", note: '6글자',
    bigm: { kind: 'index', candidates: 2 }, trgm: { kind: 'index', candidates: 2 }, gist: { kind: 'index', candidates: 2 } },
  { op: "LIKE '%클클%'", note: '2글자',
    bigm: { kind: 'index', candidates: 1 }, trgm: { kind: 'index', candidates: 100014 }, gist: { kind: 'index', candidates: 100014 } },
  { op: "ILIKE '%CLOUDCLUB%'",
    bigm: { kind: 'seq' }, trgm: { kind: 'index', candidates: 2 }, gist: { kind: 'index', candidates: 2 } },
  { op: "~ 'cloudclub'", note: 'ASCII 정규식',
    bigm: { kind: 'seq' }, trgm: { kind: 'index', candidates: 2 }, gist: { kind: 'index', candidates: 2 } },
  { op: "~ '클라우드클럽'", note: '한글 정규식',
    bigm: { kind: 'seq' }, trgm: { kind: 'index', candidates: 100014 }, gist: { kind: 'index', candidates: 100014 } },
  { op: "= '클둥이'", note: '동등 비교',
    bigm: { kind: 'seq' }, trgm: { kind: 'index', candidates: 1 }, gist: { kind: 'index', candidates: 1 } },
  { op: "=% '클라우드클럽'", note: 'bigm 유사도',
    bigm: { kind: 'index', candidates: 8 }, trgm: { kind: 'none' }, gist: { kind: 'none' } },
  { op: "% '클라우드클럽'", note: 'trgm 유사도',
    bigm: { kind: 'none' }, trgm: { kind: 'index', candidates: 6 }, gist: { kind: 'index', candidates: 4 } },
  { op: 'ORDER BY <-> LIMIT 3', note: 'KNN',
    bigm: { kind: 'none' }, trgm: { kind: 'nosort' }, gist: { kind: 'knn' } },
]

/** 피연산자 순서가 인덱스 사용을 바꾸는 자리 — 에러가 안 나서 발견하기 어렵다. */
export const DIRECTION_TRAP = [
  { q: "doc <% '검색어'", gin: 'Seq Scan (Filter 로만 평가)', gist: '—', ok: false },
  { q: "doc %> '검색어'", gin: 'Index Cond ✓', gist: '—', ok: true },
  { q: "'검색어' <% doc", gin: 'Index Cond ✓ (플래너가 교환한다)', gist: 'Index Cond ✓', ok: true },
  { q: "doc <<% '검색어'", gin: 'Seq Scan', gist: '—', ok: false },
  { q: "doc %>> '검색어'", gin: 'Index Cond ✓ (후보 5행)', gist: '—', ok: true },
  { q: "'검색어' <<% doc", gin: 'Index Cond ✓ (후보 5행)', gist: 'Index Cond ✓ (후보 5행)', ok: true },
]

/** 세 유사도가 같은 검색어('클럽')에 매기는 점수 */
export const THREE_SIMS = [
  { doc: '클럽', sim: 1.0, word: 1.0, strict: 1.0 },
  { doc: '클럽 하우스', sim: 0.4286, word: 1.0, strict: 1.0 },
  { doc: '클라우드클럽', sim: 0.25, word: 0.3333, strict: 0.25 },
  { doc: '클라우드클럽 십기 스터디 참여 안내문', sim: 0.0909, word: 0.3333, strict: 0.25 },
]

/** 같은 오탈자에 두 확장이 매기는 점수 */
export const SIM_PAIRS = [
  { from: '신건', to: '신컨', bigm: 0.3333, trgm: 0.2 },
  { from: '김신건', to: '김신컨', bigm: 0.5, trgm: 0.3333 },
  { from: '클둥이', to: '클동이', bigm: 0.5, trgm: 0.1429 },
  { from: '클라우드클럽', to: '클라으드클럽', bigm: 0.7143, trgm: 0.4 },
  { from: '클라우드클럽', to: '클라우드 클럽', bigm: 0.8571, trgm: 0.5556 },
  { from: '클라우드클럽', to: '클라우드클럽스터디', bigm: 0.6, trgm: 0.5455 },
  { from: '클라우드클럽', to: '클클', bigm: 0.1429, trgm: 0.1111 },
  { from: 'CloudClub', to: 'cloudclub', bigm: 0.6667, trgm: 1.0 },
]

/** 임계값을 양쪽 다 0.3 으로 두었을 때의 순위 */
export const THRESHOLD_RANK = {
  bigm: [
    { doc: '클라우드클럽', sim: 1.0 },
    { doc: '클라우드 클럽', sim: 0.8571 },
    { doc: '클라으드클럽', sim: 0.7143, mark: true },
    { doc: '클라우드클럽스터디', sim: 0.6 },
  ],
  trgm: [
    { doc: '클라우드클럽', sim: 1.0 },
    { doc: '클라우드 클럽', sim: 0.5556 },
    { doc: '클라우드클럽스터디', sim: 0.5455, mark: true },
    { doc: '클라으드클럽', sim: 0.4 },
  ],
}

/** 기능으로 고르는 표 */
export const CHOOSE_BY_FEATURE: { need: string; answer: string; who: 'bigm' | 'trgm' | 'both' | 'neither' }[] = [
  { need: '2글자 한글 부분 문자열', answer: 'pg_bigm — trgm 은 전체 인덱스 스캔', who: 'bigm' },
  { need: '짧은 한글 이름의 오탈자 검색', answer: 'pg_bigm — trgm 은 임계값 0.3 에 못 미친다', who: 'bigm' },
  { need: '구두점이 의미를 갖는 검색 (IP·버전·경로)', answer: 'pg_bigm', who: 'bigm' },
  { need: '대소문자를 구분해야 하는 검색', answer: 'pg_bigm', who: 'bigm' },
  { need: 'ILIKE', answer: 'pg_trgm — bigm 은 Seq Scan', who: 'trgm' },
  { need: '정규식 (ASCII/유럽어)', answer: 'pg_trgm — 대안 없음', who: 'trgm' },
  { need: '정규식 (한글)', answer: '둘 다 안 된다 — trgm 은 전체 인덱스 스캔, bigm 은 Seq Scan', who: 'neither' },
  { need: '"가장 비슷한 것 N건" 정렬', answer: 'pg_trgm + GiST — 대안 없음', who: 'trgm' },
  { need: '단어 단위 유사도', answer: "pg_trgm — 단, '검색어' <% doc 방향으로", who: 'trgm' },
  { need: '대소문자 무시 유사도', answer: 'pg_trgm', who: 'trgm' },
]

export const OP_ENV = { rows: 100014, repo: '../../week02/bigm-vs-trgm/experiments/03-operator-coverage-and-correctness' }
