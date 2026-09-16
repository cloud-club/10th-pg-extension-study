# pg_cron lab 01 - preload 와 "한 DB 제약"

```bash
./run.sh          # 약 10초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

`intro/labs/09-bgworker` 가 "Background Worker 를 띄우는 extension 부류"의 대표 사례로 `pg_cron` 을 살짝 다뤘다면, 이 lab 은 **그 익스텐션 자체가 주제**입니다. 전체 5개 lab 목록은 [`../README.md`](../README.md), 종합 카탈로그 문서는 [`../../README.md`](../../README.md) 참고.

## 이 lab 이 다루는 것

`sql/01-preload-and-architecture.sql` 하나로:

- `shared_preload_libraries=pg_cron` 없이는 왜 안 되는가 - `_PG_init()` 이 `RegisterBackgroundWorker()` 로 launcher 를 등록하는데, postmaster 가 시작할 때만 이 등록이 가능하다.
- **pg_cron 은 클러스터 전체에서 `cron.database_name` 이 가리키는 DB 에만 설치할 수 있다** - 다른 DB(`otherdb`)에서 `CREATE EXTENSION` 을 시도해 실제 에러(`can only create extension in database study`)를 직접 재현한다.
- launcher 가 checkpointer/autovacuum launcher 와 같은 지위의 **별도 프로세스**로 보이는 것을 `pg_stat_activity` 로 확인한다.
- `cron.job` 이 RLS(Row-Level Security)가 걸린 평범한 테이블이라는 것, 그리고 `pg_extension_config_dump()` 덕분에 스케줄이 `pg_dump` 대상이라는 것을 확인한다.

## 이 lab 이 서버에 준 설정 (`docker-compose.yml`)

```
shared_preload_libraries = pg_cron
cron.database_name       = study     # 스케줄 테이블(cron.job)이 사는 곳 - 클러스터에 하나뿐
cron.host                = /var/run/postgresql  # 실습은 로컬 소켓
cron.max_running_jobs    = 32        # 동시성 lab03만 5로 낮춘다
```

`initdb/01-create-otherdb.sql` 이 최초 기동 시 `otherdb` 라는 두 번째 데이터베이스를 만들어둡니다 - "한 DB 제약" 에러를 재현하는 데 씁니다.

## 다음 lab

[`../02-scheduling-and-syntax/`](../02-scheduling-and-syntax) - cron 문법, 이름 있는/없는 잡, 다른 DB 에 스케줄링

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.
