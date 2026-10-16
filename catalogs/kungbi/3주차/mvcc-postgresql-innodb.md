# MVCC: PostgreSQL VACUUM과 InnoDB Undo/Purge

> 핵심 질문: 같은 `100 → 200` UPDATE를 과거 snapshot이 읽을 때, 두 엔진은 `100`을 어디에 보관하고 누가 언제 치우는가?

이 문서는 PostgreSQL 18과 MySQL 8.4의 공식 문서를 기준으로 한다. 여기서 “MySQL의 MVCC”는 기본 트랜잭션 스토리지 엔진인 **InnoDB의 구현**을 뜻한다.

## 1. MVCC를 먼저 한 문장으로

MVCC는 한 논리 행의 여러 버전을 보존하고, 각 SQL 문이나 트랜잭션의 **snapshot에 보이는 버전만 선택**하는 동시성 제어 방식이다. PostgreSQL 문서는 각 SQL 문이 특정 시점의 데이터 snapshot을 보며, 일반 조회용 잠금과 쓰기 잠금이 충돌하지 않아 읽기와 쓰기가 서로를 막지 않는다고 설명한다.[1] InnoDB의 consistent read 역시 특정 시점의 snapshot을 제공하며 대상 테이블에 잠금을 설정하지 않는다.[7]

다만 “읽기는 절대 쓰기를 막지 않는다”를 모든 작업에 확대하면 안 된다. `SELECT ... FOR UPDATE` 같은 locking read, DDL, 동일 행을 변경하는 쓰기끼리는 별도의 잠금과 대기가 생긴다.[1][10]

### Snapshot은 데이터 복사본이 아니다

Snapshot은 테이블 전체를 복사한 파일이 아니라, **어떤 트랜잭션의 변경을 볼 수 있는지 판정하는 경계**다. 엔진은 그 경계와 행 버전의 트랜잭션 정보를 비교해 읽을 버전을 선택한다.[1][7]

## 2. 끝까지 사용할 하나의 예제

비교를 위해 두 데이터베이스 모두 `REPEATABLE READ`로 맞춘다.[2][7]

```text
초기 상태: account(id=1, balance=100)

T1                                      T2
BEGIN ISOLATION LEVEL REPEATABLE READ
SELECT balance → 100
                                        UPDATE balance = 200
                                        COMMIT
SELECT balance → 100
COMMIT

새 트랜잭션 SELECT balance → 200
```

T1이 두 번째 조회에서도 `100`을 보는 것은 첫 조회 시점의 snapshot을 계속 사용하기 때문이다. PostgreSQL의 `REPEATABLE READ`는 트랜잭션 시작 전 커밋된 데이터만 보고, InnoDB `REPEATABLE READ`의 consistent read는 첫 consistent read가 만든 snapshot을 같은 트랜잭션에서 재사용한다.[2][7]

이 예제의 핵심은 `200`이 현재 값이 된 뒤에도 T1이 읽을 수 있도록 **`100`의 버전을 당분간 보존해야 한다**는 점이다.[2][7]

## 3. 공통 구조: 네 역할로 보면 쉽다

| 역할 | 질문 | PostgreSQL | InnoDB |
| --- | --- | --- | --- |
| 현재 상태 | 지금 커밋된 값은 어디에 있는가? | 최신 heap tuple | clustered index record |
| 과거 | 이전 값은 어디에 남는가? | 이전 heap tuple | update Undo Log |
| 판정자 | 이 reader는 어떤 버전을 보는가? | snapshot + `xmin/xmax` | Read View + `DB_TRX_ID` |
| 수거자 | 아무도 안 보는 버전을 누가 치우는가? | VACUUM | Purge |

같은 MVCC 계약을 지키지만, “과거”를 보관하는 물리적 위치가 다르기 때문에 유지보수 방식도 달라진다.[3][6]

## 4. PostgreSQL: 과거 버전도 heap에 있다

PostgreSQL의 각 row version에는 삽입 트랜잭션 ID인 `xmin`과 삭제 트랜잭션 ID인 `xmax`가 있다. 공식 문서는 UPDATE가 같은 논리 행에 대해 새 row version을 만든다고 명시한다.[3] 실제 heap tuple header에는 `t_xmin`, `t_xmax`, 그리고 현재 또는 더 새로운 버전을 가리키는 `t_ctid`가 저장된다.[11]

```text
Heap page

┌────────────────────────────────────┐
│ tuple A: balance=100               │
│ xmin=T0 · xmax=T2 · ctid→tuple B   │
├────────────────────────────────────┤
│ tuple B: balance=200               │
│ xmin=T2 · xmax=0                   │
└────────────────────────────────────┘
```

T1의 snapshot에서는 T2의 변경이 보이지 않으므로 tuple A가 보이고, T2 커밋 뒤 시작한 새 트랜잭션에서는 tuple B가 보인다. 여기서 `xmax`가 있다고 무조건 현재 reader에게 안 보이는 것은 아니다. 그 트랜잭션이 아직 커밋되지 않았거나 현재 snapshot보다 뒤라면 이전 버전은 여전히 보일 수 있다.[3]

### UPDATE 비용과 HOT

PostgreSQL UPDATE는 새 row version을 테이블에 추가하며, 경우에 따라 새 index entry도 필요하다.[5] 다만 인덱스가 참조하는 컬럼을 바꾸지 않고 같은 page에 새 tuple을 둘 공간이 있으면 HOT(Heap-Only Tuple) 최적화가 새 index entry 생성을 피하고 중간 버전 일부를 일반 처리 중 제거할 수 있다.[5]

HOT은 UPDATE가 “제자리 덮어쓰기”로 바뀐다는 뜻이 아니다. 새 heap tuple version은 여전히 만들어지고, 인덱스 유지 비용과 일부 정리 비용을 줄이는 최적화다.[5]

## 5. 왜 이전 tuple을 즉시 지울 수 없는가

UPDATE나 DELETE 직후 이전 버전을 바로 없애면, 아직 오래된 snapshot을 사용하는 T1은 자신이 봐야 할 `100`을 잃는다. PostgreSQL은 이전 버전이 다른 트랜잭션에 보일 가능성이 있는 동안 보존하고, 더 이상 어떤 트랜잭션에도 필요하지 않을 때 dead tuple로 회수한다.[4]

```text
T2 COMMIT 직후

논리적으로 현재값       200
T1에게 필요한 과거값    100
즉시 삭제 가능?         아니오
T1 종료 후              회수 가능 후보
```

따라서 오래 열린 트랜잭션은 오래된 snapshot의 수명을 늘리고, 그 snapshot에 필요할 수 있는 버전의 회수를 늦춘다.[4]

## 6. PostgreSQL은 왜 VACUUM이 필요한가

표준 `VACUUM`의 핵심 역할은 세 가지다.[4]

### ① dead tuple 공간을 재사용 가능하게 만든다

표준 VACUUM은 테이블과 인덱스의 dead row version을 제거하고 공간을 이후 행이 재사용할 수 있게 표시한다. 하지만 일반적으로 그 공간을 운영체제에 즉시 반환하지는 않는다.[4]

### ② Visibility Map을 관리한다

VACUUM은 모든 활성·미래 트랜잭션에 보이는 tuple만 있는 page를 Visibility Map에 표시한다. 다음 VACUUM이 해당 page를 건너뛸 수 있고, index-only scan이 heap 방문을 생략할 수 있는 근거가 된다.[4]

### ③ 오래된 XID를 freeze한다

PostgreSQL의 일반 XID는 32비트 순환 공간을 사용하므로, 지나치게 오래된 XID를 그대로 두면 과거와 미래의 판정이 뒤집히는 wraparound 위험이 생긴다. VACUUM은 충분히 오래된 row version을 freeze해 모든 정상 트랜잭션보다 과거로 취급되게 한다.[4]

`VACUUM (ANALYZE)` 또는 autovacuum의 ANALYZE 작업은 planner 통계도 갱신할 수 있지만, 통계 갱신과 dead tuple 회수는 구분해서 이해해야 한다.[4]

## 7. VACUUM과 VACUUM FULL은 다르다

| 항목 | `VACUUM` | `VACUUM FULL` |
| --- | --- | --- |
| 핵심 | dead space를 내부 재사용 가능하게 표시 | 테이블 파일을 새로 작성해 압축 |
| 파일 크기 | 보통 그대로 | 줄어들 수 있음 |
| 동시 운영 | 일반 DML과 병행 가능 | `ACCESS EXCLUSIVE` lock 필요 |
| 추가 공간 | 상대적으로 적음 | 새 복사본을 위한 공간 필요 |
| 기본 전략 | 자주 실행 | 예외적인 재작성 |

PostgreSQL 공식 문서는 표준 VACUUM을 충분히 자주 실행해 VACUUM FULL 필요성을 피하는 방향을 권한다. autovacuum은 VACUUM FULL을 자동으로 실행하지 않는다.[4]

즉, `VACUUM 완료 = 파일 축소`가 아니다. 정상적인 목표는 테이블을 항상 최소 크기로 만드는 것이 아니라, UPDATE 사이클에서 생긴 공간을 다시 사용하며 크기를 안정화하는 것이다.[4]

## 8. InnoDB: 현재 record에서 Undo를 따라 과거를 복원한다

InnoDB 테이블의 clustered index는 row data를 저장하며 보통 PRIMARY KEY가 clustered index가 된다.[12] InnoDB는 각 row에 마지막 INSERT/UPDATE 트랜잭션을 나타내는 6바이트 `DB_TRX_ID`와 Undo record를 가리키는 7바이트 `DB_ROLL_PTR` 같은 숨은 필드를 추가한다.[6]

```text
Clustered index record

┌─────────────────────────────┐
│ balance=200                 │
│ DB_TRX_ID=T2                │
│ DB_ROLL_PTR ───────────┐    │
└────────────────────────┼────┘
                         ▼
                  Update Undo Log
                  ┌──────────────┐
                  │ balance=100  │
                  │ 이전 버전 정보 │
                  └──────────────┘
```

공식 문서는 row가 UPDATE된 경우 Undo record에 업데이트 전 내용을 재구성하는 데 필요한 정보가 들어 있다고 설명한다.[6] 따라서 오래된 Read View를 가진 T1은 현재 record가 자신에게 너무 새롭다면 roll pointer를 따라 `100`을 복원한다.[6][7]

“InnoDB는 무조건 모든 행 전체를 Undo에 복사한다”라고 설명하면 과장이다. Undo record는 변경을 되돌리거나 이전 버전을 재구성하는 데 필요한 정보를 저장하며, 그 물리 크기는 원본 row보다 작을 수 있다.[6][8]

## 9. Undo Log에는 두 가지 책임이 있다

Undo Log는 단일 read-write transaction의 변경을 되돌리는 정보 모음이며, consistent read가 수정 전 데이터를 가져오는 데도 사용된다.[8]

- **Insert Undo**: transaction rollback에 필요하고 커밋 후 버릴 수 있다.[6]
- **Update Undo**: rollback뿐 아니라 consistent read의 과거 버전 재구성에도 필요하다.[6][8]

Update Undo는 해당 snapshot을 가진 어떤 트랜잭션도 과거 버전을 요구하지 않게 된 뒤에야 버릴 수 있다.[6] 따라서 읽기만 하는 트랜잭션도 오래 열어두면 Undo 정리를 늦추고 rollback segment와 undo tablespace의 성장을 유발할 수 있다.[6]

## 10. InnoDB의 Purge는 무엇을 치우는가

InnoDB는 DELETE된 row를 SQL 실행 즉시 물리적으로 제거하지 않고 delete-mark 상태로 둔다. MVCC나 rollback에 더 이상 필요하지 않아 해당 Undo record를 버릴 수 있을 때 row와 index record를 물리적으로 제거하는 작업을 Purge라고 한다.[9]

Purge는 background thread가 committed transaction의 Undo page 목록인 history list를 주기적으로 처리하고, 처리한 Undo page를 해제한다.[9]

이 해제는 history에서 더 이상 MVCC용으로 붙잡지 않는다는 뜻이다. Purge 완료를 Undo tablespace나 `.ibd` 파일이 즉시 줄어든다는 의미로 확대하면 안 된다.[14]

```text
UPDATE/DELETE
    ↓
Undo record + delete-marked record
    ↓  아직 오래된 Read View가 필요
보존
    ↓  더 이상 어떤 Read View도 필요 없음
Purge가 history list 처리
```

Purge를 “InnoDB의 VACUUM 명령”이라고 부르면 차이를 잃는다. 비슷한 수거 역할은 있지만 PostgreSQL은 명시적·자동 VACUUM이 heap/index version을 처리하고 freeze와 Visibility Map까지 맡는 반면, InnoDB Purge는 Undo history와 delete-marked record를 background에서 처리한다.[4][9]

## 11. 가장 중요한 공통 운영 문제: 오래 열린 트랜잭션

| 상황 | PostgreSQL | InnoDB |
| --- | --- | --- |
| 오래된 snapshot 유지 | 이전 heap tuple이 아직 보일 수 있음 | update Undo가 과거 row를 재구성해야 함 |
| 정리 지연 | dead tuple 회수 지연 | history list와 Undo 회수 지연 |
| 누적 결과 | table/index bloat, vacuum 부담 | purge lag, undo tablespace 성장 |
| 공통 대응 원칙 | 트랜잭션을 짧게 유지하고 지연 지표를 관찰 | 트랜잭션을 짧게 유지하고 history를 관찰 |

MySQL 공식 문서도 consistent read만 수행하는 트랜잭션까지 정기적으로 커밋하지 않으면 update Undo를 버리지 못해 rollback segment가 과도하게 커질 수 있다고 경고한다.[6]

## 12. 격리 수준은 저장 위치와 별개의 축이다

PostgreSQL의 기본 격리 수준은 `READ COMMITTED`이며, 각 명령이 시작될 때 새로운 snapshot을 얻는다.[2] InnoDB의 기본 격리 수준은 `REPEATABLE READ`이며, 같은 트랜잭션의 consistent read는 첫 consistent read가 만든 snapshot을 재사용한다.[7][10]

여기서 InnoDB 설명은 plain nonlocking `SELECT`인 consistent read에 관한 것이다. Locking read와 `UPDATE`·`DELETE`의 동작에 같은 snapshot 규칙을 그대로 일반화하면 안 된다.[7][10]

따라서 기본 설정 그대로라면 같은 트랜잭션의 두 번째 SELECT가 서로 다른 결과를 볼 수 있다. 이것은 “PostgreSQL은 heap, InnoDB는 Undo”라는 저장 방식 차이와 별개로 **snapshot을 언제 새로 만드는가**의 차이다.[2][7]

## 13. 최종 비교

| 질문 | PostgreSQL | MySQL InnoDB |
| --- | --- | --- |
| MVCC 비교 범위 | PostgreSQL heap table | InnoDB storage engine |
| 현재 row | 최신 heap tuple | clustered index record |
| 과거 row | heap의 이전 tuple version | update Undo record에서 재구성 |
| 핵심 메타데이터 | `xmin`, `xmax`, `ctid` | `DB_TRX_ID`, `DB_ROLL_PTR` |
| Reader 기준 | snapshot | Read View |
| 회수 작업 | VACUUM/autovacuum | background Purge |
| 회수 대상 | dead heap tuple과 index entry | 불필요한 Undo와 delete-marked record |
| 추가 책임 | Visibility Map, XID freeze | rollback을 위한 Undo 관리 |
| 기본 snapshot 수명 | `READ COMMITTED`: statement 단위 | `REPEATABLE READ`: transaction의 첫 consistent read부터 |

## 14. 혼동하면 안 되는 네 문장

1. **MySQL = InnoDB는 아니다.** 이 비교는 InnoDB engine에 한정한다.
2. **WAL = Undo Log가 아니다.** WAL/redo는 내구성과 복구를 위한 변경 기록이고, InnoDB Undo는 rollback과 consistent read용 이전 정보다.
3. **VACUUM = Purge가 아니다.** 둘 다 더 이상 필요 없는 MVCC 흔적을 회수하지만 대상·실행 방식·부가 책임이 다르다.
4. **VACUUM = 파일 축소가 아니다.** 표준 VACUUM의 기본 목적은 dead space의 내부 재사용이다.[4]

## 15. 이 설명의 도착점

- Snapshot은 데이터 복사본이 아니라 버전 가시성 경계다.
- PostgreSQL은 과거 tuple을 heap에 두므로 dead tuple 회수를 위한 VACUUM이 필수다.
- InnoDB는 현재 record에서 Undo chain을 따라 과거 값을 재구성하고 Purge가 history를 정리한다.
- 오래 열린 트랜잭션은 두 엔진 모두에서 “청소가 끝나지 않는” 직접적인 원인이 된다.
- PostgreSQL에서 표준 VACUUM 후에도 파일 크기나 심한 bloat를 줄여야 한다면, 다음 질문은 `VACUUM FULL`의 강한 잠금을 피하면서 재작성할 방법이며 `pg_repack`이 그 연결점이 된다.[13]

## Sources

[1] https://www.postgresql.org/docs/current/mvcc-intro.html
[2] https://www.postgresql.org/docs/current/transaction-iso.html
[3] https://www.postgresql.org/docs/current/ddl-system-columns.html
[4] https://www.postgresql.org/docs/current/routine-vacuuming.html
[5] https://www.postgresql.org/docs/current/storage-hot.html
[6] https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html
[7] https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html
[8] https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html
[9] https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html
[10] https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
[11] https://www.postgresql.org/docs/current/storage-page-layout.html
[12] https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html
[13] https://reorg.github.io/pg_repack
[14] https://dev.mysql.com/doc/refman/8.4/en/innodb-file-space.html
