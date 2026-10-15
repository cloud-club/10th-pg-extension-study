#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# experiment 01 - pg_cron 의 초 단위 스케줄이 실제로 얼마나 정확한가
#
#   ./bench.sh          빌드 -> 기동 -> baseline/load 측정 -> 결과 출력 -> 정리
#   ./bench.sh down     컨테이너 + 볼륨 삭제만
#
# baseline: 1초 간격 잡 하나만 돌 때의 지터
# load:     같은 잡 + 동시에 도는 10개의 다른 1초 잡이 있을 때의 지터
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

DB=study
DBUSER=postgres
DURATION=${DURATION:-75}   # 각 phase 관측 시간(초). 기본 75초 -> 약 70여개 샘플

dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
step() { echo; cyan "== $* =="; }

psqlc() { docker exec -i pg-study-catalog-shinkeonkim-pgcron-exp01 psql -U "$DBUSER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

up() {
  step "이미지 빌드 + 기동"
  docker compose up --build -d
  dim "  준비될 때까지 대기..."
  for _ in $(seq 1 60); do
    docker exec pg-study-catalog-shinkeonkim-pgcron-exp01 pg_isready -h 127.0.0.1 -U "$DBUSER" -d "$DB" >/dev/null 2>&1 && { echo "  ready"; return 0; }
    sleep 1
  done
  echo "postgres 가 뜨지 않았습니다" >&2; exit 1
}

setup() {
  step "설정: pg_cron 설치 + heartbeat 테이블"
  psqlc <<'SQL'
SELECT version();
SHOW cron.host;
CREATE EXTENSION IF NOT EXISTS pg_cron;
DROP TABLE IF EXISTS heartbeat;
CREATE TABLE heartbeat (id bigserial PRIMARY KEY, phase text NOT NULL, tick timestamptz NOT NULL DEFAULT clock_timestamp());
SQL
  dim "  nproc (컨테이너 안 CPU 코어 수, 환경 참고용):"
  docker exec pg-study-catalog-shinkeonkim-pgcron-exp01 nproc
}

clear_jobs() {
  psqlc -c "DO \$\$ DECLARE j record; BEGIN FOR j IN SELECT jobid FROM cron.job LOOP PERFORM cron.unschedule(j.jobid); END LOOP; END \$\$;" >/dev/null
}

measure() {  # $1 = phase name, $2 = 1 이면 노이즈 잡 10개도 함께
  local phase="$1" with_noise="$2"
  step "phase=$phase 측정 시작 (${DURATION}초 관측, 노이즈 잡=${with_noise})"
  clear_jobs
  psqlc -c "SELECT cron.schedule('probe', '1 seconds', \$\$INSERT INTO heartbeat(phase) VALUES ('$phase')\$\$);" >/dev/null
  if [ "$with_noise" = "1" ]; then
    psqlc <<'SQL' >/dev/null
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM cron.schedule('noise-' || i, '1 seconds', 'SELECT pg_sleep(0.05)');
  END LOOP;
END $$;
SQL
  fi
  sleep "$DURATION"
  clear_jobs
}

report() {  # $1 = phase name
  local phase="$1"
  local samples
  samples=$(psqlc -tAc "SELECT count(*) FROM heartbeat WHERE phase='$phase';")
  [ "$samples" -ge 4 ] || { echo "성공 heartbeat 표본 부족: $samples" >&2; return 1; }
  psqlc <<SQL
WITH deltas AS (
  SELECT tick, tick - lag(tick) OVER (ORDER BY tick) AS gap
  FROM heartbeat WHERE phase = '$phase'
)
SELECT count(*) AS 샘플수,
       round(avg(extract(epoch FROM gap))::numeric, 4)    AS 평균초,
       round(stddev(extract(epoch FROM gap))::numeric, 4) AS 표준편차초,
       round(min(extract(epoch FROM gap))::numeric, 4)    AS 최소초,
       round(max(extract(epoch FROM gap))::numeric, 4)    AS 최대초,
       count(*) FILTER (WHERE abs(extract(epoch FROM gap) - 1.0) > 0.2) AS pct20_off_count
FROM   deltas WHERE gap IS NOT NULL;
SQL
}

[[ "$DURATION" =~ ^[0-9]+$ ]] && [ "$DURATION" -ge 5 ] || { echo "DURATION은 5 이상의 정수" >&2; exit 1; }
trap 'docker compose down -v >/dev/null 2>&1' EXIT
case "${1:-all}" in
  down) docker compose down -v ;;
  all)
    up
    setup
    measure baseline 0
    step "결과: baseline (다른 잡 없음)"
    report baseline
    measure load 1
    step "결과: load (동시에 도는 10개 잡 있음)"
    report load
    step "정리"
    docker compose down -v
    echo "완료. 위 두 표(baseline vs load)의 평균초/표준편차초/20%초과_이탈_횟수 를 비교하세요."
    ;;
  *) echo "usage: ./bench.sh [all|down]" >&2; exit 1 ;;
esac
