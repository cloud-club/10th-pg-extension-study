# PostgreSQL과 InnoDB의 인덱스 구조 비교

> **핵심 질문:** 같은 행을 인덱스로 찾을 때, PostgreSQL과 MySQL의 InnoDB는 실제 행을 어디에 두고 인덱스에서 어떻게 찾아갈까?

## 한 줄 요약

**일반적인 PostgreSQL 테이블은 heap에 행을 저장하고 인덱스가 행 위치를 가리킨다. InnoDB는 기본 키 인덱스의 리프 페이지에 행 데이터를 저장한다.** 따라서 같은 보조 인덱스 검색도 PostgreSQL은 `인덱스 → heap 행`, InnoDB는 `보조 인덱스 → 기본 키 → clustered index의 행`으로 이어질 수 있다.

## 먼저 범위부터

여기서 말하는 **MySQL은 InnoDB 스토리지 엔진**을 뜻한다. MySQL은 스토리지 엔진을 선택할 수 있으므로, InnoDB의 동작을 MySQL 전체의 공통 규칙으로 일반화하지 않는다.

또한 PostgreSQL 설명은 기본 테이블 저장 방식인 heap과 일반적인 B-tree 인덱스를 기준으로 한다. PostgreSQL은 여러 인덱스 접근 방법을 제공하므로, 모든 PostgreSQL 인덱스가 같은 자료구조인 것은 아니다.

## 1. 인덱스와 행은 어디에 저장될까?

### PostgreSQL: heap과 인덱스가 별도

일반적인 PostgreSQL 테이블에서는 행(tuple)이 heap에 저장되고, B-tree 인덱스는 검색 키와 행 위치를 가리키는 TID(Page 번호와 페이지 안의 항목 위치)를 관리한다. 인덱스 검색으로 TID를 찾은 뒤 heap에서 행을 읽는다.

- 기본 키는 중복을 막는 제약과 이를 구현하는 unique index를 만든다.
- 하지만 기본 키가 테이블 행의 물리적 저장 순서를 결정하지는 않는다.
- 한 테이블에 여러 인덱스를 둘 수 있고, 각 인덱스는 같은 heap을 서로 다른 키로 탐색한다.

### InnoDB: 기본 키 인덱스가 행을 담음

InnoDB의 **clustered index**는 단순히 행의 위치를 가리키는 색인이 아니라, 행 데이터 자체를 저장하는 인덱스다. 보통 기본 키가 clustered index가 된다.

- 기본 키를 지정하지 않았으면 InnoDB는 적절한 `UNIQUE NOT NULL` 인덱스를 찾고, 그것도 없으면 내부용 clustered index를 만든다.
- 보조 인덱스의 레코드에는 보조 키와 함께 해당 행의 기본 키 값이 들어간다.
- 기본 키가 긴 테이블은 기본 키 값이 보조 인덱스들에도 들어가므로, 보조 인덱스 공간이 커질 수 있다.

| 비교 | PostgreSQL 기본 heap 테이블 | MySQL InnoDB |
| --- | --- | --- |
| 행 데이터 저장 위치 | heap | 기본 키의 clustered index 리프 |
| 기본 키가 행 저장 순서를 정하나? | 아니오 | 보통 그렇다 |
| 보조 인덱스가 행으로 가는 방법 | heap의 TID를 통해 접근 | 보조 인덱스의 기본 키 값으로 clustered index 탐색 |
| 기본 키 길이의 보조 인덱스 영향 | InnoDB처럼 기본 키가 모든 보조 인덱스의 행 locator가 되지는 않음 | 기본 키가 보조 인덱스에 포함되어 공간에 영향 |

### 저장 방식과 인덱스 종류는 서로 다른 축

**heap vs clustered index**는 행을 어디에 두고 인덱스에서 어떻게 찾아가는지에 대한 차이다. **B-tree, GIN, GiST, BRIN**은 어떤 검색 조건을 어떤 인덱스 자료구조로 빠르게 처리하는지에 대한 차이이므로, 두 분류를 같은 축으로 비교하면 안 된다.

PostgreSQL의 대표 인덱스 접근 방식은 다음과 같다.

| 종류 | 잘 맞는 검색의 예 |
| --- | --- |
| B-tree | 일반적인 동등 비교, 범위 비교, 정렬 |
| Hash | 동등 비교 |
| GIN | 배열·전문 검색처럼 한 행에서 여러 검색 키가 나오는 경우 |
| GiST / SP-GiST | 공간·범위 등 연산자별 검색 전략과 특수한 자료 구조 |
| BRIN | 물리적으로 가까운 행들의 값이 서로 상관된 대용량 테이블에서 블록 범위 요약으로 후보를 찾는 경우 |

기본 선택은 B-tree지만, 데이터 타입·연산자·검색 형태에 따라 다른 방식이 더 맞을 수 있다. PostgreSQL은 operator class나 확장을 통해 특수한 검색과 인덱스 기능을 추가할 수 있다. 이것은 InnoDB의 clustered index 부재를 보완하는 기능이 아니라, **검색 가능한 데이터와 검색 연산을 넓히는 확장성**이다.

## 2. 같은 검색을 두 엔진에서 따라가기

다음 쿼리가 `customer_id` 보조 인덱스를 사용한다고 해보자.

```sql
SELECT id, status
FROM orders
WHERE customer_id = 42;
```

### PostgreSQL의 일반적인 경로

```text
customer_id B-tree 인덱스
  → 일치하는 인덱스 항목과 TID
  → heap에서 해당 tuple 확인
  → MVCC 가시성 확인 후 반환
```

인덱스에 쿼리가 필요한 컬럼이 모두 들어 있는 covering index라면 heap 접근을 피할 수도 있다. 다만 PostgreSQL은 MVCC 가시성 확인이 필요하므로, 해당 heap page가 visibility map에서 all-visible로 표시되어야 실제 heap 방문을 생략할 수 있다. 따라서 PostgreSQL의 `Index Only Scan`은 “인덱스에 컬럼이 다 있다”만으로 항상 heap을 전혀 읽지 않는다는 뜻은 아니다.

### InnoDB의 일반적인 경로

```text
customer_id 보조 인덱스
  → customer_id + 기본 키 값
  → 기본 키 clustered index 탐색
  → 행 데이터 반환
```

조회에 필요한 값이 보조 인덱스 안에 모두 있으면 covering index가 되어 clustered index까지 가지 않고 결과를 얻을 수도 있다. 그렇지 않으면 보조 인덱스에서 기본 키를 얻고 실제 행이 있는 clustered index를 추가로 찾는다.

**핵심은 “어느 쪽이 항상 한 번 덜 읽는다”가 아니다.** 반환할 컬럼, 인덱스 구성, 캐시 적중, 데이터 분포, 실행 계획에 따라 실제 비용이 달라진다.

## 3. 범위 검색과 물리적 지역성

InnoDB에서는 기본 키 범위로 탐색할 때 clustered index를 따라가며 행 데이터를 함께 읽을 수 있다. 그래서 기본 키 순서의 범위 조회에 물리적 지역성이 유리할 수 있다.

PostgreSQL은 기본 키 인덱스의 순서와 heap의 행 배치가 자동으로 계속 일치하지 않는다. PostgreSQL의 `CLUSTER` 명령을 실행하면 기존 인덱스 순서대로 테이블을 한 번 재배치할 수 있지만:

- 한 번의 재배치이지, 이후 쓰기까지 순서를 계속 유지하는 구조는 아니다.
- 실행 중 테이블에 `ACCESS EXCLUSIVE` 잠금을 잡는다.
- 물리적 순서를 다시 얻으려면 필요할 때 재실행해야 한다.

그러므로 PostgreSQL에서 “기본 키 인덱스가 있으니 행도 기본 키 순으로 저장되어 있다”고 보면 안 된다.

## 4. UPDATE와 MVCC는 인덱스에 어떤 차이를 만들까?

### PostgreSQL

PostgreSQL의 UPDATE는 일반적으로 heap에 새 tuple 버전을 만든다. 인덱스가 가리키는 위치와 heap tuple의 버전·가시성 관리는 함께 고려해야 한다.

다만 매 UPDATE마다 모든 인덱스에 새 항목을 추가하는 것은 아니다. 다음 조건을 만족하면 **HOT (Heap-Only Tuple)** 최적화를 사용할 수 있다.

1. UPDATE가 인덱스가 참조하는 컬럼을 바꾸지 않는다. (요약 인덱스에는 예외 규칙이 있다.)
2. 새 tuple을 기존 행과 같은 heap page에 넣을 공간이 있다.

HOT이 가능하면 새 인덱스 항목을 만들 필요가 줄어든다. 반대로 인덱스 대상 컬럼이 바뀌거나 페이지 공간이 부족하면 일반적인 비-HOT 경로가 되어 인덱스 작업과 나중의 정리가 더 필요할 수 있다.

### InnoDB

InnoDB의 현재 행은 clustered index 쪽에 있고, 이전 값을 복원하는 데 필요한 변경 정보는 Undo Log에 기록된다. 보조 인덱스 대상 컬럼이 바뀌면 보조 인덱스도 변경 대상이 된다. 더는 어떤 consistent read도 필요로 하지 않는 과거 Undo 정보는 purge 대상으로 정리된다.

이는 앞서 공부한 MVCC 차이와 연결된다.

```text
PostgreSQL: heap 안의 tuple version + VACUUM
InnoDB: clustered record + Undo 기록 + Purge
```

두 엔진 모두 인덱스가 있지만, 행의 현재 버전과 과거 버전을 두는 방식이 다르므로 UPDATE와 오래된 버전 정리의 운영 특성도 달라진다.

## 5. PostgreSQL에서 VACUUM, CLUSTER, pg_repack은 각각 뭘 할까?

| 기능 | 하는 일 | 파일·순서에 미치는 영향 | 잠금·용도 |
| --- | --- | --- | --- |
| `VACUUM` / autovacuum | 더는 보이지 않는 tuple을 정리하고 공간을 재사용 가능하게 표시 | 대체로 테이블 파일을 작게 다시 쓰거나 인덱스 순서를 유지하는 작업은 아님 | 기본적인 정기 유지보수 |
| `CLUSTER` | 인덱스 순서로 테이블 heap을 다시 배치 | 테이블을 재작성하고 물리적 순서를 한 번 맞춤 | 작업 동안 강한 테이블 잠금이 필요 |
| `VACUUM FULL` | 테이블을 새 파일로 다시 써서 빈 공간을 압축 | 테이블 크기를 줄일 수 있지만 인덱스 순서로 배치한다는 뜻은 아님 | 강한 테이블 잠금을 작업 동안 유지 |
| `REINDEX` | 인덱스를 다시 생성 | 인덱스만 재작성; heap 행 배치를 정렬하지 않음 | 인덱스 bloat·손상 등의 정비에 사용 |
| `pg_repack` | 테이블·인덱스를 새로 구성해 bloat를 줄임; 선택적으로 지정한 순서로 재배치 | 온라인 `CLUSTER` 또는 온라인 재작성에 가까운 작업을 지원 | 대부분의 처리 중에는 읽기·쓰기를 허용하고, 마무리 교체에는 짧은 잠금이 필요할 수 있음 |

일반 `VACUUM`은 죽은 tuple의 공간을 재사용 가능하게 만들지만, 보통 그 공간을 운영체제에 돌려주거나 테이블 전체를 촘촘히 압축하지는 않는다. 반대로 `VACUUM FULL`과 `CLUSTER`는 테이블을 다시 쓰지만 강한 잠금 부담이 있다.

### `pg_repack`은 무엇을 해결하나?

`pg_repack`은 PostgreSQL에 clustered index를 추가하지 않는다. 테이블과 인덱스에 bloat가 쌓였거나, 테이블을 다시 정리·재배치하고 싶은데 장시간 강한 잠금을 피해야 할 때 고려하는 **운영·유지보수 확장**이다. 대상 테이블의 변경을 추적하면서 새 사본을 만들고 마지막에 교체하는 방식으로 동작한다.

- 테이블과 인덱스의 bloat 정리에 사용할 수 있다.
- 옵션에 따라 인덱스 순서나 지정한 컬럼 순서로 행을 재배치할 수 있다.
- 일반 `CLUSTER`처럼 다음 UPDATE 이후에도 물리적 순서를 보장하지는 않는다.
- 대상 테이블에는 보통 primary key 또는 적절한 unique key가 필요하다.
- 작업 중 상당한 추가 디스크 공간이 필요할 수 있고, 대상 테이블의 DDL을 동시에 수행할 수 없는 등의 제약이 있다. AWS 가이드는 테이블과 인덱스 사용량에 준하는 추가 여유 공간을 고려하도록 안내한다.

**인지도 측면에서는** 오래 유지되는 잘 알려진 PostgreSQL 운영 확장이지만, PostgreSQL 코어 기능도 아니고 모든 서비스가 반드시 설치해야 하는 확장도 아니다. `autovacuum`을 대신하는 것도 아니다. bloat와 정비 시간·잠금 요구를 확인한 뒤 선택하는 도구다. AWS도 RDS/Aurora 유지보수 가이드에서 `pg_repack`을 별도 정비 방법으로 다루며, `VACUUM FULL`보다 잠금 구간을 줄이는 대신 키와 여유 공간 등의 조건이 있음을 설명한다.

## 6. 인덱스 관련 확장은 모두 같은 문제를 푸는 게 아니다

| 확장 | 주된 목적 | clustered index 차이와의 관계 |
| --- | --- | --- |
| [`pg_repack`](https://github.com/reorg/pg_repack) | 테이블·인덱스 재구성, bloat 정리, 선택적 물리 재배치 | 저장 구조를 바꾸진 않지만 정비 부담을 줄이는 운영 도구 |
| [`HypoPG`](https://github.com/HypoPG/hypopg) | 가상 인덱스를 만들어 실제 생성 전 `EXPLAIN`에서 쓸모를 검토 | heap/clustered index 차이를 보완하는 도구는 아님; 인덱스 설계 실험용 |

HypoPG는 “이 인덱스를 만들면 planner가 실행 계획을 바꿀까?”를 실제 디스크 인덱스를 만들지 않고 살펴보는 확장이다. `pg_repack`과는 문제 영역이 다르다.

## 7. 오해하면 안 되는 점

- **“InnoDB만 인덱스가 있다”가 아니다.** 두 엔진 모두 다양한 인덱스를 지원하며, 기본 저장·행 탐색 구조가 다르다.
- **“PostgreSQL 기본 키가 clustered index다”가 아니다.** 기본 키는 unique index와 제약을 제공하지만 heap의 저장 순서를 고정하지 않는다.
- **“PostgreSQL의 `CLUSTER`가 InnoDB clustered index와 같다”가 아니다.** `CLUSTER`는 일회성 재배치 명령이다.
- **“`pg_repack`이 InnoDB 구조를 PostgreSQL에 구현한다”가 아니다.** 재배치·재작성 작업을 더 운영 친화적으로 하는 확장이다.
- **“인덱스 스캔은 항상 빠르다”가 아니다.** 읽어야 할 행이 많으면 순차 스캔이 더 유리할 수 있고, 최종 판단은 실제 데이터와 `EXPLAIN` 계획으로 해야 한다.

## 8. 이 주제를 공부하고 설명할 수 있어야 하는 것

1. PostgreSQL의 기본 키 인덱스가 행의 저장 위치를 결정하지 않는 이유를 말한다.
2. InnoDB의 secondary index 조회가 왜 기본 키 clustered index로 한 번 더 갈 수 있는지 설명한다.
3. PostgreSQL의 covering/index-only scan과 visibility map의 관계를 설명한다.
4. UPDATE에서 PostgreSQL의 HOT이 가능한 조건과 인덱스 갱신 비용의 관계를 설명한다.
5. `VACUUM`, `CLUSTER`, `VACUUM FULL`, `REINDEX`, `pg_repack`의 역할을 구분한다.
6. `pg_repack`이 유용한 상황과 InnoDB clustered index의 대체재가 아닌 이유를 설명한다.

## Sources

- [MySQL 8.4 Reference Manual — Clustered and Secondary Indexes](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html)
- [MySQL 8.4 Reference Manual — InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)
- [PostgreSQL 18 — Index Types](https://www.postgresql.org/docs/18/indexes-types.html)
- [PostgreSQL 18 — Index Scanning](https://www.postgresql.org/docs/18/index-scanning.html)
- [PostgreSQL 18 — Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/18/indexes-index-only-scans.html)
- [PostgreSQL 18 — Heap-Only Tuples (HOT)](https://www.postgresql.org/docs/18/storage-hot.html)
- [PostgreSQL 18 — CLUSTER](https://www.postgresql.org/docs/18/sql-cluster.html)
- [PostgreSQL 18 — Routine Vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
- [pg_repack — upstream project and documentation](https://github.com/reorg/pg_repack)
- [AWS Prescriptive Guidance — Removing bloat with pg_repack](https://docs.aws.amazon.com/prescriptive-guidance/latest/postgresql-maintenance-rds-aurora/pg-repack.html)
- [HypoPG — upstream project](https://github.com/HypoPG/hypopg)
