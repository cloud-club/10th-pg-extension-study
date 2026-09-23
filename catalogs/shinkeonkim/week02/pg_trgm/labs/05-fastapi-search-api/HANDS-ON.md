# Lab 05 직접 해보기 - FastAPI 통합

```bash
./run.sh up          # postgres + api 기동
open http://localhost:18964/docs    # Swagger UI
```

## STEP 1 - 검색어 길이에 따라 경로가 갈린다

```bash
curl -sG http://localhost:18964/articles/search --data-urlencode "q=클라우드클럽" | jq
#  "mode": "substring"   <- 3글자 이상이라 %q% 로 검색

curl -sG http://localhost:18964/articles/search --data-urlencode "q=클클" | jq
#  "mode": "prefix"      <- 2글자라 q% 로 우회
```

`main.py` 의 이 부분이다.

```python
MIN_SUBSTRING_LEN = 3
if len(q) >= MIN_SUBSTRING_LEN:
    mode, pattern = "substring", f"%{escaped}%"
else:
    mode, pattern = "prefix", f"{escaped}%"
```

## STEP 2 - 왜 그렇게 해야 하는지 직접 확인한다

```bash
curl -sG http://localhost:18964/articles/explain \
     --data-urlencode "q=클클" --data-urlencode "mode=substring" | jq '.index_scan_rows, .plan'
curl -sG http://localhost:18964/articles/explain \
     --data-urlencode "q=클클" --data-urlencode "mode=prefix" | jq '.index_scan_rows, .plan'
```

| 패턴 | 인덱스 스캔이 돌려준 행 | Recheck 제거 | 인덱스 버퍼 | 실행 시간 |
|---|---:|---:|---:|---:|
| `%클클%` | **20,016** (= 테이블 전체) | 20,015 | 170 | 8.21 ms |
| `클클%` | **1** | 0 | 5 | **0.062 ms** |

`%클클%` 쪽은 `GIN_SEARCH_MODE_ALL` 상태다 — 인덱스를 통째로 읽고 힙에서 20,015행을 걸러냈다.

## STEP 3 - 유사도 검색 (관련도 순 정렬)

```bash
curl -sG http://localhost:18964/articles/similar \
     --data-urlencode "q=김신컨 발표 자료" --data-urlencode "threshold=0.3" | jq
#  "김신건 발표 자료"  similarity 0.6667
```

한 글자 오타(`건` → `컨`)가 있어도 찾는다. `LIKE` 로는 0건인 검색이다.

```bash
# 임계값을 낮추면 후보가 늘어난다
curl -sG http://localhost:18964/articles/similar \
     --data-urlencode "q=김신컨" --data-urlencode "threshold=0.1" | jq '.count'
```

**GUC 는 파라미터 바인딩이 안 된다.** `main.py` 가 `float()` 캐스팅으로 검증한 뒤 문자열로 끼워 넣는 이유다 — 검증 없이 그대로 넣으면 SQL 인젝션이 된다.

## STEP 4 - KNN 자동완성 (pg_bigm 에는 없는 기능)

```bash
curl -sG http://localhost:18964/articles/autocomplete --data-urlencode "q=클라우드클" | jq
```

```
클라우드클럽 스터디 안내   distance 0.6667
클라우드 클럽 운영 회고    distance 0.7333
클라으드클럽 오탈자 예시   distance 0.8889
```

**임계값을 넘는 게 하나도 없어도 항상 5건을 돌려준다.** `%` 연산자였다면 0건이었을 검색어에도 "그나마 가까운 것"을 준다 — "검색 결과 없음"을 피해야 하는 UI 에 맞다.

```bash
# 전혀 상관없는 검색어를 넣어도 결과가 나온다
curl -sG http://localhost:18964/articles/autocomplete --data-urlencode "q=zzzzzz" | jq '.results[0]'
```

## STEP 5 - 정규식과 U+07FF 벽

```bash
curl -sG http://localhost:18964/articles/regex --data-urlencode "pattern=cloudclub|CloudClub" | jq '.index_effective, .note'
#  true

curl -sG http://localhost:18964/articles/regex --data-urlencode "pattern=클라우드클럽" | jq '.index_effective, .note'
#  false  "U+07FF 를 넘는 문자(한글 등)가 있어 ..."
```

**결과는 둘 다 맞게 나온다 — 다른 건 인덱스가 도와주느냐다.** `main.py` 가 `any(ord(ch) > 0x7FF for ch in pattern)` 로 미리 판정해 경고를 함께 돌려준다. 실제 서비스라면 이 경우 요청을 거부하거나 `LIKE` 로 후보를 좁히는 경로로 보내야 한다.

---

## 정리 - 애플리케이션이 책임져야 하는 것

| | pg_bigm | pg_trgm |
|---|---|---|
| 검색어 길이 검증 | 불필요 | **필요** (3글자 미만) |
| LIKE 이스케이프 | `likequery()` | **직접 구현** |
| 정규식 문자 검증 | 해당 없음 | **필요** (U+07FF) |
| GUC 값 검증 | 필요 | 필요 |
| 드라이버 `%` 이스케이프 | 필요 (`=%`) | 필요 (`%`) |

## 다음 단계

- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- pg_bigm 통합 예제: [`../../../pg_bigm/labs/05-fastapi-search-api/`](../../../pg_bigm/labs/05-fastapi-search-api)
