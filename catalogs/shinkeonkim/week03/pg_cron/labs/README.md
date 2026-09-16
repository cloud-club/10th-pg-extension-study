# pg_cron 실습

각 실습은 별도의 Docker Compose 프로젝트와 포트를 사용한다. 원하는 실습만 선택해 실행할 수 있다.

| 실습 | 내용 | 포트 |
| --- | --- | --- |
| [01 · preload와 구조](01-preload-and-architecture/) | preload, 설치 DB 제약, RLS, pg_dump 대상 | 15930 |
| [02 · 예약 문법](02-scheduling-and-syntax/) | 5필드·초·월말 문법, 다른 DB 예약, 예약 수정 | 15931 |
| [03 · 실행과 동시성](03-execution-model-and-concurrency/) | libpq 실행 경로, `cron.max_running_jobs` | 15932 |
| [04 · 권한과 운영](04-monitoring-and-ops/) | 같은 잡의 직렬 실행, 권한, 이력 정리 | 15933 |
| [05 · FastAPI 연동](05-fastapi-job-scheduler-api/) | REST API에서 예약 등록·조회·수정·삭제 | DB 15934 · API 18934 |

## 자동 실행

각 디렉터리에서 `./run.sh`를 실행한다. 스크립트는 학습 목표를 출력한 뒤 이미지 빌드, 컨테이너 시작, SQL 또는 API 시나리오와 결과 검증을 수행한다.

```bash
cd 01-preload-and-architecture
./run.sh
```

주요 명령은 모든 실습에서 같다.

| 명령 | 동작 |
| --- | --- |
| `./run.sh` | 전체 시나리오 실행 |
| `./run.sh explain` | 실행 단계와 판정 기준 출력 |
| `./run.sh up` | 컨테이너만 시작 |
| `./run.sh psql` | 실습 DB에 접속 · 01~04 |
| `./run.sh down` | 컨테이너와 볼륨 삭제 |

수동으로 실행하려면 각 디렉터리의 `HANDS-ON.md`를 따른다. FastAPI 실습은 `./run.sh demo`로 API 시나리오만 다시 실행할 수 있다.

상세 개념은 웹의 `#/pg-cron/about`, 카탈로그 요약은 [`../../../pg_cron.md`](../../../pg_cron.md)에서 확인한다.
