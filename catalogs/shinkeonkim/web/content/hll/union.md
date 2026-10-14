# 기본 09 · 숫자를 더하지 말고 스케치를 합치기

## 겹치는 학생이 있는 두 날짜
월요일 {1,2,3}, 화요일 {3,4}이면 일별 고유 수 합은 3+2=5지만 이틀 고유 수는 {1,2,3,4}의 4입니다. 숫자 두 개에는 누가 겹치는지 정보가 없습니다. 같은 계약의 스케치는 합집합 요약을 만들 수 있습니다.

## 레지스터 모형의 병합
A=[1,3,0,2], B=[2,1,4,2]라면 각 위치의 max를 취해 [2,3,4,2]로 합칩니다. 같은 입력의 버킷과 rank가 같아야 이 성질이 의미 있습니다. HLL 스케치를 숫자별로 더하거나 레지스터를 합산하지 않습니다.

```sql
CREATE TABLE hll_lab.daily AS
SELECT day,hll_add_agg(hll_hash_integer(user_id),11,5,-1,1) sketch
FROM hll_lab.events GROUP BY day;
SELECT hll_cardinality(hll_union_agg(sketch)) FROM hll_lab.daily;
```
이 CREATE 예제는 자동 Lab이 만든 daily를 제거하거나 다른 이름을 정한 뒤 수동 실행합니다. hll_union은 두 스케치, hll_union_agg는 여러 스케치를 합칩니다. [함수 계약](https://github.com/citusdata/postgresql-hll/blob/master/REFERENCE.md)

## 병합이 무손실이라는 말과 정확한 인원수는 다릅니다
호환되는 레지스터 스케치는 각 칸의 max로 병합하면 원본 합집합을 같은 설정으로 직접 요약한 상태와 같습니다. 순서·중복이 max 결과를 바꾸지 않기 때문입니다. 추가적인 요약 손실 없이 합칠 수 있다는 강점이며, 기존 추정 오차가 사라지는 것은 아닙니다. 레지스터를 읽고 합치는 CPU·원격 스케치 전송·저장 비용도 있으므로 무료 연산은 아닙니다.

## 실행 가능한 일별 저장과 주간 조회
다음은 기존 Lab 표에서 별도 결과 표를 만드는 예제입니다. 전체 스크립트를 같은 세션에서 실행하고 정리할 수 있습니다.
```sql
BEGIN;
CREATE TEMP TABLE daily_uniques AS
SELECT day,hll_add_agg(hll_hash_integer(user_id),11,5,-1,1) AS users
FROM hll_lab.events GROUP BY day;
SELECT day,hll_cardinality(users) FROM daily_uniques ORDER BY day;
SELECT hll_cardinality(hll_union_agg(users)) FROM daily_uniques
WHERE day >= DATE '2026-01-01' AND day < DATE '2026-01-08';
ROLLBACK;
```
집계 생성은 원본을 읽지만 마지막 기간 조회는 일별 스케치만 읽습니다. 문자열 ID에는 hll_hash_text, bigint에는 hll_hash_bigint를 선택하며 기간 경계와 입력 계약을 맞춥니다. 이 Lab은 고정 날짜를 사용해 실행 시점에 따라 빈 결과가 나오지 않도록 했습니다.

## 날짜 경계와 이동 창
지난 7개 행은 지난 7일과 다를 수 있습니다. 하루가 빠지거나 같은 날짜의 그룹이 여러 행이면 ROWS 6 PRECEDING은 다른 기간을 뜻합니다. 날짜 경계·시간대·그룹 키를 명시하고 필요한 날짜의 스케치를 필터링한 뒤 병합합니다.
오래된 날짜를 빼고 새 날짜를 넣는 이동 창에서 일반적인 HLL 삭제는 없습니다. 보관한 일별 스케치로 원하는 기간을 다시 합치는 방법을 비교합니다. 일별 저장은 집계 차원을 선택하는 설계입니다.

## Lab의 정답
[Lab 02](lab-union.md)는 7일 × 일별 10,000명, 210,000개의 방문 기록을 만듭니다. 일별 정확값 합은 70,000명이지만 주간 정확값은 25,000명입니다. 병합한 스케치와 원본을 한 번에 집계한 스케치가 같은지 검증합니다. 추정값이 정답 25,000과 정확히 같아야 하는 검증은 아닙니다.
복습: 요약을 다시 합쳐 같은 값을 얻는 것과 정답에 오차가 없는 것은 같은 보장일까요? 아닙니다. 다음은 [제약과 선택](limits.md)입니다.
