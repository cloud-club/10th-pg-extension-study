# Lab 05 직접 해보기 - FastAPI 검색 API

```bash
./run.sh up
```

컨테이너가 뜨면 두 가지 방법으로 만져볼 수 있다.

## 방법 1 - Swagger UI (권장)

브라우저에서 http://localhost:18944/docs 를 연다. 각 엔드포인트를 클릭하고 "Try it out" 으로 파라미터를 넣어가며 바로 호출해볼 수 있다.

## 방법 2 - curl

**짧은 키워드(2글자) 검색** - pg_bigm 이 짧은 키워드에 강한 이유를 실제로 체감한다.

```bash
curl -G http://localhost:18944/articles/search --data-urlencode "q=검색"
```

**긴 구절 검색**

```bash
curl -G http://localhost:18944/articles/search --data-urlencode "q=백엔드 개발"
```

**오탈자를 허용하는 유사도 검색** - "장고로 배우는 백엔드 개발" 제목을 일부러 틀리게 질의해도 잡힌다.

```bash
curl -G http://localhost:18944/articles/similar \
  --data-urlencode "q=장고로 배우는 백엔드 개펄" \
  --data-urlencode "threshold=0.3"
```

`threshold` 를 낮추면(예: 0.1) 더 느슨하게, 높이면(예: 0.6) 더 엄격하게 매칭된다 - 직접 값을 바꿔가며 결과가 어떻게 달라지는지 확인해보자.

**디버깅: 2-gram 분해 확인**

```bash
curl -G http://localhost:18944/articles/debug/bigm --data-urlencode "text=검색"
```

검색이 예상과 다르게 나올 때, 이 엔드포인트로 검색어가 실제로 어떤 2-gram 으로 쪼개지는지 먼저 확인하면 원인을 좁히기 쉽다.

---

## 코드에서 눈여겨볼 것 (`api/main.py`)

- `search_articles()` - `WHERE body LIKE likequery(%s)` 한 줄이 전부다. 인덱스가 알아서 탄다.
- `similar_articles()` - `SET pg_bigm.similarity_limit = {threshold}` 처럼 GUC 는 파라미터 바인딩이 안 되고, `title =%% %s` 처럼 `=%` 연산자는 `%%`로 이스케이프해야 psycopg 가 오작동하지 않는다.
- `get_cursor()` - 데모 수준으로 요청마다 새 연결을 연다. 트래픽이 있는 실제 서비스라면 `psycopg_pool` 같은 커넥션 풀을 쓰는 게 정석이다.

## 정리

```bash
./run.sh down
```

- 이전 lab: [`../04-comparison-and-ops/`](../04-comparison-and-ops)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)
