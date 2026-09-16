# pg_bigm

> 텍스트를 2글자 조각으로 색인해, 짧은 한글 키워드를 포함한 LIKE 부분 문자열 검색을 가속한다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 검색 · 텍스트 |
| 버전 | 기존 실습: PostgreSQL 16 / pg_bigm 1.2 (`v1.2-20250903`) |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | [공식 저장소](https://github.com/pgbigm/pg_bigm) · [1.2 문서](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md) |
| 정리한 사람 | shinkeonkim |
| 회차 | week02 |

---

## 1. Before / After - 없으면 뭐가 불편한가

**Before**

일반 B-tree로 가속하기 어려운 앞뒤 와일드카드 검색은 많은 행을 읽게 된다. 아래 두 예시는 2절에서 생성하는 테이블을 사용한다.

```sql
SELECT doc FROM catalog_bigm_demo WHERE doc LIKE '%검색%';
```

**After**

```sql
CREATE INDEX catalog_bigm_demo_idx
  ON catalog_bigm_demo USING gin (doc gin_bigm_ops);
SELECT doc FROM catalog_bigm_demo WHERE doc LIKE '%검색%';
```

검색 의미와 LIKE 문법을 유지하면서 후보 행을 인덱스로 좁힐 수 있다. 인덱스가 있어도 작은 테이블이나 대부분의 행이 매칭되는 조건에서는 순차 스캔을 선택할 수 있다.

## 2. 설치 & 데모

서버에 pg_bigm 라이브러리와 확장 설치 파일이 필요하다. 자체 호스팅 환경의 소스 빌드 절차는 [실습 Dockerfile](week02/pg_bigm/labs/01-preload-and-guc-registration/Dockerfile)에 있다. 설치 권한이 있는 사용자로 별도 실습 DB에서 아래 블록을 순서대로 실행한다. 1절의 예시를 따로 실행할 필요는 없다.

```sql
CREATE EXTENSION IF NOT EXISTS pg_bigm;
CREATE TABLE catalog_bigm_demo (id integer PRIMARY KEY, doc text NOT NULL);
INSERT INTO catalog_bigm_demo VALUES
  (1, '한글 검색을 공부합니다'),
  (2, 'PostgreSQL 확장 스터디'),
  (3, '검색 결과를 확인합니다');
CREATE INDEX catalog_bigm_demo_idx
  ON catalog_bigm_demo USING gin (doc gin_bigm_ops);
ANALYZE catalog_bigm_demo;
```

```sql
SELECT id, doc FROM catalog_bigm_demo
WHERE doc LIKE likequery('검색') ORDER BY id;
-- 1 | 한글 검색을 공부합니다
-- 3 | 검색 결과를 확인합니다

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM catalog_bigm_demo WHERE doc LIKE '%검색%';
-- 3행뿐인 데모는 Seq Scan일 수 있다. 결과 정확성과 인덱스 선택은 별개다.

DROP TABLE catalog_bigm_demo; -- 데모 테이블과 그 인덱스 정리
```

`likequery()`는 입력을 리터럴 부분 문자열 검색용 LIKE 패턴으로 만든다. 기본 검색 기능에는 shared_preload_libraries가 필수는 아니다. 다만 라이브러리를 아직 로드하지 않은 세션의 GUC 인식과 ALTER SYSTEM 동작은 구분해야 한다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | `%검색%`처럼 짧은 키워드의 부분 문자열 검색이 잦고, 실제 실행계획에서 후보 행을 충분히 줄일 수 있을 때 |
| 이럴 때는 피한다 | GiST KNN, 정규식·ILIKE의 인덱스 지원, 형태소 분석이나 문서 랭킹이 핵심일 때 |
| 비용 | GIN 인덱스 저장 공간·빌드 시간·쓰기 비용. FASTUPDATE의 pending list 관리가 필요하며 서버별 설치 가능 여부를 확인해야 한다 |
| 대안 | [pg_trgm](pg_trgm.md), PostgreSQL 내장 전문검색(tsvector/tsquery), 애플리케이션 검색 서비스 |

한 글자 검색이나 흔한 키워드는 bigram 인덱스가 있어도 후보가 많을 수 있다. 한글이라는 이유만으로 항상 pg_trgm보다 빠르다고 판단하지 않는다. 접두어 검색으로 바꾸는 것은 최적화뿐 아니라 **검색 결과의 의미를 바꾸는 선택**이다.

## 4. 매니지드 DB 지원 여부

기존 스터디 조사와 서비스 문서를 기준으로 정리했다. 지원과 기본 활성화는 다르며, 적용할 PostgreSQL 버전의 확장 목록을 확인한다.

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | [AWS 지원 발표](https://aws.amazon.com/about-aws/whats-new/2021/04/amazon-rds-for-postgresql-supports-pg-bigm-extension-for-faster-full-text-search/) |
| AWS Aurora | ○ | [AWS의 Aurora/RDS 인덱스 비교](https://aws.amazon.com/blogs/database/index-types-supported-in-amazon-aurora-postgresql-and-amazon-rds-for-postgresql-using-extensions-bloom-pg_trgm-and-pg_bigm/) |
| Supabase | 확인 필요 | 기존 조사에서 지원을 확정하지 못함 |
| Neon | 확인 필요 | 기존 조사에서 지원을 확정하지 못함 |
| GCP Cloud SQL | ○, PG17+ | cloudsql.enable_pg_bigm 플래그·재시작 조건은 [공식 확장 안내](https://docs.cloud.google.com/sql/docs/postgres/extensions) 확인 |

확장 자체의 preload 필요 여부와 관리형 서비스가 요구하는 활성화 플래그는 별개다.

---

## 5. (선택) 내부 동작 원리

문자열에서 겹치는 bigram을 추출해 GIN의 키로 저장하고, 각 키에 해당하는 행 위치를 연결한다. `gin_bigm_ops`가 LIKE 연산자의 후보 추출·일치 판정을 GIN 프레임워크에 제공한다. SQL 실행 훅으로 LIKE를 가로채는 구조는 아니다.

후보 행은 원래 LIKE 조건으로 다시 검사한다. 조각이 존재한다고 문자열 순서나 전체 패턴까지 일치하는 것은 아니기 때문이다. `pg_bigm.enable_recheck`를 끄면 패턴에 따라 오탐을 반환할 수 있다.

## 6. (선택) 벤치마크 / 실습 결과

아래는 기존 PostgreSQL 16·Docker 실험 기록의 요약이며 이번 문서 작성 중 재측정한 값은 아니다.

| 조건 | 결과 |
| --- | --- |
| 합성 텍스트 20만 행, `LIKE '%클클%'` | pg_bigm 후보 200행·인덱스 버퍼 4개, pg_trgm 후보 20만 행·버퍼 5,097개 |
| 같은 비교 실험의 3글자 이상 검색어 | pg_trgm이 더 적은 인덱스 버퍼를 읽은 조건도 있음. 짧은 키워드 결과를 일반화할 수 없음 |
| NSMC 말뭉치 100행·1,000행의 Before/After | 인덱스를 만들고도 Seq Scan을 고른 조건이 있었음. 행 수와 선택도가 함께 영향을 줌 |

원본·조건: [키워드 길이와 선택도 비교](week02/bigm-vs-trgm/experiments/01-keyword-length-and-selectivity/README.md), [Before/After 실험](week02/pg_bigm/experiments/00-explain-before-after/README.md). 실행시간은 캐시·하드웨어·일치 비율에 따라 달라지므로 이 수치를 운영 성능 보장으로 사용하지 않는다.

---

## 참고 링크

- [pg_bigm 1.2 공식 문서](https://github.com/pgbigm/pg_bigm/blob/REL1_2_STABLE/docs/pg_bigm_en.md)
- [소스 분석](week02/pg_bigm/docs/02-internals-and-source.md)
- [Docker 실습 5개](week02/pg_bigm/labs/README.md)
- [pg_bigm·pg_trgm 비교 자료](week02/bigm-vs-trgm/README.md)
