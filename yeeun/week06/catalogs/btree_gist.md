# btree_gist

> PostgreSQL에서 일반 데이터 타입의 비교 연산을 GiST Index에서도 사용할 수 있도록 지원하는 Extension. `EXCLUDE` Constraint와 함께 사용하면 예약 시간 중복처럼 여러 조건이 동시에 충돌하는 데이터를 방지할 수 있다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | Indexing · Data Integrity |
| 주요 목적 | 일반 데이터 타입의 GiST Index 지원 |
| 주요 비교 대상 | B-tree Index, GiST Index, UNIQUE Constraint |
| 핵심 특징 | 서로 다른 비교 연산을 하나의 GiST Index에서 활용 |
| 주요 활용 | 예약 시간 중복 방지, 범위 충돌 방지 |
| 핵심 개념 | GiST, Range Type, EXCLUDE Constraint |
| 회차 | `week06` |
| 정리한 사람 | 김예은 |
| 문서 | [PostgreSQL btree_gist](https://www.postgresql.org/docs/current/btree-gist.html) |

## 한눈에 보는 흐름

```text
예약 시스템
  → 같은 회의실 + 시간 겹침 → 저장 불가
  → UNIQUE로는 범위 중복을 직접 표현하기 어려움
  → Range Type (시간 범위를 하나의 값)
  → EXCLUDE Constraint (충돌 Row 거부)
  → GiST Index
  → 일반 타입(=)도 GiST에서 필요
  → btree_gist
```

| 역할 | 무엇인지 |
| --- | --- |
| GiST | PostgreSQL Index Method |
| EXCLUDE | PostgreSQL 기본 Constraint |
| Range Type | 기본 제공 타입 (`tsrange` 등) |
| `btree_gist` | 일반 타입 비교를 GiST에서 쓰게 하는 Extension |

---

## 1. 어떤 문제를 해결하는가

회의실 예약:

| 회의실 | 시작 | 종료 | 허용? |
| --- | --- | --- | --- |
| A | 10:00 | 11:00 | — |
| A | 10:30 | 11:30 | 거부 (겹침) |
| B | 10:30 | 11:30 | 허용 (다른 방) |

```text
같은 회의실 + 예약 시간 중복 → 저장 불가능
```

`UNIQUE`는 동일 값 중복에 적합하고, **일부만 겹치는 범위**를 직접 표현하기 어렵다.  
이때 Range Type + EXCLUDE + GiST가 필요하고, INTEGER의 `=` 를 GiST에 붙이려면 **`btree_gist`** 가 필요하다.

---

## 2. B-tree Index

기본 Index Method. `=`, `<`, `<=`, `>`, `>=` 와 `UNIQUE`에 널리 쓰인다.

```sql
CREATE INDEX idx_users_email ON users (email);
```

```text
두 시간 범위가 겹치는가?  → B-tree / UNIQUE만으로는 부족
```

---

## 3–4. Range Type · 연산자

범위를 **한 값**으로 저장한다.

```sql
SELECT tsrange('2026-10-20 10:00', '2026-10-20 11:00');
```

| Type | 의미 |
| --- | --- |
| `int4range` / `int8range` | INTEGER / BIGINT 범위 |
| `numrange` | NUMERIC |
| `tsrange` / `tstzrange` | TIMESTAMP / TIMESTAMPTZ |
| `daterange` | DATE |

| 연산자 | 의미 |
| --- | --- |
| `&&` | 겹침 |
| `@>` / `<@` | 포함 |
| `-|-` | 인접 |
| `*` | 교집합 |

```sql
SELECT
  tsrange('2026-10-20 10:00', '2026-10-20 11:00')
  &&
  tsrange('2026-10-20 10:30', '2026-10-20 11:30');  -- TRUE

SELECT
  tsrange('2026-10-20 10:00', '2026-10-20 11:00')
  &&
  tsrange('2026-10-20 11:00', '2026-10-20 12:00');  -- FALSE (기본: 끝점 미포함)
```

---

## 5. EXCLUDE Constraint

**두 Row를 비교했을 때 지정한 연산이 모두 TRUE면 거부.**

```sql
EXCLUDE USING gist (
    room_id WITH =,
    during WITH &&
)
```

```text
INSERT/UPDATE → 기존 Row와 비교
  → room_id 같은가? (=)
  → during 겹치는가? (&&)
  → 둘 다 TRUE → 저장 거부
```

EXCLUDE는 PostgreSQL **기본** Constraint다. `btree_gist` 기능이 아니다.

---

## 6–7. GiST · 그래서 `btree_gist`

`GiST` = Generalized Search Tree. 범위·공간·거리 등 다양한 검색용 프레임워크.

Range의 `&&` 는 기본 GiST로 가능하지만,

```sql
EXCLUDE USING gist (
    room_id WITH =,   -- INTEGER 등 일반 타입
    during WITH &&    -- TSRANGE
)
```

처럼 **일반 타입의 `=` 를 GiST에서** 쓰려면 Operator Class가 필요하다 → **`btree_gist`**.

지원 타입 예: INTEGER, BIGINT, NUMERIC, TEXT, VARCHAR, DATE, TIMESTAMP, UUID …

```text
INTEGER의 =  +  TSRANGE의 &&
  → 하나의 GiST Index
  → EXCLUDE
  → 복합 충돌 규칙
```

---

## 8. 설치

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

공식 contrib 모듈. preload 불필요. lab: [`../lab/`](../lab/) · 포트 `15506`

---

## 9–13. 예약 실습 개요

```sql
CREATE TABLE reservation_demo (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    during TSRANGE NOT NULL,
    CONSTRAINT valid_reservation
        CHECK (NOT isempty(during)),
    CONSTRAINT no_overlapping_reservation
        EXCLUDE USING gist (
            room_id WITH =,
            during WITH &&
        )
);
```

| 케이스 | 결과 |
| --- | --- |
| room1 · 10–11 | INSERT 성공 |
| room1 · 11–12 (인접) | 성공 |
| room1 · 10:30–11:30 (겹침) | `exclusion_violation` (`23P01`) |
| room2 · 10:30–11:30 | 성공 (회의실 다름) |
| 겹치게 UPDATE | 거부 |

자세한 절차·실측: [`../HANDS-ON.md`](../HANDS-ON.md)

---

## 14. 다른 기능 (요약)

1. 일반 타입 GiST Index — 단순 숫자 조회는 보통 B-tree가 더 적합  
2. GiST에서 `<>` 등 비교 지원  
3. 일부 타입 `<->` 거리 검색 (모든 타입은 아님)

---

## 15. B-tree vs btree_gist

| 항목 | B-tree | btree_gist |
| --- | --- | --- |
| 목적 | 일반 값 비교 | 일반 타입의 GiST 비교 |
| UNIQUE | O | 대체 불가 |
| Range와 복합 GiST | X | O |
| EXCLUDE 복합 조건 | 제한적 | 유용 |
| 일반 조회 | 우선 | 특별한 이유 있을 때 |

`btree_gist`는 B-tree **대체재가 아니다.**

---

## 16–18. 장단점

| 장점 | 단점 |
| --- | --- |
| 복합 충돌 조건을 DB에서 표현 | 일반 B-tree보다 항상 빠르지 않음 |
| 일반 타입 + Range를 한 GiST에 | UNIQUE 대체 불가 |
| INSERT/UPDATE·모든 입력 경로에 적용 | GiST Index 유지·쓰기 비용 |
| 다양한 기본 타입 Operator Class | 복잡한 비즈니스 규칙은 App 병행 |

```text
복합 충돌 표현  ↕  Index 비용 + Constraint 설계 복잡도
```

---

## 19–20. 언제 / 주의

**고려:** 회의실·숙박·장비 대여 · 자원 점유 · 동일 대상+유효기간 중복  
**비고려:** 단순 ID/이메일 UNIQUE · 일반 가격·날짜 정렬

주의: `NOT NULL` · `CHECK (NOT isempty(during))` · `tsrange` vs `tstzrange` · Constraint 추가 전 기존 충돌 데이터 확인

---

## 21–22. 흐름 · FAQ

```text
B-tree(값 비교) → Range + && → EXCLUDE → GiST
  → 일반 타입 = 도 필요 → btree_gist
```

| Q | A |
| --- | --- |
| Extension 역할? | 일반 타입 비교를 GiST에서 지원 |
| EXCLUDE는 Extension 기능? | 아니요. PG 기본 Constraint |
| btree_gist 없이 EXCLUDE? | Operator Class만 있으면 가능 |
| Range는 Extension? | 아니요. 기본 타입 |
| B-tree보다 좋은가? | 아니요. 용도가 다름 |

---

## 정리

핵심: **일반 데이터 타입 비교를 GiST에서 쓰게 한다.**  
대표 활용: `room_id =` + `during &&` → DB에서 예약 충돌 거부.

> 일반 타입 비교와 Range 등 특수 비교를 **하나의 GiST**에서 묶고, 복합 충돌을 DB가 보장해야 할 때.

---

## 39. 벤치마크 / 실습 결과

재현: [`../lab/`](../lab/) · [`../HANDS-ON.md`](../HANDS-ON.md)  
환경: PostgreSQL **16.15** · `btree_gist` **1.7** · 포트 **15506** · Docker (2026-10-14, aarch64)

### 동작

| 케이스 | 결과 |
| --- | --- |
| 같은 방 · 시간 겹침 INSERT/UPDATE | `exclusion_violation` |
| 다른 방 · 같은 시간 | 성공 |
| 인접 구간 (`[10,11)` + `[11,12)`) | 성공 |

### INSERT 비용 (Bulk)

| 방식 | 규모 | 시간 |
| --- | ---: | ---: |
| plain | 100k | 0.26초 |
| EXCLUDE+GiST | 100k | **1.64초** (~6×) |
| EXCLUDE+GiST | 1M | **27.3초** |
| EXCLUDE+GiST | **1억** | **2,736초 (~45.6분)** · ~37k rows/s |

1억 적재 후 크기: heap **6.5 GB** · indexes **10 GB** · total **17 GB**

### 1억에서의 읽기·충돌

| 작업 | 시간 |
| --- | ---: |
| 겹침 조회 (`room_id` + `during &&`) | ~**1.3 ms** |
| 충돌 INSERT 거부 | ~**1.4 ms** |

```text
쓰기(대량 적재)는 비싸고, 적재 후 충돌 검사·범위 조회는 ms.
```

---

## 참고 자료

- [btree_gist](https://www.postgresql.org/docs/current/btree-gist.html)
- [Range Types](https://www.postgresql.org/docs/current/rangetypes.html)
- [GiST Indexes](https://www.postgresql.org/docs/current/gist.html)
- [Exclusion Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Range Functions and Operators](https://www.postgresql.org/docs/current/functions-range.html)
