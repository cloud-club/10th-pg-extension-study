# Lab 03 · 실행 모드와 동시 실행 한도

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- 기본 libpq 모드의 잡은 `pg_stat_activity`에서 `client backend`로 보인다.
- `application_name='pg_cron'`으로 일반 애플리케이션 연결과 구분한다.
- `cron.max_running_jobs`가 전체 동시 실행 수의 상한으로 적용된다.
- 한도 이내라는 사실만으로 모든 잡의 정상 진행을 보장할 수는 없다.

예약 직후에는 launcher가 다음 시각을 확인하기 전이므로 실행 프로세스가 아직 보이지 않을 수 있다. 자동 검증은 이 지연을 고려해 기다린 뒤 실행 중인 프로세스와 이력을 함께 확인한다.

이 실습은 `cron.max_running_jobs=5`를 사용한다. 자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), worker 모드 전환을 포함한 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

다음 실습: [Lab 04 · 권한과 운영](../04-monitoring-and-ops/)
