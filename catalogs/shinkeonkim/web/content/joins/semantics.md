# 기본 01 · JOIN은 어떤 결과를 만드는가?

## 의미와 방법을 먼저 나누기
INNER·LEFT·RIGHT·FULL·CROSS는 원하는 결과의 의미입니다. Nested Loop·Hash·Merge는 그 결과를 계산하는 실행 방법입니다. 메뉴와 조리법이 다른 분류인 것과 같습니다.

```sql
WITH students(id, name) AS (VALUES (1, '민수'), (2, '지수')),
orders(student_id, item) AS (VALUES (1, '책'), (1, '펜'))
SELECT s.id, s.name, o.item
FROM students s LEFT JOIN orders o ON o.student_id = s.id
ORDER BY s.id, o.item;
```

민수는 주문이 두 개이므로 두 행이 나옵니다. 지수는 주문이 없어도 한 행이 남고 item은 NULL입니다. INNER JOIN이면 지수 행이 없습니다. JOIN은 중복을 자동으로 제거하지 않습니다.

## 결과의 크기를 생각하기
| SQL 의미 | 결과 |
| --- | --- |
| INNER | 조건에 맞는 행 쌍 |
| LEFT | 맞는 행 쌍 + 짝이 없는 왼쪽 행 |
| RIGHT | 맞는 행 쌍 + 짝이 없는 오른쪽 행 |
| FULL | 맞는 행 쌍 + 양쪽의 짝 없는 행 |
| CROSS | 가능한 모든 행 쌍 |

같은 키가 왼쪽에 3행, 오른쪽에 4행이면 그 키의 동등 JOIN 결과는 12행입니다. 이를 알고리즘 문제로 오해하면 인덱스를 추가해도 거대한 결과 자체의 비용은 남습니다. EXISTS는 짝의 존재만 묻기 때문에 같은 질문이 아닙니다. 계획에 Semi Join 또는 Anti Join이 나타날 수 있습니다.

## ON과 WHERE는 언제 다를까?
```sql
SELECT s.id, o.item FROM students s
LEFT JOIN orders o ON o.student_id = s.id AND o.item = '책';

SELECT s.id, o.item FROM students s
LEFT JOIN orders o ON o.student_id = s.id
WHERE o.item = '책';
```

첫 쿼리는 책 주문이 없는 학생도 보존합니다. 두 번째는 JOIN 후 WHERE를 적용하며 NULL item은 조건을 만족하지 않아 제거합니다. 최적화 전에 원하는 결과부터 확정해야 합니다. 위 쿼리는 students와 orders 테이블을 준비한 뒤 실행하는 별도 예시입니다.

## 확인 질문
학생을 한 명만 보여주려는 요구에 주문 JOIN을 쓰면 어떤 중복이 생길까요? “주문이 있는 학생”이라면 EXISTS가 의도를 더 직접적으로 표현합니다. 물리 알고리즘을 바꾸기 전에 행 수와 NULL 보존 규칙부터 확인합니다.
[테이블 표현식 공식 문서](https://www.postgresql.org/docs/18/queries-table-expressions.html), [서브쿼리와 EXISTS](https://www.postgresql.org/docs/18/functions-subquery.html)를 참고합니다. 다음은 [Nested Loop](nested-loop.md)입니다.
