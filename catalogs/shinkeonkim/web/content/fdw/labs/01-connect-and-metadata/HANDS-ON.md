# Lab 01 · 연결과 메타데이터 — 수동 실습

전제: 기본 01~03. 서버·DB·역할·스키마·테이블을 구분한다.

## 실행 위치와 학습 목표

저장소 루트에서 다음 경로로 이동한다. 이후 이 페이지의 ./run.sh와 python3 verify.py는 해당 Lab 디렉터리 기준이다.

```bash
cd catalogs/shinkeonkim/week07/postgres_fdw/labs/01-connect-and-metadata
```

## 1. 준비하고 객체를 읽는다

```bash
./run.sh up
./run.sh psql
```

up은 원격 10만 권·출판사 100개·읽기/쓰기 분리 계정을 준비하고 로컬 foreign table을 등록한다. 초기화는 기존 행을 보존하며 반복 실행할 수 있다. 잘못 바꾼 전체 데이터까지 원래대로 되돌리는 reset 명령은 아니다.

```sql
SELECT extname, extversion FROM pg_extension WHERE extname='postgres_fdw';
SELECT srvname, srvoptions FROM pg_foreign_server;
SELECT foreign_table_schema, foreign_table_name
FROM information_schema.foreign_tables;
SELECT id,title FROM remote_school.books WHERE id IN (1,1000,2000) ORDER BY id;
```

srvoptions에는 목적지·fetch_size·연결 유지 옵션 등이 보인다. password가 들어 있는 user mapping을 그대로 출력해 공유하지 않는다. 현재 조회에서는 실제 값보다 “어떤 로컬 역할이 어떤 원격 계정을 사용하나”를 설명하는 것이 중요하다.

## 2. 가져온 것은 행인가 정의인가

```sql
SELECT c.relname,c.relkind FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='remote_school';
SELECT count(*) FROM remote_school.books;
```

외부 표의 relkind는 f다. count가 100000이라고 해서 local의 일반 heap table에 같은 행을 보관했다는 뜻은 아니다. 원격 표 조회 결과를 세는 것이다. IMPORT는 원격의 표 정의를 로컬에 만든다.

## 3. 읽기 권한과 쓰기 권한을 분리한다

```sql
UPDATE remote_school.books SET title='forbidden' WHERE id=1;
```

이 명령은 **의도적으로 권한 오류**를 낸다. psql 수동 세션의 자동 커밋 상태에서 실행한다. BEGIN 안에서 했다면 ROLLBACK으로 실패한 트랜잭션을 끝내야 한다. 자동 SQL에는 넣지 않고 verify.py가 오류 종류를 검증한다.

원격 로그인에 성공한 뒤 표 수정 권한이 거절되는 단계다. 네트워크 timeout과 같은 종류의 오류로 분류하지 않는다. 원격에서 fdw_reader는 SELECT만 가지며 tx_probe의 쓰기는 별도 server와 fdw_writer를 사용한다.

## 4. 예상과 실제를 구분한다

자동 검증은 id<=10이 10행인지, UPDATE가 permission denied인지, 원격 id=1이 그대로인지 확인한다. 예상 제목은 Network handbook 1이다. 실행 후 실제 값과 오류는 results/run.json에 저장한다. 예제 설명만 읽었다면 실행 확인으로 기록하지 않는다.

## 5. 스스로 설명하기

- local에서 psql을 켰는데 host=localhost가 잘못될 수 있는 이유는?
- CREATE SERVER와 원격 PostgreSQL 시작의 차이는?
- 관리자 조회 성공으로 앱 역할 권한을 확인했다고 할 수 없는 이유는?

해설: FDW 연결 출발점은 local PostgreSQL이다. server는 설정 객체이며 원격 프로세스 생성이 아니다. mapping과 로컬/원격 권한은 역할별로 다를 수 있다.

정리: `./run.sh down`은 모든 week07 Lab이 공유하는 전용 컨테이너와 볼륨을 제거한다. 다른 Lab의 관찰도 끝난 뒤 실행한다.
