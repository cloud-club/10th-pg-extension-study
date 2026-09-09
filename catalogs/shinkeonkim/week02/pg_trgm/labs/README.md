# pg_trgm 실습

`pg_bigm` 을 정리하다 **"그럼 pg_trgm 은 실제로 어떻게 다른가"** 를 확인할 필요가 생겨 만든 실습 묶음입니다. `pg_bigm` lab 들과 나란히 놓고 보면 두 확장의 성격 차이가 뚜렷하게 드러납니다.

각 lab 은 **완전히 독립적**입니다. 자기만의 `Dockerfile`, `docker-compose.yml`, `run.sh` 를 갖고 있고 포트도 달라서, 관심 있는 것만 골라 동시에 띄워도 됩니다.

조사 문서는 [`../docs/`](../docs)에, 실습 결과와 조사를 종합한 카탈로그 문서는 [`../README.md`](../README.md)에 있습니다.

## pg_trgm 은 설치할 게 없다

`pg_bigm` lab 의 `Dockerfile` 은 GitHub 소스를 받아 PGXS 로 빌드하는 54줄짜리 멀티스테이지 빌드였습니다. `pg_trgm` 은 **PostgreSQL contrib** 이라 `postgresql-contrib` 패키지 한 줄이면 끝입니다 — lab 01 의 `Dockerfile` 이 22줄인 이유입니다.

게다가 PostgreSQL 13 부터 **`trusted = true`** 라서 **수퍼유저가 아니어도 `CREATE EXTENSION pg_trgm` 이 됩니다.** lab 01 에서 직접 재현합니다.

## 두 가지 방법

각 lab 은 **자동 실행**과 **직접 실습** 두 가지로 볼 수 있습니다.

### ① 자동 - 전체 흐름을 빠르게 훑기

```bash
cd 01-install-and-trigram-anatomy
./run.sh
```

`./run.sh` 하나가 **이미지 빌드 → 컨테이너 기동 → 스크립트 순차 실행**까지 전부 합니다.

### ② 직접 - psql 에 접속해 한 줄씩 쳐보기

**이쪽이 실제로 손에 남습니다.** 각 lab 의 `HANDS-ON.md` 를 따라갑니다.

```bash
cd 01-install-and-trigram-anatomy
./run.sh up      # 컨테이너만 기동
./run.sh psql    # psql 접속
```

처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

## Lab 목록

| Lab | 주제 | 포트 |
|---|---|---|
| [01-install-and-trigram-anatomy](01-install-and-trigram-anatomy) | 설치가 얼마나 쉬운가 · `trusted` 확장 · **패딩** · 멀티바이트 해싱 · 유사도 공식 검산 | 15960 |
| [02-gin-vs-gist](02-gin-vs-gist) | `pg_bigm` 에 없는 GiST 는 언제 이득인가 — **버퍼 수로 재는** 비교, `siglen` 튜닝 | 15961 |
| [03-similarity-and-knn](03-similarity-and-knn) | 유사도 3형제(`similarity`/`word_similarity`/`strict_word_similarity`) · **KNN 정렬** | 15962 |
| [04-regex-and-tuning](04-regex-and-tuning) | **가장 중요한 lab** — 짧은 키워드 함정 · 한글 정규식 U+07FF 벽 · 운영 체크리스트 | 15963 |
| [05-fastapi-search-api](05-fastapi-search-api) | **실전 통합** — FastAPI 백엔드가 무엇을 책임져야 하는가 | 15964 (DB) / 18964 (API) |

## psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` | 설치된 extension 목록 |
| `\d <테이블>` | 테이블 구조 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 |
| `\q` | 나가기 |

## 이 lab 들을 만들며 확인한 것

- **"pg_trgm 은 `KEEPONLYALNUM` 때문에 한글을 걸러낸다"는 흔한 설명은 틀렸다.** `show_trgm('가나다라')` 는 조각 5개를 정상 생성한다 (01). 진짜 문제는 **2글자 검색어**와 **구두점**이다.
- **한 글자 차이로 인덱스가 무력화된다.** 5만 행에서 `%제브라%`(3글자)는 인덱스가 후보를 1행까지 좁히지만, `%제브%`(2글자)는 **50,004행 전부**를 후보로 올린다 (04).
- **그런데 `'% 제브 %'` 로 감싸면 다시 2행으로 줄어든다** — `get_wildcard_part()` 가 비단어 문자 경계에 패딩을 붙이기 때문이다 (04).
- **한글 정규식(`~`)은 아예 동작하지 않는다.** 2바이트 문자(`naïve`, `ΑΒΓΔΕ`)까지는 되고 3바이트(한글)부터 안 된다 — 경계가 정확히 `MAX_SIMPLE_CHR 0x7FF` 다 (04).
- **GiST 는 기본 `siglen` 에서 GIN 보다 버퍼를 400배 더 읽는다.** 원인은 "GiST 가 느리다"가 아니라 **"기본 96비트 시그니처가 포화됐다"** 였다 (02). 다만 lab 02 의 좁은 데이터에서는 `siglen=64` 로 GIN 과 같아지는데, **실제 말뭉치에서는 256까지 올려도 GIN 의 약 32배**다 ([`../experiments/01`](../experiments/01-gin-vs-gist-build-and-probe)) — lab 의 결론을 그대로 일반화하면 안 되는 예다.
- **`similarity()` 는 본문이 길어지면 무너진다** (0.5714 → 0.0563). 긴 본문에서 짧은 검색어를 찾을 땐 `word_similarity()` 를 써야 한다 (03).

## 더 읽기

- [`../../bigm-vs-trgm/`](../../bigm-vs-trgm) — 두 확장의 정면 비교와 정량 실험
- [`web/#/foundations/ngram`](../../../web/README.md) — 2-gram 과 3-gram 기초
