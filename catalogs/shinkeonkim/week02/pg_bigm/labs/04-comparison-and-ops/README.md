# Lab 04 - pg_trgm 과 나란히 비교 + 실무 체크리스트

```bash
./run.sh          # 약 30초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

이 lab 은 `pg_bigm` 과 `pg_trgm` 을 같은 DB 에 함께 설치해 짧은 키워드 검색을 나란히 비교하고, `gin_key_limit` 과 실무 체크리스트로 마무리한다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## 직접 겪은 함정

- **2글자 키워드(`%AB%`)로 `pg_bigm` vs `pg_trgm` 인덱스를 비교하면, 둘 다 `EXPLAIN` 에 `Index Cond` 가 붙지만 비용(cost)이 몇 백 배 차이난다.** "인덱스를 타느냐 마느냐"가 아니라 "그 인덱스가 얼마나 선택적이냐"의 문제였다 - 처음엔 "pg_trgm 은 인덱스 조건을 아예 못 만든다"고 잘못 생각했는데, 실제 `EXPLAIN` 을 보고 정정했다.

## 다음 단계

- 이전 lab: [`../03-similarity-and-functions/`](../03-similarity-and-functions)
- **실전 통합**: [`../05-fastapi-search-api/`](../05-fastapi-search-api) - FastAPI 백엔드에서 `pg_bigm` 을 실제로 어떻게 쓰는지
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
