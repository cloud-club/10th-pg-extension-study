# 10. 용어집과 진단 순서

## 이 장에서 얻을 것

용어를 다시 설명하고, 증상에서 관측·가설·실험으로 넘어가는 순서를 연습한다. 기본 학습을 끝낸 뒤 랩과 심화 중 어디로 갈지 선택한다.

## 1. 핵심 용어

| 용어 | 쉬운 뜻 | 확인할 대상 |
| --- | --- | --- |
| foreign table | 원격 표를 가리키는 로컬 정의 | pg_foreign_table, 열 정의 |
| server | 접속 목적지 설정 | pg_foreign_server |
| user mapping | 로컬 역할과 원격 계정의 연결 | 현재 역할, 실제 원격 권한 |
| backend | 연결을 처리하는 PostgreSQL 프로세스 | pg_stat_activity.pid |
| pushdown | 데이터가 있는 서버로 처리를 보냄 | EXPLAIN VERBOSE의 Remote SQL |
| projection | 필요한 열만 선택 | 원격 SELECT 열 목록 |
| selectivity | 조건을 통과하는 행의 비율 | 예상 행과 실제 행 |
| cardinality | 결과 행 수 | rows와 loops |
| RTT | 요청·응답 왕복 시간 | 네트워크 관측 |
| bandwidth | 초당 전송 가능한 데이터량 | 유효 전송률 |
| fetch_size | 읽기 한 묶음의 행 수 | server·table 옵션 |
| batch_size | INSERT 한 묶음의 행 수 | 쓰기 옵션, 지원 조건 |
| snapshot | 읽을 수 있는 행 버전 범위 | 트랜잭션·격리 수준 |
| idle in transaction | 열린 트랜잭션에서 다음 명령 대기 | state, xact_start |
| planner cost | 실행 경로의 상대 추정 비용 | cost, 통계, 비용 옵션 |
| throughput | 초당 완료 요청 수 | 부하 실험 완료 건수 |
| p95 | 요청 95%가 이하인 지연 | 전체 요청의 분포 |
| idempotency | 같은 업무를 재시도해도 효과가 중복되지 않음 | 업무 ID, UNIQUE, 상태 |

## 2. 느린 조회의 진단 순서

1. 기대 결과와 실제 결과가 같은지 확인한다. 빠른 오답은 최적화 결과가 아니다.
2. EXPLAIN VERBOSE로 Remote SQL·로컬 Filter·JOIN·Aggregate 위치를 확인한다.
3. ANALYZE로 예상 행과 실제 행·loops를 비교한다. 쓰기에는 실행 부작용을 고려한다.
4. 원격에서 같은 SQL의 인덱스·CPU·I/O·잠금을 확인한다.
5. 반환 행 수와 열 폭, 실제 전송 바이트·RTT를 확인한다.
6. 단일 요청과 동시 요청의 지연·처리량을 나누어 비교한다.
7. 한 변수씩 바꿔 같은 정답·환경에서 반복한다.

예를 들어 “fetch_size를 늘려 주세요”라는 요청이 와도 먼저 원격 집계인지 확인한다. 결과가 한 행이면 fetch_size는 주요 원인이 아닐 수 있다. “원격 네트워크가 느리다”는 질문에는 원격 잠금 대기를 먼저 발견할 수도 있다.

## 3. 상황 문제와 해설

상황 A: GROUP BY 결과 두 행을 얻는 데 오래 걸리고 로컬 계획에 Aggregate가 있다.

해설: 원격에서 두 행만 받았는지 단정하지 않는다. Remote SQL에 집계가 있는지, 로컬 필터가 집계를 막았는지, 원격에서 얼마를 받았는지 살핀다. [Lab 02](../../labs/02-pushdown-and-search/HANDS-ON.md)에서 확인한다.

상황 B: 앱 풀을 8에서 64로 늘린 후 평균보다 p95가 크게 나빠졌다.

해설: 원격 연결 수·active 요청·CPU·I/O·잠금과 앱 풀 대기를 함께 본다. 처리량이 늘었는지도 확인한다. 로컬 연결 수를 늘리는 것이 원격 처리 용량을 늘리지 않는다.

상황 C: 원격 UPDATE가 커밋됐는데 기존 로컬 트랜잭션이 이전 값을 읽는다.

해설: FDW 원격 트랜잭션의 스냅샷을 확인하고 COMMIT 후 재조회한다. [Lab 04](../../labs/04-transactions-and-locks/HANDS-ON.md)에서 순서를 제어한다.

상황 D: 원격 쓰기에 오류가 났으니 자동으로 같은 업무를 다시 요청한다.

해설: 오류가 커밋 미반영을 증명하는지 확인해야 한다. 업무 ID로 상태를 조회하고 중복 효과를 막는다. 이 문제는 read-only SQL 튜닝과 별도다.

## 4. 무엇을 먼저 실습할까

처음 DB를 함께 읽는다면 Lab 01 → 02 → 03 → 04 → 05 순서로 진행한다. 각 Lab의 웹 Lab 페이지는 관찰 목표와 수동 절차를 설명하고 week07의 run.sh는 자동 실행을 담당한다. 자동 실행이 통과한 뒤 결과를 자기 말로 설명해 본다.

planner가 왜 원격 처리를 선택하지 않는지 궁금하면 심화 01·02, RTT와 메모리의 관계가 궁금하면 심화 03, 업무 정확성이 중요하면 심화 05를 읽는다. 심화 문서는 기본 용어를 알고 있다는 전제에서 구현과 판단 근거를 더 상세히 연결한다.

## 5. 질문을 자료에 반영하는 방법

질문마다 증상·환경·가설·관측 결과를 분리한다. 기존 설명에 빈 개념이 있으면 그 장을 먼저 보강하고 필요한 Lab을 연결한다. 단순히 질문과 답을 마지막에 덧붙여 읽는 순서를 무너뜨리지 않는다.

성능 숫자는 실행 스크립트·버전·조건·반복 횟수와 함께 남긴다. 계산기로 만든 가정값을 실험 데이터에 넣지 않는다. 측정이 가설과 다르면 가설 또는 실험을 수정하고 이전 해석도 함께 정정한다.

## 참고와 다음 단계

[EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) · [관측 통계](https://www.postgresql.org/docs/18/monitoring-stats.html)

다음: [심화 01. planner와 shippability](../advanced/01-planner-and-shippability.md) 또는 [Lab 01](../../labs/01-connect-and-metadata/HANDS-ON.md).
