# 심화 04. 연결·관측·부하

## 출발점과 질문

연결 수가 늘 때 어떤 자원이 먼저 포화되는지 판단한다. 로컬 FDW 대기와 원격 쿼리 대기를 연결하고, 벤치마크가 무엇을 측정했는지 정확히 적는다.

## 1. 요청의 네 구간

```text
앱 풀 대기 → 로컬 계획·실행 → FDW 원격 연결·실행·전송 → 앱 결과 처리
```

이 구간들은 호출 경로에서 겹치거나 포함 관계를 가진다. 로컬 Execution Time에 원격 대기가 포함되므로 로컬 시간과 원격 시간을 더하면 같은 구간을 중복 계산할 수 있다.

DB 통계는 앱 풀 대기나 최종 JSON 직렬화 시간을 포함하지 않는다. 사용자가 체감한 전체 시간과 DB 실행 시간의 차이를 봐야 한다. 성능 보고서에는 타이머의 시작·끝을 적는다.

## 2. 대기 이벤트는 원인의 최종 이름이 아니다

PostgreSQL 18의 FDW 대기 이벤트는 연결 수립·원격 결과·정리 대기를 구분하는 데 도움이 된다. 결과 대기가 길다고 네트워크만 느리다고 확정하지 않는다. 원격의 lock wait·CPU·I/O가 로컬에서는 원격 결과 대기로 보일 수 있다.

```sql
SELECT pid, application_name, state, wait_event_type, wait_event,
       clock_timestamp() - xact_start AS transaction_age
FROM pg_stat_activity
WHERE datname = current_database();
```

로컬과 원격에서 실행한 결과를 같은 시점에 비교한다. 원격 application_name을 실습·작업별로 구분하면 어떤 연결인지 찾기 쉽다. PostgreSQL 18 get_connections의 추가 컬럼과 16 출력 형식이 같다고 가정하지 않는다.

## 3. 연결 예산은 세 계층에서 정한다

앱 풀 크기는 사용 가능한 로컬 연결을 제한한다. 로컬 backend가 접촉한 목적지·mapping 수는 원격 연결 수에 영향을 준다. 원격 max_connections는 업무 연결 전체와 공유한다.

너무 큰 풀은 처리량이 늘지 않는 상태에서도 idle 연결이나 active 요청을 늘릴 수 있다. 너무 작은 풀은 앱 큐를 길게 만든다. 목표는 최대 연결 개수가 아니라 부하가 올라갈 때 지연·처리량·오류가 허용 범위에 있는 것이다.

connection.c의 GetConnection은 backend별 캐시와 실제 원격 연결을 연결하고, 트랜잭션 종료 콜백은 연결의 작업 상태를 정리한다. 연결 재사용과 트랜잭션 보존은 같은 설정이 아니다.

## 4. pg_stat_statements와 로그의 서로 다른 증거

pg_stat_statements는 정규화한 SQL별 호출·시간·행 등의 누적값이다. 특정 요청의 순간 지연을 그대로 나타내지 않는다. 실패·취소·계획 단계와 계측 설정에 따라 관측 범위도 고려한다.

원격에는 FDW cursor·FETCH와 생성 SQL이 나타날 수 있다. queryid 값만으로 양쪽 한 요청을 직접 join하지 않는다. application_name·시각·로컬 PID와 필요한 경우 로그를 함께 사용한다. 계획 SQL과 실행 SQL을 구분한다.

## 5. 실험을 성립시키는 조건

먼저 단일 쿼리의 결과와 계획을 고정한다. 이후 동시 세션 1·4·16처럼 바꾸며 완료 요청 수·전체 시간·지연 분포·오류를 기록한다. 요청 생성기가 병목이 아닌지도 확인한다.

닫힌 루프는 각 worker가 이전 응답 후 다음 요청을 보내므로 서버가 느려지면 입력률도 떨어진다. 열린 루프는 목표 도착률을 유지하려고 하며 대기열 증가를 더 직접 보여준다. 둘의 처리량·p95를 같은 조건처럼 비교하지 않는다.

이 저장소의 작은 실험은 서버 EXPLAIN 반복과 세션 연결 동작 검증을 제공한다. 서비스 전체의 부하 한계·WAN p99까지 검증한 것으로 표현하지 않는다. 추가 부하 실험이 필요하면 요청 발생 방식과 계측을 확장한다.

## 6. 복습

질문: 로컬 200ms + 원격 150ms이므로 요청은 350ms인가?

답: 로컬 시간에 원격 대기가 포함되면 중복 합산이다. 측정 범위를 확인한다.

질문: 원격 연결이 32개면 32개 쿼리가 동시에 실행 중인가?

답: idle 연결도 포함될 수 있다. state와 실제 active 수를 봐야 한다.

## 근거와 다음

[누적 통계](https://www.postgresql.org/docs/18/monitoring-stats.html) · [pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html) · [connection.c REL_18_6](https://github.com/postgres/postgres/blob/REL_18_6/contrib/postgres_fdw/connection.c)

다음: [심화 05. 쓰기·잠금·실패](05-writes-locks-and-retries.md).
