# pg_cron lab 04 - 겹치는 실행, 권한, 운영

```bash
./run.sh          # 약 20초 (겹침 재현에 8초 기다립니다)
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

전체 5개 lab 목록은 [`../README.md`](../README.md), 종합 카탈로그 문서는 [`../../README.md`](../../README.md) 참고.

## 이 lab 이 다루는 것

`sql/01-monitoring-and-ops.sql` 하나로:

- **같은 잡이 자기 스케줄보다 오래 걸리면, 다음 실행은 동시에 뜨지 않고 이전 실행이 끝난 직후 시작한다** (직렬화) - `start_time` 간격을 직접 재서 증명한다.
- **잡은 등록한 사용자의 권한으로 실행된다** - 최소 권한 role 로 등록해본다.
- **잡 이름은 사용자별로 유효범위가 나뉜다** (`cron.job` 의 `(jobname, username)` UNIQUE) - 슈퍼유저라도 남이 등록한 잡을 이름으로 `unschedule()` 할 수 없다는 것을 실제 에러로 확인한다.
- `job_run_details` 를 스스로 청소하는 잡 등록, 운영 체크리스트, 다른 스케줄러와의 비교.

## 직접 겪은 함정

**슈퍼유저(`postgres`)로 다른 사용자가 등록한 이름 있는 잡을 `cron.unschedule('이름')` 했더니 실패했다** (`could not find valid entry for job`). `cron.job` 의 `(jobname, username)` UNIQUE 제약 때문에 이름의 유효범위가 사용자별이다 - `jobid` 로는 지울 수 있다.

## 이 lab 이 서버에 준 설정

[`../01-preload-and-architecture/README.md`](../01-preload-and-architecture/README.md) 와 동일.

## 다음 단계

- 이 5개 lab 을 종합한 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 설명: 웹 `#/pg-cron/failures`, `#/pg-cron/operations`, `#/pg-cron/source`
- 실무 백엔드 연동 예시: [`../05-fastapi-job-scheduler-api/`](../05-fastapi-job-scheduler-api)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.
