# 기본 04 · Merge Join: 정렬된 명단 함께 읽기

## 이미 번호순이라면
두 명단이 학생 번호순으로 정렬되어 있다면 작은 번호 쪽을 앞으로 움직이며 같은 번호를 만날 수 있습니다. Merge Join은 mergejoinable한 조건과 호환되는 입력 정렬을 사용합니다. 일반적인 사용 예는 동등 조건입니다. SQL에 부등호를 썼다고 정렬만 해서 Merge Join을 할 수 있다고 가정하지 않습니다.

```text
Merge Join
  Merge Cond: (s.id = o.student_id)
  -> Index Scan on students ...   ← 키 순서를 제공할 수 있음
  -> Sort                        ← 키 순서가 없어서 준비
       Sort Key: o.student_id
       -> Seq Scan on orders o
```

계획의 Sort가 없더라도 입력은 인덱스 또는 하위 노드에서 필요한 순서를 제공할 수 있습니다. 최종 결과 순서를 보장받으려면 SQL에 ORDER BY를 씁니다.

## 정렬 비용까지 비교하기
이미 정렬된 두 입력을 전진하는 단순 모델은 입력 크기와 출력 크기에 비례합니다. 하지만 Sort를 먼저 해야 한다면 정렬 시간과 공간을 지불합니다. Sort Method가 quicksort인지 external merge인지, Memory 또는 Disk가 얼마인지 확인합니다.
키가 양쪽에 반복되면 같은 키 그룹의 모든 행 쌍을 만들어야 합니다. 중복 그룹을 다시 읽는 과정이 있어 “각 행을 무조건 딱 한 번 읽는다”는 설명은 불완전합니다. Materialize가 보이면 재사용되는 입력과 추가 보관 비용을 조사합니다.

## 인덱스가 있다고 정렬을 항상 피할까?
필요한 키 순서와 인덱스 순서가 맞아야 하고, 그 인덱스를 통해 행을 가져오는 전체 비용도 비교합니다. Seq Scan 후 Sort가 더 저렴할 수 있습니다. JOIN 뒤 GROUP BY·ORDER BY가 필요한 계획에서는 입력 순서의 재사용도 살펴봅니다.
[인덱스와 ORDER BY](https://www.postgresql.org/docs/18/indexes-ordering.html), [Merge Join 실행 코드](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/executor/nodeMergejoin.c)를 참고합니다. [Lab](labs.md)에서 Sort가 포함된 계획을 직접 읽습니다.
