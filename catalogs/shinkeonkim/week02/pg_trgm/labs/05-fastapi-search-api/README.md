# Lab 05 - 실전 통합: FastAPI 검색 API

```bash
./run.sh          # 빌드 -> 기동 -> curl 데모 시퀀스 (약 1분)
```

| | 명령 | 언제 |
|---|---|---|
| **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
| **직접** | [`HANDS-ON.md`](HANDS-ON.md) + Swagger UI (<http://localhost:18964/docs>) | 직접 만져볼 때 |

`pg_trgm` 을 실제 백엔드에 넣으면 **애플리케이션 코드가 무엇을 책임져야 하는지**를 보여주는 예제다. [`pg_bigm` 의 같은 lab`](../../../pg_bigm/labs/05-fastapi-search-api) 과 나란히 읽으면 차이가 뚜렷하다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## pg_bigm 통합과 무엇이 다른가

| | pg_bigm | pg_trgm |
|---|---|---|
| 검색어 길이 | 신경 쓸 필요 없다 | **3글자 미만이면 다른 경로로 보내야 한다** |
| 이스케이프 | `likequery()` 가 해준다 | **직접 구현해야 한다** (`like_escape()`) |
| 관련도 정렬 | 없다 | `similarity()` 로 정렬 |
| 자동완성 | 없다 | **KNN (`<->`)** — 결과가 없어도 "가까운 N건" |
| 정규식 | 불가 | 가능 (단, 한글은 인덱스가 안 먹는다) |
| DB Dockerfile | 24줄 (소스 빌드) | **14줄** (contrib) |

## 엔드포인트

| 경로 | 하는 일 |
|---|---|
| `GET /articles/search?q=` | 부분 문자열 검색. **3글자 미만이면 접두어 검색으로 자동 전환**하고 `mode` 필드로 알려준다 |
| `GET /articles/similar?q=&threshold=` | 유사도 검색 + 관련도 순 정렬 |
| `GET /articles/autocomplete?q=` | KNN 자동완성 (GiST) |
| `GET /articles/regex?pattern=` | 정규식 검색. `index_effective` 로 U+07FF 벽 여부를 알려준다 |
| `GET /articles/explain?q=&mode=` | 같은 검색어의 두 패턴을 EXPLAIN 해서 차이를 보여준다 |

## 직접 겪은 것

- **`/explain` 이 이 lab 의 핵심이다.** 20,016행 테이블에서 같은 2글자 검색어 `클클` 을 두 패턴으로 재면:

  | 패턴 | 인덱스 스캔이 돌려준 행 | Recheck 제거 | 인덱스 버퍼 | 실행 시간 |
  |---|---:|---:|---:|---:|
  | `%클클%` | **20,016** (테이블 전체) | 20,015 | 170 | 8.21 ms |
  | `클클%` | **1** | 0 | 5 | **0.062 ms** |

  애플리케이션이 검색어 길이를 보고 경로를 갈라야 하는 이유가 이 표다.

- **GUC 는 파라미터 바인딩이 안 된다.** `SET pg_trgm.similarity_threshold = %s` 는 문법 에러라 값을 문자열로 끼워 넣어야 하는데, 검증을 빼먹으면 그대로 SQL 인젝션이다. FastAPI 의 `ge`/`le` 로 범위를 강제하고 `float()` 로 한 번 더 캐스팅했다. (pg_bigm lab 에서도 똑같이 겪은 함정이다.)

- **`%` 연산자를 psycopg 로 쓰려면 `%%` 로 이스케이프해야 한다** — 드라이버의 파라미터 자리표시자와 충돌한다. 이것도 pg_bigm 의 `=%` 와 같은 문제다.

- **`likequery()` 가 없는 게 생각보다 불편하다.** `pg_bigm` 은 검색어를 안전한 LIKE 패턴으로 바꿔주는 함수를 제공하는데, `pg_trgm` 에는 없어서 `%`, `_`, `\` 이스케이프를 직접 구현하고 `ESCAPE '\'` 를 매 쿼리에 붙여야 한다.

## 다음 단계

- 이전 lab: [`../04-regex-and-tuning/`](../04-regex-and-tuning)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- pg_bigm 통합 예제와 비교: [`../../../pg_bigm/labs/05-fastapi-search-api/`](../../../pg_bigm/labs/05-fastapi-search-api)
