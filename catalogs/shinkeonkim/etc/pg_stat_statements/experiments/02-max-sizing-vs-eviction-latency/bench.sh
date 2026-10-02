#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# experiment 02 - pg_stat_statements.max 를 작게(잦은 eviction) / 크게(eviction
# 없음) 잡았을 때, 문장 하나하나의 실행 지연시간이 실제로 달라지는지 측정한다.
#
#   ./bench.sh          두 설정(max=200 / max=5000) 각각 measure.py 실행
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

IMAGE=pg-study-pgss-exp02
CONTAINER=pg-study-pgss-exp02-run
PORT=15951
DB=bench
N=${1:-1600}
[[ "$N" =~ ^[0-9]+$ ]] && [ "$N" -ge 2 ] && [ "$N" -le 1664 ] || { echo "N은 2~1664 정수" >&2; exit 1; }

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

run_config() {  # $1 = pg_stat_statements.max 값
  local max="$1"
  cleanup
  cyan "== max=$max 컨테이너 기동 =="
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_DB="$DB" -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
    -p "$PORT:5432" \
    "$IMAGE" postgres -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.max="$max" >/dev/null
  wait_ready

  cyan "-- max=$max: measure.py 로 $N 개의 서로 다른 쿼리 모양 실행 --"
  docker exec "$CONTAINER" python3 /usr/local/bin/measure.py "$N"
}

echo "=== max=200 (N=$N; 실제 eviction 여부는 dealloc 결과로 확인) ==="
run_config 200
echo
echo "=== max=5000 (N=$N; 허용 범위에서는 max보다 적은 쿼리 모양) ==="
run_config 5000
