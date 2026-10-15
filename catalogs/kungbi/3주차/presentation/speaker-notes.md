# 발표자 노트 — 같은 MVCC, 다른 버전 관리

> PostgreSQL VACUUM과 MySQL InnoDB Undo/Purge · 22장

## Slide 01 — 같은 MVCC, 다른 버전 관리

- 오늘 질문은 단순하다. `100`을 `200`으로 바꾼 뒤, 오래된 트랜잭션은 어떻게 계속 `100`을 읽는가?
- PostgreSQL과 MySQL 전체를 비교하는 것이 아니라 PostgreSQL heap과 MySQL **InnoDB**를 비교한다.
- 결론은 과거 버전의 주소가 다르다는 것이다.

## Slide 02 — 정답부터

- PostgreSQL은 이전 row version도 heap tuple로 남긴다.
- InnoDB는 현재 record에서 roll pointer로 Undo record를 따라가 과거 값을 재구성한다.
- 그래서 PostgreSQL의 수거자는 VACUUM, InnoDB의 수거자는 Purge다.
- 근거: [3][4][6][9]

## Slide 03 — 왜 MVCC인가

- 한 값만 존재하고 읽는 동안 잠근다면 reader와 writer 중 하나가 기다려야 한다.
- MVCC는 여러 버전을 두고 reader마다 자신의 snapshot에 맞는 버전을 고른다.
- 일반 조회와 쓰기가 서로를 덜 막는 것이 장점이지만, locking read와 쓰기끼리의 잠금까지 없애는 것은 아니다.
- 근거: [1][7]

## Slide 04 — 하나의 실행 예제

- 두 DB의 차이를 공정하게 보기 위해 양쪽 모두 `REPEATABLE READ`로 맞춘다.
- T1이 `100`을 읽고, T2가 `200`으로 업데이트해 커밋한다.
- T1은 기존 snapshot으로 `100`, 새 트랜잭션은 `200`을 본다.
- 이 순간 두 값이 동시에 필요하기 때문에 이전 버전을 즉시 없앨 수 없다.
- 근거: [2][7]

## Slide 05 — Snapshot의 의미

- Snapshot을 테이블 전체 복사본으로 생각하면 구현을 오해하기 쉽다.
- 실제 핵심은 “어떤 트랜잭션의 결과를 볼 수 있는가”라는 가시성 경계다.
- 엔진은 이 경계와 각 버전의 트랜잭션 정보를 비교해 반환할 버전을 고른다.
- 근거: [1][2][7]

## Slide 06 — 네 역할

- 이후 세부 용어보다 현재·과거·판정자·수거자 네 역할을 유지한다.
- 현재값은 양쪽 모두 쉽게 찾을 수 있지만 과거값의 물리적 위치가 다르다.
- 이 차이가 청소와 운영 지표의 차이로 이어진다.

## Slide 07 — PostgreSQL 파트

- 먼저 PostgreSQL에서 과거값이 heap 안에 어떤 모습으로 남는지 본다.
- 흐름은 `새 tuple version → dead tuple → VACUUM`이다.

## Slide 08 — PostgreSQL heap

- UPDATE는 논리 행 하나를 바꾸지만 물리적으로 새 row version을 만든다.
- 이전 tuple의 `xmax`에는 변경 트랜잭션이, 새 tuple의 `xmin`에는 생성 트랜잭션이 들어간다.
- `xmax`가 0이 아니라고 모든 reader에게 바로 안 보이는 것은 아니다. snapshot이 그 트랜잭션을 볼 수 있는지도 함께 판단한다.
- 근거: [3][11]

## Slide 09 — HOT

- PostgreSQL UPDATE가 항상 모든 index entry를 새로 만드는 것은 아니다.
- 인덱스 대상 컬럼을 바꾸지 않고 같은 page에 공간이 있으면 HOT이 새 index entry를 피할 수 있다.
- 그러나 새 heap tuple version은 여전히 생성된다. HOT을 제자리 덮어쓰기라고 부르면 안 된다.
- 근거: [5]

## Slide 10 — 현재가 아님과 삭제 가능의 차이

- T2가 커밋한 뒤 시스템의 현재값은 `200`이다.
- 하지만 T1의 snapshot에는 `100`이 필요하므로 이전 tuple은 물리적으로 남아야 한다.
- 어떤 snapshot도 필요로 하지 않을 때 dead tuple은 비로소 회수 가능하다.
- 근거: [4]

## Slide 11 — VACUUM의 세 역할

- 첫째, dead tuple과 index 공간을 재사용 가능하게 한다.
- 둘째, Visibility Map을 갱신해 다음 VACUUM과 index-only scan을 돕는다.
- 셋째, 오래된 XID를 freeze해 wraparound를 막는다.
- `VACUUM ANALYZE`의 통계 갱신은 관련은 있지만 dead tuple 회수와 같은 작업으로 뭉개지 않는다.
- 근거: [4]

## Slide 12 — VACUUM과 VACUUM FULL

- 일반 VACUUM은 빈 공간을 내부에서 다시 쓰게 할 뿐 파일을 보통 줄이지 않는다.
- VACUUM FULL은 살아 있는 행으로 파일을 다시 써 압축하지만 `ACCESS EXCLUSIVE` lock과 새 복사본 공간이 필요하다.
- 일상 전략은 표준 VACUUM을 충분히 자주 돌려 FULL 필요성을 피하는 것이다.
- 근거: [4]

## Slide 13 — InnoDB 파트

- 이제 같은 `100 → 200`을 InnoDB에서 추적한다.
- 흐름은 `Read View → Roll Pointer → Undo → Purge`다.

## Slide 14 — 현재 record와 Undo

- InnoDB clustered index는 row data를 저장한다.
- record에는 마지막 변경 트랜잭션을 나타내는 `DB_TRX_ID`와 Undo를 가리키는 `DB_ROLL_PTR`가 있다.
- Undo record에는 업데이트 전 내용을 재구성하는 데 필요한 정보가 들어 있다.
- 근거: [6][12]

## Slide 15 — Consistent read

- T1이 현재 record `200`을 읽지만, `DB_TRX_ID=T2`가 자신의 Read View에서 보이지 않는다고 판단한다.
- 그러면 roll pointer를 따라 Undo에서 이전 `100`을 재구성한다.
- Undo는 rollback 전용이 아니라 consistent read에도 사용된다.
- 근거: [6][7][8]

## Slide 16 — Purge

- InnoDB는 DELETE도 내부적으로 delete-mark한 뒤 즉시 물리 삭제하지 않는다.
- 과거 Read View나 rollback이 Undo를 더 이상 요구하지 않을 때 Purge가 history list를 처리한다.
- VACUUM과 비슷한 수거 역할이 있지만, InnoDB에는 사용자가 같은 방식으로 실행하는 VACUUM 명령이 있는 것이 아니다.
- 근거: [9]

## Slide 17 — 공통 실패 모드

- 오래 열린 reader는 두 엔진 모두에서 안전한 수거 경계를 과거에 묶어 둔다.
- PostgreSQL에서는 dead tuple 회수 지연과 bloat, InnoDB에서는 update Undo 회수 지연과 history 증가로 나타난다.
- 읽기 전용 트랜잭션도 오래 열어두면 InnoDB Undo 정리를 막을 수 있다.
- 근거: [4][6]

## Slide 18 — 격리 수준은 별도 축

- PostgreSQL 기본 `READ COMMITTED`는 statement마다 snapshot을 새로 만든다.
- InnoDB 기본 `REPEATABLE READ`의 consistent read는 첫 조회의 snapshot을 재사용한다.
- 이것은 heap과 Undo라는 저장 위치 차이와 별개의 snapshot 수명 정책이다.
- 이 설명은 plain nonlocking `SELECT` 기준이다. Locking read와 DML에 그대로 일반화하지 않는다.
- 근거: [2][7][10]

## Slide 19 — 최종 비교

- 현재·과거·판정·수거 네 역할에 다시 대입한다.
- VACUUM에는 Visibility Map과 XID freeze가, Undo에는 rollback 책임이 추가로 있다.
- 목적이 비슷하다는 이유로 VACUUM과 Purge를 같은 구현으로 부르면 중요한 차이가 사라진다.

## Slide 20 — 네 가지 오해 방지

- 비교 범위는 MySQL 전체가 아니라 InnoDB다.
- WAL/redo와 Undo는 목적이 다르다.
- VACUUM과 Purge는 같은 청소 명령이 아니다.
- 표준 VACUUM이나 Purge 완료가 데이터 파일 크기 축소를 보장하지 않는다.
- 근거: [4][6][8][9][14]

## Slide 21 — 결론과 다음 질문

- MVCC의 공통 원리는 여러 버전과 snapshot 가시성이다.
- PostgreSQL은 과거 tuple을 heap에 두고, InnoDB는 현재 clustered record에서 update Undo를 따라 과거를 재구성한다.
- 따라서 청소 방식도 VACUUM과 Purge로 갈린다.
- 표준 VACUUM 후에도 심한 물리 bloat를 온라인으로 줄여야 한다면 다음 주제는 `pg_repack`이다. [13]

## Slide 22 — 출처

- PostgreSQL 18과 MySQL 8.4 공식 문서만 핵심 근거로 사용했다.
- 번호별 전체 URL과 확인일은 `citations.json`에 있다.
- 질문을 받을 때 구현 세부와 격리 수준을 섞지 않는 것이 가장 중요하다.
