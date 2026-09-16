/* eslint-disable */
/* ===========================================================================
 * 이 페이지들이 그리는 모든 수치는 여기 한 곳에 모아둔다.
 *
 * 규칙: **실제로 bench.sh 를 돌려 나온 값만 적는다.** 추정치·기대값을 넣지 않는다.
 * 각 항목의 `source` 는 그 값을 만든 실험 디렉터리이고, 저장소에서 그대로 재현할 수 있다.
 *
 * 측정 환경: PostgreSQL 16 / pg_bigm 1.2 (v1.2-20250903) / pg_trgm 1.6
 *            Docker (3 CPU / 4 GB) · 말뭉치 NSMC(CC0) 199,993 문장
 * =========================================================================== */
export const DATA = {
  env: {
    pg: 'PostgreSQL 16',
    bigm: 'pg_bigm 1.2 (v1.2-20250903)',
    trgm: 'pg_trgm 1.6',
    host: 'Docker · 3 CPU / 4 GB',
    corpus: 'NSMC (Naver Sentiment Movie Corpus, CC0) 199,993문장',
    corpusUrl: 'https://github.com/e9t/nsmc',
  },

  /* 저장소 경로 (이 HTML 기준 상대 경로) */
  repo: {
    base: '../../week02/bigm-vs-trgm/experiments',
    exp: {
      e01: '01-keyword-length-and-selectivity',
      e02: '02-index-build-size-and-write',
      e03: '03-operator-coverage-and-correctness',
      e04: '04-storage-overhead-at-scale',
      e05: '05-pattern-and-length',
      e06: '06-fulltext-vs-ngram',
      e07: '07-postgres-version-matrix',
    },
    bigm00: '../../week02/pg_bigm/experiments/00-explain-before-after',
    trgm01: '../../week02/pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
    trgm02: '../../week02/pg_trgm/experiments/02-threshold-and-knn-latency',
  },

  /* ---------------------------------------------------------------- 실험 01
   * 키워드 길이 × 선택도 (200,000행) — 결정적 지표만 (2회 실행 동일) */
  e01: {
    rows: 200000,
    note: '인덱스 스캔이 돌려준 후보 행 수. 길이 축과 선택도 축을 한 실험에서 잰다.',
    /* 길이 축 — 선택도를 0.1% 로 고정하고 검색어 길이만 바꾼다 (코아는 30% 대조군) */
    rowsData: [
      { kw: '클라우드클럽', len: 6, answer: 200,   bigm: { idx: 200,    recheck: 0,      buf: 16,   ms: 0.20 },
                                                    trgm: { idx: 200,    recheck: 0,      buf: 13,   ms: 0.17 } },
      { kw: '클둥이',      len: 3, answer: 200,   bigm: { idx: 257,    recheck: 57,     buf: 31,   ms: 0.94 },
                                                    trgm: { idx: 200,    recheck: 0,      buf: 4,    ms: 0.33 } },
      { kw: '김신건',      len: 3, answer: 200,   bigm: { idx: 200,    recheck: 0,      buf: 7,    ms: 0.46 },
                                                    trgm: { idx: 208,    recheck: 8,      buf: 4,    ms: 0.45 } },
      { kw: '클클',        len: 2, answer: 200,   bigm: { idx: 200,    recheck: 0,      buf: 4,    ms: 0.52 },
                                                    trgm: { idx: 200000, recheck: 199800, buf: 5097, ms: 231.57 } },
      { kw: '신컨',        len: 2, answer: 200,   bigm: { idx: 200,    recheck: 0,      buf: 4,    ms: 0.28 },
                                                    trgm: { idx: 200000, recheck: 199800, buf: 5097, ms: 239.62 } },
      { kw: '코아',        len: 2, answer: 60006, bigm: { idx: 60006,  recheck: 0,      buf: 14,   ms: 9.46 },
                                                    trgm: { idx: 200000, recheck: 139994, buf: 5097, ms: 257.81 } },
    ],
    /* 선택도 축 — 길이를 3글자로 고정하고 선택도만 바꾼다.
     * 검색어가 서로의 부분 문자열이 되면 정답 행수가 오염된다(처음에 '클둥이오' 로 당했다). */
    selectivity: [
      { kw: '클둥이', pct: 0.1, answer: 200,   bigm: { idx: 257,   recheck: 57, buf: 31, ms: 0.94 },
                                                trgm: { idx: 200,   recheck: 0,  buf: 4,  ms: 0.33 } },
      { kw: '클둥일', pct: 1,   answer: 2000,  bigm: { idx: 2000,  recheck: 0,  buf: 24, ms: 1.46 },
                                                trgm: { idx: 2000,  recheck: 0,  buf: 4,  ms: 1.43 } },
      { kw: '클둥오', pct: 5,   answer: 10000, bigm: { idx: 10001, recheck: 1,  buf: 33, ms: 8.19 },
                                                trgm: { idx: 10000, recheck: 0,  buf: 7,  ms: 4.30 } },
      { kw: '클둥삼', pct: 10,  answer: 20000, bigm: { idx: 20000, recheck: 0,  buf: 31, ms: 8.32 },
                                                trgm: { idx: 20000, recheck: 0,  buf: 8,  ms: 9.79 } },
      { kw: '클둥사', pct: 30,  answer: 60000, bigm: { idx: 60000, recheck: 0,  buf: 32, ms: 19.06 },
                                                trgm: { idx: 60011, recheck: 11, buf: 14, ms: 21.87 } },
    ],
  },

  /* ---------------------------------------------------------------- 실험 02
   * 조각 통계 (표본 20,000행). show_bigm/show_trgm 은 문서별 중복 제거 후를 돌려준다. */
  e02: {
    fragments: [
      { data: '한국어(NSMC)', n: '2-gram', raw: 857069,  dedup: 791053,  loss: 7.7,  uniq: 50398,  perFrag: 15.7 },
      { data: '한국어(NSMC)', n: '3-gram', raw: 793062,  dedup: 763255,  loss: 3.8,  uniq: 121558, perFrag: 6.3 },
      { data: '영문(Gutenberg)', n: '2-gram', raw: 2040850, dedup: 1493519, loss: 26.8, uniq: 1937, perFrag: 771.0 },
      { data: '영문(Gutenberg)', n: '3-gram', raw: 1954587, dedup: 1623740, loss: 16.9, uniq: 5909, perFrag: 274.8 },
    ],
    write: [
      { idx: '인덱스 없음',                sec: 0.06, us: 6.0,  x: 1.0 },
      { idx: 'gist_trgm_ops',              sec: 0.14, us: 14.0, x: 2.3 },
      { idx: 'gin_bigm_ops',               sec: 0.18, us: 18.0, x: 3.0 },
      { idx: 'gin_trgm_ops',               sec: 0.19, us: 19.0, x: 3.2 },
      { idx: 'gin_trgm_ops FASTUPDATE=off', sec: 0.55, us: 55.0, x: 9.2 },
      { idx: 'gin_bigm_ops FASTUPDATE=off', sec: 0.64, us: 64.0, x: 10.7 },
    ],
  },

  /* ---------------------------------------------------------------- 실험 04
   * 저장 용량 (10만 ~ 500만 행). ratio = 인덱스 / 테이블 */
  e04: {
    scales: [100000, 500000, 1000000, 5000000],
    tableMB: [12.6, 63.2, 126.4, 636.4],
    series: [
      { name: 'gin_bigm_ops',              mb: [17.9, 65.9, 113.1, 502.2], ratio: [1.42, 1.04, 0.89, 0.79] },
      { name: 'gin_trgm_ops',              mb: [31.3, 99.4, 147.3, 645.3], ratio: [2.48, 1.57, 1.17, 1.01] },
      { name: 'gist_trgm_ops(siglen=256)', mb: [16.2, 82.8, 166.4, 850.2], ratio: [1.29, 1.31, 1.32, 1.34] },
      { name: 'gin (tsvector)',            mb: [24.2, 73.0, 118.1, 440.3], ratio: [1.92, 1.16, 0.93, 0.69] },
      { name: 'btree (대조군)',            mb: [12.3, 61.8, 123.8, 623.8], ratio: [0.98, 0.98, 0.98, 0.98] },
    ],
    uniqEntries: { bigm: 50398, trgm: 121558, tsv: 82633 },
    buildSec: {
      'gin_bigm_ops': [1.4, 7.0, 14.5, 75.4],
      'gin_trgm_ops': [1.2, 6.4, 12.6, 66.5],
      'gin (tsvector)': [0.9, 4.6, 9.0, 46.8],
      'btree (대조군)': [1.7, 10.2, 15.8, 90.6],
    },
  },

  /* ---------------------------------------------------------------- 실험 05
   * 길이 × 패턴 × 엔진 (1,000,000행 / 정답 500행, 45칸 전부 정답 일치) */
  e05: {
    rows: 1000000, answer: 500,
    lengths: [2, 3, 5, 10, 20],
    ms: {
      none: { infix: [57.8, 59.9, 69.7, 68.6, 57.7], prefix: [21.0, 16.1, 15.7, 15.7, 15.4], suffix: [65.6, 74.2, 79.3, 60.8, 57.3] },
      bigm: { infix: [0.52, 0.54, 0.64, 0.63, 0.80], prefix: [0.62, 0.59, 0.64, 0.67, 0.75], suffix: [0.70, 0.77, 0.78, 0.76, 0.96] },
      trgm: { infix: [797.06, 1.06, 1.13, 1.32, 1.27], prefix: [1.49, 1.12, 1.15, 1.27, 1.19], suffix: [1.37, 1.27, 1.24, 1.39, 1.39] },
    },
    /* 2글자에서 패턴 모양이 갈리는 지점 (trgm) */
    twoChar: [
      { pattern: "%클둥%", idx: 1000000, recheck: 999500, buf: 50328, ms: 797.06 },
      { pattern: "클둥%",  idx: 500,     recheck: 0,      buf: 511,   ms: 1.49 },
      { pattern: "%클럽",  idx: 590,     recheck: 90,     buf: 594,   ms: 1.37 },
    ],
    /* 같은 2글자 '%클둥%' 을 bigm 으로 풀었을 때 — GIN_SEARCH_MODE_ALL 대조군 */
    twoCharBigm: { pattern: "%클둥%", idx: 500, recheck: 0, buf: 504, ms: 0.52 },
    noneBuffers: 16187,
  },

  /* ---------------------------------------------------------------- 실험 06
   * 전문검색(tsvector) vs n-gram (1,000,000행) */
  e06: {
    rows: 1000000,
    recall: [
      { kw: '영화',   like: 313428, ts: 118437, tsPct: 37.8, pre: 239651, prePct: 76.5, lexVariants: 1280 },
      { kw: '연기',   like: 51121,  ts: 11252,  tsPct: 22.0, pre: 43019,  prePct: 84.2, lexVariants: 1034 },
      { kw: '배우',   like: 32520,  ts: 2900,   tsPct: 8.9,  pre: 24100,  prePct: 74.1, lexVariants: 552 },
      { kw: '스토리', like: 34651,  ts: 10490,  tsPct: 30.3, pre: 31316,  prePct: 90.4, lexVariants: 555 },
      { kw: '감동',   like: 30996,  ts: 4980,   tsPct: 16.1, pre: 28381,  prePct: 91.6, lexVariants: 772 },
      { kw: '재미',   like: 74494,  ts: 5516,   tsPct: 7.4,  pre: 67524,  prePct: 90.6, lexVariants: 1738 },
    ],
    /* 테이블은 tsv 생성 컬럼을 포함해 291 MB 다 (실험 04 의 126 MB 와 기준이 다르다) */
    size: { tableMB: 291, tsvMB: 121, tsvRatio: 0.41, bigmMB: 123, bigmRatio: 0.42, trgmMB: 158, trgmRatio: 0.54 },
    buildSec: { tsv: 5.6, bigm: 13.6, trgm: 12.8 },
    /* 1차 판은 인덱스 세 개를 동시에 둔 채 재서 '쓴 인덱스'가 검증되지 않았다.
     * (스토리 줄은 실제로 trgm 을 타고 있었다 — 버퍼 22,854 가 지문) 다시 쟀다. */
    speed: [
      { kw: '영화',   방식: 'tsquery @@',      idx: 'docs_tsv',  hits: 118437, buf: 36009, ms: 198.42 },
      { kw: '영화',   방식: 'LIKE (bigm)',     idx: 'docs_bigm', hits: 313428, buf: 37252, ms: 114.95 },
      { kw: '영화',   방식: 'LIKE (trgm)',     idx: 'docs_trgm', hits: 313428, buf: 72032, ms: 1972.18 },
      { kw: '스토리', 방식: 'tsquery @@',      idx: 'docs_tsv',  hits: 10490,  buf: 9228,  ms: 45.62 },
      { kw: '스토리', 방식: 'LIKE (bigm)',     idx: 'docs_bigm', hits: 34651,  buf: 22873, ms: 178.05 },
      { kw: '스토리', 방식: 'LIKE (trgm)',     idx: 'docs_trgm', hits: 34651,  buf: 22854, ms: 134.62 },
    ],
    /* 어휘 경계를 가로지르는 부분 문자열 — '영화가' 안의 '화가' */
    crossLexeme: { like: 25366, ts: 445 },
    /* 구절 검색: '영화 <-> 연기' (인접) vs '영화 & 연기' (같은 문서 아무 데나) */
    phrase: { adjacent: 45, and: 1250 },
  },

  /* ---------------------------------------------- pg_bigm 실험 00 (플랜 전환점) */
  bigm00: {
    note: 'enable_seqscan 을 건드리지 않고 플래너가 무엇을 고르는지 본다. 2회 실행 15칸 전부 동일.',
    grid: [
      { rows: 100,     kw: '클둥이', sel: 1.0,    noIdx: 'Seq Scan',          withIdx: 'Seq Scan' },
      { rows: 100,     kw: '코아',   sel: 30.0,   noIdx: 'Seq Scan',          withIdx: 'Seq Scan' },
      { rows: 1000,    kw: '클둥이', sel: 0.2,    noIdx: 'Seq Scan',          withIdx: 'Bitmap Heap Scan' },
      { rows: 1000,    kw: '코아',   sel: 30.0,   noIdx: 'Seq Scan',          withIdx: 'Seq Scan' },
      { rows: 10000,   kw: '코아',   sel: 30.0,   noIdx: 'Seq Scan',          withIdx: 'Bitmap Heap Scan' },
      { rows: 1000000, kw: '클둥이', sel: 0.1,    noIdx: 'Parallel Seq Scan', withIdx: 'Bitmap Heap Scan' },
    ],
  },

  /* ---------------------------------------------- pg_trgm 실험 01 (siglen 스윕) */
  trgm01: {
    note: 'GIN 은 2회 실행 완전 동일, GiST 는 ±5% 흔들린다 (GiST 빌드가 결정적이지 않다).',
    /* siglen 512·1024 까지 확장. 512 는 256 보다도 1024 보다도 나쁘다 — 2회 재현됐다. */
    siglens:  ['GIN(기준)', 12, 24, 48, 64, 128, 256, 512, 1024],
    shortBuf: [13, 4480, 4003, 3031, 3012, 2191, 445, 11159, 573],
    longBuf:  [13, 31763, 21250, 16381, 14581, 11743, 2855, 200071, 67213],
    shortMB:  [39.35, 41.05, 36.65, 33.06, 32.36, 32.42, 32.85, 145.19, 49.64],
    longMB:   [161.87, 248.80, 192.67, 152.94, 146.84, 143.09, 143.73, 1876.02, 1479.50],
    /* 512 는 3회 실행에서 거의 그대로 나왔다 (노이즈가 아니라는 근거).
     * 반대로 1024 는 47.48 / 84.48 / 49.64 로 크게 흔들린다 — GiST 빌드 비결정성. */
    repro512: { shortMB: [144.05, 143.82, 145.19], longMB: [1840.91, 1857.22, 1876.02],
                longBuf: [197274, 197200, 200071] },
    repro1024: { shortMB: [47.48, 84.48, 49.64] },
    /* pageinspect 로 직접 센 값. flag 바이트는 key_data 의 12번 오프셋이다
     * (gist_page_items_bytea 는 키 datum 이 아니라 IndexTuple 통째를 돌려준다).
     * 리프는 모든 siglen 에서 200,001개로 고정 — ARRKEY 라 siglen 과 무관하다. */
    saturation: {
      siglens: [12, 24, 48, 64, 128, 256, 512, 1024],
      shortInternal: [5190, 4631, 4153, 4054, 3990, 4198, 18394, 6204],
      shortAllTrue:  [0, 0, 0, 0, 0, 0, 45, 9],
      longInternal:  [31652, 22478, 19236, 18788, 18305, 18336, 232992, 239579],
      longAllTrue:   [29976, 2, 0, 415, 701, 0, 169, 200],
    },
    /* 같은 데이터로 3회 빌드한 트리 구조 — 전부 다르다 (docs_long, siglen=256) */
    determinism: {
      pages:   [18416, 18427, 18392],
      entries: [218353, 218364, 218330],
      leaves:  [17489, 17497, 17470],
    },
  },

  /* 실험 04 의 '어휘가 늘어나는 대조군' — 100만 행에서 fixed 와 나란히 */
  e04grow: {
    rows: 1000000,
    /* 표본 20,000행 기준 유니크 엔트리 = '어휘 밀도' */
    uniq:  { bigm: { fixed: 50398, grow: 51448 },
             trgm: { fixed: 121558, grow: 142546 },
             tsv:  { fixed: 82633, grow: 102631 } },
    ratio: { 'gin_bigm_ops':              { fixed: 0.89, grow: 0.89 },
             'gin_trgm_ops':              { fixed: 1.17, grow: 1.15 },
             'gist_trgm_ops(siglen=256)': { fixed: 1.32, grow: 1.32 },
             'gin (tsvector)':            { fixed: 0.93, grow: 1.15 },
             'btree (대조군)':            { fixed: 0.98, grow: 1.00 } },
  },

  /* ------------------------------------------------- 실험 05 × 버전 (실험 07)
   * 실험 05 의 길이×패턴 격자를 PG 16/17/18 에서 다시 잰 것.
   * 45칸 전부 정답 500행으로 확인됐다 — 보이는 차이는 전부 길이·패턴 때문이다.
   * 19beta1 은 pg_bigm 이 빌드되지 않아 잴 수 없었다. */
  e05ver: {
    rows: 500000, answer: 500,
    lengths: [2, 3, 5, 10, 20],
    ms: {
      '16': {
        none: { infix: [29.807, 29.883, 30.412, 30.089, 30.005], prefix: [9.106, 9.523, 8.866, 9.332, 8.769], suffix: [29.89, 43.622, 40.823, 30.997, 29.635] },
        bigm: { infix: [0.922, 1.092, 1.054, 1.14, 1.16], prefix: [1.003, 1.245, 1.146, 1.16, 1.214], suffix: [1.115, 1.152, 1.106, 1.135, 1.45] },
        trgm: { infix: [480.171, 0.893, 0.99, 0.967, 1.38], prefix: [1.223, 0.901, 0.916, 1.07, 1.071], suffix: [1.803, 1.083, 1.258, 1.306, 1.246] },
      },
      '17': {
        none: { infix: [32.317, 29.86, 29.901, 30.091, 30.437], prefix: [8.556, 9.889, 8.632, 8.627, 9.497], suffix: [30.55, 37.403, 40.427, 31.647, 29.924] },
        bigm: { infix: [1.031, 1.043, 0.977, 1.115, 1.276], prefix: [1.057, 0.95, 1.001, 1.169, 1.203], suffix: [1.132, 1.096, 1.111, 1.192, 1.247] },
        trgm: { infix: [447.031, 1.139, 1.031, 1.222, 1.112], prefix: [0.967, 1.033, 1.016, 1.538, 1.324], suffix: [1.313, 1.103, 1.164, 1.195, 1.258] },
      },
      '18': {
        none: { infix: [29.661, 28.945, 29.255, 31.274, 29.1], prefix: [9.125, 10.345, 8.416, 8.678, 8.742], suffix: [35.506, 38.286, 41.014, 31.252, 28.987] },
        bigm: { infix: [1.045, 1.239, 1.213, 1.863, 1.241], prefix: [1.062, 1.169, 1.318, 1.198, 1.348], suffix: [1.345, 1.188, 1.332, 1.355, 1.398] },
        trgm: { infix: [466.496, 1.075, 1.184, 1.141, 1.411], prefix: [1.055, 1.323, 1.094, 1.417, 1.314], suffix: [1.34, 1.484, 2.129, 1.318, 1.379] },
      },
    },
  },

  /* ------------------------------------- 실험 01·04·06 축 × 버전 (실험 07 이 잼)
   * 실험 01(길이×선택도) · 04(인덱스 5종 크기) · 06(전문검색 재현율)의 축을
   * PG 16/17/18 에서 다시 잰 것. 50만 행이라 각 실험 본체와 절대값이 다르다.
   * 19beta1 은 pg_bigm 이 빌드되지 않아 잴 수 없었다. */
  verAxes: {
    rows: 500000,
    versions: ['16', '17', '18'],
    /* 길이 축(6/3/2글자, 전부 0.1%) + 선택도 축(3글자 고정, 1~30%) */
    selectivity: [
      { v: '16', eng: 'bigm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 17, ms: 0.269 },
      { v: '16', eng: 'bigm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 621, recheck: 121, buf: 65, ms: 0.698 },
      { v: '16', eng: 'bigm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.129 },
      { v: '16', eng: 'bigm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 11, ms: 1.655 },
      { v: '16', eng: 'bigm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 25001, recheck: 1, buf: 72, ms: 7.618 },
      { v: '16', eng: 'bigm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 31, ms: 14.21 },
      { v: '16', eng: 'bigm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150000, recheck: 0, buf: 61, ms: 18.989 },
      { v: '16', eng: 'trgm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 13, ms: 0.272 },
      { v: '16', eng: 'trgm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.227 },
      { v: '16', eng: 'trgm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 500000, recheck: 499500, buf: 13209, ms: 567.623 },
      { v: '16', eng: 'trgm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 5, ms: 1.652 },
      { v: '16', eng: 'trgm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 25000, recheck: 0, buf: 9, ms: 7.843 },
      { v: '16', eng: 'trgm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 12, ms: 14.236 },
      { v: '16', eng: 'trgm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150030, recheck: 10, buf: 25, ms: 21.355 },
      { v: '17', eng: 'bigm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 17, ms: 0.269 },
      { v: '17', eng: 'bigm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 621, recheck: 121, buf: 65, ms: 0.77 },
      { v: '17', eng: 'bigm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.152 },
      { v: '17', eng: 'bigm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 11, ms: 1.819 },
      { v: '17', eng: 'bigm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 25001, recheck: 1, buf: 72, ms: 10.435 },
      { v: '17', eng: 'bigm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 31, ms: 14.787 },
      { v: '17', eng: 'bigm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150000, recheck: 0, buf: 61, ms: 23.989 },
      { v: '17', eng: 'trgm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 13, ms: 0.25 },
      { v: '17', eng: 'trgm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.273 },
      { v: '17', eng: 'trgm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 500000, recheck: 499500, buf: 13209, ms: 528.551 },
      { v: '17', eng: 'trgm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 5, ms: 1.884 },
      { v: '17', eng: 'trgm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 25000, recheck: 0, buf: 9, ms: 7.396 },
      { v: '17', eng: 'trgm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 12, ms: 16.526 },
      { v: '17', eng: 'trgm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150030, recheck: 10, buf: 25, ms: 18.491 },
      { v: '18', eng: 'bigm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 17, ms: 0.285 },
      { v: '18', eng: 'bigm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 628, recheck: 121, buf: 65, ms: 0.826 },
      { v: '18', eng: 'bigm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.141 },
      { v: '18', eng: 'bigm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 11, ms: 1.683 },
      { v: '18', eng: 'bigm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 34946, recheck: 1, buf: 69, ms: 8.663 },
      { v: '18', eng: 'bigm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 31, ms: 15.955 },
      { v: '18', eng: 'bigm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150000, recheck: 0, buf: 61, ms: 28.682 },
      { v: '18', eng: 'trgm', kw: '클라우드클럽', len: 6, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 13, ms: 0.259 },
      { v: '18', eng: 'trgm', kw: '클둥이', len: 3, answer: 500, pct: 0.1, idx: 500, recheck: 0, buf: 4, ms: 0.218 },
      { v: '18', eng: 'trgm', kw: '클클', len: 2, answer: 500, pct: 0.1, idx: 730056, recheck: 499500, buf: 16935, ms: 830.368 },
      { v: '18', eng: 'trgm', kw: '클둥일', len: 3, answer: 5000, pct: 1.0, idx: 5000, recheck: 0, buf: 5, ms: 1.909 },
      { v: '18', eng: 'trgm', kw: '클둥오', len: 3, answer: 25000, pct: 5.0, idx: 34945, recheck: 0, buf: 10, ms: 7.945 },
      { v: '18', eng: 'trgm', kw: '클둥삼', len: 3, answer: 50000, pct: 10.0, idx: 50000, recheck: 0, buf: 12, ms: 14.543 },
      { v: '18', eng: 'trgm', kw: '클둥사', len: 3, answer: 150000, pct: 30.0, idx: 150050, recheck: 10, buf: 25, ms: 31.463 },
    ],
    /* 인덱스 5종 크기 — 테이블 63MB 기준 */
    size: {
      '16': [{name: "gin_bigm_ops", mb: 65.8, ratio: 1.04, uniq: 50196, sec: 10.6}, {name: "gin_trgm_ops", mb: 99.1, ratio: 1.57, uniq: 120834, sec: 7.0}, {name: "gist_trgm_ops(siglen=256)", mb: 82.9, ratio: 1.31, uniq: null, sec: 7.2}, {name: "gin (tsvector)", mb: 72.8, ratio: 1.15, uniq: 82189, sec: 5.1}, {name: "btree (대조군)", mb: 61.9, ratio: 0.98, uniq: null, sec: 7.0}],
      '17': [{name: "gin_bigm_ops", mb: 65.8, ratio: 1.04, uniq: 50196, sec: 7.8}, {name: "gin_trgm_ops", mb: 99.1, ratio: 1.57, uniq: 120834, sec: 6.5}, {name: "gist_trgm_ops(siglen=256)", mb: 83.0, ratio: 1.31, uniq: null, sec: 7.1}, {name: "gin (tsvector)", mb: 72.8, ratio: 1.15, uniq: 82189, sec: 4.5}, {name: "btree (대조군)", mb: 61.9, ratio: 0.98, uniq: null, sec: 7.2}],
      '18': [{name: "gin_bigm_ops", mb: 65.8, ratio: 1.04, uniq: 50196, sec: 4.0}, {name: "gin_trgm_ops", mb: 99.1, ratio: 1.57, uniq: 120834, sec: 3.7}, {name: "gist_trgm_ops(siglen=256)", mb: 82.9, ratio: 1.31, uniq: null, sec: 7.3}, {name: "gin (tsvector)", mb: 72.8, ratio: 1.15, uniq: 82189, sec: 2.3}, {name: "btree (대조군)", mb: 61.9, ratio: 0.98, uniq: null, sec: 8.2}],
    },
    /* 전문검색 재현율 — LIKE 를 정답으로 놓은 tsquery 의 재현율 */
    recall: {
      '16': [{kw: "영화", like: 156809, ts: 59253, tsPct: 37.8, pre: 119909, prePct: 76.5}, {kw: "연기", like: 25506, ts: 5665, tsPct: 22.2, pre: 21434, prePct: 84.0}, {kw: "배우", like: 16316, ts: 1450, tsPct: 8.9, pre: 12099, prePct: 74.2}, {kw: "스토리", like: 17402, ts: 5260, tsPct: 30.2, pre: 15722, prePct: 90.3}, {kw: "감동", like: 15475, ts: 2506, tsPct: 16.2, pre: 14173, prePct: 91.6}, {kw: "재미", like: 37382, ts: 2745, tsPct: 7.3, pre: 33877, prePct: 90.6}],
      '17': [{kw: "영화", like: 156809, ts: 59253, tsPct: 37.8, pre: 119909, prePct: 76.5}, {kw: "연기", like: 25506, ts: 5665, tsPct: 22.2, pre: 21434, prePct: 84.0}, {kw: "배우", like: 16316, ts: 1450, tsPct: 8.9, pre: 12099, prePct: 74.2}, {kw: "스토리", like: 17402, ts: 5260, tsPct: 30.2, pre: 15722, prePct: 90.3}, {kw: "감동", like: 15475, ts: 2506, tsPct: 16.2, pre: 14173, prePct: 91.6}, {kw: "재미", like: 37382, ts: 2745, tsPct: 7.3, pre: 33877, prePct: 90.6}],
      '18': [{kw: "영화", like: 156809, ts: 59253, tsPct: 37.8, pre: 119909, prePct: 76.5}, {kw: "연기", like: 25506, ts: 5665, tsPct: 22.2, pre: 21434, prePct: 84.0}, {kw: "배우", like: 16316, ts: 1450, tsPct: 8.9, pre: 12099, prePct: 74.2}, {kw: "스토리", like: 17402, ts: 5260, tsPct: 30.2, pre: 15722, prePct: 90.3}, {kw: "감동", like: 15475, ts: 2506, tsPct: 16.2, pre: 14173, prePct: 91.6}, {kw: "재미", like: 37382, ts: 2745, tsPct: 7.3, pre: 33877, prePct: 90.6}],
    },
  },

  /* ---------------------------------------------------------------- 실험 07
   * PostgreSQL 버전 매트릭스 (50만 행 / 정답 500행)
   * 19beta1 은 pg_bigm 1.2 가 빌드되지 않아 측정 자체가 불가능했다. */
  e07: {
    rows: 500000, answer: 500,
    versions: ['16', '17', '18', '19'],
    server: { '16': '16.15', '17': '17.11', '18': '18.6', '19': 'BUILD_FAILED' },
    tableMB: 63,
    /* 확장 자체의 동작이 안 바뀌었는지 확인하는 값 — 표본 20,000행 */
    frag: { '16': { bigm: 50196, trgm: 120834 },
            '17': { bigm: 50196, trgm: 120834 },
            '18': { bigm: 50196, trgm: 120834 } },
    sizeMB:  { '16': { bigm: 65.8, trgm: 99.1 },
               '17': { bigm: 65.8, trgm: 99.1 },
               '18': { bigm: 65.8, trgm: 99.1 } },
    buildSec: { '16': { bigm: 8.0, trgm: 7.1 },
                '17': { bigm: 7.8, trgm: 7.0 },
                '18': { bigm: 3.5, trgm: 3.7 } },
    /* 검색어 3개 × 엔진 3개. idx = 인덱스 스캔이 돌려준 행(none 은 해당 없음) */
    q: {
      '16': [
        { kw: '클클',        len: 2, none: { ms: 31.17 }, bigm: { idx: 500, recheck: 0, buf: 4, ms: 0.74 }, trgm: { idx: 500000, recheck: 499500, buf: 12642, ms: 440.73 } },
        { kw: '클둥이',      len: 3, none: { ms: 30.05 }, bigm: { idx: 500, recheck: 0, buf: 7, ms: 0.83 }, trgm: { idx: 500, recheck: 0, buf: 4, ms: 0.74 } },
        { kw: '클라우드클럽', len: 6, none: { ms: 38.91 }, bigm: { idx: 500, recheck: 0, buf: 17, ms: 0.27 }, trgm: { idx: 500, recheck: 0, buf: 13, ms: 0.25 } },
      ],
      '17': [
        { kw: '클클',        len: 2, none: { ms: 33.90 }, bigm: { idx: 500, recheck: 0, buf: 4, ms: 0.80 }, trgm: { idx: 500000, recheck: 499500, buf: 12642, ms: 429.36 } },
        { kw: '클둥이',      len: 3, none: { ms: 31.24 }, bigm: { idx: 500, recheck: 0, buf: 7, ms: 0.82 }, trgm: { idx: 500, recheck: 0, buf: 4, ms: 0.79 } },
        { kw: '클라우드클럽', len: 6, none: { ms: 46.76 }, bigm: { idx: 500, recheck: 0, buf: 17, ms: 0.27 }, trgm: { idx: 500, recheck: 0, buf: 13, ms: 0.31 } },
      ],
      '18': [
        { kw: '클클',        len: 2, none: { ms: 29.72 }, bigm: { idx: 500, recheck: 0, buf: 4, ms: 0.92 }, trgm: { idx: 500000, recheck: 499500, buf: 12642, ms: 414.15 } },
        { kw: '클둥이',      len: 3, none: { ms: 32.99 }, bigm: { idx: 500, recheck: 0, buf: 7, ms: 0.88 }, trgm: { idx: 500, recheck: 0, buf: 4, ms: 0.84 } },
        { kw: '클라우드클럽', len: 6, none: { ms: 30.94 }, bigm: { idx: 500, recheck: 0, buf: 17, ms: 0.29 }, trgm: { idx: 500, recheck: 0, buf: 13, ms: 0.33 } },
      ],
    },
    pg19: {
      failed: true,
      error: "bigm_op.c:177:26: error: ‘database_ctype_is_c’ undeclared",
      cause: "PG19 에서 전역 database_ctype_is_c 가 사라지고 pg_locale_t 의 ctype_is_c 필드로 옮겨졌다. char2wchar() 도 헤더에서 빠졌다.",
    },
  },

  /* -------------------------------------------------- 널리 알려진 서술 중, 재보니 달랐던 것
   * 각 항목은 '흔한 서술 / 실측 / 근거' 셋을 갖는다. 근거가 없는 항목은 넣지 않는다. */
  corrections: [
    {
      claim: 'pg_trgm 은 KEEPONLYALNUM 때문에 한글을 걸러낸다',
      found: '틀렸다. show_trgm(\'가나다라\') 는 조각 5개를 정상 생성한다',
      why: 'ISWORDCHR 가 쓰는 t_isalnum_with_len() 은 멀티바이트를 인식한다. 진짜 문제는 구두점이다 — 192.168.0.1 이 네 단어로 쪼개진다',
      where: 'bigm-vs-trgm/docs/02-source-side-by-side.md',
      tag: '소스',
    },
    {
      claim: '2-gram 이라 조각이 많아서 인덱스가 크다',
      found: '틀렸다. 생 조각 수는 857,069 vs 793,062 로 오히려 비슷하고, 인덱스는 bigm 이 25% 작다',
      why: '패딩까지 세면 조각 개수가 양쪽 다 L+1 이다. 실제 차이는 유니크 조각 가짓수(50,398 vs 121,558)에서 온다',
      where: 'experiments/02-index-build-size-and-write',
      tag: '실측',
    },
    {
      claim: 'pg_bigm 이 무조건 빠르다',
      found: '3글자 이상에서는 trgm 이 버퍼를 덜 읽은 경우가 있다 (4 vs 7)',
      why: '3-gram 조각이 2.4배 희귀해 포스팅 리스트가 짧다. bigm 의 우위는 2글자 칸 하나다',
      where: 'experiments/01-keyword-length-and-selectivity',
      tag: '실측',
    },
    {
      claim: 'pg_bigm 의 similarity 는 이름뿐이고 실은 LIKE 처리다',
      found: '진짜 유사도 검색이고 GIN 인덱스도 탄다',
      why: 'bigm_similarity() 는 겹친 조각 / max(조각 수). =% 연산자가 별도 전략 번호로 등록돼 있다',
      where: 'experiments/03-operator-coverage-and-correctness',
      tag: '소스',
    },
    {
      claim: 'pg_bigm 은 ILIKE 도 인덱스로 가속한다',
      found: '틀렸다. ILIKE 는 Seq Scan 이다',
      why: '연산자 클래스에 ILIKE 전략이 등록돼 있지 않다. pg_trgm 은 IGNORECASE 라 된다',
      where: 'experiments/03-operator-coverage-and-correctness',
      tag: '실측',
    },
    {
      claim: '한글 정규식(~)도 pg_trgm 이 가속한다',
      found: '가속되지 않는다. 두 확장 모두 Seq Scan 이다',
      why: '정규식 엔진의 MAX_SIMPLE_CHR 이 0x7FF 라, U+07FF 를 넘는 문자는 컬러를 펼칠 수 없어 트라이그램을 못 뽑는다',
      where: 'pg_trgm/docs/02-internals-and-source.md',
      tag: '소스',
    },
    {
      claim: 'GiST 는 siglen 을 키우면 GIN 과 비슷해진다',
      found: '데이터에 따라 다르다. 그 결론은 5만 행 합성 데이터에서만 성립했다',
      why: '실제 말뭉치에서 다시 재니 격차가 남았다. 게다가 GiST 지표는 재현되지 않았다(버퍼 ±5%, KNN LIMIT 1 은 65~230)',
      where: 'pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
      tag: '재현성',
    },
    {
      claim: '인덱스 빌드/크기 차이는 5~13% 수준이다 (이 카탈로그의 이전 실험)',
      found: '실제 말뭉치에서는 27~73% 로 벌어진다 (같은 실험을 말뭉치로 다시 만들어 확인)',
      why: '이전 실험이 어휘 15문장짜리 합성 데이터 + random() 을 썼다. 반복도가 극단적으로 높으면 두 인덱스 모두 유니크 조각이 적어져 격차가 사라진다. 격차는 규모에 따라 줄어든다 — 5만 행 1.73배, 100만 행 1.27배',
      where: 'pg_bigm/experiments/01-index-build-time-and-size-vs-pg_trgm',
      tag: '재현성',
    },
    {
      claim: '어휘가 늘어나는 데이터에서는 n-gram 인덱스 배수도 덜 떨어진다 (이 카탈로그의 예상)',
      found: '틀렸다. 움직인 것은 tsvector 뿐이다 (0.93× → 1.15×). n-gram 은 그대로였다',
      why: '낱말 하나가 통째로 새 어휘소가 되는 전문검색과 달리, n-gram 은 그 낱말을 이미 본 문자들의 조합으로 쪼갠다. 고정비를 정하는 것은 문서 수가 아니라 문자 조합 공간이고, n 이 작을수록 포화가 빠르다 (bigm +2% vs trgm +17%)',
      where: 'experiments/04-storage-overhead-at-scale',
      tag: '검증',
    },
    {
      claim: 'trial 을 찾으면 trivial 이 거짓 양성으로 걸린다 (3-gram 기준)',
      found: '3-gram 에서는 아니다. trivial 에는 ria 조각이 없어 인덱스 단계에서 이미 탈락한다',
      why: '2-gram(tr,ri,ia,al) 에서는 맞는 예다. 3-gram 의 거짓 양성 예는 arterial triage — tri/ria/ial 이 흩어져 전부 존재하지만 trial 은 없다',
      where: 'references/05-recheck-and-lossy-index.md',
      tag: '검증',
    },
    {
      claim: 'tsvector/tsquery 는 pg_bigm·pg_trgm 과 비교할 수 있는 익스텐션이다',
      found: '익스텐션이 아니다. PostgreSQL 코어의 타입·연산자라 CREATE EXTENSION 이 필요 없다',
      why: 'pg_extension 에는 plpgsql·pg_bigm·pg_trgm 만 있다. 층위가 다르니 "무엇이 빠른가"가 아니라 "무엇을 못 하는가"를 봐야 한다',
      where: 'experiments/06-fulltext-vs-ngram',
      tag: '실측',
    },
    {
      claim: '영문 2-gram 유니크 조각은 294개뿐이다 (이 카탈로그의 이전 실험)',
      found: '실제 영문 산문에서는 1,937개다 — 합성 데이터가 6.6배 적게 만들고 있었다',
      why: '어휘 12개를 조합한 합성 데이터라 반복도가 극단적으로 높았다. Project Gutenberg 3권으로 바꿔 다시 쟀다. 방향(영문 2-gram 은 선택도가 나쁘다)은 그대로지만 배수가 틀렸다',
      where: 'experiments/02-index-build-size-and-write',
      tag: '재현성',
    },
    {
      claim: '3글자 이상에서 bigm 이 trgm 보다 1.5~2배 빠르다 (이 카탈로그의 이전 실험)',
      found: '철회했다. 같은 질의를 20회씩 다시 재니 두 인덱스의 범위가 완전히 겹쳤고, 3글자에서는 오히려 trgm 이 빨랐다',
      why: '원래 표는 각 칸 1회 측정이었다. 버퍼가 같은데(약 510) 시간만 2배 차이나는 것이 애초에 이상한 신호였다 — 같은 질의의 max/min 이 9배까지 벌어진다',
      where: 'experiments/05-pattern-and-length',
      tag: '재현성',
    },
    {
      claim: '인덱스 없이 접미어(%X)가 부분 일치(%X%)보다 느린 것은 끝에서부터 비교해야 해서다',
      found: '틀렸다. 패턴 모양이 아니라 매치가 문자열의 어디에 있느냐의 문제였다',
      why: 'LIKE 매처는 첫 매치에서 멈춘다. 주입 행이 <BASE20> 문장 <BASE20> 이라 부분 일치는 맨 앞에서 끝나고 접미어는 끝까지 가야 했다. 매치를 끝으로 몰자 부분 일치가 오히려 느려졌다(152.5 vs 139.8 ms)',
      where: 'experiments/05-pattern-and-length',
      tag: '검증',
    },
    {
      claim: '실험 06 의 속도 표에서 \'LIKE (bigm 인덱스)\' 는 정말 bigm 을 썼다 (이 카탈로그의 이전 실험)',
      found: '한 줄은 틀렸다. 스토리 줄은 실제로 trgm 을 타고 있었다 — 같은 표 안에서 영화는 bigm, 스토리는 trgm 이었다',
      why: '세 인덱스를 동시에 둔 채로 재서 플래너가 골랐다. 버퍼가 지문이 됐다 — 스토리의 옛 버퍼 22,854 는 다시 잰 trgm 값(22,854)과 정확히 같고 bigm(22,873)과는 다르다. 영화는 37,248 ≈ bigm 37,252 라 맞았다. 지금은 상대 인덱스를 지우고 재고, 플랜에서 Index Scan on 을 읽어 \'쓴 인덱스\' 열에 기록한다',
      where: 'experiments/06-fulltext-vs-ngram',
      tag: '재현성',
    },
    {
      claim: 'GiST 가 느린 것은 ALLISTRUE 포화 때문이다',
      found: '절반만 맞다. 짧은 문서(42.7자)는 어느 siglen 에서도 포화율이 0% 인데 GIN 보다 버퍼를 345배 읽는다',
      why: 'pageinspect 로 직접 셌다. 포화는 긴 문서 + 기본 siglen=12 에서만 일어나고(내부 노드의 94.7%), siglen 을 24 로 한 단계만 올려도 0.0% 로 사라진다. 짧은 문서에서의 원인은 포화가 아니라 시그니처 충돌(거짓 양성)이다',
      where: 'pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
      tag: '실측',
    },
    {
      claim: 'siglen=512 에서 인덱스가 커지는 것은 시그니처가 포화돼서다',
      found: '아니다. 포화율은 0.1% 뿐이고, 내부 노드가 12.7배 폭증한 것이다',
      why: '긴 문서에서 내부 노드 18,336 → 232,992, 인덱스 143.74 → 1,820.28 MB — 두 자리까지 정확히 같은 배수다. 리프는 200,001개로 고정(ARRKEY 라 siglen 과 무관). 왜 폭증하는지는 확인하지 못했다',
      where: 'pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
      tag: '실측',
    },
    {
      claim: 'GiST 지표가 흔들리는 것은 측정 노이즈다',
      found: '아니다. 같은 데이터로 3회 빌드하니 트리 구조 자체가 매번 달랐다',
      why: '페이지 18,416 / 18,427 / 18,392, 엔트리 218,353 / 218,364 / 218,330, 리프 페이지 17,489 / 17,497 / 17,470 — 전부 다르다. 삽입 순서를 고정해도 그렇다. 왜인지는 여전히 모른다',
      where: 'pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
      tag: '실측',
    },
    {
      claim: 'GiST 의 siglen 은 올릴수록 좋아진다',
      found: '틀렸다. 256 이 최적이고 그 위에서 무너진다 — 긴 문서에서는 512·1024 둘 다 재앙이다',
      why: '긴 문서에서 인덱스가 143.7 MB → 512 는 1,876 MB(13배) / 1024 는 1,479 MB(10배), 버퍼 2,855 → 200,071 / 67,213. 512 는 3회 실행에서 그대로 재현됐다. 원인은 확인하지 못했다',
      where: 'pg_trgm/experiments/01-gin-vs-gist-build-and-probe',
      tag: '실측',
    },
    {
      claim: 'pg_bigm 1.2 는 PostgreSQL 16~19 를 지원한다',
      found: '19beta1 에서 빌드되지 않는다',
      why: 'PG19 에서 전역 database_ctype_is_c 가 pg_locale_t 의 필드로 옮겨지고 char2wchar() 가 헤더에서 빠졌다',
      where: 'experiments/07-postgres-version-matrix',
      tag: '실측',
    },
    {
      claim: 'pg_trgm 인덱스는 LIKE 를 ILIKE 만큼 정확하게 푼다',
      found: '반대다. 대소문자를 구분하는 LIKE 에서 후보 600행 중 400행을 Recheck 이 버린다 (정답 200). ILIKE 는 recheck 0 이다',
      why: 'pg_trgm 은 IGNORECASE 로 조각을 소문자화해 저장한다. 인덱스 입장에서 자연스러운 연산이 ILIKE 이고 LIKE 쪽이 오히려 추가 필터다. 대소문자 구분 검색에는 pg_bigm 이 낫다 — 후보 200행, recheck 0',
      where: 'experiments/09-ilike-and-case-insensitive',
      tag: '실측',
    },
    {
      claim: '검색어가 한글이면 LIKE 든 ILIKE 든 성능이 같다',
      found: '틀렸다. pg_bigm 에서 1.05 ms -> 54.00 ms 로 51배 벌어진다',
      why: 'pg_bigm 연산자 클래스에 ~~* 가 없어 인덱스를 통째로 못 쓴다. 검색어의 문자 종류와 무관하다. ORM 이 기본으로 ILIKE 를 내보내면(icontains 등) 인덱스가 조용히 무시된다. 인덱스 없는 Seq Scan 도 ILIKE 가 3.6배 비싸다',
      where: 'experiments/09-ilike-and-case-insensitive',
      tag: '실측',
    },
    {
      claim: '베이스 이미지를 최신 Debian(trixie)으로 올리면 취약점 경고가 줄어든다 (이 카탈로그의 예상)',
      found: '틀렸다. critical 16 → 14, high 93 → 98 로 사실상 같다. 줄어드는 것은 alpine 뿐이다 (1 / 30)',
      why: 'Debian 쪽 109건 중 패치가 나와 있는 것은 22건뿐이고 그 22건이 전부 gosu(Go stdlib) 다 — 나머지 87건은 Debian 이 "minor issue" 로 분류해 업데이트를 내지 않은 것들이라 베이스를 한 세대 올려도 그대로 남는다. gosu 는 모든 변종에 똑같이 들어 있다. 먼저 옮겨 놓고 나중에 잰 자리다',
      where: 'trivy 0.74.0 로 직접 스캔 — TODO.md L-1 에 기록',
      tag: '검증',
    },
    {
      claim: 'pg_trgm 은 조각을 하나도 못 만들면 전체 인덱스 스캔으로 떨어진다 (공식 문서)',
      found: '규모에 따라 다르다. 20만 행에서는 플래너가 전체 인덱스 스캔보다 Seq Scan 이 싸다고 판단해 인덱스를 아예 안 썼다',
      why: '100만 행에서는 문서대로 전체 인덱스 스캔이 나와 후보 1,000,000행을 올린다. 둘 다 나타나고, 결론("인덱스가 필터로 동작하지 않는다")은 같다',
      where: 'experiments/08-space-and-punctuation · experiments/05-pattern-and-length',
      tag: '실측',
    },
    {
      claim: '버전을 올리면 2글자 함정이 나아질 수 있다',
      found: 'PG 16·17·18 에서 인덱스 스캔 행·recheck·버퍼가 한 자리도 다르지 않다',
      why: 'GIN_SEARCH_MODE_ALL 은 플래너의 선택이 아니라 extractQuery() 가 조건을 하나도 못 만든 결과다. 코어가 할 수 있는 일이 없다',
      where: 'experiments/07-postgres-version-matrix',
      tag: '실측',
    },
  ],

  /* "모른다"도 결과다 — 관측만 하고 원인을 규명하지 못한 것들 */
  unknowns: [
    { seen: 'GiST 빌드가 실행마다 실제로 다른 트리를 만든다 (3회 빌드 확인)',
      unknown: '삽입 순서를 고정했는데도 gtrgm_picksplit() 의 분할이 달라지는 이유' },
    { seen: 'PostgreSQL 18 에서 GIN 인덱스 빌드가 약 2배 빨라졌다',
      unknown: '비동기 I/O 때문인지 다른 변경인지 분리해 재지 않았다' },
    { seen: 'siglen=512 에서 내부 노드가 12.7배 폭증한다 (크기와 정확히 비례)',
      unknown: '키가 2배 커진 것만으로는 12.7배가 설명되지 않는다. TOAST_INDEX_TARGET(≈510B) 압축 임계가 후보' },
    { seen: 'PostgreSQL 19beta1 에서 pg_bigm 이 빌드되지 않는다',
      unknown: '패치가 나올지, 1.2 계열이 대응할지 (관측만 했고 업스트림 상황은 확인하지 않았다)' },
    { seen: '짧은 문서에서 GiST 가 GIN 보다 버퍼를 345배 읽는다 (포화는 0%)',
      unknown: '시그니처 충돌률을 직접 재지는 않았다 — 포화가 아니라는 것까지만 확인했다' },
    { seen: 'ILIKE 는 Seq Scan 에서도 LIKE 보다 3.6배 비싸다',
      unknown: '대소문자 폴딩 비용으로 보이지만 프로파일링으로 확인하지 않았다' },
  ],

  /* 재현성 검증 결과 — 확인하지 않은 것은 확인하지 않았다고 적는다 */
  repro: [
    { exp: 'bigm-vs-trgm/01 키워드 격자',    ok: true,  detail: '완전 일치 — 발행값과도 일치' },
    { exp: 'bigm-vs-trgm/02 빌드·크기·쓰기', ok: true,  detail: '완전 일치 (데이터 생성 결정화 후)' },
    { exp: 'bigm-vs-trgm/03 연산자 행렬',    ok: true,  detail: '완전 일치' },
    { exp: 'bigm-vs-trgm/05 길이×패턴',      ok: true,  detail: '결정적 지표 45칸 동일 · 버퍼 <0.5% 편차' },
    { exp: 'pg_bigm/00 플랜 전환점',         ok: true,  detail: '15칸 전부 동일' },
    { exp: 'pg_trgm/01 siglen 스윕',         ok: false, detail: 'GIN 완전 일치 / GiST 버퍼 ±5%' },
    { exp: 'pg_trgm/02 임계값·KNN',          ok: false, detail: '임계값·재현율 동일 / KNN LIMIT 1 은 65~230' },
    { exp: 'bigm-vs-trgm/04 규모별 용량',    ok: null,  detail: '1회만 실행 (500만 행 빌드가 길다) — 반복 확인하지 않았다' },
    { exp: 'bigm-vs-trgm/06 전문검색 비교',  ok: null,  detail: '1회만 실행 — 재현율·매치 행수는 순수 집계지만 반복 확인하지 않았다' },
  ],
}

export type Data = typeof DATA
