# 블로그 주의사항 검토 · 사실, 조건, 실험으로 다시 읽기

## 먼저 내린 판단

인용한 우아한형제들 글의 방향은 유용합니다. 다만 특정 이관 경험의 해결책을 모든 FDW 조회의 규칙으로 적용하지 않습니다. 이 페이지는 원문을 비난하거나 성능 수치를 재검증했다고 주장하지 않고, 주의사항의 표현·적용 조건을 PostgreSQL 18 기준으로 확인합니다. 확인일은 2026-10-09입니다.

[우아한형제들 사례 원문](https://techblog.woowahan.com/20371/), 원문이 참고한 [Crunchy Data 성능 글](https://www.crunchydata.com/blog/performance-tips-for-postgres-fdw)을 읽고 공식 보장과 자체 실험을 구분했습니다. 기업의 당시 수치에 대한 실행 계획·원본 측정 환경이 모두 공개된 것은 아니므로 그 숫자의 독립 재현까지 완료한 것은 아닙니다.

| 주장 | 판정 | 자료에 필요한 보강 |
| --- | --- | --- |
| 로컬·원격 JOIN은 느려질 수 있다 | 맞음, 조건부 | 전송 행·열, Remote SQL, loops를 먼저 확인 |
| 같은 remote DB의 JOIN은 한 번에 fetch한다 | 표현 보정 | JOIN pushdown과 FETCH 횟수는 별개 |
| CTE로 조회 대상을 줄이면 된다 | 조건부 | 실제 필터 위치, 인라인화와 MATERIALIZED 확인 |
| fetch_size를 늘리면 개선된다 | 조건부 | 왕복은 줄지만 반환 행 자체는 줄지 않음 |
| 읽기 전용 옵션과 최소 권한이 필요하다 | 타당 | 두 옵션 분리, table override와 원격 권한 확인 |
| 원격 commit·abort는 순차 처리된다 | 기본 동작 설명 | 현재 버전의 병렬 옵션과 2PC 미지원 구분 |
| 작업 후 설정 제거는 필수다 | 일회성 이관에는 타당한 절차 | 상시 사용, 메타데이터, 연결, 권한을 구분 |

## 1. JOIN: 원격에서 결합해도 FETCH는 여러 번일 수 있다

같은 DB 주소라는 사실만으로는 충분하지 않습니다. 같은 foreign server 객체·user mapping, 전송 가능한 JOIN 조건과 비용 판단을 확인합니다. 두 server 객체가 같은 DB를 가리켜도 하나의 server 객체처럼 자동 통합된다고 생각하지 않습니다. 로컬 표와 원격 표를 연결하면 로컬 결합 단계가 필요하지만, 원격 필터나 파라미터 조회까지 금지되는 것은 아닙니다.

“원격 JOIN 결과를 받는다”는 말은 “원격 원본 두 개를 각각 받아 로컬에서 결합하지 않을 수 있다”는 뜻입니다. 한 번의 FETCH라는 뜻은 아닙니다. 옵션 이름도 fetch_size이며 기본값은 100입니다. [공식 FDW 옵션과 최적화](https://www.postgresql.org/docs/18/postgres-fdw.html)를 참고합니다.

또한 원격 모든 행을 읽는 계획이 반드시 SELECT *를 전송하는 것은 아닙니다. 필요한 열만 가져와도 행 수가 많으면 비쌀 수 있습니다. Foreign Scan의 rows는 로컬 필터 이후 출력일 수 있으므로 Filter·Rows Removed by Filter·Remote SQL·원격 로그를 함께 읽습니다. 원격 전체 읽기와 원격 전체 행의 네트워크 전송도 구분합니다.

### 실제로 확인한 로컬 JOIN

```sql
SELECT b.id
FROM remote_school.books b
JOIN public.favorite_books f ON b.id = f.book_id;
```

현재 전용 Lab에서는 원격 books 100,000행을 가져와 로컬 favorite_books 3행과 결합해 결과 3행을 만들었습니다. 선택된 원격 SQL은 SELECT id FROM public.books였습니다. 전체 행 전송은 관측했지만 전체 열 전송은 아니었습니다. 이는 이 데이터·통계·비용 설정의 선택 결과입니다.

로컬 키를 먼저 모아 보내는 대안도 비교했습니다.

```sql
SELECT b.id
FROM remote_school.books b
JOIN public.favorite_books f ON b.id = f.book_id
WHERE b.id = ANY (
  (SELECT array_agg(book_id) FROM public.favorite_books)::integer[]
);
```

이 계획은 ANY ($1::integer[]) 조건을 전송했고 Foreign Scan이 3행을 반환했습니다. 키 배열이 작고 조건을 전송할 수 있다는 전제입니다. 큰 배열의 생성·직렬화·전송·원격 계획 비용도 조사해야 합니다. 이 결과를 “ANY는 항상 빠르고 IN은 항상 전체 조회”라는 규칙으로 확대하지 않습니다. 두 쿼리의 실제 반환 id 집합도 같은지 검증했습니다.

[비용·통계·JOIN](docs/advanced/02-cost-statistics-and-joins.md), [번외 JOIN 심화](/pg-joins/planning)로 이어집니다.

## 2. CTE: 이름을 붙이는 것보다 필터를 어디에 두는지가 중요하다

CTE는 쿼리 중간 결과에 이름을 붙이는 SQL입니다. 영구적인 로컬 복사본을 만드는 materialized view와 다릅니다. 부작용 없는 비재귀 CTE는 참조 횟수 등에 따라 상위 쿼리로 합쳐질 수 있습니다. MATERIALIZED는 별도 계산을 요청하지만 원격 필터를 자동으로 만들어 주지 않습니다. [CTE 공식 문서](https://www.postgresql.org/docs/18/queries-with.html)

### 잘못 적용하면 전송이 늘어나는 예

```sql
WITH r AS MATERIALIZED (
  SELECT id FROM remote_school.books
)
SELECT id FROM r WHERE id <= 10;
```

이 Lab에서는 CTE 입력을 100,000행 가져온 뒤 바깥 조건으로 10행을 남겼습니다. 반대로 필터를 안에 두면 다음 계획의 원격 입력은 10행이었습니다.

```sql
WITH r AS MATERIALIZED (
  SELECT id FROM remote_school.books WHERE id <= 10
)
SELECT id FROM r;
```

| 쿼리 | Foreign Scan 출력 | 최종 결과 |
| --- | --- | --- |
| 직접 WHERE id <= 10 | 10 | 10 |
| 일반 CTE + 바깥 WHERE | 10 | 10 |
| MATERIALIZED CTE + 바깥 WHERE | 100,000 | 10 |
| MATERIALIZED CTE + 안쪽 WHERE | 10 | 10 |

이 조건에서는 일반 CTE와 직접 WHERE의 효과가 같았습니다. MATERIALIZED를 만능 성능 옵션으로 가르치면 오히려 회귀를 만들 수 있습니다. 블로그 예제를 검토할 때도 now() 같은 함수·타입 변환을 포함한 조건이 실제 Remote SQL에 남는지 확인합니다. 날짜 경계 값을 미리 파라미터로 확정하는 대안을 비교하되 시간대와 업무 시점의 의미를 보존합니다.

## 3. fetch_size와 로컬 캐시: 해결하는 비용이 다르다

기존 [Lab 03](labs/03-fetch-and-network/HANDS-ON.md)은 결과 10,000행을 끝까지 읽을 때 fetch_size 100과 1,000에서 FETCH 101회와 11회를 관측했습니다. 빈 마지막 묶음으로 EOF를 확인한 결과까지 포함합니다. 반환 행 수는 그대로이고 왕복 횟수가 줄었습니다. 원격 전체 읽기의 원인을 없앴다는 뜻은 아닙니다.

큰 묶음은 메모리·선읽기량을 늘릴 수 있습니다. 전체 결과를 소비하는 배치와 일부만 읽는 요청을 따로 측정합니다. 표 옵션이 server 옵션보다 우선하므로 server 값을 바꿔도 표에 지정한 값은 남을 수 있습니다. [cursor·fetch·메모리](docs/advanced/03-cursors-network-and-memory.md), [FDW cursor 실행 코드](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/postgres_fdw/postgres_fdw.c)를 참고합니다.

### Materialized view를 쓰면 새로 생기는 질문

로컬 캐시는 반복 조회의 원격 접근을 줄이는 대신 저장 공간·최신성·갱신 부하를 관리합니다. 일반 REFRESH는 정의 쿼리를 다시 실행해 내용을 교체하며 자동 증분 동기화가 아닙니다. CONCURRENTLY에는 적합한 UNIQUE 인덱스와 이미 채워진 view 등의 조건이 있습니다. 같은 view의 REFRESH는 동시에 하나만 실행됩니다. [REFRESH 공식 문서](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html)

전처리·최초 복사·인덱스·갱신·검증 시간을 모두 포함해 비교합니다. 단순 updated_at watermark는 삭제, 늦게 도착한 변경, 같은 시각의 여러 행, 장기 트랜잭션을 놓칠 수 있어 동기화 규칙을 별도로 설계해야 합니다. 일회성 이관과 계속 갱신하는 캐시는 다른 문제입니다.

## 4. 쓰기 차단: 옵션과 권한을 두 층으로 검증하기

updatable=false는 INSERT·UPDATE·DELETE, truncatable=false는 TRUNCATE를 제어합니다. 하나만 꺼서는 다른 종류까지 차단했다고 볼 수 없습니다. server 기본값을 표 옵션으로 덮어쓸 수 있으므로 table-level 설정도 검사합니다.

```sql
-- 전용 Lab에서만 실행하는 변경 예시: 트랜잭션 종료 시 되돌립니다.
BEGIN;
ALTER SERVER writable_remote OPTIONS (ADD updatable 'false', ADD truncatable 'false');
SELECT foreign_table_schema, foreign_table_name, option_name, option_value
FROM information_schema.foreign_table_options
WHERE option_name IN ('updatable', 'truncatable');
ROLLBACK;
```

이미 존재하는 옵션을 변경할 때는 ADD 대신 SET을 씁니다. 검증 실험에서는 표에 updatable=false 또는 truncatable=false를 지정해 요청이 로컬에서 거부되는 것을 확인했습니다. 반면 server의 updatable=false에 표의 true를 겹치면 UPDATE의 계획 생성이 허용됐습니다. 이 검증은 EXPLAIN만 사용했고 해당 UPDATE를 실행하지 않았습니다.

원격 전용 역할에는 필요한 SELECT만 부여하고 실제 역할·상속 권한·객체 소유권을 확인합니다. 로컬 옵션을 수정할 권한이 있는 사용자를 상대로 옵션만을 권한 경계로 삼지 않습니다. 로컬 foreign table 권한과 원격 역할 권한은 각각 검사합니다. 기존 [Lab 01](labs/01-connect-and-metadata/HANDS-ON.md)은 원격 읽기 역할의 UPDATE 거부를 확인합니다. [권한 공식 문서](https://www.postgresql.org/docs/18/sql-grant.html), [쓰기 옵션 구현](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/postgres_fdw/postgres_fdw.c)을 참고합니다.

## 5. 트랜잭션: 정상 연동과 장애 원자성을 나누기

원격 트랜잭션과 savepoint는 로컬 작업에 대응해 관리됩니다. 로컬 SERIALIZABLE이면 원격도 SERIALIZABLE, 그 밖에는 REPEATABLE READ입니다. 따라서 로컬 READ COMMITTED에서도 같은 트랜잭션의 원격 재조회가 같은 스냅샷을 유지할 수 있습니다.

여러 원격 트랜잭션의 commit·abort는 기본적으로 순차적이지만 PostgreSQL 18에는 parallel_commit·parallel_abort 옵션도 있습니다. 병렬 처리는 지연을 바꾸는 옵션이며 분산 원자성을 추가하지 않습니다. 원격 트랜잭션을 2PC용으로 prepare하는 기능은 지원하지 않습니다. [FDW 트랜잭션 공식 문서](https://www.postgresql.org/docs/18/postgres-fdw.html), [트랜잭션·연결 구현](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/postgres_fdw/connection.c)을 참고합니다.

여러 DB의 읽기를 합쳤다는 사실만으로 동일한 전역 시점을 얻지는 않습니다. 커밋 중 연결이 끊겼다면 원격의 이미 확정된 효과를 로컬 오류만으로 미반영이라고 판단하지 않습니다. 업무 ID·원격 UNIQUE 제약·상태 조회·재시도 정책으로 불확실성을 다룹니다.

기존 [Lab 04](labs/04-transactions-and-locks/HANDS-ON.md)는 정상 rollback·원격 snapshot·잠금 취소를 검증합니다. 커밋 직후 단절, 여러 DB의 부분 성공, 병렬 커밋 장애는 아직 재현한 실험이 아닙니다. [쓰기·잠금·재시도](docs/advanced/05-writes-locks-and-retries.md)에서 장애 순서를 더 읽습니다.

## 6. 정리: 객체가 있는 것과 연결이 열린 것은 다르다

foreign table·server·user mapping은 로컬 카탈로그 정의입니다. 정의만 만들었다고 계속 원격 조회하는 백그라운드 작업이 시작되지는 않습니다. 연결은 첫 접근 때 만들어지고 기본적으로 로컬 세션에서 재사용됩니다. 사용자별 연결 수와 idle/idle in transaction을 구분합니다. 연결 유지 자체와 열린 트랜잭션의 snapshot·잠금 비용도 같은 문제가 아닙니다.

### 실제 연결 수명 관측

새 로컬 세션에서 postgres_fdw_get_connections()는 0행이었습니다. 원격 조회 후 트랜잭션이 끝났는데도 연결은 1개 남았습니다. 그 세션에서 postgres_fdw_disconnect('school_remote')를 실행한 뒤에는 0개였고 foreign table 정의는 그대로 있었습니다. 이 함수가 다른 로컬 백엔드의 연결까지 전부 닫는 것은 아닙니다. 현재 트랜잭션에서 사용 중인 연결은 즉시 끊을 수 없습니다. [연결 수명 구현](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/postgres_fdw/connection.c)

일회성 이관용 mapping·자격 증명·네트워크 접근은 역할이 끝나면 정리하는 것이 합리적입니다. 상시 서비스에 쓰는 FDW를 매 조회 후 삭제하는 규칙으로 확대하지 않습니다. 공유 extension은 다른 server와 foreign table의 의존성까지 확인합니다.

### 정리 순서에 보강할 내용

1. 이관 결과·건수·업무 정합성을 확인하고 이관 쿼리·계획·실행 기록을 보관합니다.
2. 앱·배치·view가 원격 정의를 더 참조하지 않는지 확인하고 작업을 종료합니다.
3. 종료 대상 세션의 원격 연결·열린 트랜잭션을 관측합니다.
4. 일회성 foreign table·mapping·server를 의존성 순서에 맞춰 명시적으로 제거합니다.
5. 원격 역할의 필요 없어진 권한·인증 경로를 정리합니다. 로컬 객체 삭제가 원격 역할을 자동 삭제하지 않습니다.
6. postgres_fdw 자체는 다른 용도가 없는 경우에 제거합니다. CASCADE를 기본 정리 명령으로 가르치지 않습니다.

DROP FOREIGN TABLE은 원격 원본 삭제가 아닙니다. 실험에서도 임시 foreign table을 제거한 뒤 원격 books가 남음을 확인했습니다. [DROP FOREIGN TABLE](https://www.postgresql.org/docs/18/sql-dropforeigntable.html), [DROP SERVER](https://www.postgresql.org/docs/18/sql-dropserver.html), [DROP EXTENSION](https://www.postgresql.org/docs/18/sql-dropextension.html)을 참고합니다.

## 7. 재현과 검증 범위

이 검토는 기존 전용 두 DB Lab이 준비되어 있어야 실행됩니다. 저장소 루트에서 다음을 실행합니다. 첫 명령은 학습 컨테이너의 객체·역할·데이터를 준비하는 스크립트이며 운영 DB 대상이 아닙니다.

```bash
bash catalogs/shinkeonkim/week07/postgres_fdw/labs/shared/run.sh up
python3 catalogs/shinkeonkim/week07/postgres_fdw/experiments/04-blog-review/verify.py
```

원본은 experiments/04-blog-review/results/run.json입니다. CTE 4개, 로컬 JOIN과 키 배열 대안, 쓰기 차단 2종, 표 옵션 우선순위, 연결 종료와 원격 표 보존을 검증합니다. 옵션 변경과 임시 객체는 rollback 범위에서 처리합니다. 숫자는 성능 반복 측정이 아니라 처리 위치와 결과를 확인한 단일 실행 관측입니다. 기존 반복 실험 3개와 구분합니다.

다음 보강 후보는 같은 정답의 원격 전처리·로컬 staging·캐시 갱신 전체 비용, 여러 세션에서의 정리, 커밋 장애 주입입니다. 완료하지 않은 실험을 근거로 표시하지 않습니다.

## 다음 단계로 실제 비교하기
[JOIN 비교 Lab](join-comparison.md)에서 직접 JOIN·키 배열·원격 전처리·로컬 staging의 같은 결과와 준비·조회 비용을 확인한다. 원격 부하·커밋 장애·캐시 갱신까지 완료한 결과는 아니다.
