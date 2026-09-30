# pg_trgm — 버전별 변천사

> `pg_trgm` 은 contrib 이라 **PostgreSQL 코어 릴리스와 함께 버전이 올라간다.** 아래 표는 추측이 아니라 `postgres:16` 이미지의 `/usr/share/postgresql/16/extension/pg_trgm--*.sql` 업그레이드 스크립트를 직접 열어 무엇이 추가/변경됐는지 확인해 정리한 것이다. `pg_bigm` 처럼 릴리스 노트를 읽는 대신 **SQL 정의 자체가 근거**다.

```bash
# 이 표를 만든 방법 (labs/01 의 컨테이너에서 그대로 재현된다)
ls /usr/share/postgresql/16/extension/ | grep pg_trgm
cat /usr/share/postgresql/16/extension/pg_trgm--1.1--1.2.sql
```

## 버전별 핵심 변경

| 버전 | 함께 나온 PG | 업그레이드 스크립트에 실제로 들어 있는 것 | 의미 |
| --- | --- | --- | --- |
| **1.0** | 9.1 | 베이스 - `similarity()`, `show_trgm()`, `set_limit()`/`show_limit()`, `%`, `<->`, `gin_trgm_ops` / `gist_trgm_ops` (LIKE·ILIKE) | 시작점 |
| **1.1** | 9.3 | 두 연산자 패밀리에 `OPERATOR 5 ~`, `OPERATOR 6 ~*` 추가 | **정규식 인덱스 검색**(`trgm_regexp.c`) 도입 |
| **1.2** | 9.6 | `word_similarity()`, `<%`/`%>`, `<<->`/`<->>`, 그리고 **`gin_trgm_triconsistent`** (GIN `FUNCTION 6`) | 단어 단위 유사도 + GIN 3상태 consistent |
| **1.3** | 10 | 25개 함수 전부에 `ALTER FUNCTION ... PARALLEL SAFE` (단 `set_limit` 만 `PARALLEL UNSAFE`) | **병렬 쿼리 지원** |
| **1.4** | 11 | `strict_word_similarity()`, `<<%`/`%>>`, `<<<->`/`<->>>` | 단어 경계를 엄격히 보는 유사도 |
| **1.5** | 13 | `gtrgm_options()` (GiST `FUNCTION 10`), `%`·`<%`·`%>`·`<<%`·`%>>` 에 `RESTRICT = matchingsel` | **`siglen` 연산자 클래스 파라미터**, 유사도 연산자 선택도 추정 개선 |
| **1.6** | 14 | 두 연산자 패밀리에 `OPERATOR 11 pg_catalog.=` | 인덱스로 동등 비교 지원 |

<sub>`pg_trgm--1.3.sql` 이 신규 설치용 베이스로 남아 있고 1.0~1.2 는 업그레이드 경로로만 존재한다.</sub>

"함께 나온 PG" 열은 기억에 의존하지 않고, PostgreSQL 메이저별 이미지에서 `default_version` 을 직접 읽어 확정했다.

```bash
for v in 10 11 12 13 14 15 16; do
  docker run --rm --entrypoint sh postgres:$v-alpine \
    -c "grep default_version /usr/local/share/postgresql/extension/pg_trgm.control"
done
```

| PG | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `pg_trgm` default_version | 1.3 | 1.4 | 1.4 | **1.5** | **1.6** | 1.6 | 1.6 |

즉 **1.4 는 PG 11 에서 나와 12 까지, 1.5 는 13 에서, 1.6 은 14 부터 지금까지** 유지되고 있다 - PG 14 이후로는 SQL 정의가 바뀌지 않았다.

## pg_bigm 의 변천사와 나란히 놓으면

| 능력 | pg_trgm | pg_bigm |
| --- | --- | --- |
| 유사도 검색 도입 | 1.0 (2011, PG 9.1) - 처음부터 있었다 | 1.1 (2013) |
| GIN `triConsistent` | **1.2 (2016, PG 9.6)** | **1.2 (2016)** |
| 병렬 쿼리 | 1.3 (2017, PG 10) | 1.2 (2016) |
| 인덱스 파라미터 튜닝 | 1.5 (2020, PG 13) - `siglen` | 없음 (`gin_key_limit` GUC 로 대신) |
| 연산자 클래스 이름 충돌 사고 | 없음 | 1.0 이 `gin_trgm_ops` 라는 이름을 썼다가 1.1 에서 `gin_bigm_ops` 로 개명 |

**`triConsistent` 를 둘 다 2016년에 넣었다는 게 흥미롭다** - PostgreSQL 9.4 가 GIN 에 3상태 consistent 를 추가한 뒤 양쪽이 비슷한 시기에 따라간 것이다. 병렬 쿼리는 `pg_bigm` 이 오히려 한 발 빨랐다.

## 실무 시사점

- **`pg_trgm` 은 "버전 고정"이라는 개념이 사실상 없다.** PostgreSQL 을 올리면 함께 올라간다. `pg_bigm` 처럼 "어느 git 태그를 빌드했는지"를 관리할 필요가 없는 것이 가장 큰 운영상 차이다.
- **다만 `ALTER EXTENSION pg_trgm UPDATE` 는 잊기 쉽다.** pg_upgrade 로 메이저 업그레이드를 하면 바이너리는 새것인데 **카탈로그의 extension 버전은 옛날 그대로** 남는다. 예를 들어 PG 11 에서 만든 DB 를 PG 16 으로 올렸는데 `pg_trgm` 이 1.4 로 남아 있으면 `siglen` 파라미터도, `=` 연산자 지원도 못 쓴다.

  ```sql
  SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
  ALTER EXTENSION pg_trgm UPDATE;   -- default_version 으로 올린다
  ```

- **`set_limit()`/`show_limit()` 는 1.2(9.6) 이후로 사실상 폐기됐다.** 지금은 `pg_trgm.similarity_threshold` GUC 를 쓴다. 오래된 블로그 글이 `SELECT set_limit(0.5)` 를 시키면 그건 9.6 이전 자료다 (`set_limit` 이 유일하게 `PARALLEL UNSAFE` 로 남은 것도 세션 상태를 바꾸는 함수라서다).
- **PostgreSQL 13 미만이면 GiST `siglen` 튜닝을 못 한다.** 긴 텍스트를 GiST 로 인덱싱하는데 성능이 안 나온다면 먼저 PG 버전부터 확인할 일이다 ([02](02-internals-and-source.md) 의 시그니처 포화 참고).

## 더 읽기

- [무엇을, 왜](01-what-and-why.md)
- [내부 동작과 코드베이스](02-internals-and-source.md)
- [실무 활용 가이드](04-production-playbook.md)

## 참고 링크

- [contrib/pg_trgm 업그레이드 스크립트 원문](https://github.com/postgres/postgres/tree/REL_16_STABLE/contrib/pg_trgm)
- [PostgreSQL 9.3 릴리스 노트 - pg_trgm 정규식 인덱스 지원](https://www.postgresql.org/docs/release/9.3.0/)
- [PostgreSQL 13 릴리스 노트 - GiST opclass 파라미터](https://www.postgresql.org/docs/release/13.0/)
