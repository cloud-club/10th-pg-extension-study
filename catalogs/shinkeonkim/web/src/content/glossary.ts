/** 용어 사전. 예전 references/00-start-here.md 의 용어표를 옮기면서 갈래(group)를 붙였다. */
export type Term = {
  term: string
  meaning: string
  analogy?: string
  group: '기본' | '확장' | 'GIN 내부' | '측정'
  /** 더 읽을 페이지 경로 */
  to?: string
}

export const GLOSSARY: Term[] = [
  { group: '기본', term: '인덱스', meaning: '"이 값이 몇 번째 행에 있다"를 미리 적어둔 표', analogy: '책 뒤 찾아보기' },
  { group: '기본', term: 'B-tree', meaning: '값을 가나다순으로 정렬해 담는 기본 인덱스', analogy: '가나다순 찾아보기', to: '/foundations/btree' },
  { group: '기본', term: '역인덱스', meaning: '값을 쪼갠 조각별로 "그 조각을 가진 행 목록"을 담는 인덱스', analogy: '조각별 찾아보기', to: '/foundations/btree' },
  { group: '기본', term: 'Seq Scan', meaning: '처음부터 끝까지 전부 훑는 것', analogy: '책을 1쪽부터 넘기기' },
  { group: '기본', term: '선택도(selectivity)', meaning: '검색 결과가 전체의 몇 %인가. 낮을수록(희귀할수록) 인덱스가 이득', analogy: '"이 단어, 책에 몇 번 나와?"', to: '/experiments/length-selectivity' },
  { group: '기본', term: 'VACUUM', meaning: '지워진 행의 흔적을 치우고 통계를 갱신하는 정리 작업', analogy: '대청소' },
  { group: '기본', term: 'work_mem', meaning: '정렬·해시에 쓰는 작업 메모리. 모자라면 결과가 뭉툭해짐', analogy: '작업대 크기', to: '/foundations/recheck' },

  { group: '확장', term: 'n-gram', meaning: '글자를 n 개씩 잘라낸 조각. 2-gram=두 글자, 3-gram=세 글자', analogy: '단어를 잘게 썬 것', to: '/foundations/ngram' },
  { group: '확장', term: 'pg_bigm', meaning: '두 글자씩 자르는 확장. 짧은 한국어 검색어에 강함', to: '/pg-bigm/about' },
  { group: '확장', term: 'pg_trgm', meaning: '세 글자씩 자르는 확장. PostgreSQL 에 딸려 오고 기능이 많음', to: '/pg-trgm/about' },
  { group: '확장', term: '패딩(padding)', meaning: '조각을 만들 때 단어 앞뒤에 붙이는 가짜 공백. "여기가 시작/끝"을 표시', analogy: '단어에 붙인 여백 표시', to: '/foundations/ngram' },
  { group: '확장', term: '어휘소(lexeme)', meaning: '전문검색이 쓰는 단위. 글자가 아니라 낱말을 정규화한 것', analogy: '사전의 표제어', to: '/fulltext/tsvector' },
  { group: '확장', term: 'tsvector', meaning: 'PostgreSQL 에 원래 있는 낱말 단위 검색 기능(확장이 아님)', analogy: '낱말 찾아보기', to: '/fulltext/tsvector' },
  { group: '확장', term: 'contrib', meaning: 'PostgreSQL 에 딸려 오는 공식 확장 묶음. pg_trgm 이 여기 속함', analogy: '기본 부속품' },
  { group: '확장', term: 'PGXS', meaning: '확장을 소스에서 직접 빌드하는 방식. pg_bigm 은 이게 필요함', analogy: '부품을 직접 깎기', to: '/pg-bigm/about' },

  { group: 'GIN 내부', term: 'GIN', meaning: 'PostgreSQL 의 역인덱스 구현체. pg_bigm·pg_trgm·전문검색이 전부 이걸 씀', analogy: '찾아보기의 실제 종이·제본', to: '/foundations/gin' },
  { group: 'GIN 내부', term: '엔트리 트리', meaning: 'GIN 안에서 조각들을 정렬해 담는 부분', analogy: '찾아보기의 표제어 목록', to: '/foundations/gin' },
  { group: 'GIN 내부', term: '포스팅 리스트', meaning: '조각 하나가 가리키는 행 번호 목록', analogy: '표제어 옆의 쪽수들', to: '/foundations/gin' },
  { group: 'GIN 내부', term: 'TID (ctid)', meaning: '"몇 번째 블록의 몇 번째 튜플"인 행 주소. 포스팅 리스트에 들어가는 것이 이것', analogy: '쪽수와 줄 번호', to: '/foundations/gin' },
  { group: 'GIN 내부', term: '펜딩 리스트', meaning: 'FASTUPDATE 가 켜져 있을 때 새 조각을 잠시 모아두는 정렬 안 된 공간', analogy: '아직 정리 안 한 메모', to: '/foundations/gin' },
  { group: 'GIN 내부', term: 'GiST', meaning: '또 다른 인덱스 방식. 작지만 부정확해서 헛걸음이 많음', analogy: '대충 만든 찾아보기', to: '/pg-trgm/gist' },
  { group: 'GIN 내부', term: 'siglen', meaning: 'GiST 가 쓰는 요약 비트맵의 크기. 크면 정확해지지만 무한정은 아님', analogy: '요약본의 분량', to: '/pg-trgm/gist' },

  { group: '측정', term: 'Recheck', meaning: '찾아보기로 추린 후보의 원문을 다시 읽어 진짜인지 확인하는 단계', analogy: '쪽수 보고 갔더니 헛걸음이라 넘김', to: '/foundations/recheck' },
  { group: '측정', term: '후보(candidate)', meaning: '인덱스가 "여기 있을지도 모른다"고 올린 행. 진짜 답보다 많을 수 있음', analogy: '찾아보기가 알려준 쪽수들' },
  { group: '측정', term: '버퍼(buffer)', meaning: '디스크에서 읽어들인 8KB 페이지 수. 이 카탈로그의 주 측정 지표', analogy: '실제로 펼쳐 본 쪽 수', to: '/meta/method' },
  { group: '측정', term: 'EXPLAIN', meaning: '이 쿼리를 어떻게 실행할지/했는지 데이터베이스에게 물어보는 명령', analogy: '영수증', to: '/meta/method' },
  { group: '측정', term: '재현율(recall)', meaning: '찾아야 할 것 중 몇 %를 찾았나', analogy: '놓친 게 얼마나 되나', to: '/fulltext/korean-recall' },
  { group: '측정', term: '정밀도(precision)', meaning: '찾은 것 중 몇 %가 진짜인가', analogy: '헛걸음이 얼마나 되나' },
  { group: '측정', term: '거짓 양성', meaning: '인덱스는 "있다"는데 실제로는 없는 것', analogy: '헛걸음', to: '/foundations/recheck' },
]

export const GROUPS = ['기본', '확장', 'GIN 내부', '측정'] as const
