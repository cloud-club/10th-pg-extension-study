# pg_bigm — 실무 활용 가이드

> 실제 운영에서 무엇에 쓰는지, 매니지드 DB 지원 현황, 그리고 `pg_trgm`/전문검색과의 역할 분담을 정리한다. 재현 스크립트는 [`../labs/`](../labs) 의 각 lab 참고. 실전 백엔드 통합 예제는 [`../labs/05-fastapi-search-api/`](../labs/05-fastapi-search-api).

## 실무에서 실제로 하는 일

| 용도 | 예시 |
| --- | --- |
| 한글/CJK 부분 문자열 검색 가속 | 상품명, 게시글 제목/본문에서 `LIKE '%키워드%'` 자동완성/검색 |
| 짧은 키워드 검색 | 2글자짜리 브랜드명, 코드, 약어 검색 (`pg_trgm` 이 취약한 지점) |
| 오탈자에 강한 검색 | `=%` 유사도 연산자로 "정확히 안 맞아도 비슷한 것" 찾기 |
| 기존 `LIKE` 쿼리의 무중단 가속 | 애플리케이션 쿼리를 바꾸지 않고 인덱스만 추가 |

## 매니지드 DB 지원 현황

pg_bigm 은 PGDG(apt.postgresql.org) 배포판이 없는 서드파티 소스 프로젝트라, "웬만한 매니지드 서비스면 다 된다"고 가정하면 안 된다 - 실제로 확인된 것과 안 된 것을 구분해서 적는다.

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS for PostgreSQL | ✅ | 2021년 4월 공식 지원 발표 - "일본어/중국어/한국어 등 멀티바이트 문자 전문검색 가속"이라고 명시 |
| AWS Aurora PostgreSQL | ✅ | 같은 발표에서 Aurora PostgreSQL 도 함께 언급됨 |
| GCP Cloud SQL for PostgreSQL | ✅ (PostgreSQL 17+) | **`cloudsql.enable_pg_bigm` 데이터베이스 플래그를 켜야 하고, 이 작업은 인스턴스 재시작을 유발한다** - GCP 스스로도 이 확장을 "공유 라이브러리 프리로드가 필요한 확장"으로 분류한다는 방증이다 |
| Azure Database for PostgreSQL | 확인 필요 | 공식 지원 확장 목록에서 명시적으로 확인하지 못했다 - 사용 전 최신 목록을 직접 조회할 것 |
| Supabase / Neon | 확인 필요 | 공식 확장 목록에서 확인하지 못했다 - 필요하면 각 서비스의 커스텀 확장 요청/지원 여부를 문의할 것 |

<sub>GCP 의 "preload 필요 확장"이라는 분류는 이 카탈로그의 [내부 동작 문서](02-internals-and-source.md)에서 실습으로 확인한 내용(preload 없이도 기능은 되지만 세션마다 GUC 인식이 들쭉날쭉함)과 정확히 들어맞는다 - 매니지드 서비스 입장에서는 "일관성 없는 동작"을 감수하느니 아예 preload 를 강제하는 편이 안전하다고 판단한 것으로 보인다.</sub>

## 보안/운영 고려사항

- **`pg_bigm.enable_recheck` 는 반드시 켜둘 것.** 끄면 GIN 인덱스의 false positive(예: "trial" 검색에 "trivial" 이 섞여 나옴)가 그대로 결과에 남는다. 디버깅/성능 측정 목적이 아니면 건드리지 않는다.
- **인덱스 컬럼 크기 제한(~102MB)을 초과하면 INSERT/UPDATE 자체가 에러난다.** 큰 텍스트 컬럼을 통째로 인덱싱하기보다, 검색에 필요한 앞부분만 별도 컬럼으로 잘라 인덱싱하는 패턴을 고려한다.
- **FASTUPDATE(기본 on)는 쓰기를 빠르게 하는 대신 pending list 를 쌓는다.** pending list 가 커지면 그 목록을 훑어야 하는 조회가 느려질 수 있다 - `pg_gin_pending_stats()` 로 주기적으로 확인하거나, 읽기 위주 테이블은 `FASTUPDATE=off` 를 고려한다.
- **preload 없이 운영하면 "어떤 세션에서는 되고 어떤 세션에서는 안 되는" 혼란이 생길 수 있다** ([02](02-internals-and-source.md)) - 운영에서는 `shared_preload_libraries` 또는 `session_preload_libraries` 를 명시적으로 설정해 일관성을 확보하는 것이 안전하다.

## 비교: `pg_trgm` / 전문검색과의 역할 분담

| 상황 | 추천 |
| --- | --- |
| 한글/CJK 텍스트, 짧은 키워드(1~2글자) 포함 | **pg_bigm** |
| 영문 위주, 정규식(`~`,`~*`)도 함께 필요, GiST 인덱스가 필요 | `pg_trgm` (contrib 라 설치가 더 간단하기도 하다) |
| "관련도 순 정렬", 형태소 분석, 자연어 검색 랭킹이 필요 | PostgreSQL 내장 전문검색(`tsvector`/`tsquery`) - 단, 한국어는 별도 사전/파서(예: `mecab` 연동)가 필요한 경우가 많다 |
| BM25 랭킹, Elasticsearch 급의 검색 경험이 필요 | ParadeDB `pg_search` 같은 전용 검색 익스텐션 검토 |

`pg_bigm` 과 `pg_trgm` 은 1.1 이후로는 **같은 DB 에 함께 설치**할 수 있다 - 컬럼 특성에 따라 인덱스 종류를 섞어 쓸 수도 있다 ([`labs/04-comparison-and-ops/`](../labs/04-comparison-and-ops)에서 실제로 둘 다 설치해 나란히 비교한다).

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [내부 동작과 코드베이스](02-internals-and-source.md)

## 참고 링크

- [Amazon RDS for PostgreSQL Supports pg_bigm extension for faster full text search (AWS 공식 발표, 2021)](https://aws.amazon.com/about-aws/whats-new/2021/04/amazon-rds-for-postgresql-supports-pg-bigm-extension-for-faster-full-text-search/)
- [Index types supported in Amazon Aurora PostgreSQL and Amazon RDS for PostgreSQL using extensions (Bloom, pg_trgm, and pg_bigm) - AWS Database Blog](https://aws.amazon.com/blogs/database/index-types-supported-in-amazon-aurora-postgresql-and-amazon-rds-for-postgresql-using-extensions-bloom-pg_trgm-and-pg_bigm/)
- [73+ PostgreSQL Extensions on Cloud SQL, Ranked (pg_bigm 항목 포함)](https://1bench.dev/extensions/postgresql/on-gcp-cloud-sql)
