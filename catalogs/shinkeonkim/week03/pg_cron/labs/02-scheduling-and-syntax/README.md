# Lab 02 · 예약 문법과 관리 함수

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- 5필드 cron 표현식, 1~59초 간격과 월말 기호 `$`
- 이름 없는 잡의 2인자 함수와 이름 있는 잡의 3인자 함수
- 존재하지 않는 1인자 `cron.schedule()` 호출의 오류
- `cron.schedule_in_database()`를 사용한 다른 DB의 SQL 실행
- `cron.alter_job()`을 사용한 시간표와 활성 상태 변경

`cron.schedule('SELECT ...')`처럼 인자 하나만 전달하는 함수는 없다. 이름 없는 잡은 `(schedule, command)`, 이름 있는 잡은 `(job_name, schedule, command)` 형식을 사용한다.

자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

다음 실습: [Lab 03 · 실행과 동시성](../03-execution-model-and-concurrency/)
