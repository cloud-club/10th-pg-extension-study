# Lab 03 · FETCH 횟수와 네트워크 모델 — 수동 실습

전제: 기본 06. 반환 행·RTT·fetch_size와 설정 우선순위를 구분한다.

## 실행 위치와 학습 목표

저장소 루트에서 다음 경로로 이동한다. 이후 이 페이지의 ./run.sh와 python3 verify.py는 해당 Lab 디렉터리 기준이다.

```bash
cd catalogs/shinkeonkim/week07/postgres_fdw/labs/03-fetch-and-network
```

## 1. 비교할 쿼리를 고른다

```bash
./run.sh up
./run.sh psql
```

```sql
ALTER SERVER school_remote OPTIONS (SET fetch_size '100');
EXPLAIN (ANALYZE,VERBOSE)
SELECT id,title FROM remote_school.books WHERE id<=10000;
ALTER SERVER school_remote OPTIONS (SET fetch_size '1000');
EXPLAIN (ANALYZE,VERBOSE)
SELECT id,title FROM remote_school.books WHERE id<=10000;
ALTER SERVER school_remote OPTIONS (SET fetch_size '100');
```

count(*)만 읽으면 원격에서 한 행으로 집계될 수 있으므로 실제 10,000행을 가져오는 쿼리를 쓴다. EXPLAIN ANALYZE는 서버가 결과를 끝까지 처리하며 psql에는 계획만 출력하므로 터미널에 행을 찍는 비용과 분리된다. 앱 전체 행 다운로드 시간까지 잰 것은 아니다.

## 2. 실제 FETCH 명령을 센다

```bash
python3 verify.py
```

자동 검증은 원격 읽기 역할의 log_statement를 잠시 all로 바꾸고 각 조건에 고유 application_name을 붙인 새 연결을 연다. 시작 시각 이후 로그에서 FETCH 명령을 세고, finally에서 역할 로그와 server 옵션을 원래대로 복원한다.

N=10,000인 현재 스캔에서 F=100은 101회, F=1,000은 11회가 기대된다. 데이터 묶음 100회·10회에 마지막 빈 FETCH가 더해지는 구현을 확인하는 것이다. 다른 N·LIMIT·rescan에는 같은 수를 적용하지 않는다.

## 3. 왜 이 로그로 속도 우승을 말하지 않을까

문장 로그는 원격 I/O와 출력 처리를 추가한다. FETCH가 많은 조건은 로그도 더 많이 만든다. 따라서 log_statement=all을 켠 검증의 시간으로 순수 fetch_size 성능 차이를 주장하지 않는다. 횟수 검증과 성능 실험을 별도로 실행한다.

network 계산기의 ceil(N/F) 값은 데이터 묶음의 단순 모델이다. 실제 횟수 결과와 나란히 보고 EOF 확인 같은 빠진 작업을 설명한다. FETCH 수는 SQL 명령 수이지 TCP 패킷 수가 아니다.

## 4. 행 폭을 바꿔 본다

```sql
EXPLAIN (ANALYZE,VERBOSE)
SELECT id,title,payload FROM remote_school.books WHERE id<=10000;
```

payload는 더 넓은 결과를 만들기 위한 합성 문자열이다. 같은 반환 행 수여도 전송량과 변환 작업이 늘 수 있다. pg_column_size(payload)는 내부 저장 크기이며 실제 전송 바이트가 아니다.

## 5. 결과 기록과 한계

results/run.json에는 환경·반환 행·실제 FETCH 수를 저장한다. RTT 주입·실제 wire bytes·RSS·앱 첫 행 시간은 이 랩에서 측정하지 않는다. 반복 실험 02는 로그를 끈 상태에서 fetch_size와 행 폭별 서버 실행 시간을 비교한다.

복습: 10,000/1,000=10인데 왜 11회인가? 마지막 가득 찬 묶음 다음에 빈 결과로 종료를 확인한다. 실제 구현의 EOF 처리와 단순 모델을 구분한다.

정리: `./run.sh down`은 모든 week07 Lab이 공유하는 전용 컨테이너와 볼륨을 제거한다. 다른 Lab의 관찰도 끝난 뒤 실행한다.
