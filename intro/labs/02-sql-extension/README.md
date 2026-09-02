# Lab 02 - SQL-only Extension 직접 만들기

```bash
./run.sh
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


`ext/` 안의 4개 파일이 전부입니다. C 코드는 한 줄도 없습니다.

```
ext/
├── greetkor.control        # 메타데이터 (이게 없으면 CREATE EXTENSION 불가)
├── greetkor--1.0.sql       # 설치 스크립트
├── greetkor--1.0--1.1.sql  # 업그레이드 스크립트
└── Makefile                # PGXS - 사실상 4줄
```

`Dockerfile` 이 빌드 시점에 `make install` 을 돌려 이 파일들을 `$(pg_config --sharedir)/extension/` 으로 복사합니다. 그게 "설치"의 전부입니다.

## 이 lab 에서 확인할 것

| 스크립트 | 확인 내용 |
|---|---|
| `01-install.sql` | control 파일이 있으면 PostgreSQL 이 "설치 가능"으로 인식한다 |
| `02-membership.sql` | 스크립트가 만든 객체에 `deptype='e'` 가 **자동으로** 붙는 과정 |
| `03-upgrade.sql` | `ALTER EXTENSION ... UPDATE TO '1.1'` - 함수 교체 + 새 함수 + 설정 테이블 추가 |
| `04-pgdump.sql` | **pg_dump 는 함수 정의를 덤프하지 않는다.** 대신 `pg_extension_config_dump()` 로 등록한 테이블 데이터는 덤프한다 |
| `05-hot-reload.sql` | 개발 루프: 수정 → `make install` → `DROP`/`CREATE EXTENSION` |

## 이런 출력이 나오면 성공입니다

```
--- 덤프 결과에서 greetkor 관련 부분만 ---
CREATE EXTENSION IF NOT EXISTS greetkor WITH SCHEMA public;
...
COPY public.greetkor_config (key, value) FROM stdin;
locale	ko_KR
timezone	Asia/Seoul
```
→ `greet()` 함수 정의는 **한 글자도 덤프되지 않았습니다**. 대신 설정 테이블의 데이터는 나왔습니다. 이 차이가 `pg_extension_config_dump()` 의 존재 이유입니다.

## 직접 해볼 것

`ext/` 는 컨테이너에 마운트되어 있으므로, 호스트에서 파일을 고치고 바로 반영할 수 있습니다.

1. `ext/greetkor--1.0.sql` 에 함수를 하나 추가

2. 컨테이너에서 다시 설치

   ```bash
   ./run.sh shell
   cd /build/greetkor && make install
   exit
   ```

3. 다시 깔아서 확인

   ```bash
   ./run.sh psql
   ```
   ```sql
   DROP EXTENSION greetkor; CREATE EXTENSION greetkor;
   ```

**주의:** 이미 배포한 extension 은 이렇게 하면 안 됩니다. 반드시 새 업그레이드 스크립트 (`greetkor--1.1--1.2.sql`)를 추가하고 `default_version` 을 올려야 합니다.
