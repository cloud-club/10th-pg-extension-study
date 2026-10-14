# Lab 02 · pushdown·JOIN·원격 검색 — 수동 실습

전제: 기본 04~05. SELECT·WHERE·JOIN·GROUP BY·EXPLAIN을 읽는다.

## 실행 위치와 학습 목표

저장소 루트에서 다음 경로로 이동한다. 이후 이 페이지의 ./run.sh와 python3 verify.py는 해당 Lab 디렉터리 기준이다.

```bash
cd catalogs/shinkeonkim/week07/postgres_fdw/labs/02-pushdown-and-search
```

## 1. 같은 정답의 두 필터

```bash
./run.sh up
./run.sh psql
```

```sql
EXPLAIN (ANALYZE,VERBOSE,BUFFERS)
SELECT id,title FROM remote_school.books WHERE id<=10;
EXPLAIN (ANALYZE,VERBOSE,BUFFERS)
SELECT id,title FROM remote_school.books WHERE public.local_small(id);
```

local_small은 같은 id<=10을 반환하는 VOLATILE PL/pgSQL 함수다. 첫 계획의 Remote SQL에는 WHERE가 있고, 두 번째에는 로컬 Filter와 Rows Removed by Filter가 있다. 최종 결과 10행이 같아도 받은 중간 데이터가 다르다.

자동 검증은 반환 ID 집합이 같은지와 로컬 Filter가 99,990행을 버리는지 확인한다. 현재 데이터에서의 결정적인 관찰이며 다른 크기의 데이터에도 같은 숫자를 기대하면 안 된다.

## 2. 집계 위치

```sql
EXPLAIN (ANALYZE,VERBOSE)
SELECT category,count(*) FROM remote_school.books GROUP BY category;
```

Remote SQL의 GROUP BY와 외부 노드의 결과 행 수를 확인한다. “결과 두 행”과 “원격에서 두 행을 받음”을 구분한다. WHERE에 local_small을 추가하면 집계 후보가 어떻게 바뀌는지도 관찰할 수 있다.

## 3. 같은 목적지 JOIN과 로컬 JOIN

```sql
EXPLAIN (VERBOSE)
SELECT b.id,p.name FROM remote_school.books b
JOIN remote_school.publishers p ON p.id=b.publisher_id
WHERE b.id<=10;
EXPLAIN (VERBOSE)
SELECT f.reader_name,b.title FROM public.favorite_books f
JOIN remote_school.books b ON b.id=f.book_id;
```

두 번째에는 로컬 표가 들어 있으므로 첫 번째와 같은 원격 JOIN을 기대하지 않는다. JOIN 종류·Remote SQL·예상 행 수를 적는다. 이후 ANALYZE를 붙여 실제 loops를 확인한다. 한 번의 계획 선택을 모든 데이터 크기에 일반화하지 않는다.

## 4. pg_trgm 조건 위치

```sql
ALTER SERVER school_remote OPTIONS (SET extensions '');
EXPLAIN (ANALYZE,VERBOSE)
SELECT id FROM remote_school.books WHERE title % 'PostgreSQL';
EXPLAIN (ANALYZE,VERBOSE)
SELECT id FROM remote_school.books WHERE similarity(title,'PostgreSQL') > 0.3;
ALTER SERVER school_remote OPTIONS (SET extensions 'pg_trgm');
EXPLAIN (ANALYZE,VERBOSE)
SELECT id FROM remote_school.books WHERE title % 'PostgreSQL';
EXPLAIN (ANALYZE,VERBOSE)
SELECT id FROM remote_school.books WHERE similarity(title,'PostgreSQL') > 0.3;
ALTER SERVER school_remote OPTIONS (SET extensions '');
```

양쪽의 pg_trgm은 setup에서 설치했다. 옵션 전후 모두 %는 로컬에 남는 것을 확인한다. pg_proc에서 similarity_op의 provolatile=s(STABLE), similarity의 provolatile=i(IMMUTABLE)를 읽는다. similarity 조건은 extensions 등록 뒤 원격 SQL로 가는지 비교한다. 양쪽 similarity_threshold가 다른 환경에서는 결과 의미도 별도로 맞춰야 한다. 이 랩은 기본값을 사용한 호환 환경에서 ID 집합을 대조한다.

## 5. 원격 인덱스도 확인한다

```bash
./run.sh remote
```

```sql
EXPLAIN (ANALYZE,BUFFERS)
SELECT id FROM public.books WHERE title LIKE '%PostgreSQL%';
```

LIKE는 유사도 비교와 다른 정답을 갖는 별도 인덱스 관찰이다. Bitmap Index Scan 또는 다른 실제 경로를 확인한다. similarity 함수 조건이 전송됐다고 trigram GIN 인덱스를 자동 사용한다고 단정하지 않는다. 이 환경에서 특정 인덱스를 만들었다는 사실과 planner가 이를 선택했다는 사실은 다르다. 결과 selectivity·통계에 따라 다른 경로도 정당할 수 있다.

## 6. 해석과 한계

로컬 함수 경로는 함수 호출 비용도 추가하므로 실행 시간 차이를 **순수 네트워크 비용**으로 부르지 않는다. 이 랩의 일차 검증은 처리 위치·제거 행·정답 동일성이다. 반복 시간 비교는 experiments에서 환경·반복 수와 함께 수행한다.

복습: extension을 등록하면 인덱스가 생기는가? 아니다. 설치·shippability·인덱스 생성·인덱스 선택을 각각 구분한다.

정리: `./run.sh down`은 모든 week07 Lab이 공유하는 전용 컨테이너와 볼륨을 제거한다. 다른 Lab의 관찰도 끝난 뒤 실행한다.

## 원격 검색의 다음 질문
[pg_trgm 관련 확장 심화](../../related/remote-search.md)에서 조건 전송과 원격 인덱스 사용을 별도 단계로 검증한다. 확장 이름 등록만으로 두 단계가 모두 해결되지 않는다.
