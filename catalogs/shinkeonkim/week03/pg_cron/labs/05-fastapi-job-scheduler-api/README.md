# pg_cron lab 05 - FastAPI 잡 스케줄러 API

```bash
./run.sh          # 최초 이미지 빌드 후 성공 이력을 최대 30초 대기합니다
```

01~04 는 psql 로 직접 `cron.schedule()` 을 부르는 lab 이었다면, 이 lab 은 **실제 백엔드가 pg_cron 을 이렇게 감싸서 쓴다**는 걸 보여줍니다 - 매번 SQL 을 손으로 짜는 대신, FastAPI 로 만든 작은 REST API 뒤에 pg_cron 을 숨겨서 "잡 스케줄러 관리 API"를 제공하는 패턴입니다.

전체 lab 목록은 [`../README.md`](../README.md), 종합 카탈로그 문서는 [`../../README.md`](../../README.md) 참고.

## 구성

```
postgres/   pg_cron 이 설치된 PostgreSQL (다른 lab 과 동일한 이미지)
api/        FastAPI 앱 - cron.schedule/unschedule/alter_job 을 감싼 REST API
```

## 엔드포인트

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| `POST` | `/jobs` | `{name, schedule, sql}` → `cron.schedule()` 로 잡 등록. 스케줄 문법이 잘못되면 pg_cron 이 낸 에러를 그대로 400 으로 돌려준다 |
| `GET` | `/jobs` | `cron.job` 목록 |
| `GET` | `/jobs/{name}/runs?limit=10` | 그 잡의 `cron.job_run_details` 실행 이력 |
| `PATCH` | `/jobs/{name}` | `{active}` → `cron.alter_job()` 으로 켜고 끄기 |
| `DELETE` | `/jobs/{name}` | `cron.unschedule()` |

## 실행하면 보이는 것

1. `demo-heartbeat` 잡(2초 간격)을 등록 - jobid 반환
2. `GET /jobs` 로 등록 확인
3. 성공 이력이 생길 때까지 최대 30초 대기 후 `GET /jobs/{name}/runs` - **`succeeded` 실행이 최소 한 번 있는지 검증**이 보인다 (psql 없이, HTTP 로만 확인)
4. `PATCH` 로 비활성화
5. 일부러 잘못된 스케줄(`not-a-cron-expression`)로 등록을 시도 - **pg_cron 자신의 검증 에러 메시지가 API 응답에 그대로 실려온다** (`invalid schedule: ... HINT: Use cron format ...`) - DB 레이어의 검증을 API 레이어가 다시 구현할 필요가 없다는 뜻
6. 정리

## 직접 확인해볼 것

```bash
./run.sh up
open http://localhost:18934/docs   # Swagger UI 에서 직접 두드려본다
```

자세한 curl 예시는 [`HANDS-ON.md`](HANDS-ON.md) 참고.

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.
