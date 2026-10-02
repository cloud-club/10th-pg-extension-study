# Lab 04 · 동시성

```bash
./run.sh       # 자동 실행 (세션 스크립트 5개, 약 30초)
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- 같은 행의 다른 키를 바꾸는 두 UPDATE가 서로 기다리는가 (`pg_stat_activity`의 `Lock` 대기)
- 읽고 → 앱에서 합치고 → 통째로 쓰면 유실되는가
- `SET attrs = attrs || ...`와 `SELECT ... FOR UPDATE`가 유실을 막는가
- REPEATABLE READ에서의 `40001` 오류
- pgbench 8세션 × 50회 카운터: 읽고-쓰기 vs 원자적 UPDATE

세션을 나누는 스크립트는 [`scripts/`](scripts/)에 있고 SQL 파일이 `\!`로 호출한다.
자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

웹 자료: `#/hstore/concurrency` · 반복 실험: [`../experiments/04-concurrency-lost-update/`](../experiments/04-concurrency-lost-update/)

이전 실습: [Lab 03](../03-indexes/) · 종합: [`../README.md`](../README.md)
