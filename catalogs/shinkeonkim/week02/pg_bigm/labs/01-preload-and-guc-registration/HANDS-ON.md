# Lab 01 직접 해보기 - preload 없이도 되는 것 / 안 되는 것

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 을 먼저 열어보세요 - `shared_preload_libraries` 줄이 **주석 처리**되어 있습니다. 이 lab 은 일부러 preload 없이 시작합니다.

---

## STEP 1 - preload 없이도 되는 것 / 안 되는 것

```sql
SHOW shared_preload_libraries;   -- 비어있다
CREATE EXTENSION pg_bigm;        -- preload 없이도 성공한다
```

이 세션은 방금 `CREATE EXTENSION` 을 직접 실행했다 - `CREATE FUNCTION ... AS 'MODULE_PATHNAME'` 이 심볼을 검증하려고 그 자리에서 라이브러리를 dlopen 하기 때문에, **이 세션은 이미 `pg_bigm.so` 를 메모리에 갖고 있다.**

```sql
SELECT name, vartype, source, setting FROM pg_settings WHERE name = 'pg_bigm.similarity_limit';
```

`vartype = real`, `source = default` - placeholder 가 아니라 등록된 GUC 다.

**다른 세션은 사정이 다르다.** 새 터미널(또는 `\!` 로 컨테이너 안에서 새 psql)을 열어보자.

```sql
\! psql -U postgres -d study -c "ALTER SYSTEM SET pg_bigm.similarity_limit = 0.5;"
```
```
ERROR:  unrecognized configuration parameter "pg_bigm.similarity_limit"
```

그 세션은 pg_bigm 함수를 한 번도 부른 적이 없어서 `.so` 가 아직 메모리에 없다 - **카탈로그에 설치돼 있는 것**과 **이 백엔드 프로세스가 그 코드를 로드했는가**는 별개의 문제다. 반면 지금 이 세션(방금 `CREATE EXTENSION` 을 실행한 세션)에서는 같은 명령이 바로 된다:

```sql
ALTER SYSTEM SET pg_bigm.similarity_limit = 0.42;  -- 성공
ALTER SYSTEM RESET pg_bigm.similarity_limit;
SELECT pg_reload_conf();
```

먼저 "평범한 SET" 은 pg_bigm 을 설치조차 안 한 이름으로도 항상 성공한다는 것도 확인해보자 (PostgreSQL 의 범용 placeholder GUC 메커니즘 - pg_bigm 과 무관):

```sql
\! psql -U postgres -d study -c "SET whatever_random_ext.foo = 1; SHOW whatever_random_ext.foo;"
```

**직접 실험해볼 것**: `docker-compose.yml` 의 `command` 주석을 풀어 `shared_preload_libraries=pg_bigm` 을 켜고 `./run.sh down && ./run.sh up`. 그 뒤에는 어느 세션에서든 `ALTER SYSTEM SET`/`SHOW` 가 즉시, 일관되게 동작한다.

---

## 정리

| | |
|---|---|
| preload 가 필요한 이유 | 훅/공유메모리/워커가 아니라 **커스텀 GUC 를 모든 세션에서 일관되게 인식**시키기 위함 |
| 없어도 되는 것 | `CREATE EXTENSION`, 세션 로컬 `SET` |
| preload를 설정하는 목적 | `ALTER SYSTEM SET`/`postgresql.conf` 레벨 설정을 모든 세션에서 즉시 신뢰하기 |

## 다음 단계

- 다음 lab: [`../02-bigram-index-and-search/`](../02-bigram-index-and-search)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)
