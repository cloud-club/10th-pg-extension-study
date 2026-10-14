# 05. 실행 계획과 pushdown

## 이 장에서 얻을 것

실행 계획을 아래에서 위로 읽고 Remote SQL, Filter, rows, loops, cost를 구분한다. pushdown은 처리 일부를 데이터가 있는 서버로 보내는 것이다.

## 1. EXPLAIN과 EXPLAIN ANALYZE

```sql
EXPLAIN (VERBOSE)
SELECT id, title FROM remote_school.books WHERE id <= 10;

EXPLAIN (ANALYZE, VERBOSE, BUFFERS)
SELECT id, title FROM remote_school.books WHERE id <= 10;
```

첫 번째는 선택한 계획을 보여주며 실제 SELECT 결과를 읽는 실행을 하지 않는다. 다만 FDW의 계획 수립 자체가 원격 접속·원격 EXPLAIN을 발생시킬 수 있으므로 “네트워크를 절대 쓰지 않는다”는 뜻은 아니다. 두 번째는 실제 쿼리를 실행해서 걸린 시간과 행 수를 보여준다.

UPDATE에 ANALYZE를 붙이면 UPDATE가 실행된다는 점도 기억한다. 이 교재의 자동 계획 실습은 SELECT 위주이며 쓰기 실습은 롤백 확인 단계와 분리한다.

## 2. 세 줄짜리 개념 계획 읽기

```text
Foreign Scan on remote_school.books
  Filter: (로컬에서 판단할 조건)
  Remote SQL: SELECT id, title FROM public.books WHERE (...)
```

위는 특정 실행을 캡처한 결과가 아니라 읽는 법을 설명한 모양이다. 실제 계획은 Lab 02의 결과 파일에 있다. Foreign Scan은 외부 접근을 담당하는 노드, Remote SQL은 원격으로 보낼 SQL, Filter는 이 노드에서 로컬로 판단할 조건이다.

Remote SQL에 WHERE가 있으면 해당 조건을 원격으로 보내는 계획이다. Filter가 있다면 원격에서 받은 뒤 판단할 조건이 남아 있다. 일부 조건은 원격, 나머지는 로컬일 수도 있다. “WHERE가 있다/없다”만으로 전체 쿼리를 분류하지 않는다.

## 3. 실제 행 수와 반복 횟수

actual rows는 그 노드가 반환한 행 수를 읽는 출발점이다. loops가 여러 번이면 rows와 시간은 반복당 평균으로 표시되는 경우가 있으므로 총 일량을 생각할 때 loops를 함께 본다. Rows Removed by Filter는 필터 단계에서 버린 행을 나타낸다.

Foreign Scan이 3행을 반환했어도 로컬 Filter에서 99,997행을 버렸다면 원격에서 많이 받은 경로일 수 있다. 반대로 원격 SQL에 id 필터가 있으면 원격 테이블의 인덱스가 어떤 방식으로 쓰였는지는 원격 계획을 확인한다.

## 4. Nested Loop와 Hash Join

Nested Loop는 한쪽의 각 행마다 다른 쪽을 찾아 합치는 방식이다. 원격 조회가 안쪽에 있고 파라미터가 바뀌면 원격 요청이 반복될 수 있다. 모두 네트워크 재조회인 것은 아니므로 Materialize·Memoize·실제 loops·Remote SQL도 확인한다.

Hash Join은 한쪽 결과로 해시 표를 만든 후 다른 쪽을 대조한다. 한 번 받아 합친다고 해서 항상 싸지는 않다. 원격에서 받은 행이 많으면 전송량과 로컬 메모리·디스크 임시 작업이 커질 수 있다.

## 5. cost와 milliseconds는 같은 단위가 아니다

cost는 planner가 상대적인 경로를 비교하기 위한 값이다. actual time은 실행 중 관측한 시간이다. cost 100을 “100ms”로 읽지 않는다. 서로 다른 버전·설정의 cost를 측정 지연처럼 직접 비교하지도 않는다.

BUFFERS는 현재 서버에서 관측한 버퍼 접근이다. 로컬 Foreign Scan의 결과만으로 원격이 디스크에서 몇 블록을 읽었는지 알 수 없다. Remote SQL을 복사해 원격에서 EXPLAIN (ANALYZE, BUFFERS)을 실행하고 양쪽을 나란히 읽는다.

## 6. 왜 내 함수는 원격으로 안 갈까

같은 이름의 함수라도 서버마다 코드·설정·버전이 다르면 결과가 달라질 수 있다. 그래서 postgres_fdw는 안전하게 보낼 수 있는 표현식을 구분한다. Lab 02는 의도적으로 VOLATILE인 로컬 함수를 넣어 로컬 필터와 원격 필터를 대조한다.

자세한 함수·연산자 판정과 extension 옵션은 [심화 01](../advanced/01-planner-and-shippability.md)에서 다룬다. 기본 단계에서는 “Remote SQL과 로컬 Filter를 직접 읽는다”는 습관부터 만든다.

## 7. 복습

질문: Foreign Scan이 보이면 필터·집계도 모두 원격에서 실행되나?

답: 아니다. 상위 로컬 Aggregate·Sort와 Remote SQL을 함께 읽어야 한다.

질문: cost가 줄었으니 사용자 응답 시간도 줄었다고 말할 수 있나?

답: 실제 실행을 재야 한다. 추정 비용과 관측 시간은 서로 다른 증거다.

## 참고와 다음 장

[EXPLAIN 읽기](https://www.postgresql.org/docs/18/using-explain.html) · [FDW query planning](https://www.postgresql.org/docs/18/fdw-planning.html)

다음: [06. RTT·대역폭·fetch](06-network-and-fetch.md). 실행 계획이 같은데 네트워크 조건이 바뀌면 무엇이 달라지는지 배운다.
