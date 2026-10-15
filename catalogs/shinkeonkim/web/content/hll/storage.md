# 심화 02 · EMPTY·EXPLICIT·SPARSE·FULL

## 같은 hll 타입 안의 다른 표현
확장은 EMPTY(빈 집합), EXPLICIT(고유 해시 목록), SPARSE(0이 아닌 레지스터만 보관), FULL(모든 레지스터를 비트로 보관)을 사용합니다. 고유 개수가 늘어도 바이트 수가 항상 일정하게 증가하는 것은 아닙니다. 해시 목록을 버리고 레지스터 요약으로 승격할 때 줄어들 수도 있습니다. [저장 명세](https://raw.githubusercontent.com/aggregateknowledge/hll-storage-spec/v1.0.0/STORAGE.md)

## 실제 값의 저장을 눈으로 확인하기
```sql
WITH v(id) AS (VALUES (17),(17),(28),(39))
SELECT hll_print(hll_add_agg(hll_hash_integer(id))) FROM v;
```
기본 설정에서 EXPLICIT, 3 elements와 고유 해시 세 개가 나왔습니다. 실제 값은 -7921456016582288345, -6816633132510080745, 6865416962167295854입니다. 사용자 ID 17·28·39를 원래 형태로 저장한 것이 아니며 중복된 17의 해시는 한 개만 남았습니다.

### 같은 입력을 강제로 레지스터 표현에 넣기
```sql
WITH v(id) AS (VALUES (17),(17),(28),(39))
SELECT encode(hll_send(hll_add_agg(hll_hash_integer(id),4,5,0,0)),'hex')
FROM v;
```
이 교육용 설정은 16개 레지스터·칸당 5비트, EXPLICIT와 SPARSE 비활성화입니다. 실제 결과는 14840000000000020000000040였습니다. 문자열 자체를 외울 필요는 없습니다. hll_send는 사람이 보기 위한 표가 아니라 직렬화된 bytes를 반환하고 encode는 그 bytes를 16진수로 보여줍니다.
헤더 뒤의 payload를 저장 명세에 따라 해석하면 [0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0]입니다. [기본 06](registers.md)의 7번·14번 레지스터 관측과 일치했습니다. bytes 안에 해시 목록이 남아 있는 방식과, 레지스터 값만 비트로 묶어 넣은 방식의 차이를 확인한 것입니다.

```bash
python3 catalogs/shinkeonkim/web/labs/hll/inspect-storage.py
```
저장소 루트에서 준비된 Lab을 대상으로 읽기 전용 SQL을 실행합니다. 결과는 web/labs/hll/results/storage.json이며, hash의 그룹·rank 계산 결과와 FULL bytes에서 해석한 16개 값을 대조합니다. 입력이 적어도 FULL을 강제한 학습 예제이므로 이를 기본 승격 동작으로 설명하지 않습니다.

## 파라미터의 역할
| 파라미터 | 바꾸는 것 | 주의 |
| --- | --- | --- |
| log2m | 레지스터 수 m=2^p | 공간·정밀도 영향 |
| regwidth | 레지스터 하나의 비트 수 | rank 저장 범위·포화 |
| expthresh | EXPLICIT 승격 기준 | -1 자동, 0 비활성화 |
| sparseon | 희소 표현 사용 | 0이면 생략 |

FULL의 레지스터 payload 모델은 m × regwidth / 8 bytes입니다. p=11·w=5이면 1,280 bytes입니다. Lab의 binary 표현에는 헤더가 포함되어 1,283 bytes가 나왔고 즉시 계산한 pg_column_size는 1,287 bytes였습니다. 실제 표 저장·TOAST·페이지·인덱스까지 포함한 크기나 집계 중 RSS는 아닙니다.

## 실제 전이 관찰
Lab에서는 n=160까지 EXPLICIT였고 n=161에서 SPARSE, n=1,000에서는 FULL이었습니다. n=160의 binary 크기 1,283 bytes에서 n=161의 317 bytes로 줄었습니다. 이것은 설정·입력·버전이 명시된 관측이며 모든 설치에서 같은 고정 경계라고 설명하지 않습니다. [Lab 01](lab-basics.md)과 결과 페이지에서 원본을 확인합니다.

## 직렬화와 버전
hll_send의 bytes와 사람이 읽는 hll_print를 구분합니다. 설치한 2.21에는 직접 bytea 캐스트가 없어 hll_send로 측정했습니다. 외부 구현끼리 binary를 교환하려면 저장 schema version·파라미터뿐 아니라 해시와 비트 규칙도 일치해야 합니다. 문서의 호환 설명만 보고 무검증으로 합치지 않습니다.
