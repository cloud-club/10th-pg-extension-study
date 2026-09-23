/* ===========================================================================
 * PostgreSQL 에서 한국어 형태소 분석을 붙이는 방법들
 *
 * **이 카탈로그가 직접 재본 것이 아니다.** 공개 문서를 읽고 정리한 것이고,
 * 그래서 성능 수치를 싣지 않는다 — 측정 원칙 5번("실제로 돌려 나온 값만 적는다").
 * 각 항목의 source 로 원문을 그대로 확인할 수 있다.
 * =========================================================================== */

export type Analyzer = {
  name: string
  what: string
  how: string
  /** PostgreSQL 의 tsvector 를 그대로 쓰나, 아니면 자기 인덱스를 쓰나 */
  integrates: 'tsvector' | '별도 인덱스' | '별도 엔진'
  pros: string[]
  cons: string[]
  license?: string
  source: { label: string; url: string }[]
}

export const ANALYZERS: Analyzer[] = [
  {
    name: 'textsearch_ko (mecab-ko)',
    what: 'MeCab 형태소 분석기와 mecab-ko-dic 사전을 PostgreSQL 의 전문검색에 꽂는 확장',
    how: "mecab-ko · mecab-ko-dic 을 먼저 설치하고 확장을 PGXS 로 빌드한다. 그다음 CREATE EXTENSION textsearch_ko 하고 default_text_search_config = korean 으로 둔다.",
    integrates: 'tsvector',
    pros: [
      '코어의 tsvector · tsquery · ts_rank 를 그대로 쓴다 — 쿼리를 바꿀 필요가 없다',
      '조사·어미를 떼어낸다. to_tsvector(\'무궁화꽃이 피었습니다.\') 가 \'무궁화\' \'꽃\' \'피\' 로 나온다',
      'BSD-2-Clause',
    ],
    cons: [
      'mecab-ko 와 사전을 서버에 직접 설치해야 한다 — 매니지드 DB 에서는 대부분 불가능하다',
      'DB 인코딩이 UTF-8 이어야 한다',
      '저장소 갱신이 뜸하다 — 최신 PostgreSQL 대응은 직접 확인해야 한다',
    ],
    license: 'BSD-2-Clause',
    source: [
      { label: 'i0seph/textsearch_ko', url: 'https://github.com/i0seph/textsearch_ko' },
    ],
  },
  {
    name: 'PGroonga',
    what: 'Groonga 검색 엔진을 PostgreSQL 인덱스로 붙인다. 형태소 분석기를 고를 수 있다',
    how: "CREATE INDEX ... USING pgroonga (col) WITH (tokenizer='TokenMecab') — 기본값은 TokenBigram 이고, MeCab 을 쓰려면 토크나이저를 지정한다.",
    integrates: '별도 인덱스',
    pros: [
      '토크나이저를 고를 수 있다 — TokenBigram(기본) · TokenMecab · TokenNgram · TokenDelimit',
      '기본 TokenBigram 은 비ASCII 를 2-gram 으로 자른다 — 사전 없이도 한국어가 동작한다',
      '공식 문서가 pg_bigm 과의 비교를 따로 두고 있다',
    ],
    cons: [
      '전용 연산자(&@, &@~ 등)를 쓴다 — LIKE 를 그대로 두는 n-gram 과 달리 쿼리를 고쳐야 한다',
      'Groonga 를 함께 설치해야 한다. 매니지드 DB 지원이 제한적이다',
      'tsvector 생태계(ts_rank · phraseto_tsquery)를 그대로 쓰지 못한다',
    ],
    source: [
      { label: 'PGroonga', url: 'https://pgroonga.github.io/' },
      { label: 'CREATE INDEX USING pgroonga — 토크나이저 목록', url: 'https://pgroonga.github.io/reference/create-index-using-pgroonga.html' },
      { label: 'PGroonga versus pg_bigm', url: 'https://pgroonga.github.io/reference/pgroonga-versus-pg-bigm.html' },
    ],
  },
  {
    name: 'pg_search (ParadeDB)',
    what: 'BM25 랭킹을 PostgreSQL 안에 넣는 확장. 토크나이저 설정으로 한국어를 다룬다',
    how: '전용 BM25 인덱스를 만들고 검색 연산자를 쓴다. 형태소 분석 자체보다 랭킹 품질이 목적이다.',
    integrates: '별도 인덱스',
    pros: [
      '관련도 랭킹(BM25)이 ts_rank 보다 검색 품질에 가깝다',
      'pgvector 와 묶어 하이브리드 검색을 한 DB 안에서 구성할 수 있다',
    ],
    cons: [
      '역시 전용 인덱스·연산자다 — 부분 문자열 검색을 대신하지 못한다',
      '한국어 형태소 분석은 별도 토크나이저 설정에 의존한다',
    ],
    source: [
      { label: 'ParadeDB 로 구현하는 PostgreSQL 한글 전문 검색 (Mimul)', url: 'https://www.mimul.com/blog/paradedb-korean/' },
    ],
  },
]

/** 형태소 분석을 붙일 수 없을 때 남는 선택지 — 이 카탈로그가 실제로 잰 쪽이다 */
export const FALLBACKS = [
  {
    name: 'n-gram (pg_bigm / pg_trgm)',
    when: '부분 문자열 검색이 요구사항이거나, 서버에 아무것도 못 깐다',
    note: '사전이 필요 없다. 대신 랭킹·구절 검색이 없다. 이 카탈로그가 재고 있는 것이 이쪽이다.',
    to: '/start/overview',
  },
  {
    name: "tsquery 접두어(':*')",
    when: '전문검색을 쓰되 조사 때문에 놓치는 것만 줄이고 싶다',
    note: '재현율이 7~38% → 74~92% 로 회복된다. 다만 앞에 뭔가 붙은 경우(이영화)는 원리상 못 잡는다.',
    to: '/fulltext/korean-recall',
  },
]
