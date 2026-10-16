# 08. 트랜잭션·스냅샷·장애

## 이 장에서 얻을 것

BEGIN·COMMIT·ROLLBACK과 스냅샷의 의미를 배우고, 원격 연결이 들어간 경우의 보장 경계를 구분한다. 쓰기 재시도는 “오류가 나면 같은 SQL을 다시 실행”보다 어려운 문제다.

## 1. 트랜잭션은 작업의 묶음이다

BEGIN으로 시작하고 COMMIT으로 확정한다. ROLLBACK은 해당 트랜잭션의 변경을 취소한다. 자동 커밋 모드에서는 각각의 SQL이 짧은 별도 트랜잭션으로 실행된다.

```sql
BEGIN;
SELECT title FROM remote_school.books WHERE id = 1;
SELECT title FROM remote_school.books WHERE id = 1;
COMMIT;
```

스냅샷은 읽을 수 있는 데이터의 버전 범위를 나타낸다. 다른 사용자가 중간에 제목을 바꿔 커밋했더라도 내 읽기가 어떤 스냅샷을 유지하느냐에 따라 새 값을 보지 않을 수 있다.

## 2. 로컬 READ COMMITTED와 원격 읽기

postgres_fdw는 로컬 트랜잭션에 대응하는 원격 트랜잭션을 관리한다. 로컬 SERIALIZABLE이면 원격도 SERIALIZABLE이고, 그 외에는 원격 REPEATABLE READ를 사용한다. 그러므로 로컬의 기본 READ COMMITTED에서도 한 트랜잭션의 반복 원격 SELECT는 같은 스냅샷을 볼 수 있다.

Lab 04는 첫 SELECT → 별도 원격 세션의 UPDATE/COMMIT → 두 번째 SELECT → 로컬 COMMIT 후 SELECT 순서로 관찰한다. 단순히 pg_sleep을 넣는 대신 두 세션의 실행 순서를 제어한다. 그래서 왜 이전 값을 보는지 설명할 수 있다.

## 3. 읽기 연결이 idle과 idle in transaction인 차이

idle 연결은 작업을 마친 채 다음 요청을 기다리는 상태다. idle in transaction은 트랜잭션을 열어둔 채 다음 명령을 기다리는 상태다. 후자는 스냅샷이나 쓰기 잠금을 오래 유지할 수 있다. 연결을 유지한다는 것과 트랜잭션을 유지한다는 것은 다르다.

사용자 입력이나 긴 외부 API 응답을 기다리면서 DB 트랜잭션을 열어두는 패턴은 원격에도 영향을 준다. pg_stat_activity의 xact_start·state와 실제 잠금 보유 여부를 확인한다.

## 4. 로컬 롤백과 분산 원자성을 구분한다

일반적인 성공·실패 경로에서는 로컬 트랜잭션 종료에 따라 원격 커밋·롤백도 관리된다. Lab 04는 원격 쓰기 후 로컬 ROLLBACK이 값을 되돌리는 것을 확인한다. 그러나 이 정상 경로 확인은 장애 상황의 분산 원자성 증명이 아니다.

postgres_fdw는 원격 트랜잭션을 2단계 커밋용으로 prepare하지 않는다. 여러 서버와 로컬 쓰기를 함께 다룰 때 모든 장애 상황에서 “전부 성공 또는 전부 실패”한다고 가정하면 안 된다. 한 DB 트랜잭션의 보장을 여러 DB에 자동 확대하지 않는다.

원격 commit·abort는 기본적으로 순차 처리하지만 PostgreSQL 18에는 parallel_commit·parallel_abort 옵션도 있다. 병렬 처리는 2PC를 추가하지 않으므로 처리 순서와 분산 원자성을 분리해서 이해한다. [블로그 트랜잭션 설명의 검토](/postgres-fdw/blog-review)에서 버전과 검증 범위를 확인한다.

## 5. 오류와 커밋 여부는 서로 다른 정보다

원격에 COMMIT이 도착한 뒤 응답이 끊겼다면 요청자는 실패를 받더라도 실제 변경이 반영됐을 수 있다. 이는 가능한 실패 시나리오를 설명한 것이며 이 랩이 해당 순간을 재현했다고 주장하는 것은 아니다.

돈을 더하거나 주문을 생성하는 재시도에는 업무 ID·UNIQUE 제약·처리 상태 확인·멱등 설계가 필요하다. 실패한 트랜잭션은 ROLLBACK으로 끝내고 다음 시도를 새 트랜잭션에서 진행한다. 읽기 재시도와 쓰기 재시도의 위험을 구분한다.

## 6. 복습

질문: 같은 트랜잭션에서 새 원격 제목을 못 보았다. FDW가 로컬 복사본을 캐시한 것일까?

답: 스냅샷이 원인일 수 있다. 트랜잭션을 끝낸 뒤 다시 읽는 실험으로 확인한다.

질문: ROLLBACK 실습에 성공하면 원격 서버 중단 시의 여러 DB 원자성도 검증됐나?

답: 아니다. 정상 종료 경로와 분산 장애 보장은 다른 질문이다.

## 참고와 다음 장

[격리 수준](https://www.postgresql.org/docs/18/transaction-iso.html) · [2단계 트랜잭션](https://www.postgresql.org/docs/18/two-phase.html)

다음: [09. 관련 확장과 설계 선택](09-related-and-architecture.md). FDW만으로 해결할 문제와 다른 도구를 쓸 문제를 나눈다.
