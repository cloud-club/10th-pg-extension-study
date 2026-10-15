# Week 03 · pg_cron

pg_cron의 상세 설명은 웹 자료에 모아 두었다.

```bash
cd catalogs/shinkeonkim/web
bun install
bun run dev
```

브라우저에서 `http://localhost:5173/#/pg-cron/about`을 연다. 적합한 사용 사례, 설치 설정, 예약 저장 방식, 프로세스 구성, 실행 모드, 실패 처리와 소스 분석을 사이드바 순서대로 볼 수 있다.

## 실습

[`labs/`](labs)에는 Docker로 실행하는 실습 다섯 개가 있다.

| 실습 | 내용 |
| --- | --- |
| [01](labs/01-preload-and-architecture/) | preload, launcher, 메타데이터 DB |
| [02](labs/02-scheduling-and-syntax/) | 예약 문법, 다른 DB 예약, 예약 수정 |
| [03](labs/03-execution-model-and-concurrency/) | 실행 모드와 동시 실행 한도 |
| [04](labs/04-monitoring-and-ops/) | 직렬 실행, 권한, 실행 이력 |
| [05](labs/05-fastapi-job-scheduler-api/) | FastAPI에서 예약을 관리하는 예제 |

각 디렉터리에서 `./run.sh`를 실행하면 환경 준비, SQL 또는 API 시나리오와 결과 검증을 차례로 수행한다. `./run.sh explain`은 실행 단계, `HANDS-ON.md`는 수동 실습 방법을 보여준다.

## 실험

[`experiments/`](experiments)는 다음 항목을 측정한다.

- 초 단위 예약 간격의 편차
- libpq 모드와 worker 모드에서 기록되는 실행 시간의 범위
- 같은 jobid의 직렬 실행과 전체 동시 실행 한도
- `SKIP LOCKED`를 사용한 작업 분배와 오류 시 롤백

실험 03과 04는 각 조건을 10회 실행한다. 상세 결과는 로컬 `results/`에 생성되고 Git에서 제외된다. 웹에 사용하는 요약 데이터는 `web/src/data/cron-experiments.json`에 있다.

## 기준 버전

- PostgreSQL 16.15
- pg_cron 1.6.8
- 과거 1.6.7 결과는 해당 실험 문서에 별도로 표시

카탈로그 요약은 [`../../pg_cron.md`](../../pg_cron.md)에서 확인한다.
