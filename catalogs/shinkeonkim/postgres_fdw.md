# postgres_fdw

> 다른 PostgreSQL DB의 테이블을 일반 SQL에서 조회하고 수정하는 외부 데이터 접근 확장이다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 외부 데이터 · DB 연동 |
| 검증 환경 | PostgreSQL 18.6 · 동일 호스트 Docker의 두 DB |
| 라이선스 | PostgreSQL License |
| 문서 · 소스 | [공식 문서](https://www.postgresql.org/docs/18/postgres-fdw.html) · [REL_18_6 소스](https://github.com/postgres/postgres/tree/REL_18_6/contrib/postgres_fdw) |
| 정리한 사람 | shinkeonkim |
| 회차 | week07 |

## 1. Before / After

**Before:** 앱이 두 DB에 각각 연결해 결과를 합치거나, 원격 데이터를 로컬에 복사해 갱신 주기를 관리한다.

**After:** 원격 표를 foreign table로 등록하고 SELECT·JOIN에 사용한다. 표 정의가 로컬에 생기며 데이터는 원격에 남는다. 조회 때 서버 간 통신과 원격 실행 비용이 발생한다.

```sql
SELECT b.id,b.title,p.name
FROM remote_school.books b
JOIN remote_school.publishers p ON p.id=b.publisher_id
WHERE b.id<=10;
```

## 2. 설치 & 데모

원격에 books 표와 fdw_reader의 SELECT 권한이 있는 새 환경에서:

```sql
CREATE EXTENSION postgres_fdw;
CREATE SERVER school_remote FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'remote',dbname 'school',port '5432');
CREATE USER MAPPING FOR CURRENT_USER SERVER school_remote
OPTIONS (user 'fdw_reader',password 'study_only');
CREATE SCHEMA remote_school;
IMPORT FOREIGN SCHEMA public LIMIT TO (books)
FROM SERVER school_remote INTO remote_school;
SELECT id,title FROM remote_school.books WHERE id<=3 ORDER BY id;
```

비밀번호는 폐기 가능한 실습 전용이다. postgres_fdw 자체는 shared_preload_libraries나 재시작이 필요 없다. 원격 준비부터 수행하려면 웹 `#/postgres-fdw/lab-connect`를 따른다. 실행 파일은 week07/postgres_fdw/labs에 있다.

## 3. 트레이드오프

| 항목 | 판단 |
| --- | --- |
| 이럴 때 쓴다 | 선택도가 높은 원격 조회, 이전 중 데이터 대조, 가끔 하는 DB 간 결합 |
| 다른 설계도 비교 | 반복 대량 분석, 원격 장애 중에도 독립적인 응답, 여러 DB의 원자적 쓰기 |
| 비용 | RTT·전송량·원격 CPU/I/O·연결 슬롯·잠금·트랜잭션 유지 |
| 대안 | 앱의 복수 연결, dblink, ETL, 복제, 로컬 구체화 뷰 |

## 4. 관리형 DB 지원

특정 서비스 연결 실험은 아직 수행하지 않았다. RDS·Aurora·Supabase·Neon·Cloud SQL 각각의 대상 버전에서 허용 확장, CREATE SERVER·mapping 권한, outbound 경로, 원격 인증·TLS를 확인한다. 확장 제공 여부와 실제 접속 가능 여부는 별도다.

## 5. 내부 동작을 확인하는 출발점

```sql
EXPLAIN (ANALYZE,VERBOSE,BUFFERS)
SELECT category,count(*) FROM remote_school.books GROUP BY category;
```

Remote SQL로 필터·JOIN·집계 위치를 확인한다. 로컬 Filter는 가져온 뒤 판단하는 조건이며 로컬 BUFFERS는 원격 I/O의 측정값이 아니다. 원격 계획도 따로 읽는다. 읽기 묶음은 fetch_size, INSERT 묶음은 batch_size다.

## 6. 검증 결과

| 관찰 | 실제 결과 |
| --- | --- |
| 원격 id<=10과 같은 뜻의 로컬 함수 필터 | 같은 ID 10개, 로컬 필터는 99,990행 제거 |
| 10,000행, fetch_size 100 / 1000 | 실제 FETCH 101회 / 11회, 마지막 종료 확인 포함 |
| 원격 변경 후 같은 로컬 트랜잭션의 반복 SELECT | before → before, COMMIT 후 after |
| 정상 로컬 ROLLBACK | 원격 tx_probe 변경 취소 |
| 원격 행 잠금 유지 | 로컬 UPDATE가 statement_timeout으로 취소 |
| 지속 로컬 세션 4개 | 원격 연결 4개, keep_connections=false 후 연결 해제 |

반복 성능 실험 3개는 조건당 10회 실행했다. 상세 시간·범위·해석은 웹 `#/postgres-fdw/experiments`에서 실제 JSON과 함께 제공한다. 내부 Docker·합성 데이터 결과이며 WAN·서비스 p99·분산 커밋 장애까지 검증한 것은 아니다.

## 자료

- 웹 진입: `web/#/postgres-fdw/about`
- 기본 학습 10장 · 실습 5개 · 반복 실험 3개 · 심화 6장
- [웹 실행·문서 동기화 안내](web/README.md)
- 관련 카탈로그: [dblink](dblink.md) · [file_fdw](file_fdw.md)

설명은 모두 web에서 제공하며 week07에는 실행용 SQL·스크립트·측정 원본을 둔다.
