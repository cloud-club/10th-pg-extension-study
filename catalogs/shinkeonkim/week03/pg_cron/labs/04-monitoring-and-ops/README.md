# Lab 04 · 직렬 실행, 권한과 운영 점검

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- 같은 jobid의 이전 회차가 끝날 때까지 다음 회차가 기다린다.
- 잡은 등록한 DB 사용자의 권한으로 실행된다.
- 잡 이름의 유효 범위는 사용자별로 구분된다.
- `cron.job_run_details`는 운영자가 보존 기간과 정리 방법을 정한다.

`cron.unschedule('이름')`은 현재 사용자의 잡 이름을 찾는다. 다른 사용자의 잡은 관리자라도 이름만으로 삭제할 수 없으며, 권한이 있다면 jobid를 사용한다.

자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

다음 실습: [Lab 05 · FastAPI 연동](../05-fastapi-job-scheduler-api/)
