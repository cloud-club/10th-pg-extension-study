# Lab 05 · 세션별 연결·관측·관련 확장 — 수동 실습

전제: 기본 07·09. 세션·idle·연결 유지와 dblink·file_fdw의 역할을 구분한다.

## 실행 위치와 학습 목표

저장소 루트에서 다음 경로로 이동한다. 이후 이 페이지의 ./run.sh와 python3 verify.py는 해당 Lab 디렉터리 기준이다.

```bash
cd catalogs/shinkeonkim/week07/postgres_fdw/labs/05-connections-and-related
```

## 1. 연결 하나가 전역 풀인지 확인한다

```bash
./run.sh up
python3 verify.py
```

verify가 네 개의 지속 로컬 세션을 열어 각각 원격 books를 조회한다. 각 로컬 세션의 get_connections는 한 행, 원격 pg_stat_activity에서는 week07-connections 연결 네 개가 기대된다. 이어 keep_connections=false에서 다음 트랜잭션의 get_connections가 0인지 확인한다.

명령이 끝나면 세션은 닫힌다. 직접 관찰하려면 psql 터미널 네 개를 열고 아래를 각각 실행한 채 유지한다.

```sql
SELECT id FROM remote_school.books WHERE id=1;
SELECT * FROM postgres_fdw_get_connections();
```

원격 관리자 터미널에서:

```sql
SELECT pid,application_name,state,xact_start,wait_event
FROM pg_stat_activity WHERE application_name='week07-labs';
```

자동 커밋 조회가 끝난 뒤 연결이 idle인지, BEGIN 안에서 유지했다면 idle in transaction인지 구분한다. 연결 수는 active 쿼리 수와 동일하지 않다.

## 2. dblink는 SQL과 결과 타입을 직접 적는다

```sql
SELECT * FROM dblink(
 'host=remote dbname=school user=fdw_reader password=study_only',
 'SELECT id,title FROM public.books WHERE id<=3 ORDER BY id'
) AS r(id integer,title text);
```

FDW SELECT와 같은 결과를 얻지만 원격 문자열과 반환 열 타입을 직접 명시한다. dblink가 postgres_fdw planner pushdown의 동일한 표현 방식인 것은 아니다. 비밀번호는 실습 전용이다.

## 3. file_fdw는 서버 파일을 읽는다

```sql
SELECT * FROM public.csv_books ORDER BY id;
```

local 컨테이너의 /lab/books.csv는 compose가 읽기 전용 마운트한 파일이다. 셋업에서 이 파일을 가리키는 foreign table을 만들었다. 예상 행은 세 개다. remote 서버의 books 10만 행과는 다른 데이터다.

COPY와 달리 일반 heap table에 적재하지 않고 파일을 외부 표로 읽는다. 호스트 파일 경로와 서버 컨테이너 경로를 구분한다. 프로그램 실행 옵션은 이 랩의 범위에 포함하지 않는다.

## 4. 쿼리 통계의 범위

```sql
SELECT query,calls,rows,total_exec_time FROM pg_stat_statements
WHERE query LIKE '%remote_school.books%'
ORDER BY calls DESC LIMIT 5;
```

setup에서 관측용 pg_stat_statements를 preload·설치했다. 이는 FDW 활성화 요구사항이 아니다. 원격에서도 pg_stat_statements를 읽어 실제 어떤 명령이 보이는지 확인한다. 원격 queryid를 로컬 queryid와 같은 요청 ID라고 가정하지 않는다.

## 관련 확장을 더 깊게 읽기

[dblink](../../related/dblink.md)에는 named connection·cursor 수명과 바깥 WHERE의 한계, [file_fdw](../../related/file-fdw.md)에는 파일 계약·COPY 선택 기준, [관측 도구](../../related/observability.md)에는 양쪽 통계·auto_explain의 범위를 정리했다. 캐시 전환 과제는 [pg_cron과 갱신 운영](../../related/cache-cron.md)을 읽고 신선도·실패 정책부터 작성한다.

## 5. 복습과 확장 과제

질문: get_connections 한 행과 원격 네 행이 모순일까? 아니다. 로컬 함수는 그 세션만, 원격 view는 원격 전체 활동을 본다.

과제: 앱 풀을 늘리기 전에 원격 연결 슬롯과 active 작업 예산을 적어 본다. 캐시로 전환하려면 허용 신선도·마지막 갱신 성공 시각·실패 정책을 먼저 정한다.

정리: `./run.sh down`은 모든 week07 Lab이 공유하는 전용 컨테이너와 볼륨을 제거한다. 다른 Lab의 관찰도 끝난 뒤 실행한다.
