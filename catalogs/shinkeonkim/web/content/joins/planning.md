# 심화 · 계획 선택, 메모리와 동시 부하

## 실행 계획을 읽는 순서
첫째, SQL이 원하는 결과와 실제 출력 행 수를 확인합니다. 둘째, scan의 필터링과 JOIN 입력 건수를 읽습니다. 셋째, 추정 rows와 actual rows의 차이를 찾습니다. 넷째, loops·Sort·Hash 배치·버퍼·임시 I/O를 따라 비용이 늘어난 곳을 설명합니다. 마지막으로 쿼리·인덱스·통계·메모리 중 무엇을 바꿀지 결정합니다.
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT ...;
```
ANALYZE 옵션은 실제 쿼리를 실행합니다. 쓰기 쿼리에도 적용되므로 실습 대상과 트랜잭션을 확인합니다. cost는 밀리초가 아닙니다. actual rows와 시간은 loops당 평균이며 상위 노드가 하위 작업을 포함하므로 부모·자식 시간을 단순 합산하지 않습니다.

## 추정 오차가 알고리즘 선택에 미치는 영향
바깥 입력이 10행이라고 예상해 인덱스 Nested Loop를 골랐는데 실제 10만 행이면 안쪽 탐색이 1만 배 늘 수 있습니다. build 입력의 행 수와 폭을 과소평가하면 Hash의 배치와 임시 I/O가 늘 수 있습니다. 통계가 오래됐는지, 특정 값에 데이터가 몰리는지, 조건끼리 상관되어 있는지 확인합니다.
ANALYZE와 통계 목표 조정은 측정 후 고려합니다. 확장 통계가 모든 JOIN 선택도 문제를 해결하지는 않습니다. PostgreSQL 18의 extended statistics에는 JOIN 선택도 추정에 활용되지 않는 제약이 있습니다.
[통계 개념](https://www.postgresql.org/docs/18/planner-stats.html), [CREATE STATISTICS의 제한](https://www.postgresql.org/docs/18/sql-createstatistics.html)을 참고합니다.

## 메모리를 늘리기 전에 동시성을 계산하기
| 관측 | 조사할 것 |
| --- | --- |
| Hash Batches > 1, temp I/O | build 크기·행 폭·메모리 |
| Sort external merge, Disk | 입력 정렬 재사용·정렬 대상 축소 |
| Nested Loop 안쪽 loops 증가 | 바깥 추정·인덱스·키 반복 |
| 공유 버퍼 hit가 많아도 느림 | CPU·반복 횟수·출력 크기 |

예를 들어 동시 쿼리 20개가 각각 메모리를 쓰는 노드 3개를 갖고 노드당 32 MiB를 사용한다는 단순 가정만으로도 약 1.9 GiB입니다. 이는 보장 상한이나 실제 RSS 계산이 아닙니다. 해시 배수·노드 실행 중첩·worker·공유 메모리·백엔드의 다른 사용량을 따로 조사해야 합니다. Parallel Hash와 일반 Hash 아래의 병렬 입력은 같은 구조가 아닙니다.
[리소스 설정](https://www.postgresql.org/docs/18/runtime-config-resource.html), [병렬 JOIN 계획](https://www.postgresql.org/docs/18/parallel-plans.html)을 참고합니다.

## 강제 계획은 진단 도구
enable_hashjoin·enable_mergejoin·enable_nestloop를 바꿔 대안 계획을 살펴볼 수 있습니다. 세션 또는 SET LOCAL 범위로 한정하고 결과가 같은지 먼저 확인합니다. 특히 Nested Loop 비활성화는 사용을 억제할 뿐 다른 방법이 불가능하면 남을 수 있습니다. 강제한 계획이 한 번 빨랐다는 이유로 운영 전역 설정을 바꾸지 않습니다.
[계획 설정](https://www.postgresql.org/docs/18/runtime-config-query.html)을 참고합니다. Lab은 알고리즘을 관찰하려고 다른 후보를 억제하며 기본 설정의 계획도 별도로 저장합니다.

## FDW에서는 실행 장소를 추가하기
로컬 Hash Join에 원격 입력을 가져오는 경우와 원격에서 JOIN 후 결과만 가져오는 경우는 동일한 알고리즘 이름만으로 비교할 수 없습니다. 전송 행 수 × 행 폭, fetch 왕복, 원격 부하와 로컬 메모리를 함께 관찰합니다. [FDW 비용·통계·JOIN](/postgres-fdw/costs), [cursor·fetch·메모리](/postgres-fdw/cursors)로 이어집니다.
