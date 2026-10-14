# 기본 03 · hll_hash 함수는 무엇을 하는가?

## 집계할 입력을 HLL이 읽을 패턴으로 바꿉니다
hll_hash_integer는 정수 ID 하나, hll_hash_text는 문자열 ID 하나를 해시값으로 바꾸는 함수입니다. 결과 타입은 hll_hashval입니다. 이 단계에는 여러 사용자를 모아 놓은 스케치도, 추정 방문자 수도 아직 없습니다. 입력 한 개를 집계 준비가 된 패턴 한 개로 바꿉니다.

| 함수 | 받는 입력 | 반환하는 것 | 아직 하지 않은 일 |
| --- | --- | --- | --- |
| hll_hash_integer | integer ID 하나 | 64비트 해시값 하나 | 전체 고유 개수 집계 |
| hll_hash_bigint | bigint ID 하나 | 64비트 해시값 하나 | 전체 고유 개수 집계 |
| hll_hash_text | text ID 하나 | 64비트 해시값 하나 | 전체 고유 개수 집계 |
| hll_add_agg | 여러 해시값 | hll 요약 객체 하나 | 요약을 최종 숫자로 읽기 |
| hll_cardinality | hll 요약 객체 | 추정 고유 개수 | 원본 명단 복원 |

## 정수 ID로 세 단계를 나눠 실행하기
```sql
-- 1. 각 행을 바꿀 뿐입니다. 중복 ID의 행도 그대로 남습니다.
WITH visits(user_id) AS (VALUES (17),(17),(28),(39))
SELECT user_id,hll_hash_integer(user_id) AS input_pattern FROM visits;
```
17이 두 번 등장하면 같은 해시가 두 행에 나옵니다. 함수가 원본 행을 제거한 것은 아닙니다. 출력 숫자가 커 보여도 그것을 방문자 수로 읽지 않습니다.

```sql
-- 2. 여러 해시값을 하나의 요약 객체로 모읍니다.
WITH visits(user_id) AS (VALUES (17),(17),(28),(39))
SELECT hll_add_agg(hll_hash_integer(user_id)) AS user_sketch FROM visits;

-- 3. 객체에서 고유 개수의 추정 숫자를 읽습니다.
WITH visits(user_id) AS (VALUES (17),(17),(28),(39))
SELECT hll_cardinality(hll_add_agg(hll_hash_integer(user_id))) AS users FROM visits;
```
이 작은 입력의 마지막 결과는 3입니다. 확장이 작은 해시 목록을 명시적으로 보관하는 단계에서는 정확한 값이 나올 수 있습니다. 큰 입력의 결과가 항상 정확하다는 뜻은 아닙니다.

## 문자열 사용자 ID라면?
```sql
WITH visits(user_id) AS (VALUES ('alice'),('alice'),('bob'))
SELECT hll_cardinality(hll_add_agg(hll_hash_text(user_id))) AS users FROM visits;
```
이 예제에서는 문자열 ID를 hll_hash_text로 처리합니다. 정수 17과 문자열 '17'을 같은 해시라고 가정하지 않습니다. 입력 타입에 맞는 함수와 일관된 ID 표현을 사용합니다.

## 왜 해시 단계를 넣을까?
HLL은 원본 ID 숫자의 크기나 문자열 길이로 사람 수를 추정하지 않습니다. 해시 패턴을 그룹으로 나누고 특정 패턴의 관측 정보를 남깁니다. ID가 1·2·3처럼 연속이어도 HLL이 사용할 패턴은 충분히 고르게 분포해야 합니다. 같은 입력의 패턴은 반복할 때 같아야 중복이 추가 효과를 만들지 않습니다.
```sql
-- 타입만 바꿉니다. 해시 계산을 한 것이 아닙니다.
SELECT 123::hll_hashval;
```
이 캐스팅을 hll_hash_integer(123)의 대체로 사용하지 않습니다. [공식 함수 계약](https://github.com/citusdata/postgresql-hll/blob/master/REFERENCE.md)

## 서로 다른 단계의 정보 손실
해시 단계는 원본 ID를 제한된 비트에 대응시킵니다. 서로 다른 ID가 같은 해시를 만들 수 있는 충돌 가능성이 있습니다. 그 다음 HLL 집계는 해시 패턴들을 더 작은 개수 추정용 통계로 요약합니다. 해시값 하나와 집계된 스케치를 혼동하지 않습니다.
ID의 대소문자·테넌트 경계·해시 함수·seed가 달라지면 같은 사람을 같은 패턴으로 처리하지 못할 수 있습니다. 이 계약은 [심화](compatibility.md)에서 다룹니다. 일반 해시나 HLL을 개인정보 익명화의 보장으로 생각하지 않습니다.

## 복습
질문: hll_hash_integer(17)을 두 번 실행하면 2명이 될까요? 답: 같은 입력 패턴을 두 번 얻을 뿐입니다. 여러 패턴을 모으는 hll_add_agg와 숫자를 읽는 hll_cardinality가 다음 단계입니다.
다음은 [해시에서 무엇을 남길까?](bits.md)입니다.
