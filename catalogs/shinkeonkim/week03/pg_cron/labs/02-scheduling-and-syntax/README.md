# pg_cron lab 02 - 스케줄 문법과 잡 관리

```bash
./run.sh          # 약 15초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

전체 5개 lab 목록은 [`../README.md`](../README.md), 종합 카탈로그 문서는 [`../../README.md`](../../README.md) 참고.

## 이 lab 이 다루는 것

`sql/01-scheduling-and-syntax.sql` 하나로:

- cron 문법: 표준 5필드, **초 단위 간격**(`'2 seconds'`, 1.5+), **매월 마지막 날**(`$`, 1.6+)
- 이름 있는 잡(`cron.schedule(name, schedule, command)`)과 이름 없는 잡(`cron.schedule(schedule, command)`) - **1개 인자짜리 오버로드는 존재하지 않는다**는 것을 실제로 에러를 내서 확인
- `cron.schedule_in_database()` 로 다른 데이터베이스(`otherdb`)에 잡을 등록하고 실제로 실행되는 것을 확인
- `cron.alter_job()` 으로 잡을 지우지 않고 스케줄/활성 여부를 바꾸기

## 직접 겪은 함정

**`cron.schedule('SELECT ...')` 처럼 1개 인자로 "이름 없는 잡"을 등록하려던 첫 시도는 에러가 났다.** 실제 시그니처는 `(schedule, command)` 2인자와 `(job_name, schedule, command)` 3인자 두 가지뿐이다 - 1인자 오버로드는 없고, 이름 없이 등록하려면 2인자 버전을 써야 한다.

## 이 lab 이 서버에 준 설정

[`../01-preload-and-architecture/README.md`](../01-preload-and-architecture/README.md) 와 동일 (`shared_preload_libraries=pg_cron`, `cron.database_name=study`, `cron.max_running_jobs=32`). `initdb/01-create-otherdb.sql` 이 이 lab 의 `cron.schedule_in_database()` 실습에 쓰인다.

## 다음 lab

[`../03-execution-model-and-concurrency/`](../03-execution-model-and-concurrency) - 잡이 실제로 어떻게 실행되는지, 동시성 제한

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.
