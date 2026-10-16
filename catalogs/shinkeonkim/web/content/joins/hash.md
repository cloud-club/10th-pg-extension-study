# 기본 03 · Hash Join: 번호별 상자 만들기

## 만들고 찾는 두 단계
주문을 학생 번호별 상자에 모아 놓으면 각 학생은 자기 번호 상자에서 주문을 찾을 수 있습니다. Hash Join은 build 입력으로 해시 테이블을 만들고 probe 입력으로 일치 항목을 찾습니다. 해시 값만 같다고 확정하지 않고 실제 JOIN 조건을 확인합니다.

```text
Hash Join
  Hash Cond: (o.student_id = s.id)
  -> Seq Scan on orders o       ← probe
  -> Hash                      ← build 준비
       -> Seq Scan on students s
```

이 그림은 예시입니다. 실행 계획에서 Hash 아래를 읽어 build 쪽을 확인하며 SQL의 왼쪽·오른쪽 순서로 추측하지 않습니다. hashable한 동등 조건이 핵심이며 일반적인 부등호 JOIN의 만능 방법은 아닙니다.

## 중복과 행 폭
한 키의 build 행이 여러 개면 probe 행 한 개가 여러 결과를 만듭니다. 해시 테이블이 입력을 한 행씩만 보존한다고 생각하면 다대다 결과를 놓칩니다. 키와 필요한 출력 컬럼이 차지하는 공간도 중요합니다. 작은 행 10만 개와 긴 문자열을 포함한 행 10만 개는 같은 메모리를 요구하지 않습니다.

## 메모리에 들어가지 않는다면
Hash 노드의 Buckets·Batches·Memory Usage를 확인합니다. Batches가 여러 개이면 데이터를 나누어 처리하며 임시 파일 I/O가 생길 수 있습니다. BUFFERS의 temp read/written도 같이 봅니다. 입력 추정 오차 때문에 실행 중 배치 수가 바뀌기도 합니다.
해시 작업의 메모리 한도는 work_mem과 hash_mem_multiplier의 영향을 받습니다. work_mem은 연결 하나의 총 메모리 한도가 아닙니다. JOIN·정렬 노드가 여러 개이고 동시 쿼리와 병렬 worker가 있으면 전체 사용량은 더 커집니다.

## 흔한 오해와 다음 질문
큰 테이블이면 무조건 Hash Join이라는 규칙은 없습니다. build 준비 비용, 제한된 출력, 정렬된 입력, 인덱스 탐색과 비교해야 합니다. 우선 Batches가 1인지, 불필요한 컬럼을 들고 있는지, 추정 행 수가 맞는지 조사합니다.
[메모리 설정 공식 문서](https://www.postgresql.org/docs/18/runtime-config-resource.html), [Hash Join 실행 코드](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/executor/nodeHashjoin.c)를 참고합니다. [심화](planning.md)와 [실습](labs.md)으로 이어집니다.
