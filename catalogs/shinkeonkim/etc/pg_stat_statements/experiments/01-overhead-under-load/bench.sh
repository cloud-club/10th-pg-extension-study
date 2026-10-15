#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# experiment 01 - pg_stat_statements 를 켰을 때 실제 처리량(TPS) 손실을 측정한다.
#
# 4가지 설정을 매번 컨테이너를 새로 띄워가며(=완전히 독립된 상태에서) 비교한다.
# 설정별 초기 DB를 만들기 위해 docker run으로 컨테이너를 교체한다.
# shared_preload_libraries 변경은 서버 재시작이 필요하다.
#
#   ./bench.sh            전체 스윕 실행 (4 설정 x 3 회 측정, ~6-8분)
#   ./bench.sh quick       각 설정 1회씩만 (빠른 확인용, 신뢰도는 낮다)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

IMAGE=pg-study-pgss-exp01
CONTAINER=pg-study-pgss-exp01-run
PORT=15950
DB=bench
RUNS=3
DURATION=15
[ "${1:-}" = "quick" ] && { RUNS=1; DURATION=8; }

dim()  { printf '\033[2m%s\033[0m\n' "$*" >&2; }
cyan() { printf '\033[36m%s\033[0m\n' "$*" >&2; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cyan "== 이미지 빌드 =="
docker build -q -t "$IMAGE" . >&2

wait_ready() {
  for _ in $(seq 1 60); do
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d "$DB" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "서버가 준비되지 않았습니다" >&2
  exit 1
}

# $1 = config 이름, 나머지 = postgres 서버에 넘길 -c 옵션들 (없으면 preload 안 함)
run_config() {
  local name="$1"; shift
  cleanup
  cyan "== [$name] 컨테이너 기동 =="
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_DB="$DB" -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
    -p "$PORT:5432" \
    "$IMAGE" postgres "$@" >/dev/null
  wait_ready

  if [[ "$*" == *pg_stat_statements* ]]; then
    docker exec -e PGPASSWORD=postgres "$CONTAINER" \
      psql -h 127.0.0.1 -U postgres -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" >/dev/null
  fi

  dim "  pgbench -i -s 10 (초기화)"
  docker exec -e PGPASSWORD=postgres "$CONTAINER" \
    pgbench -h 127.0.0.1 -U postgres -i -s 10 -q "$DB" >/dev/null 2>&1

  dim "  워밍업 (측정 안 함, 5초)"
  docker exec -e PGPASSWORD=postgres "$CONTAINER" \
    pgbench -h 127.0.0.1 -U postgres -c 4 -j 2 -T 5 "$DB" >/dev/null 2>&1

  local i tps
  for i in $(seq 1 "$RUNS"); do
    dim "  측정 $i/$RUNS (${DURATION}초)"
    tps=$(docker exec -e PGPASSWORD=postgres "$CONTAINER" \
      pgbench -h 127.0.0.1 -U postgres -c 4 -j 2 -T "$DURATION" "$DB" 2>&1 \
      | grep '^tps = ' | head -1 | awk '{print $3}')
    echo "$name $tps"
  done
}

RESULTS=$(mktemp)

run_config baseline    >> "$RESULTS"
run_config track_top   -c shared_preload_libraries=pg_stat_statements >> "$RESULTS"
run_config track_all   -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all >> "$RESULTS"
run_config full         -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all -c pg_stat_statements.track_planning=on -c track_io_timing=on >> "$RESULTS"

cyan "== 원본 측정값 =="
cat "$RESULTS" >&2

cyan "== 요약 (mean, stddev, baseline 대비 %) =="
python3 - "$RESULTS" <<'PY'
import sys, statistics as st
from collections import defaultdict

rows = defaultdict(list)
with open(sys.argv[1]) as f:
    for line in f:
        name, tps = line.split()
        rows[name].append(float(tps))

order = ["baseline", "track_top", "track_all", "full"]
base_mean = st.mean(rows["baseline"])

print(f"{'config':<12} {'n':>3} {'mean_tps':>10} {'stddev':>8} {'overhead%':>10}")
for name in order:
    vals = rows.get(name, [])
    if not vals:
        continue
    mean = st.mean(vals)
    sd = st.stdev(vals) if len(vals) > 1 else 0.0
    overhead = (base_mean - mean) / base_mean * 100
    print(f"{name:<12} {len(vals):>3} {mean:>10.1f} {sd:>8.1f} {overhead:>9.1f}%")
PY

rm -f "$RESULTS"
