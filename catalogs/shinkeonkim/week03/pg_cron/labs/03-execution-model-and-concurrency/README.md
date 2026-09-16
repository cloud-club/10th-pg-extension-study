# pg_cron lab 03 - 실행 모델과 동시성

```bash
./run.sh          # 약 15초 (동시성 실험에서 몇 초 기다립니다)
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

전체 5개 lab 목록은 [`../README.md`](../README.md), 종합 카탈로그 문서는 [`../../README.md`](../../README.md) 참고.

## 이 lab 이 다루는 것

`sql/01-execution-model-and-concurrency.sql` 하나로:

- **기본 실행 모드(`cron.use_background_workers=off`)에서 잡은 `pg_stat_activity` 에 평범한 `client backend` 로 보인다** - launcher 가 libpq 로 로컬에 접속해서 실행하기 때문이다. `pg_cron` 전용 프로세스 종류가 따로 있는 게 아니라 `application_name='pg_cron'` 으로만 구분된다.
- **`cron.max_running_jobs` 는 동시 실행 상한이다. 초과 잡의 정상 진행까지 보장하지는 않는다** - 8개 잡을 동시에 걸어도 이 lab 이 5로 낮춰둔 상한을 넘지 않는 것을 직접 센다.

## 직접 겪은 함정

`sleeper` 잡을 걸고 곧바로 `pg_stat_activity` 를 조회했더니 아무것도 안 잡혔다 - launcher 의 다음 "틱"까지 기다려야 했다. `pg_sleep(1.5)` 로는 부족해서 `pg_sleep(2.5)` 로 늘려야 안정적으로 재현됐다 - 스케줄 등록 직후 곧바로 도는 게 아니라 다음 초 단위 틱을 기다린다는 것을 몸으로 확인한 지점이다.

## 이 lab 이 서버에 준 설정

[`../01-preload-and-architecture/README.md`](../01-preload-and-architecture/README.md) 의 preload/메타데이터 DB/소켓 설정과 같고, 한도만 다르다. 특히 `cron.max_running_jobs=5`(기본값 32)가 이 lab 의 핵심 설정이다.

## 다음 lab

[`../04-monitoring-and-ops/`](../04-monitoring-and-ops) - 겹치는 실행, 권한, 운영 체크리스트

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.
