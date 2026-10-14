# pg_stat_statements와 auto_explain · 느린 지점을 증거로 찾기

## 처음 이해하기: 성적표와 풀이 과정
pg_stat_statements는 반복된 SQL의 통계 성적표, EXPLAIN은 선택한 풀이 과정입니다. auto_explain은 조건에 맞는 실행 계획을 로그에 남기는 도구입니다. 세 도구는 서로 다른 질문에 답합니다.

## 양쪽에 설치할 때의 역할
pg_stat_statements는 shared_preload_libraries와 서버 재시작 등 설정이 필요합니다. postgres_fdw 자체의 활성화 요건과 분리합니다. 로컬에는 사용자 SQL, 원격에는 전송된 명령이 보일 수 있습니다. utility tracking·planning tracking·조회 권한도 기록합니다. [설정과 통계 열](https://www.postgresql.org/docs/18/pgstatstatements.html)

```sql
SELECT queryid,calls,rows,total_exec_time,mean_exec_time,
 shared_blks_hit,shared_blks_read,temp_blks_written
FROM pg_stat_statements
WHERE query ILIKE '%books%'
ORDER BY total_exec_time DESC LIMIT 10;
```
양쪽 서버에서 실행하는 조사 예제입니다. 오래된 누적값을 한 번 비교하기보다 같은 작업 구간의 전후 차이를 읽습니다. 공유 통계를 임의로 reset하면 다른 사용자의 관측을 지울 수 있으므로 스냅샷 비교를 먼저 사용합니다.

## 심화: 1회 호출이 원격 통계 1행은 아니다
FDW는 원격 cursor·FETCH·여러 명령을 사용할 수 있습니다. queryid는 서버 간 요청 ID가 아니며 통계에는 버전·설정에 따른 정규화와 수집 범위가 있습니다. 로컬과 원격의 total_exec_time을 단순 더하면 중첩된 대기를 이중 계산할 수 있습니다. 네트워크 RTT와 앱 풀 대기, 결과 직렬화는 별도 계측이 필요합니다.

```sql
SELECT pid,application_name,state,xact_start,wait_event_type,wait_event
FROM pg_stat_activity
WHERE application_name LIKE 'week07%';
```
원격에서 FDW application_name을 식별하는 예제입니다. 호출 기간·로컬 backend·원격 backend·로그를 연결하며 active와 연결 수를 구분합니다. [활동 상태 공식 문서](https://www.postgresql.org/docs/18/monitoring-stats.html)

## auto_explain을 추가할 때
auto_explain은 느린 쿼리의 계획을 기록할 수 있습니다. log_analyze는 실제 실행 정보를 수집하지만 계측 비용이 생기며 log_timing을 끄는 등 설정별 비용을 검토합니다. 샘플링·로그 임계값·nested statements·로그량을 조정합니다. 로컬 로그만으로 원격 인덱스 계획까지 볼 수 있다고 생각하지 않습니다. 원격에도 필요한 범위의 관측을 구성합니다. [auto_explain 공식 문서](https://www.postgresql.org/docs/18/auto-explain.html)
이 자료의 전용 Lab에서는 pg_stat_statements를 준비했으며 auto_explain 활성화·부하 실험은 아직 수행하지 않았습니다. 공식 사용법과 완료된 측정을 구분합니다.

## 진단 Lab 연결
[Lab 05](../labs/05-connections-and-related/HANDS-ON.md)의 연결 관측과 [심화 관측·부하](../docs/advanced/04-capacity-and-observability.md)를 함께 읽습니다. 가장 먼저 Remote SQL·rows·loops를 기록하고 원격 실행 비용인지 전송인지 로컬 결합인지 가설을 만듭니다.
복습: 로컬 queryid와 원격 queryid가 달라도 같은 업무 요청일 수 있는 이유를 설명합니다. 다음은 [pg_cron과 캐시](cache-cron.md)입니다.
