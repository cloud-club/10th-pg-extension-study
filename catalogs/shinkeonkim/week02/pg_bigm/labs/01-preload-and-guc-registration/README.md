# Lab 01 - preload 를 왜 권장하나 (커스텀 GUC 등록 문제)

```bash
./run.sh          # 약 30초 (첫 실행은 소스 빌드 때문에 조금 더 걸릴 수 있다)
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

`pg_stat_statements`(훅+공유메모리), `pg_cron`(백그라운드 워커)와 달리, `pg_bigm` 이 preload 를 권장하는 이유는 **커스텀 GUC 를 모든 세션에서 일관되게 인식시키기 위함**이다 - 이 lab 의 핵심 주제.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## pg_bigm 은 contrib 도, PGDG 패키지도 아니다

`apt.postgresql.org` 에는 pg_bigm 패키지가 없다 (직접 검색해서 확인했다). 그래서 이 lab 의 `Dockerfile` 은 `intro/labs/03-c-extension` 과 같은 방식으로 GitHub 소스(`v1.2-20250903` 태그 고정)를 받아 PGXS 로 직접 빌드한다.

## 이 lab 은 일부러 preload 없이 시작한다

`docker-compose.yml` 에 `shared_preload_libraries` 설정이 **주석 처리**되어 있다 - "preload 없이 뭐가 되고 안 되는지"가 이 lab 의 전부이기 때문이다.

## 직접 겪은 함정들 (이 lab 을 만들며 실제로 확인한 것)

- **`CREATE EXTENSION pg_bigm` 을 직접 실행한 세션은 그 순간 이미 `.so` 가 로드된다.** `CREATE FUNCTION ... AS 'MODULE_PATHNAME'` 이 심볼 존재를 검증하려고 그 자리에서 dlopen 하기 때문이다 - `pg_settings` 로 `vartype=real`(placeholder 아님)임을 직접 확인했다.
- **반면 "이미 설치된 DB 에 그냥 접속만 한" 새 세션은 사정이 다르다.** 그 세션은 `pg_bigm.so` 를 로드한 적이 없어서, `ALTER SYSTEM SET pg_bigm.similarity_limit = ...` 가 `ERROR: unrecognized configuration parameter` 로 실패한다. **같은 명령이 세션에 따라 되기도 안 되기도 한다** - 이 lab 에서 두 세션을 나란히 재현한다.
- **평범한 `SET`(세션 로컬)은 pg_bigm 을 설치조차 안 해도 항상 성공한다.** PostgreSQL 의 범용 "placeholder GUC" 메커니즘 때문 - pg_bigm 과 무관한 동작이라 "preload 필요 없다"는 착각의 원인이 되기 쉽다.
- **GCP Cloud SQL 은 pg_bigm 을 "프리로드가 필요한 확장"으로 취급해 전용 플래그(재시작 유발)를 요구한다** - 이 lab 에서 재현한 "세션별 불일치" 문제를 매니지드 서비스 쪽에서도 그대로 인지하고 있다는 방증이다 (`../../docs/03-production-playbook.md` 참고).

## 다음 lab

- [`../02-bigram-index-and-search/`](../02-bigram-index-and-search) - 2-gram 인덱스로 실제 검색을 가속해본다
