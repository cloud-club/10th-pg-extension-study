# 기본 05 · Bitmap은 JOIN 방식인가?

## 한 테이블을 읽는 방법
PostgreSQL의 대표적인 물리 JOIN은 Nested Loop·Hash Join·Merge Join입니다. Bitmap Index Scan·Bitmap Heap Scan·BitmapAnd·BitmapOr는 한 테이블의 후보 행 위치를 찾아 읽는 과정입니다. 두 테이블을 연결하는 네 번째 JOIN 알고리즘으로 분류하지 않습니다.

## 행 위치를 합치기
책 목록에서 “과학 분야”와 “가격 1만 원 이하”를 각각 인덱스로 찾았다고 합시다. 두 결과는 책의 내용이 아니라 같은 책 테이블의 행 위치를 가리킵니다. BitmapAnd는 두 조건을 모두 만족하는 위치, BitmapOr는 어느 하나를 만족하는 위치를 모읍니다. Bitmap Heap Scan은 그 위치의 실제 행을 읽습니다.
```text
Bitmap Heap Scan on books
  -> BitmapAnd
       -> Bitmap Index Scan on books_category_idx
       -> Bitmap Index Scan on books_price_idx
```

AND 조건이 있다고 항상 BitmapAnd가 나오는 것은 아닙니다. 한 인덱스로 찾고 나머지는 Filter로 처리하거나, 복합 인덱스를 쓰거나, Seq Scan을 고를 수도 있습니다. 이 그림은 가능한 구조입니다.

## JOIN 안에 Bitmap이 들어갈 수 있다
```text
Hash Join
  -> Bitmap Heap Scan on orders
       -> BitmapOr
            -> Bitmap Index Scan ...
            -> Bitmap Index Scan ...
  -> Hash
       -> Seq Scan on students
```

Bitmap은 orders 후보를 읽고 Hash Join은 orders와 students를 연결합니다. 역할이 다른 노드가 같은 트리에 공존합니다. “인덱스 두 개의 결과를 합친다”는 표현과 관계 JOIN을 혼동하지 않습니다.

## 심화 관찰: 순서와 재확인
Bitmap으로 읽으면 원래 인덱스의 키 순서는 보존되지 않습니다. 메모리가 부족하면 페이지 단위의 lossy bitmap이 생길 수 있습니다. Heap Blocks의 exact/lossy, Rows Removed by Index Recheck를 확인합니다. Recheck Cond가 표시된 사실만으로 실제 lossy가 발생했다고 단정하지 않습니다.
[인덱스 결합 공식 문서](https://www.postgresql.org/docs/18/indexes-bitmap-scans.html), [Bitmap Heap Scan 실행 코드](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/executor/nodeBitmapHeapscan.c)를 참고합니다. [Lab](labs.md)에는 실제 BitmapOr를 관측한 쿼리가 있습니다.
