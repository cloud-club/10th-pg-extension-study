# pg_cron 실습 - week03 카탈로그

`intro/labs/09-bgworker`가 "Background Worker를 띄우는 extension 부류"의 대표 사례로 `pg_cron`을 살짝 다뤘다면, 이 5개 lab은 **그 익스텐션 자체가 주제**입니다. 설명은 웹의 `#/pg-cron/about`부터 사이드바 순서로 제공하고, 이 실습 결과를 요약한 카탈로그 문서는 [`../README.md`](../README.md)에 있습니다.

각 lab 은 `intro/labs` 와 같은 방식으로 **완전히 독립적**입니다 - 자기만의 `Dockerfile`, `docker-compose.yml`, `run.sh` 를 갖고 있고 포트도 달라서, 관심 있는 것만 골라 실행해도 됩니다.

## 목록

| Lab | 주제 | 포트 |
|---|---|---|
| [01-preload-and-architecture](01-preload-and-architecture) | preload 가 왜 필수인가 · "한 DB 에만 설치" 제약 · RLS · pg_dump 대상 | 15930 |
| [02-scheduling-and-syntax](02-scheduling-and-syntax) | cron 문법(초 단위, 매월 마지막 날) · 이름 있는/없는 잡 · `schedule_in_database()` · `alter_job()` | 15931 |
| [03-execution-model-and-concurrency](03-execution-model-and-concurrency) | 기본 실행 모드(libpq 클라이언트 연결) · `max_running_jobs` 동시성 제한 | 15932 |
| [04-monitoring-and-ops](04-monitoring-and-ops) | 겹치는 실행의 직렬화 · 권한 · 이력 정리 · 운영 체크리스트 | 15933 |
| [05-fastapi-job-scheduler-api](05-fastapi-job-scheduler-api) | FastAPI 로 만든 잡 스케줄러 REST API - 실제 백엔드 연동 예시 | 15934 (DB) / 18934 (API) |

## 두 가지 방법 (01~04)

각 SQL 기반 lab 은 **자동 실행**과 **직접 실습** 두 가지로 볼 수 있습니다.

### ① 자동 - 전체 흐름을 빠르게 훑기

```bash
cd 01-preload-and-architecture
./run.sh
```

`./run.sh` 하나가 **이미지 빌드 → 컨테이너 기동 → sql/ 순차 실행**까지 전부 합니다.

### ② 직접 - psql 에 접속해 한 줄씩 쳐보기

각 lab의 `HANDS-ON.md`를 따라 SQL을 직접 실행하고 결과를 확인합니다.

```bash
cd 01-preload-and-architecture
./run.sh up      # 컨테이너만 기동
./run.sh psql    # psql 접속
```

05번 lab 은 SQL 이 아니라 FastAPI 앱이라 방식이 다릅니다 - [`05-fastapi-job-scheduler-api/README.md`](05-fastapi-job-scheduler-api/README.md) 참고.

### psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` | 설치된 extension 목록 |
| `\d <테이블>` | 테이블 구조 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 |
| `\c <db>` | 다른 데이터베이스로 접속 전환 |
| `\gset <prefix>` | 조회 결과를 psql 변수로 저장 |
| `\q` | 나가기 |
