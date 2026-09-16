# pg_bigm 실습

`pg_stat_statements`(훅+공유메모리), `pg_cron`(백그라운드 워커)에 이은 세 번째 week02 익스텐션이지만, `pg_bigm` 은 **그 둘과 preload 가 필요한 이유 자체가 완전히 다릅니다.**

각 lab 은 **완전히 독립적**입니다. 자기만의 `Dockerfile`, `docker-compose.yml`, `run.sh` 를 갖고 있고 포트도 달라서, 관심 있는 것만 골라 동시에 띄워도 됩니다.

조사 문서는 [`../docs/`](../docs)에, 이 실습 결과와 조사 내용을 종합한 카탈로그 문서는 [`../README.md`](../README.md)에 있습니다.

## pg_bigm 은 contrib 도, PGDG 패키지도 아니다

`apt.postgresql.org` 에는 pg_bigm 패키지가 없다 (직접 검색해서 확인했다). 그래서 각 lab 의 `Dockerfile` 은 `intro/labs/03-c-extension` 과 같은 방식으로 GitHub 소스(`v1.2-20250903` 태그 고정)를 받아 PGXS 로 직접 빌드한다.

## 두 가지 방법

각 lab 은 **자동 실행**과 **직접 실습** 두 가지로 볼 수 있습니다.

### ① 자동 - 전체 흐름을 빠르게 훑기

```bash
cd 01-preload-and-guc-registration
./run.sh
```

`./run.sh` 하나가 **이미지 빌드 → 컨테이너 기동 → 스크립트 순차 실행**까지 전부 합니다.

### ② 직접 - psql 에 접속해 한 줄씩 쳐보기

각 lab의 `HANDS-ON.md`를 따라 SQL을 직접 실행하고 결과를 확인합니다.

```bash
cd 01-preload-and-guc-registration
./run.sh up      # 컨테이너만 기동
./run.sh psql    # psql 접속
```

처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

## Lab 목록

| Lab | 주제 | 포트 |
|---|---|---|
| [01-preload-and-guc-registration](01-preload-and-guc-registration) | **왜 preload 를 권장하나** - 훅/워커가 아니라 "커스텀 GUC 등록" 문제라는 것을 직접 재현 | 15940 |
| [02-bigram-index-and-search](02-bigram-index-and-search) | 2-gram 분해 · GIN 인덱스 생성 · 한글 검색 · Recheck 이 왜 필요한가 | 15941 |
| [03-similarity-and-functions](03-similarity-and-functions) | `=%` 유사도 검색 · `bigm_similarity()` (대소문자 구분) · FASTUPDATE/pending list | 15942 |
| [04-comparison-and-ops](04-comparison-and-ops) | `pg_trgm` 과 나란히 비교(짧은 키워드) · `gin_key_limit` · 실무 체크리스트 | 15943 |
| [05-fastapi-search-api](05-fastapi-search-api) | **실전 통합** - FastAPI 백엔드에서 `likequery()`/`=%` 로 검색 API 를 만드는 예제 | 15944 (DB) / 18944 (API) |

## psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` | 설치된 extension 목록 |
| `\d <테이블>` | 테이블 구조 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 |
| `\q` | 나가기 |

## 직접 겪은 함정들 (이 lab 들을 만들며 실제로 확인한 것)

- **`CREATE EXTENSION pg_bigm` 을 직접 실행한 세션은 그 순간 이미 `.so` 가 로드된다.** `CREATE FUNCTION ... AS 'MODULE_PATHNAME'` 이 심볼 존재를 검증하려고 그 자리에서 dlopen 하기 때문이다 (01).
- **반면 "이미 설치된 DB 에 그냥 접속만 한" 새 세션은 사정이 다르다** - `ALTER SYSTEM SET pg_bigm.similarity_limit = ...` 가 실패한다. 같은 명령이 세션에 따라 되기도 안 되기도 한다 (01).
- **`pg_trgm` 과 짧은 키워드(2글자) 검색을 나란히 비교하면, 둘 다 `EXPLAIN` 에 `Index Cond` 가 붙지만 비용(cost)이 몇 백 배 차이난다** (04).
- **`pg_gin_pending_stats()` 로 FASTUPDATE pending list 를 보려면, 인덱스가 이미 있는 상태에서 INSERT 해야 한다** (03).
