# 심화 01. planner와 shippability

## 출발점과 질문

기본 05에서 Remote SQL과 로컬 Filter를 읽었다. 이제 “왜 이 조건은 원격에 보낼 수 없는가?”, “왜 가능한 원격 JOIN도 선택되지 않는가?”를 구분한다. 안전성 판단과 비용 선택은 두 단계다.

## 1. planner는 가능한 경로를 모아 비교한다

PostgreSQL은 테이블마다 결과 크기를 추정하고 가능한 scan path를 만든다. FDW도 GetForeignRelSize·GetForeignPaths·GetForeignPlan 콜백으로 참여한다. 코어 planner와 따로 독립 실행하는 것이 아니라 후보 경로를 코어에 제공한다.

개념적으로 다음 순서다. 실제 코드는 더 많은 상태와 예외를 관리한다.

```text
표와 조건을 분석한다
→ 원격에서 실행해도 의미가 같은 조건 / 로컬에 남길 조건을 분류한다
→ 원격 scan·JOIN·집계 후보 경로와 예상 비용을 만든다
→ 다른 경로와 비교해서 선택한다
→ 선택한 경로를 Remote SQL과 Foreign Scan으로 바꾼다
```

“보낼 수 없다”는 의미 보존의 문제, “보낼 수 있지만 선택되지 않았다”는 비용의 문제다. 둘을 섞으면 fetch_size나 비용 값을 조정해도 전혀 해결되지 않는 조건에 시간을 쓰게 된다.

## 2. immutable이 왜 중요할까

IMMUTABLE 함수는 같은 입력에 같은 결과를 낸다는 계약이다. STABLE은 한 문장 안에서의 안정성, VOLATILE은 호출마다 바뀔 수 있다는 범주다. 함수 선언은 개발자가 planner에 주는 약속이며 잘못 선언하면 최적화가 틀릴 수 있다.

예를 들어 local_only(id)가 내부에서 로컬 표를 읽거나 시간을 참조한다면 원격에는 그 표·설정·시각이 다를 수 있다. 이름이 같다고 보내는 것은 안전하지 않다. 이 교재의 로컬 PL/pgSQL 함수는 VOLATILE로 만들어 조건을 의도적으로 로컬에 남긴다.

사용자 함수를 IMMUTABLE로 바꾸면 빨라질 것이라는 처방은 부적절하다. 실제 의미가 immutable인지, 원격에 존재하고 같은 동작인지, FDW가 그 객체를 안전하게 보낼 수 있다고 판단하는지를 각각 확인한다.

## 3. 타입·연산자·collation도 의미에 참여한다

문자열 정렬과 비교는 collation의 영향을 받는다. 로컬과 원격 타입·collation이 다르면 같은 title 조건의 결과나 정렬 의미가 달라질 수 있다. WHERE만 같다고 정답까지 같다고 단정하지 않는다.

NULL도 따로 생각한다. `title = NULL`은 일반적인 “NULL인지” 조건이 아니며 `IS NULL`을 사용해야 한다. outer JOIN의 필터를 이동하면 NULL로 채운 행의 처리 순서가 의미를 바꿀 수 있으므로 단순 문자열 치환으로 원격 SQL을 만들지 않는다.

## 4. extensions 옵션은 설치 명령이 아니다

```sql
ALTER SERVER school_remote OPTIONS (SET extensions 'pg_trgm');
```

shared setup은 extensions를 빈 문자열로 등록하므로 Lab에서는 SET으로 바꾼다. 양쪽의 호환되는 pg_trgm 설치와 같은 의미를 확인한 뒤 원격 전송 후보로 알려준다. 서버별 사용자 정의 객체 전체를 믿겠다는 설정은 아니다.

Lab 02는 `similarity(title, 'PostgreSQL') > 0.3`에 대해 옵션을 비운 계획과 pg_trgm을 등록한 계획을 저장한다. `%`는 similarity_op(STABLE)가 세션 임계값을 사용하므로 등록 후에도 로컬에 남는 대조 조건이다. `similarity`는 IMMUTABLE이며 두 표현을 혼동하지 않는다. 반환 ID 집합도 비교한다. 조건이 Remote SQL로 갔다는 사실과 원격 인덱스가 선택됐다는 사실을 별도 항목으로 기록한다.

## 5. JOIN·upper relation 후보

GetForeignJoinPaths는 원격 JOIN, GetForeignUpperPaths는 GROUP BY·ORDER BY 같은 상위 처리 후보에 참여한다. 같은 목적지에 있는 표라도 mapping·조건 안전성·비용 때문에 원격 결합이 선택되지 않을 수 있다.

로컬 표와의 JOIN에는 외부 행의 값을 파라미터로 원격 SQL에 넣는 parameterized path가 후보가 될 수 있다. 외부 행이 3개인지 3만 개인지에 따라 실행 전략이 바뀐다. local variable을 원격 표 자체처럼 다룬다고 오해하지 않는다.

## 6. 실행 계획을 보는 점검 순서

1. 원격 표만으로 구성된 쿼리부터 계획을 확인한다.
2. WHERE를 하나씩 추가해 Remote SQL에서 빠지는 조건을 찾는다.
3. 사용자 함수·extension 연산·collation·외부 파라미터를 구분한다.
4. 의미가 안전한 후보라면 추정 행·통계·비용을 검토한다.
5. 대조 쿼리의 결과 집합이 같은지 검증한다.

이 순서는 기능 하나를 무조건 강제하기보다 원인을 분리하기 위한 것이다. GUC로 특정 JOIN 방식을 끄는 것은 진단용 대조 조건일 수 있지만 운영 최적해의 증거는 아니다.

## 7. 소스 읽기와 복습

REL_18_6의 deparse.c에서 is_foreign_expr·foreign_expr_walker를, postgres_fdw.c에서 postgresGetForeignJoinPaths·postgresGetForeignUpperPaths를 찾아 읽는다. 함수 이름만 나열하지 말고 Lab 계획에서 빠진 조건이 어느 판단 범주에 속하는지 연결한다.

복습: 원격 JOIN이 안 된 경우 비용 값을 먼저 키우는 것이 맞을까? 먼저 안전성·mapping·대상 관계를 확인한다. 실행 가능성이 없는 경로는 cost로 만들 수 없다.

## 근거와 다음

[FDW callback](https://www.postgresql.org/docs/18/fdw-callbacks.html) · [함수 volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html) · [deparse.c 고정 버전](https://github.com/postgres/postgres/blob/REL_18_6/contrib/postgres_fdw/deparse.c)

다음: [심화 02. 비용·통계·JOIN](02-cost-statistics-and-joins.md).
