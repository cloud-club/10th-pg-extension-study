# Lab 05 - FastAPI 백엔드에서 pg_bigm 쓰기

```bash
./run.sh          # 이미지 빌드 + 기동 + curl 데모까지 (첫 실행은 1분 내외)
```

01~04 lab 이 `pg_bigm` 자체의 동작을 psql 로 직접 확인했다면, 이 lab 은 **실제 백엔드 서비스가 이 확장을 어떻게 쓰는지**를 보여준다. FastAPI 로 만든 작은 검색 API 하나가 전부다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## 구성

```
postgres/   pg_bigm 을 빌드한 DB 이미지 + 시드 데이터(articles 테이블, 한글 문서 20개 + 필러 1000개)
api/        FastAPI 앱
```

두 컨테이너(`postgres`, `api`)가 `docker-compose.yml` 로 함께 뜬다.

## 엔드포인트

| 메서드 · 경로 | 하는 일 | 쓰는 pg_bigm 기능 |
|---|---|---|
| `GET /articles/search?q=` | 부분 문자열 검색 | `likequery()` - 사용자 입력을 안전하게 LIKE 패턴으로 이스케이프 |
| `GET /articles/similar?q=&threshold=` | 오탈자 허용 검색 | `=%` 연산자, `bigm_similarity()`, `pg_bigm.similarity_limit` |
| `GET /articles/debug/bigm?text=` | 2-gram 분해 확인 (디버깅용) | `show_bigm()` |

## 핵심 포인트

- **애플리케이션 코드에는 pg_bigm 전용 문법이 거의 없다.** `/articles/search` 는 그냥 `LIKE` 를 쓴다 - 인덱스(`gin_bigm_ops`)가 붙어있으니 빨라질 뿐, 쿼리 자체는 바꿀 게 없다.
- **`likequery()` 가 없으면 애플리케이션이 직접 이스케이프해야 한다.** 사용자가 검색창에 `%`나 `_`를 입력했을 때 의도치 않은 패턴이 되는 걸 막아준다 - `main.py` 의 코드 주석 참고.
- **`=%` 연산자는 psycopg 의 `%s` 파라미터 파서와 충돌한다** - `%%`로 이스케이프해야 한다. 이런 드라이버 레벨의 함정은 실제로 이 lab 을 만들면서 직접 겪고 고쳤다.
- **GUC(`pg_bigm.similarity_limit`)는 파라미터 바인딩이 안 된다** - `SET` 문 자체에 값을 넣어야 해서, 반드시 애플리케이션 쪽에서 값 검증(타입/범위)을 먼저 하고 문자열로 끼워 넣어야 한다.

## 다음 단계

- [`HANDS-ON.md`](HANDS-ON.md) - curl 예제와 Swagger UI 안내
- Swagger UI: http://localhost:18944/docs (컨테이너가 떠 있을 때)
- 이전 lab: [`../04-comparison-and-ops/`](../04-comparison-and-ops)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
