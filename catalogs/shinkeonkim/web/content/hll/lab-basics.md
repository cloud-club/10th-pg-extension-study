# Lab 01 · 설치·중복·NULL·빈 입력·표현 전이

## 준비와 실행 위치
저장소 루트에서 실행합니다. Docker·Python 3가 필요하고 호스트 DB 포트는 노출하지 않습니다. 이 Lab은 web/labs/hll의 전용 컨테이너에서 hll_lab 스키마를 재생성합니다. 기존 Week 05 DB는 사용하지 않습니다.
```bash
bash catalogs/shinkeonkim/web/labs/hll/run.sh
```
Dockerfile은 postgres:18.6에 postgresql-18-hll 2.21 패키지를 설치합니다. 전체 검증은 bench.py로 실행하며 기존 결과를 덮어씁니다. psql 수동 접속은 다음과 같습니다.
```bash
docker compose -f catalogs/shinkeonkim/web/labs/hll/compose.yaml exec db psql -U postgres -d study
```

## 작은 입력의 결과 확인
```sql
WITH v(id) AS (VALUES (1),(1),(2),(3),(NULL))
SELECT count(*),count(DISTINCT id),
 hll_cardinality(hll_add_agg(hll_hash_integer(id))) FROM v;
SELECT hll_cardinality(hll_empty());
```
5·3·3, 빈 스케치는 0입니다. bench.py는 같은 5,000개 ID를 세 번 반복한 스케치가 한 번 집계한 스케치와 같은지 검증합니다. 입력 없는 집계는 NULL인지 별도로 검사합니다.

## 그림 1 · 작은 입력이 실제로 저장한 것
![실측 재구성 · 기본 EXPLICIT 해시 목록과 FULL 강제 설정의 레지스터. 두 설정을 비교한 그림이며 자동 승격 전후의 같은 설정 비교가 아닙니다.](/hll/plots/lab01-stored-values.svg)
위쪽에는 기본 설정에서 중복을 제거한 해시 세 개가 남았습니다. 아래쪽은 16개 레지스터를 쓰도록 설정을 바꾼 경우입니다. 17은 7번 칸에 rank 2, 28은 14번 칸에 rank 2를 남겼고 39는 7번 칸에 더 작은 rank 1을 만들어 기존 값을 바꾸지 않았습니다. 아래 막대의 높이를 사람 수로 읽지 않습니다.
이 그림은 [저장 관측 스크립트](storage.md)에서 실제 bytes와 레지스터 해석을 대조한 결과입니다. “새 ID가 들어오면 항상 칸이 바뀐다”는 명단 저장 모델과 어떻게 다른지 설명해 봅니다.

## 표현 전이 확인
```sql
SELECT hll_type(s),hll_cardinality(s),octet_length(hll_send(s)),pg_column_size(s)
FROM (SELECT hll_add_agg(hll_hash_integer(i)) s
 FROM generate_series(1,161) i) q;
```
n을 1·10·160·161·500·1,000·10,000으로 바꾸며 타입·크기·추정값을 기록합니다. 단순히 오류가 없다는 것보다 변화의 이유를 [저장 심화](storage.md)와 연결합니다. 자동 결과는 [실측 결과](results.md)에 있습니다.

## 그림 2 · 고유 개수가 늘 때 저장 크기
![실측 · 고유 개수와 hll_send 직렬화 크기. 가로축은 로그 축, 색은 실제 표현 타입, 선은 관측점을 연결합니다.](/hll/plots/lab01-storage-size.svg)
160개에서는 고유 해시 목록을 보관해 1,283 bytes였지만 161개에서 SPARSE 레지스터 요약으로 바뀌며 317 bytes가 됐습니다. 입력이 늘었는데 크기가 줄어든 이유는 원본 해시 목록 대신 적은 수의 비어 있지 않은 레지스터를 저장했기 때문입니다. 1,000개·10,000개에서는 FULL의 1,283 bytes로 같았습니다.
선 사이의 중간 지점을 실제로 모두 측정한 것은 아닙니다. 이 크기는 직렬화된 값이며 표 전체 공간·집계 메모리·RSS가 아닙니다. 저장 크기가 같다는 사실도 정확한 값이 모두 남았다는 뜻은 아닙니다.

## 정리
모든 실습이 끝난 뒤 다음 명령은 전용 hll 컨테이너만 제거합니다. 결과 JSON 파일은 web/labs/hll/results에 남습니다.
```bash
docker compose -f catalogs/shinkeonkim/web/labs/hll/compose.yaml down -v
```
복습: 161개를 넣었는데 160개보다 bytes가 줄어든 것이 반드시 데이터 손실 오류일까요? 해시 목록에서 레지스터 요약으로 표현이 바뀐 결과일 수 있습니다.
