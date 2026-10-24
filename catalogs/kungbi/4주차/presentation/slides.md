# 발표 원고 — 같은 UPDATE, 다른 인덱스 비용

> **부제:** PostgreSQL의 heap/TID와 InnoDB의 clustered/secondary index

- 범위: PostgreSQL 18의 일반 heap 테이블·B-tree, MySQL 8.4의 InnoDB
- 중심 질문: **인덱스는 행을 무엇으로 찾아가며, 행이 바뀔 때 무엇을 고쳐야 할까?**
- 전제: MVCC의 기본 구조를 먼저 살펴봤다고 가정한다. 오늘은 같은 내용을 인덱스 관점에서 이어 본다.
- 구성: 공통 조회 경로를 먼저 확인한 뒤, **MVCC 차이가 인덱스에 미치는 영향**과 **이번 인덱스 학습에서 새로 확인한 구조·탐색 최적화**를 구분한다.
- 연결 자료: [PostgreSQL과 InnoDB의 인덱스 구조 비교](../indexes-postgresql-innodb.md)

---

## 슬라이드 1. 인덱스는 행을 어떻게 찾고, UPDATE 때 무엇을 고칠까?

### 화면에 보여줄 내용

```text
PostgreSQL: 인덱스 → TID → heap의 행 버전
InnoDB:     보조 인덱스 → PK → clustered index의 행
```

**핵심:** 행을 찾아가는 기준이 다르기 때문에 UPDATE 때 인덱스를 유지하는 방법도 달라진다.

### 발표 멘트

지난번에는 두 데이터베이스가 MVCC에서 과거 버전을 어떻게 관리하는지 살펴봤습니다. 이번에는 먼저 PostgreSQL과 InnoDB의 인덱스 조회 경로를 공통 바탕으로 확인하고, 내용을 두 갈래로 나누겠습니다. 첫째는 MVCC 차이가 UPDATE와 인덱스 유지에 미치는 영향, 둘째는 이번에 새로 공부한 인덱스 구조와 접근 최적화입니다. 같은 주문을 하나 정해 두고 조회와 UPDATE를 따라가겠습니다.

---

> **공통 바탕 · 슬라이드 2–4:** 인덱스가 행을 찾아가는 경로

## 슬라이드 2. 먼저 구분할 세 가지

### 화면에 보여줄 내용

| 구분 | 주문 예시 | 뜻 |
| --- | --- | --- |
| 논리적 행 | 주문 `id=9001` | 우리가 생각하는 주문 한 건 |
| 행 버전 | `paid`였던 모습, `shipped`인 모습 | UPDATE 전·후의 저장 상태 |
| 인덱스 항목 | `customer_id=42 → 찾아갈 정보` | 검색 키와 행을 찾는 정보의 연결 |

### 발표 멘트

헷갈림을 줄이려면 행, 행 버전, 인덱스 항목을 나눠야 합니다. 고객 42번의 주문 9001번은 논리적으로 계속 같은 주문입니다. 상태를 바꾸면 데이터베이스 내부에는 변경 전후의 행 버전이 생길 수 있습니다. 인덱스 항목은 그 행을 검색할 때 쓰는 별도의 길 안내라고 생각하면 됩니다. 뒤에서 말하는 ‘새 항목’이 새 주문을 뜻하는 것은 아닙니다.

---

## 슬라이드 3. TID는 heap의 주소다

### 화면에 보여줄 내용

```text
customer_id 인덱스
  42 ─────────→ TID (8, 3)
                       │
                       ▼
heap 8번 페이지
  item 1: 다른 행
  item 3: id=9001, customer_id=42, status=paid
```

- **TID = Tuple Identifier**
- heap: 테이블 행을 저장하는 영역
- TID: 페이지 번호 + 페이지 안 항목 번호

### 발표 멘트

TID는 Tuple Identifier, 즉 튜플 식별자입니다. PostgreSQL의 일반적인 B-tree 항목은 검색 값과 행 버전의 TID를 연결합니다. 여기서는 `customer_id=42`를 찾아 TID `(8,3)`을 얻고, heap의 8번 페이지에서 세 번째 항목을 읽습니다. TID가 행 데이터를 담고 있는 게 아니라, heap에서 행을 찾을 위치를 알려주는 겁니다. `ctid`도 행 버전의 물리적 위치라 UPDATE 후 바뀔 수 있으므로, 계속 유지되는 주문 번호로 쓰면 안 됩니다.[20][21]

---

## 슬라이드 4. PK 검색에서 PostgreSQL과 InnoDB는 어떻게 다를까?

### 화면에 보여줄 내용

```text
PK 검색:  SELECT status FROM orders WHERE id = 9001;
PG:       PK B-tree → TID (페이지, 항목) → heap 행
InnoDB:   clustered PK B-tree → 리프의 행 레코드

보조 키 검색:  SELECT status FROM orders WHERE customer_id = 42;
PG:           보조 B-tree → TID → heap 행
InnoDB:       보조 B-tree → PK → clustered PK B-tree → 행 레코드
```

> **TID는 또 다른 인덱스가 아니다.** heap 페이지와 페이지 안 항목을 가리키는 위치 정보다.

### 발표 멘트

PK 검색부터 보면, PostgreSQL도 `id`용 B-tree를 탐색합니다. 그 인덱스가 반환하는 TID는 heap의 페이지 번호와 항목 번호이므로, TID를 검색하는 두 번째 인덱스를 타는 게 아닙니다. 그 위치로 heap 페이지를 직접 찾아갑니다. InnoDB는 PK 자체가 clustered index이므로, B-tree의 리프에 행 레코드가 있습니다. 따라서 일반적으로 다른 컬럼까지 읽는 PK 조회의 구조 경로는 PostgreSQL이 `PK 인덱스 → heap`, InnoDB가 `clustered PK 인덱스 → 행`입니다. PostgreSQL 쪽에 별도 heap 접근이 있다는 뜻이지, TID용 B-tree를 한 번 더 탐색한다는 뜻은 아닙니다.[5][21]

보조 키 검색에서는 양쪽 다 처음 찾은 보조 인덱스에서 실제 행으로 가는 후속 접근이 있습니다. PostgreSQL은 TID로 heap 페이지를 직접 찾고, InnoDB는 보조 인덱스에서 얻은 PK로 clustered index를 다시 탐색합니다. 이 경로 수만으로 실제 디스크 I/O나 어느 쪽이 더 빠른지를 단정할 수는 없습니다. 이제 이 구조가 UPDATE와 MVCC 버전 관리에서 어떻게 이어지는지 살펴보겠습니다.[5]

---

> **1부 · 슬라이드 5–8:** MVCC 차이가 행 버전과 인덱스 유지에 미치는 영향

## 슬라이드 5. PostgreSQL UPDATE는 새 행 버전을 만든다

### 화면에 보여줄 내용

현재 인덱스: `id`, `customer_id` — `status`는 인덱스에 없음.

```sql
UPDATE orders
SET status = 'shipped'
WHERE id = 9001;
```

```text
같은 논리적 주문 id=9001
  이전 버전: status=paid
  새 버전:   status=shipped
```

### 발표 멘트

이 UPDATE는 상태만 바꿨지만, PostgreSQL은 MVCC를 위해 같은 주문의 새 행 버전을 만듭니다. 여기서 “새 행 버전”은 새로운 주문이 아니라, 같은 논리적 주문의 변경 후 모습입니다. 인덱스가 가리키는 위치가 새 TID로 달라질 수 있습니다. 따라서 일반 UPDATE라면 값이 그대로인 인덱스도 새 버전을 가리키는 항목을 추가해야 할 수 있습니다.[21]

---

## 슬라이드 6. HOT은 새 버전은 만들고 인덱스 항목은 재사용한다

### 화면에 보여줄 내용

조건: 인덱스가 참조하는 컬럼은 그대로 + 같은 heap 페이지에 새 버전 공간이 있음

```text
customer_id 인덱스
  42 → TID (8,3)
          │
          ▼
heap page 8
  (8,3) paid ──→ shipped
       기존 위치    새 행 버전
```

- HOT = Heap-Only Tuple
- 새 행 버전은 생성
- 새 인덱스 항목은 만들지 않음

### 발표 멘트

HOT은 새 행 버전을 만들지 않는 기능이 아닙니다. 인덱스가 참조하는 컬럼을 바꾸지 않고, 같은 heap 페이지에 새 버전을 넣을 공간이 있을 때, 새 인덱스 항목을 만들지 않는 최적화입니다. 기존 인덱스 항목의 TID에서 같은 페이지 안의 행 버전 연결을 따라갑니다. 연결리스트와 비슷한 면은 있지만, 중요한 요점은 “같은 페이지 안의 버전 연결을 이용해 인덱스 항목을 재사용한다”는 겁니다. 인덱스가 참조하는 컬럼이 바뀌거나 페이지 공간이 부족하면 HOT이 안 될 수 있습니다.[8]

---

## 슬라이드 7. InnoDB의 현재 행과 Undo

### 화면에 보여줄 내용

```text
clustered index의 현재 레코드
  id=9001, status=shipped
         │ Undo 정보
         ▼
이전 값을 복원: status=paid
```

- clustered record: 기본 키 인덱스 리프의 현재 행 레코드
- Undo: 이전 버전을 복원하거나 롤백하는 데 필요한 변경 정보

### 발표 멘트

InnoDB의 clustered record는 기본 키 인덱스의 리프에 있는 행 레코드입니다. 행이 UPDATE되면 clustered record가 갱신되고, 이전 상태를 복원하는 데 필요한 정보가 Undo에 기록됩니다. 새 값을 볼 수 없는 일관된 읽기는 Undo를 이용해 이전 모습을 만들 수 있습니다. Undo는 보통 테이블에 과거 행을 그대로 한 줄씩 계속 쌓아두는 별도 행 테이블이라는 뜻이 아니라, 이전 버전을 복원하는 데 필요한 변경 정보를 보관하는 구조입니다.[5][6]

---

## 슬라이드 8. InnoDB 보조 인덱스 키를 바꾸면 새 주문이 생기나?

### 화면에 보여줄 내용

전제: `status`에도 보조 인덱스가 있음.

```text
변경 전: (paid, PK=9001)

status: paid → shipped

변경 뒤:
  (paid, PK=9001)       삭제 표시 → 나중에 purge
  (shipped, PK=9001)    새 인덱스 항목
```

**새로 생긴 것:** 인덱스 레코드\
**새로 생기지 않은 것:** 논리적 주문 행

### 발표 멘트

보조 인덱스의 키 값이 바뀌면 InnoDB는 기존 `(paid, PK=9001)` 항목을 삭제 표시하고 새 값 위치에 `(shipped, PK=9001)` 항목을 넣습니다. 이건 새 주문을 만드는 게 아니라 검색 경로를 갱신하는 겁니다. 예전 인덱스 항목은 더는 필요하지 않을 때 purge로 정리되고, 과거 행 버전은 Undo가 담당합니다. 반대로 `status`가 인덱스에 없고 PK도 그대로라면, `customer_id` 보조 인덱스의 항목 자체는 보통 바꿀 이유가 없습니다.[6]

---

> **2부 · 슬라이드 9–12:** MVCC와 구분해서 보는 인덱스 구조·접근 최적화

## 슬라이드 9. 인덱스의 중복 키는 어떻게 관리할까?

### 화면에 보여줄 내용

```text
논리적으로는 여러 항목:
  42 → TID A
  42 → TID B
  42 → TID C

B-tree deduplication 예:
  42 → [TID A, TID B, TID C]
```

**Deduplication은 중복 행 삭제가 아니라 인덱스 저장 압축이다.**

### 발표 멘트

`customer_id=42`인 행이 많으면 인덱스에는 같은 키가 여러 번 나타날 수 있습니다. PostgreSQL B-tree의 deduplication은 같은 키를 여러 번 저장하는 대신, 키 하나와 여러 TID를 묶은 posting list로 표현해 공간을 줄일 수 있습니다. 행이나 행 버전을 합쳐 없애는 기능은 아닙니다.[9]

---

## 슬라이드 10. 순차 정수 PK와 무작위 UUIDv4

### 화면에 보여줄 내용

```text
AUTO_INCREMENT: 1001 → 1002 → 1003 → 1004
UUIDv4:         임의의 키 값이 생성됨
```

**이 비교에서 무작위 UUID는 UUIDv4다. UUIDv7처럼 시간순 정렬성을 둔 UUID는 별도 사례다.**[22]

| 차이 | InnoDB | PostgreSQL |
| --- | --- | --- |
| PK 트리 삽입 | clustered 행 저장에도 영향 | PK B-tree 삽입·페이지 유지에 영향 |
| heap 행 순서 | PK 순서와 연결 | PK 순서로 자동 유지되지 않음 |

**무작위 키도 B-tree 유지 비용이 있다. PostgreSQL도 예외가 아니다.**

### 발표 멘트

이 장에서 ‘무작위 UUID’는 UUIDv4를 뜻합니다. UUIDv4는 난수 또는 의사난수로 생성됩니다. 반면 UUIDv7은 상위 비트에 Unix 밀리초 타임스탬프를 두어 시간순 정렬성을 갖기 때문에 이 무작위 사례에 섞지 않습니다. 다만 v7도 같은 밀리초 안에서의 순서는 생성기 구현에 따라 달라질 수 있습니다.[22] InnoDB에서는 PK 순서가 clustered index의 행 저장 순서와 연결되므로, UUIDv4처럼 키 범위 여기저기에 삽입되는 키는 페이지 사용에 영향을 줍니다. PostgreSQL도 PK B-tree 자체는 유지해야 하고 페이지 분할이 생길 수 있지만, heap의 행을 PK 순서로 계속 배치하지는 않습니다. 그리고 AUTO_INCREMENT 정수와 UUIDv4를 비교하면 키 길이와 삽입 순서가 함께 달라지므로, 둘의 비용을 해석할 때는 이 두 요인을 구분해야 합니다. InnoDB에서는 PK가 보조 인덱스에도 들어가므로 키 길이도 공간에 영향을 줍니다.[5][9][10]

---

## 슬라이드 11. PostgreSQL·InnoDB의 순차 PK와 UUIDv4 실험을 나눠 읽자

### 화면에 보여줄 내용

| 실험 | 순차 정수 PK | UUIDv4 PK | 읽을 때 주의할 점 |
| --- | --- | --- | --- |
| MySQL 8.0.46 · InnoDB · Docker · 40만 행 [29] | BIGINT AUTO_INCREMENT: 6.8초; clustered 95.6MB + secondary 24.6MB; total 120.2MB | UUIDv4 BINARY(16): 193.3초; clustered 157.8MB + secondary 30.6MB; total 188.4MB | 64MB buffer pool, 행당 약 210B. I/O-bound 조건이며 키 폭·삽입 순서도 함께 달라진다. 조회 latency는 측정하지 않음 |
| PostgreSQL 16 · AWS RDS `db.r6g.large` · 100만 INSERT | 12.3초 · 인덱스 21MB | 18.7초 · 42MB | QueryPlane의 같은 글 안에 상충 수치가 있음 [26] |
| PostgreSQL · 1천만 행 | int8 인덱스 214MB | UUIDv4 인덱스 301MB | Cybertec: 인덱스 크기·index-only 조회, INSERT TPS 아님 ([출처](https://www.cybertec-postgresql.com/en/unexpected-downsides-of-uuid-keys-in-postgresql/)) |
| SQLite `WITHOUT ROWID` · 20만 INSERT | 0.290초 · DB 32.0MB | 0.924초 · 38.4MB | 64B payload, 실행 4회 중앙값; PostgreSQL 절대 수치 아님 [28] |

> **결론:** InnoDB와 PostgreSQL 사례는 서로 다른 실험이다. 삽입 시간·인덱스 크기·조회 시간도 따로 읽고, “UUIDv4는 항상 몇 배 느리다”로 일반화하지 않는다.

### 발표 멘트

InnoDB를 직접 비교한 사례도 추가했습니다. Kou의 실험은 MySQL 8.0.46 Docker 환경에서 InnoDB 테이블에 40만 행씩 넣고, 64MB buffer pool과 행당 약 210바이트를 사용했습니다. BIGINT AUTO_INCREMENT는 6.8초, clustered index 95.6MB·secondary index 24.6MB였고, UUIDv4 `BINARY(16)`은 193.3초, 각각 157.8MB와 30.6MB였습니다.[29] 원문은 약 28.5배 차이라고 보고하지만, buffer pool보다 데이터가 커서 I/O-bound가 되도록 만든 설정의 결과입니다. 키 폭과 무작위 삽입 순서가 함께 변했고 조회 latency는 측정하지 않았습니다. 따라서 이것은 InnoDB 안에서 키 방식을 비교한 실험이지 PostgreSQL과 InnoDB를 같은 조건으로 맞춘 교차 DB 비교는 아닙니다.

QueryPlane은 PostgreSQL 16, AWS RDS `db.r6g.large`에서 100만 행을 직접 삽입해 BIGINT 12.3초·인덱스 21MB와 UUIDv4 18.7초·42MB를 보고합니다.[26] 다만 같은 글의 앞부분에는 1천만 행으로 표시된 표와 45초·68초, 214MB·343MB라는 다른 숫자가 있어, 하나의 깔끔한 재현 실험처럼 받아들이면 안 됩니다.

Cybertec 자료는 1천만 행에서 int8 인덱스 214MB와 UUIDv4 인덱스 301MB를 비교하고 index-only `COUNT`도 측정했지만, 삽입 TPS 비교는 아닙니다.[27] 조회 시간 차이에는 인덱스 순서뿐 아니라 visibility-map 확인 비용도 포함됩니다. SQLite `WITHOUT ROWID` 실험은 64바이트 payload와 순차 `INTEGER`(BIGINT에 대응) 키를 사용해 UUIDv4와 클러스터드 B-tree 삽입을 비교하지만, PostgreSQL은 heap과 인덱스가 분리되어 있으므로 그 절대 수치를 PostgreSQL 성능으로 옮겨 말할 수 없습니다.[28]

따라서 발표에서는 InnoDB의 직접 삽입·인덱스 결과, QueryPlane의 PostgreSQL 직접 삽입 결과, Cybertec의 PostgreSQL 저장·조회 결과를 서로 다른 사례로 설명하겠습니다. SQLite 결과는 보조로 두고, 엔진 간 성능 우열이나 운영 성능은 같은 조건으로 별도 측정해야 한다고 선을 긋습니다.

---

## 슬라이드 12. 찾은 키가 실제 행의 이웃이라는 보장은 없다

### 화면에 보여줄 내용

```text
PostgreSQL
  TID: (3,2), (20,5), (8,1), (3,9)
  bitmap: page 3 {2,9} → page 8 {1} → page 20 {5}
  heap 방문: 3 → 8 → 20

InnoDB
  보조 인덱스가 찾은 PK: 31, 8, 57
  MRR 버퍼·정렬: 8, 31, 57 → clustered index 조회
```

**Bitmap / MRR: 접근 순서 최적화**\
**MVCC: 각 DB의 기존 버전·가시성 규칙대로 계속 판정**

### 발표 멘트

같은 고객의 주문을 보조 인덱스에서 찾더라도 실제 행 위치는 흩어져 있을 수 있습니다. PostgreSQL B-tree가 돌려주는 TID는 heap 페이지와 항목 위치입니다. Bitmap Index Scan은 `(페이지, 항목)` 위치를 모으고, Bitmap Heap Scan은 같은 페이지에 속한 항목을 묶어 페이지 순서로 방문합니다. 예시의 `(3,2)`와 `(3,9)`는 페이지 3에서 함께 처리하고, 다음으로 페이지 8, 20을 방문합니다. bitmap은 행 데이터를 옮기지 않고, 이번 조회에서 방문할 위치를 표시할 뿐입니다.[11]

InnoDB의 보조 인덱스는 행을 찾는 데 쓸 PK를 제공합니다. MRR은 이 PK들을 버퍼에 모아 정렬하고 clustered index를 그 순서대로 조회해 랜덤 접근을 줄이려 합니다. clustered index가 있어도 보조 인덱스로 찾은 여러 행이 서로 이웃한 위치에 있다는 보장은 없습니다.[15]

**이 최적화들은 MVCC 버전 관리 방식 자체를 바꾸지 않습니다.**

PostgreSQL은 bitmap이 정한 순서로 heap tuple을 가져온 뒤, 쿼리의 snapshot에 보이는 버전인지 확인합니다.[11][23]

InnoDB도 MRR로 clustered record를 읽은 뒤, snapshot에 과거 버전이 필요하면 Undo를 사용해 구성합니다.[6][15]

즉, Bitmap 대 MRR은 위치를 찾아가는 순서의 차이이고, MVCC의 본질적 차이는 PostgreSQL이 heap에 새 tuple version을 두는 방식과 InnoDB가 clustered record 및 Undo로 버전을 다루는 방식에 있습니다.[6][8]

---

## 슬라이드 13. 인덱스 설계는 읽기와 쓰기의 교환이다

### 화면에 보여줄 내용

| 선택 | 얻을 수 있는 것 | 같이 확인할 비용 |
| --- | --- | --- |
| PostgreSQL에서 인덱스 컬럼 추가 | 해당 조건 검색 지원 | 인덱스 크기·쓰기 비용 증가, HOT 제한 가능성 |
| InnoDB 보조 인덱스에 컬럼 추가 | 해당 조건 검색 지원 | 인덱스 유지 비용, 키 변경 시 항목 교체 |
| 순차적인 짧은 PK 설계 | 트리 페이지 사용·보조 인덱스 공간에 유리할 가능성 | 키 생성·분산·업무 요구와 함께 판단 |

### 발표 멘트

오늘의 결론은 어느 데이터베이스가 무조건 빠르다는 게 아닙니다. 인덱스를 추가하면 특정 조회를 지원할 수 있지만, 인덱스 크기와 쓰기 유지 비용도 늘어납니다. PostgreSQL에서는 인덱스가 참조하는 컬럼을 바꾸면 HOT이 제한될 수 있고, InnoDB에서는 보조 인덱스 키를 바꾸면 기존 항목을 표시하고 새 항목을 만들어야 할 수 있습니다. 실제 선택은 쿼리 패턴, 변경 빈도, 실행 계획과 데이터 분포를 확인해 결정해야 합니다.

### 마무리 질문

> 어떤 조회에 인덱스를 추가할 가치가 있을까? 읽기 이득과 쓰기·저장 공간 비용을 어떻게 확인할까?

---

## 발표를 마친 뒤 기억할 네 문장

1. **TID는 PostgreSQL heap 안의 행 버전을 찾는 위치 정보다.**[20][21]
2. **PostgreSQL의 HOT은 새 행 버전을 만들되, 조건이 맞으면 새 인덱스 항목을 생략한다.**[8]
3. **InnoDB의 Undo는 과거 버전을 복원하는 데 쓰인다.**[6]
4. **InnoDB 보조 인덱스의 새 항목은 새 주문이 아니라 새 검색 경로다.**[6]

## Sources

[5] <https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html> — MySQL 8.4 — Clustered and Secondary Indexes
[6] <https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html> — MySQL 8.4 — MVCC and Secondary Indexes
[8] <https://www.postgresql.org/docs/18/storage-hot.html> — PostgreSQL 18 — HOT
[9] <https://www.postgresql.org/docs/18/btree.html> — PostgreSQL 18 — B-tree Internals
[10] <https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html> — MySQL 8.4 — Physical Index Structure
[11] <https://www.postgresql.org/docs/18/indexes-bitmap-scans.html> — PostgreSQL 18 — Bitmap Scans
[15] <https://dev.mysql.com/doc/refman/8.4/en/mrr-optimization.html> — MySQL 8.4 — Multi-Range Read
[20] <https://www.postgresql.org/docs/18/ddl-system-columns.html> — PostgreSQL 18 — System Columns
[21] <https://www.postgresql.org/docs/18/indexam.html> — PostgreSQL 18 — Index Access Method Interface
[22] <https://www.rfc-editor.org/rfc/rfc9562.html> — RFC 9562 — Universally Unique IDentifiers (UUIDs)
[23] <https://www.postgresql.org/docs/18/mvcc-intro.html> — PostgreSQL 18 — Introduction to MVCC
[26] <https://queryplane.com/blog/uuid-vs-integer-ids-postgres> — QueryPlane — UUID vs Integer IDs in PostgreSQL (PG 16 benchmark)
[27] <https://www.cybertec-postgresql.com/en/unexpected-downsides-of-uuid-keys-in-postgresql> — Cybertec — Unexpected downsides of UUID keys in PostgreSQL
[28] <https://guidgenerator.com/engineering-blog/benchmark-uuid-vs-bigint-insert-query-speed> — GuidGenerator — UUID vs BIGINT SQLite benchmark
[29] <https://note.com/kodai_code/n/n32b866fd6b3f?hl=en> — Kou — MySQL 8.0.46 InnoDB AUTO_INCREMENT vs UUIDv4 benchmark
