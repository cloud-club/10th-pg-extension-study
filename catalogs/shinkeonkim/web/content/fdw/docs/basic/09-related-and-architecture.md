# 09. 관련 확장과 설계 선택

## 이 장에서 얻을 것

dblink·file_fdw·pg_trgm·pg_stat_statements·pg_cron의 역할을 구분한다. 관련 확장이라는 이유만으로 모든 것을 같이 설치하지 않는다.

## 기본 다음에 읽는 관련 확장 5장

| 관심 질문 | 이어 읽기 |
| --- | --- |
| SQL·반환 타입·cursor를 직접 관리한다면? | [dblink 심화](../../related/dblink.md) |
| CSV를 외부 표로 읽을까, COPY로 적재할까? | [file_fdw 심화](../../related/file-fdw.md) |
| 검색 조건 전송과 인덱스 사용이 왜 다른가? | [pg_trgm 원격 검색](../../related/remote-search.md) |
| 로컬 지연과 원격 부하를 어떻게 연결할까? | [pg_stat_statements·auto_explain](../../related/observability.md) |
| 정기 캐시 갱신의 실패·지연을 누가 다룰까? | [pg_cron과 캐시](../../related/cache-cron.md) |

각 장은 쉬운 설명 → SQL 예제 → 성능과 보장 경계 → 실습 연결로 구성한다. 이미 검증한 Lab과 추가 수동 예제를 구분한다. 공식 근거는 2026-10-13에 확인했다.

## 1. postgres_fdw와 dblink

postgres_fdw는 foreign table을 일반 SELECT에 통합한다. planner가 원격 처리 후보를 비교하고 Remote SQL을 만든다. dblink는 호출자가 원격 SQL 문자열과 결과 열 타입을 명시하는 방식이다.

```sql
SELECT * FROM dblink(
  'host=remote dbname=school user=fdw_reader password=study_only',
  'SELECT id, title FROM public.books WHERE id <= 3 ORDER BY id'
) AS result(id integer, title text);
```

SQL 문자열 안에서 무엇을 실행할지 직접 결정한다. 결과 타입을 잘못 적으면 문제가 생긴다. named connection으로 원격 세션을 유지하거나 원격 명령을 직접 제어할 수 있지만 트랜잭션 종료도 명시적으로 관리한다. dblink를 쓰면 로컬 ROLLBACK과 원격 명령이 자동으로 하나의 트랜잭션이 된다고 가정하지 않는다.

## 2. file_fdw는 PostgreSQL 서버 연결이 아니다

file_fdw는 PostgreSQL 서버에 있는 파일이나 프로그램 출력을 읽기 전용 표로 노출한다. “내 노트북에 있는 CSV”라는 말만으로 서버가 읽을 수 있는 것은 아니다. 서버 파일 경로와 서버 프로세스의 접근 권한이 필요하다.

Lab 05는 별도 컨테이너 파일을 준비해 CSV 외부 표를 조회한다. 접속형 FDW와 파일형 FDW를 같은 학교 예제로 비교한다. file_fdw는 CSV 내용을 로컬 영구 테이블에 적재하는 COPY와도 다르다.

## 3. pg_trgm: 원격 검색을 빠르게 하기

제목 유사도 검색에는 원격 pg_trgm 인덱스가 후보가 된다. 그러나 검색 조건이 로컬에서 판단되면 인덱스가 있어도 전송량을 충분히 줄이지 못할 수 있다. 양쪽에 호환되는 확장을 설치하고 동작이 같은지 확인한 뒤 server의 extensions 옵션을 사용한다.

이 옵션은 확장을 설치하거나 인덱스를 만들지 않는다. 원격으로 보낼 수 있는 immutable 확장 함수·연산자를 판단할 때 참고하는 설정이다. Lab 02는 옵션 전후 Remote SQL을 비교한다. 세션 임계값에 의존하는 %는 STABLE이라 로컬에 남고, IMMUTABLE similarity 함수의 명시 임계값 조건은 원격 전송을 대조한다. 인덱스 사용은 원격 EXPLAIN으로 따로 확인한다.

## 4. pg_stat_statements: 관측 범위 구분

로컬에서는 FDW를 사용하는 사용자 SQL을, 원격에서는 FDW가 생성해 보낸 명령을 관측한다. 원격 커서 FETCH나 여러 원격 명령이 보일 수 있어 로컬 SQL 한 번과 원격 통계 한 행이 항상 1:1 대응한다고 가정하지 않는다.

application_name으로 원격 활동을 식별하고, 동일 작업의 시간 구간·로그·계획을 함께 비교한다. queryid는 서버 간 전역 작업 ID가 아니다. 앱 풀 대기는 DB 쿼리 통계 밖이므로 서비스 지연은 별도로 측정한다.

## 5. pg_cron: 원격 의존성을 줄이는 로컬 캐시

같은 원격 집계를 자주 쓴다면 구체화 뷰를 로컬에 만들고 정기 갱신할 수 있다. 읽기는 로컬에서 끝나지만 갱신은 원격을 읽고 실패할 수 있다. 마지막 성공 갱신 시각과 허용 신선도를 함께 저장한다.

```sql
CREATE MATERIALIZED VIEW public.book_counts AS
SELECT category, count(*) AS books
FROM remote_school.books GROUP BY category;
REFRESH MATERIALIZED VIEW public.book_counts;
```

pg_cron은 이 REFRESH를 예약하는 역할이다. 원격 연결을 풀링하거나 여러 DB 커밋을 보장하는 도구는 아니다. CONCURRENTLY 갱신은 필요한 UNIQUE 인덱스와 추가 비용을 검토한 뒤 선택한다.

## 6. 선택 기준을 요구사항으로 작성한다

| 요구 | 먼저 비교할 방식 | 수용할 비용 |
| --- | --- | --- |
| 가끔 최신 원격 결과 몇 행 | postgres_fdw | 원격 가용성과 응답 지연 의존 |
| 원격 SQL·세션을 직접 제어 | dblink | SQL 문자열·결과 타입·트랜잭션 직접 관리 |
| 서버의 CSV를 바로 조회 | file_fdw | 파일 경로·권한·파싱 비용 |
| 원격 장애 중에도 이전 집계 제공 | 로컬 구체화 뷰 | 갱신 지연·실패 관리 |
| 대규모 반복 분석 | ETL·복제·분석 저장소 | 중복 저장·동기화 비용 |

관리형 DB 지원은 서비스·버전·권한과 outbound 통신을 실제 대상에서 확인한다. “확장 목록에 있다”는 사실만으로 원격 연결·서버 파일 접근·TLS 구성이 가능하다고 단정하지 않는다.

## 7. 복습

질문: pg_trgm 인덱스가 원격에 있으면 로컬 WHERE도 자동으로 원격에 갈까?

답: 아니다. 확장의 shippability와 실제 Remote SQL을 확인한다.

질문: 캐시를 쓰면 원격 부하가 사라질까?

답: 갱신 때 부하가 발생한다. 빈도를 줄이거나 다른 시간대로 옮길 수 있을 뿐이다.

국내 적용과 서비스 가이드가 궁금하면 [기업 사례와 조사 질문](../../industry-cases.md)을 읽는다. 매드업의 dblink 데이터마트 사례와 실제 postgres_fdw 이관 사례의 차이를 함께 비교한다.

## 참고와 다음 장

[dblink](https://www.postgresql.org/docs/18/dblink.html) · [file_fdw](https://www.postgresql.org/docs/18/file-fdw.html) · [구체화 뷰](https://www.postgresql.org/docs/18/rules-materializedviews.html)

다음: [10. 용어집과 진단 순서](10-glossary-and-review.md). 지금까지의 개념을 느린 쿼리 질문에 적용한다.
