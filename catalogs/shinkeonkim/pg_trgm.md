# pg_trgm

> 트라이그램을 이용해 부분 문자열·유사도 검색을 가속하고, GiST 인덱스로 가까운 문자열 N개를 찾을 수 있게 한다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 검색 · 텍스트 |
| 버전 | 기존 실습: PostgreSQL 16 / pg_trgm 1.6 |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [PostgreSQL 16 소스](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm) · [공식 문서](https://www.postgresql.org/docs/16/pgtrgm.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | week02 |

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

부분 문자열 검색만으로는 오탈자가 있는 입력과 비슷한 문자열을 찾기 어렵다.

```sql
SELECT 'postgresql' LIKE '%postgreql%' AS matched;
-- false
```

**After**

pg_trgm 설치 후에는 유사도와 임계값으로 후보를 찾을 수 있다.

```sql
SELECT similarity('postgresql', 'postgreql') > 0.3 AS matched;
-- true
```

유사도는 의미 이해나 편집 거리와 동일하지 않다. 같은 조각이 얼마나 겹치는지를 기준으로 한다.

## 2. 설치 & 데모

서버에 PostgreSQL contrib 확장 파일이 설치되어 있어야 한다. PostgreSQL 13+에서는 trusted 확장이므로 DB의 CREATE 권한을 가진 일반 사용자도 설치할 수 있지만, 관리형 서비스의 별도 허용 정책은 적용된다. shared_preload_libraries와 서버 재시작은 필요 없다.

별도 실습 DB에서 아래 블록을 순서대로 실행한다.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE catalog_trgm_demo (id integer PRIMARY KEY, title text NOT NULL);
INSERT INTO catalog_trgm_demo VALUES
  (1, 'postgresql'), (2, 'postgreql'), (3, 'banana');
CREATE INDEX catalog_trgm_demo_idx
  ON catalog_trgm_demo USING gist (title gist_trgm_ops);
ANALYZE catalog_trgm_demo;
```

```sql
SELECT round(similarity('abcd', 'abce')::numeric, 4) AS score;
-- 0.4286

SET pg_trgm.similarity_threshold = 0.3;
SELECT id, title FROM catalog_trgm_demo
WHERE title % 'postgresql' ORDER BY id;
-- 1 | postgresql
-- 2 | postgreql

-- GiST가 지원하는 거리 순서 검색(KNN)
SELECT title FROM catalog_trgm_demo
ORDER BY title <-> 'postgresql' LIMIT 1;
-- postgresql

RESET pg_trgm.similarity_threshold;
DROP TABLE catalog_trgm_demo;
```

일반적인 필터 검색은 GIN의 `gin_trgm_ops`도 사용할 수 있다. 거리 연산자로 정렬하는 KNN은 GiST를 사용한다. 3행 데모의 실제 실행계획은 순차 스캔일 수 있다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | LIKE·ILIKE·유사도 검색, 추출 가능한 trigram이 있는 정규식, 가까운 문자열 N개를 찾는 KNN |
| 이럴 때는 피한다 | 추출 가능한 조각이 없는 패턴이 대부분이거나, 형태소 분석·문서 관련도 랭킹이 주목적일 때 |
| 비용 | 인덱스 공간·쓰기 비용·후보 recheck. GiST siglen과 GIN pending list 등 설정에 따라 읽기/쓰기 비용이 달라짐 |
| 대안 | [pg_bigm](pg_bigm.md), PostgreSQL 내장 전문검색(tsvector/tsquery), 접두어·동등 비교용 B-tree |

`LIKE '%가나%'`처럼 단어 경계가 없는 두 글자 패턴은 trigram을 추출하지 못해 인덱스 전체를 읽을 수 있다. `%가나%`를 `가나%`나 `% 가나 %`로 바꾸면 검색 의미도 달라지므로 같은 결과를 내는 대체식으로 취급하지 않는다.

한글도 trigram이 생성된다. 다만 정규식의 후보 추출에는 별도의 제약이 있으므로 “한글 LIKE가 가속된다”와 “모든 한글 정규식이 가속된다”를 구분한다.

## 4. 매니지드 DB 지원 여부

기존 스터디의 지원 조사 기준이다. contrib라는 사실만으로 서비스의 권한·허용 목록을 생략할 수는 없다.

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | 대상 엔진 버전의 확장 목록·설치 권한 확인 |
| AWS Aurora | ○ | 대상 엔진 버전의 확장 목록·설치 권한 확인 |
| Supabase | ○ | 프로젝트 DB에서 확장 활성화 |
| Neon | ○ | 사용 DB에서 CREATE EXTENSION |
| GCP Cloud SQL | ○ | 서비스의 확장 설치 권한 정책 적용 |

세부 출처는 [기존 운영 가이드](week02/pg_trgm/docs/04-production-playbook.md), [Cloud SQL 확장 목록](https://docs.cloud.google.com/sql/docs/postgres/extensions)을 참고한다. pg_trgm 자체는 preload가 필요 없다.

---

## 5. (선택) 내부 동작 원리

단어 앞에 공백 두 개, 뒤에 한 개를 붙이고 3글자씩 겹쳐 자른다. 유사도 계산에서는 단어가 아닌 문자를 경계로 취급한다. 멀티바이트 조각은 고정 크기 내부 표현으로 변환되며 한글을 무조건 제외하는 것은 아니다.

GIN은 조각별 행 위치를, GiST는 조각 집합의 서명을 이용한다. 인덱스로 후보를 좁힌 뒤 원래 조건을 재검사한다. SQL 훅이나 background worker 대신 연산자 클래스라는 인덱스 확장점을 사용한다.

## 6. (선택) 벤치마크 / 실습 결과

기존 PostgreSQL 16·Docker 실험 기록의 요약이며 이번 문서 작성 중 재측정하지 않았다.

| 조건 | 결과 |
| --- | --- |
| 합성 텍스트 20만 행, `LIKE '%클클%'` | 후보 20만 행, recheck 탈락 199,800행. 인덱스 사용 자체가 효율적인 검색을 뜻하지 않음 |
| 5만 행 규모의 한글 정규식·LIKE 비교 | 해당 한글 정규식은 전체 후보를 읽었지만, 같은 문자열의 LIKE에서는 후보를 1행으로 좁힘 |
| 20만 행, GiST siglen=12와 256 비교 | 해당 부하의 인덱스 버퍼가 약 4,400개에서 420개로 감소. 모든 데이터에서 같은 효과를 보장하지 않음 |

원본·재현 조건: [길이·선택도 비교](week02/bigm-vs-trgm/experiments/01-keyword-length-and-selectivity/README.md), [pg_trgm 실험 목록](week02/pg_trgm/experiments/README.md). PostgreSQL 버전·문자열 분포·패턴·캐시를 함께 기록하고 판단해야 한다.

---

## 참고 링크

- [PostgreSQL 16 pg_trgm 공식 문서](https://www.postgresql.org/docs/16/pgtrgm.html)
- [소스 분석](week02/pg_trgm/docs/02-internals-and-source.md)
- [Docker 실습 5개](week02/pg_trgm/labs/README.md)
- [pg_bigm·pg_trgm 비교 자료](week02/bigm-vs-trgm/README.md)
