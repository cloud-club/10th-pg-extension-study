# hstore lab 04 — 동시성

Docker Engine과 Compose v2가 실행 중이어야 한다.
이 실습은 컨테이너 안에서 psql 세션을 여러 개 띄워 서로 다른 세션의 동작을 본다. 시간은 sleep으로 맞추므로 경과 시간(ms)은 실행마다 조금 다르다.

1. 세션 A가 키 b를 추가하고 커밋하지 않은 동안 세션 B가 같은 행의 다른 키 c를 추가한다. `pg_stat_activity`에서 B의 `wait_event_type = Lock`을 보고, A 커밋 후 두 키가 모두 남았는지 확인한다.
2. 두 세션이 각자 읽은 값에 자기 키를 합쳐 통째로 UPDATE 하면 먼저 쓴 쪽의 키가 사라지는 것을 본다.
3. 유실을 막는 두 방법(`SET attrs = attrs || ...`, `SELECT ... FOR UPDATE`)이 두 키를 모두 남기는지 본다.
4. REPEATABLE READ에서 남이 먼저 커밋한 행을 고치면 `could not serialize access` 오류가 나는지 본다.
5. pgbench로 8개 세션이 카운터를 각 50번(총 400번) 올려, 읽고-쓰기와 원자적 UPDATE의 최종 값을 비교한다.

해석: 판정은 최종 값이다. 읽고-쓰기는 400보다 훨씬 작고, 원자적 UPDATE는 정확히 400이어야 한다. 유실 정도는 실행마다 다르므로 ‘400이 아님’만 판정한다. 반복 통계는 experiments/04에 있다.

실습 설정: PostgreSQL 16.15, hstore 1.8, pgbench. 세션 스크립트는 scripts/ 에 있다.
명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
