# Lab · 같은 결과, 다른 실행 계획

## 목적과 환경
이 Lab은 속도 순위를 만들지 않고 실제 JOIN·scan 노드를 확인합니다. PostgreSQL 18.6 단일 컨테이너에서 학생 1만 행과 주문 10만 행을 생성합니다. orders.student_id와 두 필터 컬럼에 인덱스를 만들고 ANALYZE합니다. 병렬 실행을 끄고 알고리즘 비교 시에만 대안 JOIN을 억제합니다.
실행 파일은 catalogs/shinkeonkim/extra/pg-joins에 있으며 설명 문서는 모두 web에 있습니다. 생성·삭제하는 객체는 전용 컨테이너의 join_lab 스키마입니다. 기존 Week 07 DB를 사용하지 않습니다.

## 재현하기
저장소 루트에서 Docker가 실행 중인 상태로 다음을 실행합니다.
```bash
bash catalogs/shinkeonkim/extra/pg-joins/run.sh
```
run.sh는 컨테이너를 준비하고 lab.sql을 실행해 results/plan.txt에 원본 계획을 저장합니다. 다시 실행하면 전용 스키마를 재생성합니다. 끝난 뒤 컨테이너를 정리하려면 다음 명령을 실행합니다.
```bash
docker compose -f catalogs/shinkeonkim/extra/pg-joins/compose.yaml down -v
```

## Lab 01 · 세 알고리즘과 결과 동일성
학생 번호 1~100의 주문을 조회합니다. 각 학생에게 주문 10개가 있어서 예상 출력은 1,000행입니다. NL·Hash·Merge 설정에서 결과 건수를 검증하고 실제 계획을 저장합니다. 그중 하나의 핵심 쿼리는 다음과 같습니다.
```sql
BEGIN;
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_mergejoin = off;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT s.id, o.id FROM join_lab.students s
JOIN join_lab.orders o ON o.student_id = s.id
WHERE s.id <= 100;
ROLLBACK;
```
Nested Loop 안쪽 Bitmap Heap Scan과 Bitmap Index Scan의 loops가 100인지 확인합니다. 이 데이터에서는 일반 Index Scan 대신 bitmap 경로로 학생별 주문을 찾았습니다. Hash 계획의 Hash 아래 테이블을 찾습니다. Merge 계획에서 Sort가 어디에 붙는지 읽습니다. 이 쿼리의 계획 강제는 교육 목적이며 운영 권장 설정이 아닙니다.

## Lab 02 · BitmapOr와 JOIN의 공존
```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT s.id, o.id FROM join_lab.students s
JOIN join_lab.orders o ON o.student_id = s.id
WHERE o.category = 1 OR o.region = 2;
```
category는 id % 100, region은 floor(id / 100) % 100으로 생성합니다. 두 조건은 각각 1,000행, 교집합은 10행이므로 예상 결과는 1,990행입니다. Lab에서는 enable_seqscan을 꺼 bitmap 경로를 쉽게 관측합니다. BitmapOr는 orders의 행 위치를 합치고 그 위의 JOIN이 students와 연결합니다.

## Lab 03 · Hash 배치와 메모리
전체 주문을 연결하는 같은 쿼리를 work_mem 64kB와 16MB로 각각 실행합니다. hash_mem_multiplier는 1로 고정합니다. 낮은 메모리에서 Batches와 temp I/O가 늘어나는지 확인합니다. 타이밍 한 번으로 성능 우열을 선언하지 않습니다. 캐시·하드웨어·동시성에 따라 수치가 달라집니다.

## 실제 관측과 해석
아래는 저장소에서 실행한 계획의 요약입니다. 원본 plan.txt의 actual 시간은 해당 실행의 수치이며 반복 벤치마크가 아닙니다.
| 사례 | 실제 확인 | 해석 |
| --- | --- | --- |
| 세 JOIN 방식 | 모두 1,000행 | 알고리즘이 달라도 같은 결과 |
| Nested Loop | 안쪽 Bitmap Heap/Index Scan loops=100 | 학생 100명마다 주문 인덱스 조회 |
| Hash Join | 학생 입력을 Hash로 구축 | Hash 아래를 보고 build 입력 확인 |
| Merge Join | 두 인덱스의 순서 사용, Sort 없음 | 이 데이터에서는 정렬 준비를 인덱스로 제공 |
| BitmapOr + Hash Join | 1,990행 | scan과 JOIN이 같은 계획에 공존 |
| Hash 64kB / 16MB | Batches 8 / 1 | 작은 메모리에서 8배치와 temp I/O 발생 |

Merge Lab에는 Sort가 없었습니다. Sort 노드를 반드시 만들어 보고 싶다면 같은 트랜잭션에서 enable_indexscan과 enable_indexonlyscan을 off로 설정해 대안 경로를 관찰합니다. 인덱스로 순서를 받는 경우와 Sort로 준비하는 경우를 구분합니다.

## 스스로 바꿔 볼 조건
학생 조건을 100에서 1 또는 10,000으로 바꾸고 강제 설정이 없는 계획을 비교합니다. SELECT 컬럼에 긴 payload를 추가해 Hash 공간을 관찰합니다. ORDER BY와 LIMIT을 추가해 startup 비용이 어떤 선택을 만드는지 확인합니다. 각 변경에서는 결과 건수·설정·원본 계획을 함께 기록합니다.
[EXPLAIN 문서](https://www.postgresql.org/docs/18/using-explain.html)를 참고하고 [심화 진단 순서](planning.md)로 돌아갑니다.
