# Lab 05 · FastAPI에서 pg_cron 관리하기

이 실습은 FastAPI로 `cron.schedule`, `cron.alter_job`, `cron.unschedule`과 실행 이력 조회를 감싼 REST API를 구현한다.

```bash
./run.sh       # 전체 API 시나리오 실행
./run.sh up    # PostgreSQL과 API만 시작
./run.sh demo  # API 시나리오 다시 실행
```

## 구성

```text
postgres/  pg_cron 1.6.8이 설치된 PostgreSQL
api/       잡 관리 REST API를 제공하는 FastAPI 앱
```

## API

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `POST` | `/jobs` | 잡 등록 |
| `GET` | `/jobs` | 잡 목록 조회 |
| `GET` | `/jobs/{name}/runs` | 실행 이력 조회 |
| `PATCH` | `/jobs/{name}` | 활성 상태 변경 |
| `DELETE` | `/jobs/{name}` | 잡 삭제 |

자동 시나리오는 등록, 성공 이력 조회, 비활성화, 잘못된 입력의 상태 코드와 삭제를 검증한다. pg_cron이 반환한 예약 문법 오류는 API의 HTTP 400 응답에 포함된다.

이 API는 인증 없이 관리자 DB 계정으로 임의 SQL을 예약하는 교육용 예제다. 운영 환경에서는 인증과 권한 분리, 허용할 SQL 또는 작업 유형의 제한이 필요하다.

Swagger UI는 `http://localhost:18934/docs`에서 열 수 있다. 단계별 curl 예시는 [HANDS-ON.md](HANDS-ON.md), 자동 검증 기준은 [LESSON.md](LESSON.md)에 있다.
