# 심화 03. cursor·fetch·메모리

## 출발점과 질문

기본 06의 ceil(N/F)×RTT는 가정 모델이었다. 실제 SELECT 실행의 커서·버퍼·종료 확인을 연결해 왜 실측과 다를 수 있는지 설명한다.

## 1. 커서는 원격 결과를 이어 읽는 손잡이다

postgres_fdw의 scan 구현은 원격에서 커서를 열고 FETCH로 결과 묶음을 받는다. 로컬 executor는 한 행씩 요구하지만 FDW는 내부 묶음에서 행을 반환한다. executor가 한 행씩 읽는 것과 네트워크가 한 행마다 왕복하는 것은 다르다.

```text
로컬 executor가 다음 행을 요구
→ FDW 묶음 버퍼에 행이 남았나?
  → 남았다: 버퍼에서 한 행 반환
  → 없다: 원격 FETCH, 행들을 변환해 저장
→ 종료면 더 이상 반환하지 않음
```

실제 함수 연결은 postgresIterateForeignScan → fetch_more_data → 원격 결과 처리다. create_cursor는 조회를 시작하고, rescan은 매개변수나 재실행에 따라 커서를 다시 다루며, 종료 시 정리한다.

## 2. 마지막 묶음에 종료 확인이 추가될 수 있다

N이 F의 배수이면 마지막 FETCH가 F행을 채워 반환했을 때 그것만으로 EOF인지 알 수 없다. 다음 빈 FETCH가 필요할 수 있다. N/F를 실제 요청 횟수로 확정하면 안 되는 이유다. 커서 생성·close·BEGIN/COMMIT도 별도 명령이다.

Lab 03은 같은 시점의 원격 로그에 나오는 실제 FETCH 명령 수를 세는 기능 확인을 제공한다. 문장 로그를 켠 실험은 로그 I/O가 시간을 바꾸므로 성능 비교 실험과 분리한다. 네트워크 패킷 수와 SQL FETCH 수도 같은 지표가 아니다.

## 3. 첫 행 지연과 완료 지연

fetch_size가 커지면 첫 묶음을 만드는 작업도 커질 수 있다. 전체 다운로드가 빨라져도 첫 결과를 앱에 보여주는 시간은 다르게 움직일 수 있다. 원격 ORDER BY·GROUP BY가 입력을 처리한 후 출력하는 경우에는 fetch 이전의 시작 지연이 지배적일 수 있다.

EXPLAIN의 node startup time, 총 실행 시간, 실제 앱 첫 행 수신은 측정 범위가 다르다. 현재 반복 실험은 서버의 EXPLAIN Execution Time을 기록하며 앱 첫 행 지연을 측정한 것으로 표현하지 않는다.

## 4. 메모리를 한 묶음 크기로만 예측하지 않는다

F × 평균 행 폭은 개념적인 결과 묶음 크기의 출발점이다. 실제 메모리에는 libpq 결과, PostgreSQL Datum 변환, tuple 구조, 메모리 컨텍스트와 로컬 JOIN·Sort도 포함된다. 문자열이 원격 저장에서 압축됐다고 네트워크와 로컬 메모리도 같은 크기라는 뜻은 아니다.

backend가 32개 동시에 넓은 결과를 받으면 한 세션의 안전한 설정이 전체 시스템에는 부담일 수 있다. work_mem은 FDW의 모든 메모리를 제한하는 전역 캡이 아니다. 프로세스 RSS·컨테이너 메모리·임시 파일을 함께 봐야 한다.

## 5. 여러 지역 네트워크의 실험 설계

컨테이너 내부 RTT와 지역 간 RTT는 전혀 다를 수 있다. 원격 CPU·쿼리·결과 폭·TLS를 고정한 뒤 RTT, 손실, 대역폭을 개별 축으로 바꾼다. 지연 주입은 “단방향 20ms”와 “실측 RTT 20ms”를 혼동하지 않는다.

Linux netem을 활용하려면 해당 환경의 네트워크 namespace와 권한을 확인하고 다른 업무 트래픽을 건드리지 않는 전용 링크를 사용한다. 이 저장소는 현재 WAN 지연 주입 결과를 제공하지 않는다. 내부 Docker 결과를 WAN 성능으로 일반화하지 않는다.

## 6. 비동기 실행이 줄이는 것은 대기 겹침이다

async_capable은 Append의 여러 foreign scan을 비동기로 진행할 수 있게 한다. 한 연결을 공유하는 쿼리는 순차 처리되므로 같은 server·mapping의 여러 표에 옵션을 켰다고 모두 동시에 실행되는 것은 아니다.

비동기는 원격 일을 없애지 않는다. 겹쳐 보낸 요청이 원격 포화를 앞당길 수도 있다. 네트워크 대기를 겹칠 수 있는 독립 목적지인지, 원격 처리 여유가 있는지, 실제 Append 계획인지 확인한다.

## 7. 복습

질문: FETCH가 101회였다면 앱이 DB 요청을 101번 한 것인가?

답: 아니다. 하나의 앱 SELECT 안에서 DB 사이 FETCH가 여러 번 일어날 수 있다.

질문: EXPLAIN 총 시간으로 첫 행 표시 시간을 검증했나?

답: 아니다. 측정 범위를 분리해야 한다.

## 근거와 다음

[libpq 비동기 처리](https://www.postgresql.org/docs/18/libpq-async.html) · [postgres_fdw.c REL_18_6](https://github.com/postgres/postgres/blob/REL_18_6/contrib/postgres_fdw/postgres_fdw.c)

다음: [심화 04. 연결·관측·부하](04-capacity-and-observability.md).
