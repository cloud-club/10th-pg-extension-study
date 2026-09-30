# Lab 03 - 유사도 검색과 제공 함수들

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

이 lab 은 `=%` 유사도 검색, `bigm_similarity()` 함수, 그리고 GIN 의 FASTUPDATE/pending list 를 다룬다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## 이 lab 에서 확인하는 것

| | |
|---|---|
| `=%` 연산자 · `pg_bigm.similarity_limit` | "정확히 안 맞아도 비슷한 것" 찾기 - 오탈자에 강하다 |
| `bigm_similarity()` | `pg_trgm` 의 `similarity()` 와 달리 **대소문자를 구분**한다 |
| `pg_gin_pending_stats()` | FASTUPDATE 로 인한 GIN pending list 크기 확인 |

## 직접 겪은 함정

- **`pg_gin_pending_stats()` 로 FASTUPDATE pending list 를 보려면, 인덱스가 이미 있는 상태에서 INSERT 해야 한다.** `CREATE INDEX` 시점에 이미 있던 행은 pending list 를 거치지 않고 통째로 빌드되어 항상 0/0 으로 보인다 - 이 lab 은 인덱스 생성 후 추가로 500행을 INSERT 해서 실제 pending list 가 쌓이는 걸 보여준다.
- **`bigm_similarity('ABC','abc')` 는 0, `pg_trgm` 의 `similarity('ABC','abc')` 는 1.** 대소문자를 구분해야 하는 도메인(코드, 식별자)이면 이 차이가 중요하다.

## 다음 lab

- 이전: [`../02-bigram-index-and-search/`](../02-bigram-index-and-search)
- 다음: [`../04-comparison-and-ops/`](../04-comparison-and-ops) - `pg_trgm` 과 나란히 비교, 실무 체크리스트
