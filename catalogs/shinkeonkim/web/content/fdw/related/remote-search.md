# pg_trgm · 검색 조건 전송과 원격 인덱스를 따로 검증하기

## 처음 이해하기: 검색을 어디서 끝낼까?
책 제목 검색을 다른 학교에서 끝내면 맞는 책만 가져올 수 있습니다. 우리 학교에서 검색하면 후보 제목을 먼저 받아야 할 수 있습니다. pg_trgm은 문자열을 trigram으로 다루는 검색 확장이며 DB 사이 연결을 만드는 확장은 아닙니다.

## 세 가지 조건을 나누기
| 단계 | 질문 | 확인 |
| --- | --- | --- |
| 설치와 의미 | 양쪽 함수·타입·연산자가 호환되는가? | 버전·정의·임계값 |
| 원격 전송 | 조건을 보내도 의미가 유지되는가? | extensions·volatility·Remote SQL |
| 원격 실행 | 보낸 조건에 인덱스를 쓰는가? | 원격 EXPLAIN·필터·버퍼 |

ALTER SERVER의 extensions 설정은 설치나 인덱스 생성 명령이 아닙니다. 이미 설치한 호환 확장의 전송 판단에 사용합니다. 조건을 전송했다는 사실과 인덱스로 실행했다는 사실도 서로 다릅니다.

## 기존 Lab에서 확인한 중요한 예외
[Lab 02](../labs/02-pushdown-and-search/HANDS-ON.md)는 pg_trgm을 extensions에 추가해도 % 조건이 로컬에 남는 것을 확인했습니다. %의 similarity_op는 세션 임계값에 의존하는 STABLE 함수여서 IMMUTABLE 전송 조건과 맞지 않았습니다. 반면 similarity(title, 'PostgreSQL guide') > 0.3처럼 명시 임계값을 사용하는 조건은 전송을 확인했습니다.

```sql
SELECT p.proname,p.provolatile
FROM pg_proc p WHERE p.proname IN ('similarity','similarity_op');
EXPLAIN (VERBOSE)
SELECT id,title FROM remote_school.books
WHERE similarity(title,'PostgreSQL guide') > 0.3;
```
provolatile의 i·s·v는 각각 immutable·stable·volatile입니다. 최적화를 위해 함수 volatility를 의미와 다르게 바꾸지 않습니다. [FDW 전송 규칙](https://www.postgresql.org/docs/18/postgres-fdw.html)

## 심화: 전송 가능한 조건이 인덱스 조건은 아니다
위 similarity 비교를 원격으로 보내더라도 trigram 인덱스가 그 표현식을 자동으로 Index Cond로 처리한다고 단정하지 않습니다. LIKE·ILIKE·정규식·지원 연산자와 GiST 거리 정렬 등은 연산자·인덱스 종류에 따라 비교합니다. 짧은 검색어와 선택도가 낮은 조건은 후보가 많을 수 있습니다. [pg_trgm의 인덱스 지원](https://www.postgresql.org/docs/18/pgtrgm.html)
원격 관리 세션에서 동일한 Remote SQL을 EXPLAIN하고 반환 건수·recheck·버퍼를 기록합니다. 임계값·collation·버전 차이를 통제하며 결과 의미가 같은 대안을 비교합니다.

## 실험을 확장할 순서
1. 같은 검색어·임계값에서 정답 id 집합을 보존합니다.
2. 로컬 Filter인지 원격 WHERE인지 확인합니다.
3. 원격 Seq Scan·Bitmap Scan·Index Scan을 읽습니다.
4. 전송 행 폭과 FETCH 횟수를 기록합니다.
5. 동시 검색 시 원격 CPU·I/O와 로컬 연결 예산을 함께 봅니다.

이 자료가 이미 검증한 것은 조건 전송의 차이입니다. 모든 검색 패턴의 인덱스 성능 비교를 완료한 것은 아닙니다. “원격 검색을 인덱스로 빠르게 했다”는 주장에는 원격 계획 증거를 추가합니다. 다음은 [관측 도구](observability.md)입니다.
