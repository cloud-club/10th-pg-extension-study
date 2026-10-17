# pg_repack

> PostgreSQL의 Table / Index Bloat를 줄이기 위해 테이블이나 인덱스를 재구성하면서, `VACUUM FULL`이나 `CLUSTER`에 비해 운영 중 Exclusive Lock을 오래 유지하지 않도록 설계된 Extension

| 항목 | 내용 |
| --- | --- |
| 카테고리 | Database Maintenance · Storage · Bloat Management |
| 대상 | PostgreSQL Table / Index |
| 핵심 기능 | Table / Index 재구성 및 Bloat 제거 |
| 비교 대상 | `VACUUM`, `VACUUM FULL`, `CLUSTER`, `REINDEX` |
| 특징 | 대부분의 재구성 작업 동안 일반적인 데이터 접근을 허용 |
| 회차 | `week04` |
| 정리한 사람 | 김예은 |

`pg_repack`을 이해하려면 먼저 PostgreSQL의 **MVCC, Dead Tuple, VACUUM, Bloat**가 무엇인지 이해해야 한다.

| 개념 | 한 줄 |
| --- | --- |
| MVCC | Row를 덮어쓰지 않고 Version을 남기며 동시성 처리 |
| Dead Tuple | 더 이상 어떤 Transaction에도 필요 없는 이전 Version |
| VACUUM | Dead 공간을 **재사용 가능**하게 만듦 (파일이 항상 줄지는 않음) |
| Bloat | 유효 데이터 대비 Table/Index 파일이 비대함 |
| VACUUM FULL | Rewrite로 파일 축소 · **ACCESS EXCLUSIVE** |
| pg_repack | Rewrite에 가깝게 축소하되 **긴 Exclusive를 피함** (Online) |

개념 연결:

```text
MVCC ──UPDATE/DELETE ──▶ Dead Tuple
                              │
                              ▼
                         VACUUM (공간 재사용)
                              │
                    파일이 안 줄어들면 Bloat
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        VACUUM FULL                    pg_repack
     (긴 Exclusive)              (Online · 짧은 Lock)
```

---

## 1. `pg_repack`은 어떤 문제를 해결하는가

먼저 다음과 같은 상품 Table이 있다고 가정한다.

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL
);
```

상품의 가격이나 재고는 계속 변경될 수 있다.

```sql
UPDATE products SET stock = 9 WHERE id = 1;
UPDATE products SET stock = 8 WHERE id = 1;
UPDATE products SET stock = 7 WHERE id = 1;
```

사용자 입장에서는 값 하나가 계속 덮어써지는 것처럼 보인다. 하지만 PostgreSQL은 **MVCC(Multi-Version Concurrency Control)** 를 사용하기 때문에 내부 동작은 다르다.

---

## 2. MVCC란 무엇인가

MVCC는 Multi-Version Concurrency Control의 약자로, **다중 버전 동시성 제어**다.

핵심 아이디어:

> 여러 Transaction이 동시에 Database를 사용할 때, 하나의 Row에 대해 여러 Version을 관리하여 서로의 작업을 불필요하게 방해하지 않도록 한다.

Transaction A가 상품을 읽는 동안 Transaction B가 재고를 바꾸면, 기존 데이터를 즉시 덮어버리는 방식만으로는 동시성을 다루기 까다로워질 수 있다. PostgreSQL의 MVCC에서는 개념적으로 다음과 같이 여러 Version이 존재할 수 있다.

```text
Old Version   id=1  stock=10
New Version   id=1  stock=9
```

각 Transaction은 자신의 Snapshot 기준으로 보여야 하는 Version을 본다. Reader + Writer + 다른 Transaction이 동시에 동작할 때 불필요한 충돌을 줄이는 것이 목적이다.

---

## 3. UPDATE는 단순한 덮어쓰기가 아니다

```sql
UPDATE products SET stock = 9 WHERE id = 1;
```

논리적으로는 `10 → 9` 이지만, MVCC 관점에서는 기존 Version을 그 자리에서 없애는 것만으로 생각하지 않는다. 개념적으로 새 Version이 만들어진다.

다시 UPDATE하면 개념적으로는 다음과 같다.

```text
논리(사용자)          물리(개념적 저장)
─────────────        ─────────────────
stock = 10
    ↓ UPDATE
stock = 9      →     [v1 stock=10] [v2 stock=9]
    ↓ UPDATE
stock = 8      →     [v1] [v2] [v3 stock=8]
```

| Version | stock | 상태(개념) |
| --- | ---: | --- |
| v1 | 10 | 이전 |
| v2 | 9 | 이전 |
| v3 | 8 | 현재(Live) |

---

## 4. DELETE도 즉시 물리적으로 사라지는 것은 아니다

```sql
DELETE FROM products WHERE id = 1;
```

조회하면 0 rows이지만, 해당 데이터가 차지하던 물리 공간을 그 순간 즉시 없앤다는 뜻은 아니다. 다른 Transaction이 아직 그 Version을 필요로 할 수 있기 때문이다.

어느 시점이 되면 더 이상 어떤 Transaction에서도 필요 없는 Row Version이 생긴다. 이것이 **Dead Tuple**이다.

---

## 5. Dead Tuple이란?

> 더 이상 어떤 Transaction에서도 필요하지 않은 이전 Row Version

재고가 `10 → 9 → 8 → 7`로 바뀌고 현재 필요한 값이 `7`이면, 이전 Version들은 개념적으로 DEAD가 된다.

```text
stock = 10   DEAD
stock = 9    DEAD
stock = 8    DEAD
stock = 7    LIVE
```

UPDATE / DELETE가 반복되면 이런 공간이 계속 생길 수 있고, 방치하면 Database가 계속 커질 수 있다. 그래서 PostgreSQL에는 `VACUUM`이 있다.

---

## 6. VACUUM이란?

PostgreSQL 공식 문서는 `VACUUM`의 중요한 역할 중 하나를 **Dead Tuple이 차지하던 Storage를 회수하여 다시 사용할 수 있게 하는 것**으로 설명한다.

```sql
VACUUM products;
```

일반 `VACUUM`을 “파일을 완전히 잘라내는 작업”으로 이해하면 정확하지 않다. Dead Tuple이 쓰던 공간을 PostgreSQL이 **다시 쓸 수 있는 공간으로 만드는 것**에 가깝다.

```text
Before VACUUM     [ LIVE ][ DEAD ][ LIVE ][ DEAD ][ LIVE ]
After  VACUUM     [ LIVE ][ FREE ][ LIVE ][ FREE ][ LIVE ]
                     ↑ 파일 끝(EOF)은 그대로일 수 있음
```

| | Dead 공간 | OS에 파일 반환 | 새 Row가 FREE 재사용 |
| --- | --- | --- | --- |
| 일반 `VACUUM` | 회수(재사용 가능) | 보통 X | O |
| `VACUUM FULL` | Rewrite로 제거 | O (가능) | (새 파일) |

---

## 7. VACUUM 후 Table 크기는 줄어드는가?

여기가 `pg_repack`을 이해할 때 중요하다.

Table이 Disk에서 10GB이고 Live Data 6GB · 재사용 가능 공간 4GB라고 해도, 일반 `VACUUM` 후 반드시 `10GB → 6GB`가 되는 것은 아니다. 대부분 OS에 반환하지 않고 같은 Table이 다시 쓰도록 유지한다.

```text
VACUUM
  → Dead Tuple 공간
  → PostgreSQL이 다시 사용할 수 있는 공간
```

Table이 계속 갱신된다면 어차피 공간이 다시 필요하므로, 이것만으로 나쁜 것은 아니다.

---

## 8. Autovacuum

관리자가 매번 `VACUUM`을 칠 필요는 없다. **Autovacuum**이 상태를 보고 필요한 Table에 VACUUM 등을 수행한다.

```text
UPDATE / DELETE → Dead Tuple 증가 → Autovacuum → 공간 재사용
```

`pg_repack`은 VACUUM / Autovacuum을 매일 대체하는 Extension이 아니다. Routine Maintenance의 기본은 적절한 Autovacuum이다.

---

## 9. Bloat란 무엇인가

Bloat는 부풀어 오름 · 비대화. Table / Index가 **실제 유효 데이터에 비해 불필요하게 많은 공간**을 차지하는 상태를 말한다.

```text
필요한 Live 데이터   ████████████░░░░░░░░  6 GB
실제 Table 파일      ████████████████████  10 GB
                     └─ Live ─┘└─ 여분/Bloat ─┘
```

| 증상 후보 | 설명 |
| --- | --- |
| Disk | Table/Index가 예상보다 큼 |
| I/O · Cache | 읽을 Page가 늘어날 수 있음 |
| Backup / Maintenance | 복사·스캔 부담 증가 |

`크다 = Bloat`는 아니다. 데이터가 많아서 큰 경우와 구분해야 한다.

심하면 Disk 사용 증가, Page I/O · Cache 효율 · Backup/Maintenance 부담이 커질 수 있다. 다만 `Table이 크다 = 무조건 Bloat`는 아니다. 데이터가 많아서 큰 것일 수도 있다.

---

## 10. VACUUM이 있는데 왜 Bloat가 남는가

일반 `VACUUM`은 대부분 Table File 전체를 새로 써서 빈 공간을 걷어내는 작업이 아니다. “앞으로 Table 안에서 다시 쓸 공간”과 “Disk에서 파일 크기를 줄이고 싶다”는 요구가 다를 수 있다. 물리 공간을 크게 회수하려면 `VACUUM FULL` 등이 필요하다.

---

## 11. VACUUM FULL

```sql
VACUUM FULL products;
```

Table 내용을 **새 Disk File로 다시 작성**해 불필요 공간을 제거한다. Disk 공간을 OS에 반환할 수 있다.

문제는 **ACCESS EXCLUSIVE Lock**. 재작성 동안 일반 Application이 해당 Table을 정상 사용하기 어렵다. 추가 Disk도 필요하다. 공식 문서도 Routine에서는 일반 `VACUUM`을 쓰고 `VACUUM FULL`은 상당한 공간 회수가 필요할 때 제한적으로 쓰는 방향을 설명한다.

---

## 12. 여기서 `pg_repack`이 등장한다

```text
문제 1: UPDATE/DELETE로 Table·Index가 비대해짐
문제 2: 일반 VACUUM은 원하는 만큼 파일을 안 줄일 수 있음
문제 3: VACUUM FULL은 Rewrite 가능하지만 Exclusive Lock이 무거움
```

요구:

```text
Table을 새로 정리하고 싶다
+ 그 몇 시간 동안 서비스에서 Table을 못 쓰게 하고 싶지는 않다
```

이 선택지 중 하나가 **`pg_repack`**이다.

---

## 13. `pg_repack`이란?

공식 문서: Table / Index Bloat를 제거하고 재구성하는 Extension. `VACUUM FULL` / `CLUSTER`와 달리 전체 처리 시간 동안 Exclusive Lock을 유지하지 않고 **Online** 방식으로 작업하는 것이 핵심이다.

Online ≠ Lock이 전혀 없다. 정확히는:

```text
긴 재구성 시간 동안 ACCESS EXCLUSIVE를 계속 쥐지 않는다.
```

---

## 14. 어떻게 쓰면서 다시 만드는가

복사 중에도 INSERT / UPDATE / DELETE가 들어오면 단순 복사만으로는 결과가 어긋난다. `pg_repack`은 **Log Table + Trigger**로 복사 중 변경을 기록한다.

---

## 15. Full Table Repack 기본 흐름

```text
  Application (SELECT / INSERT / UPDATE / DELETE)
              │
              ▼
     ┌─────────────────┐     Trigger      ┌──────────┐
     │ Original Table  │ ───────────────▶ │ Log Table│
     └────────┬────────┘                  └────┬─────┘
              │ copy                           │ apply
              ▼                                ▼
     ┌─────────────────┐
     │   New Table     │ ◀── Index 생성 후 최종 동기화
     └────────┬────────┘
              │ 짧은 ACCESS EXCLUSIVE
              ▼
         Table Swap (교체) → 정리
```

| 단계 | Lock 감각(개념) |
| --- | --- |
| Log/Trigger 설치 · Copy · Apply | 긴 Exclusive 없이 진행 (Online) |
| 마지막 Swap | **짧은** Exclusive 구간 |

핵심: “막고 통째로 복사”가 아니라 **변경을 기록하며 새 Table을 준비한 뒤 교체**한다.

---

## 16. Trigger가 필요한 이유

복사 중 `UPDATE products SET stock = stock - 1 WHERE id = 100`이 오면, Log에 남겨 새 Table에 반영하지 않으면 옛 재고가 남는다. Trigger 덕분에 긴 복사 시간 동안 Table을 완전히 못 쓰게 만들 필요가 없다.

---

## 17. 정말 Lock이 없는가?

아니다.

> 전체 재구성 시간 동안 ACCESS EXCLUSIVE를 유지하지 않고, 필요한 구간에서만 Lock을 쓰는 Online Reorganization

Full Repack 중 DDL 제한용 Lock, 마지막 교체 구간의 더 강한 Lock이 있다.

```text
pg_repack ≠ No Lock
pg_repack = Minimal Lock / Online Reorganization
```

---

## 18. VACUUM / VACUUM FULL / pg_repack 비교

| 항목 | `VACUUM` | `VACUUM FULL` | `pg_repack` |
| --- | --- | --- | --- |
| Dead Tuple 공간 재사용 | O | O | 재구성으로 처리 |
| Table 물리 크기 축소 | 제한적 | O | O |
| Table 전체 재작성 | X | O | Full Repack 시 O |
| 일반 작업과 병행 | 대체로 가능 | 어려움 | 대부분 시간 가능 |
| ACCESS EXCLUSIVE | 전체 동안 불필요 | 작업 동안 필요 | 짧은 구간 |
| 추가 Disk | 상대적으로 작음 | 필요 | 많이 필요할 수 있음 |
| Routine Maintenance | O | 일반적으로 X | 일반적으로 X |
| 심한 Bloat 정리 | 제한적 | O | O |

```text
Routine → VACUUM / Autovacuum
심한 Bloat + 중단 가능 → VACUUM FULL 후보
심한 Bloat + 긴 Exclusive Lock 부담 → pg_repack 후보
```

---

## 19. Autovacuum 대체재인가?

아니다. Autovacuum을 방치한 채 주기적 `pg_repack`만 돌리는 것은 기본 사용 목적이 아니다.

먼저: Autovacuum이 정상인가? UPDATE/DELETE 패턴은? 특정 Table만 비정상 Bloat인가? 장시간 Transaction이 Dead Tuple 회수를 막고 있나?

`pg_repack`은 **이미 발생한 심한 Bloat를 Online으로 정리할 때 고려하는 Maintenance Tool**에 가깝다.

---

## 20. Full Table Repack 요구사항

대상 Table에 **PRIMARY KEY** 또는 **NOT NULL 컬럼으로 된 UNIQUE Index**가 필요하다. 변경분을 Log에 남기고 새 Table에 반영하려면 Row를 식별해야 하기 때문이다.

---

## 21. Disk 공간

기존 Table을 그 자리에서 조금씩 압축하는 방식이 아니다. 새 Table·Index를 만들므로 **상당한 추가 Disk**가 필요하다. Disk가 거의 찬 뒤에 “공간 없으니 repack”은 여유 공간 부족으로 실패할 수 있다.

확인: 현재 Table/Index 크기 · 가용 Disk · Repack 중 추가 공간.

```sql
SELECT pg_size_pretty(pg_relation_size('products'));
SELECT pg_size_pretty(pg_total_relation_size('products'));
```

---

## 22. Dead Tuple 통계

```sql
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

통계 기반이라 정확한 물리 Row Count와 동일하지 않다.

---

## 23. 기본 사용 형태

```sql
CREATE EXTENSION pg_repack;
```

실제 Repack은 CLI Utility를 쓴다.

```bash
pg_repack --table=products --dbname=app_db
```

```text
pg_repack Client → PostgreSQL → Extension → Reorganization
```

`CREATE EXTENSION`만으로 Table이 자동 정리되지는 않는다.

---

## 24. 실무에서 언제 고려할까

`products`처럼 가격·재고·상태 변경·삭제·대량 Sync가 이어져 Table/Index가 필요 이상으로 커졌다면:

1. Autovacuum · Bloat 원인 · 일반 VACUUM으로 충분한지 확인  
2. 큰 공간 회수가 필요하고 `VACUUM FULL`로 오래 막기 어렵다면 `pg_repack` 후보

| 상황 | 판단 |
| --- | --- |
| 평상시 Dead Tuple 관리 | Autovacuum 우선 |
| Dead Tuple이 조금 | 바로 repack 이유 없음 |
| Bloat 심함 / Disk 회수 필요 | 검토 가능 |
| `VACUUM FULL` Exclusive Lock 부담 | 좋은 후보 |
| 추가 Disk 거의 없음 | 주의 |
| PK / UNIQUE 없음 | Full Repack 제약 |
| 작업 중 DDL | 피함 |
| 원인 미조사 · 매일 무조건 실행 | 부적절 |

---

## 25. 내부 동작 한눈에

```text
MVCC → UPDATE/DELETE → Dead Tuple
  → VACUUM/Autovacuum (공간 재사용, 파일은 안 줄일 수 있음)
  → 심한 Bloat
  → VACUUM FULL? (Rewrite + ACCESS EXCLUSIVE)
  → 부담이면 pg_repack
  → Log + Trigger → 새 Table Copy → 변경 반영
  → Index → 최종 동기화 → 짧은 Lock으로 교체 → 정리
```

---

## 26. FAQ · 오해 정리

**Q. UPDATE하면 그냥 덮어쓰나?**  
MVCC에서는 새 Version이 생기는 쪽으로 이해한다. 이전 Version은 즉시 물리 제거되지 않을 수 있다.

**Q. Dead Tuple은 오류인가?**  
아니다. MVCC 과정에서 자연스럽게 생길 수 있다.

**Q. Dead Tuple이 하나라도 있으면 문제인가?**  
아니다. VACUUM / Autovacuum이 전제다.

**Q. VACUUM하면 File이 바로 작아지냐?**  
일반적으로 아니다. 같은 Table이 다시 쓰게 두고 OS에 바로 안 돌리는 경우가 많다.

**Q. 항상 VACUUM FULL?**  
아니다. Exclusive Lock · 추가 Disk 부담.

**Q. pg_repack은 Lock이 없나?**  
아니다. 긴 Exclusive를 안 쥐는 것이 장점이지, Lock 제로가 아니다.

**Q. VACUUM 대체?**  
아니다. Routine은 Autovacuum. repack은 심한 Bloat용.

**Q. Bloat면 무조건?**  
아니다. 정도 · Disk · 성능 · Autovacuum · 여유 공간 · Window를 본다.

---

## 27. 한 문장으로

> PostgreSQL의 MVCC와 반복 변경으로 Table / Index가 크게 비대해졌을 때, `VACUUM FULL`처럼 긴 Exclusive Lock을 피하면서 Online으로 재구성하기 위한 Extension이다.

떠올릴 질문:

```text
"이 Table Bloat를 실제로 줄여야 하는데
VACUUM FULL로 오래 막기는 어렵다.
Extension으로 풀 수 없을까?"
```

---

## 39. 벤치마크 / 실습 결과

재현: [`../lab/`](../lab/) · [`../HANDS-ON.md`](../HANDS-ON.md)  
환경: PostgreSQL **16.15** · `pg_repack` **1.5.3** · 포트 **15504**  
데이터: `repack_demo` · `repeat('A',1000)` × **100,000** → `DELETE WHERE id <= 80000` (live **20,000**)

### 크기 변화 (total)

```text
INSERT / DELETE / VACUUM     ████████████████████████  114 MB
VACUUM FULL                  █████                     23 MB
pg_repack (DELETE+VACUUM 후) █████                     23 MB
```

| 단계 | table | indexes | total | live rows |
| --- | --- | --- | ---: | ---: |
| INSERT 후 | 112 MB | 2208 kB | **114 MB** | 100,000 |
| DELETE 후 | 112 MB | 2208 kB | **114 MB** | 20,000 |
| `VACUUM` 후 | 112 MB | 2208 kB | **114 MB** | 20,000 |
| `VACUUM FULL` 후 | 22 MB | 456 kB | **23 MB** | 20,000 |
| `pg_repack` 직전 | 112 MB | 2208 kB | **114 MB** | 20,000 |
| `pg_repack` 후 | 22 MB | 456 kB | **23 MB** | 20,000 |

### 실습으로 알게 된 내용

| # | 배운 점 | 근거(이번 lab) |
| --- | --- | --- |
| 1 | **논리 Row 수 ≠ Disk 파일 크기** | DELETE로 live 10만→2만인데 total은 **114 MB 그대로** |
| 2 | **일반 VACUUM ≠ 파일 축소** | VACUUM 후에도 **114 MB** — FREE로 남겨 재사용 |
| 3 | **파일을 줄이려면 Rewrite** | `VACUUM FULL` → **23 MB** |
| 4 | **`pg_repack`도 비슷한 축소** | Online reorg 후 **23 MB** (FULL과 동일 오더) |
| 5 | **용도가 다르다** | FULL = 강한 Lock · repack = 긴 Exclusive를 피함. Routine은 여전히 Autovacuum |
| 6 | **`CREATE EXTENSION`만으로 끝이 아님** | CLI `pg_repack -t ...` 가 실제 작업을 수행 |
| 7 | **PK가 필요** | Full Table Repack은 PK(또는 NOT NULL UNIQUE)로 Row 식별 |

```text
이번 lab 한 줄 요약

  "지웠다" ≠ "파일이 작아졌다"
        ↓
  VACUUM = 다시 쓸 자리를 비워 둠
        ↓
  진짜 줄이려면 FULL 또는 pg_repack (Rewrite)
        ↓
  운영 중 긴 Exclusive가 부담이면 → pg_repack
```

---

## 참고 자료

### pg_repack
- `reorg/pg_repack` 공식 Repository · Documentation
- Full Table Repack 과정 · Requirements · Disk · Lock / DDL 제한

### PostgreSQL
- VACUUM · Routine Vacuuming · MVCC / Concurrency · Locking
- `pg_stat_user_tables`
