# 04. SELECT와 JOIN의 데이터 흐름

## 이 장에서 얻을 것

필터·JOIN·집계가 입력 행을 어떻게 바꾸는지 배운다. “같은 결과를 얻는다”와 “같은 양의 데이터를 이동한다”를 구분할 수 있게 된다.

## 1. WHERE는 행, SELECT는 열을 줄인다

```sql
SELECT id, title FROM remote_school.books WHERE id <= 10;
```

조건을 통과한 책만 필요하고 payload라는 긴 본문 열은 필요 없다. 원격 SQL에도 같은 필터와 필요한 열이 반영되면 원격에서 작은 결과를 만든다. 반대로 조건이 로컬에서 실행되면 조건 판단에 필요한 행과 열을 더 가져와야 할 수 있다.

제목과 번호만 읽는 것과 번호·제목·긴 본문을 모두 읽는 것은 행 수가 같아도 전송 바이트가 다르다. 이후 네트워크 실험은 좁은 행과 넓은 행을 분리한다.

## 2. JOIN은 두 표의 행을 연결한다

책에는 publisher_id가 있고 publishers에는 출판사 id와 name이 있다. 같은 번호를 가진 책과 출판사를 연결한다.

```sql
SELECT b.id, b.title, p.name
FROM remote_school.books AS b
JOIN remote_school.publishers AS p ON p.id = b.publisher_id
WHERE b.id <= 10;
```

JOIN은 한쪽 표의 열을 붙이는 작업이다. 출판사 번호가 중복되어 여러 행이 매칭되면 결과 행도 늘어난다. WHERE가 있어도 JOIN 결과 수가 입력 책 수와 항상 같은 것은 아니다. 실습에서는 publishers.id가 primary key라 책 한 권이 출판사 하나에 매칭된다.

두 표가 같은 foreign server와 호환되는 mapping을 사용하면 원격에서 JOIN을 수행할 후보가 된다. 원격에서 합친 결과를 받는지, 각 표를 받은 후 로컬에서 합치는지는 다음 장의 실행 계획으로 확인한다.

## 3. 로컬 표와 원격 표의 JOIN

로컬의 favorite_books에는 관심 있는 책 번호 세 개만 있고 원격에는 10만 권이 있다고 하자.

```sql
SELECT f.reader_name, b.title
FROM public.favorite_books AS f
JOIN remote_school.books AS b ON b.id = f.book_id;
```

전략 A는 원격 책 목록을 많이 가져와 로컬에서 합치는 것이다. 전략 B는 책 번호를 매개변수로 삼아 필요한 원격 행을 반복 조회하는 것이다. 관심 목록이 작고 원격 id 인덱스가 있으면 B가 유리할 수 있지만 번호가 수천 개이고 RTT가 길면 반복 요청 비용이 커질 수 있다.

여기서는 어느 전략이 항상 이긴다고 정하지 않는다. 외부 입력의 개수, 원격 선택도, 인덱스와 RTT가 결정을 바꾼다. Nested Loop·Hash Join이라는 이름은 다음 장에서 읽는다.

원격 JOIN이 수행돼도 결과는 fetch_size 단위로 여러 번 가져올 수 있다. 같은 주소보다 같은 server 객체·mapping·전송 가능한 조건을 확인한다. 로컬 JOIN도 원격 필터가 가능하므로 항상 전체 행·전체 열 전송이라고 단정하지 않는다. [블로그 주의사항 검토](/postgres-fdw/blog-review)에서 실제 전송 행 수와 Remote SQL을 대조한다.

## 4. GROUP BY는 여러 행을 요약한다

```sql
SELECT category, count(*)
FROM remote_school.books
GROUP BY category;
```

실습 데이터는 category 두 종류를 가지므로 결과는 두 행이다. 중요한 질문은 최종 두 행을 얻기 위해 DB 사이에서 몇 행을 옮겼는가다. 원격에서 집계하면 요약만 받지만 로컬에서 집계하면 많은 원본 행을 가져올 수 있다.

집계를 원격에 보낸다고 원격에서 일을 안 하는 것은 아니다. 10만 권을 읽어 분류별 개수를 세는 CPU·I/O는 원격에서 사용한다. 전송량 감소와 원격 작업 감소는 서로 다르다.

## 5. LIMIT과 정렬의 함정

```sql
SELECT id, title FROM remote_school.books ORDER BY title LIMIT 10;
```

결과는 10행이지만 먼저 제목 순으로 정렬해야 한다. 원격에 적절한 인덱스가 있는지, 원격 SQL에 ORDER BY와 LIMIT이 있는지, 로컬에서 정렬하는지를 살핀다. 10행 결과만 보고 “10행만 처리했다”고 결론 내리면 안 된다.

SQL의 작성 순서는 동작의 논리적 의미를 정하지만 실제 실행 순서를 줄마다 직접 지시하지 않는다. planner가 같은 의미의 여러 실행 경로를 비교한다.

## 6. 복습

질문: 최종 GROUP BY 결과가 두 행이면 통신도 두 행만 했을까?

답: 원격 집계 여부를 봐야 한다. 최종 결과 수와 원격에서 받은 중간 행 수는 다를 수 있다.

질문: 로컬 작은 표와 원격 큰 표의 JOIN은 항상 느릴까?

답: 필요한 번호만 원격 인덱스로 조회하면 작게 끝날 수 있다. 반대로 반복 횟수가 많으면 왕복 비용이 커진다.

## 참고와 다음 장

[테이블 표현식과 JOIN](https://www.postgresql.org/docs/18/queries-table-expressions.html)

다음: [05. 실행 계획과 pushdown](05-explain-and-pushdown.md). 실행 위치를 직접 확인한다.

## JOIN 자체를 더 공부하기
Nested Loop·Hash Join·Merge Join의 차이와 Bitmap Scan의 역할은 [번외 PostgreSQL JOIN 학습 지도](/pg-joins/about)에서 기본·심화·Lab 순서로 읽을 수 있습니다. FDW에서는 알고리즘과 함께 실행 장소·전송량을 확인합니다.
