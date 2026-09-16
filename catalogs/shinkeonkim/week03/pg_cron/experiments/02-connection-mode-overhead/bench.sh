#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# experiment 02 - 기본 모드(libpq 클라이언트 연결) vs
#                 cron.use_background_workers=on (진짜 background worker) 비교
#
#   ./bench.sh          빌드 -> 기동 -> 두 모드 각각 60초 측정 -> 비교 출력 -> 정리
#   ./bench.sh down     컨테이너 + 볼륨 삭제만
#
# 측정 대상: 매초 도는 트리비얼한 잡(SELECT 1)의 "실행 시간"(end_time - start_time).
# start_time은 연결/worker 기동 뒤 기록된다. 전체 기동 오버헤드의 대리 지표가 아니다.
# worker는 SPI를 사용하지 않는다. README의 측정 경계 설명을 먼저 읽는다.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

DB=study
DBUSER=postgres
C=pg-study-catalog-shinkeonkim-pgcron-exp02
DURATION=${DURATION:-60}

dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
step() { echo; cyan "== $* =="; }

psqlc()  { docker exec -i "$C" psql -U "$DBUSER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
psqlv()  { docker exec -i "$C" psql -U "$DBUSER" -d "$DB" -tAc "$1"; }   # 스칼라 한 값만 받아올 때

wait_ready() {
  for _ in $(seq 1 60); do
    docker exec "$C" pg_isready -h 127.0.0.1 -U "$DBUSER" -d "$DB" >/dev/null 2>&1 && { echo "  ready"; return 0; }
    sleep 1
  done
  echo "postgres 가 뜨지 않았습니다" >&2; exit 1
}

up() {
  step "이미지 빌드 + 기동 (기본: cron.use_background_workers=off)"
  docker compose up --build -d
  dim "  준비될 때까지 대기..."
  wait_ready
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" >/dev/null
  dim "  nproc / max_worker_processes 확인:"
  docker exec "$C" nproc
  psqlc -c "SELECT version(); SHOW cron.host; SHOW max_worker_processes;"
  psqlc -c "ALTER SYSTEM SET cron.use_background_workers = off;" >/dev/null
  docker restart "$C" >/dev/null
  wait_ready
}

clear_jobs() { psqlc -c "DO \$\$ DECLARE j record; BEGIN FOR j IN SELECT jobid FROM cron.job LOOP PERFORM cron.unschedule(j.jobid); END LOOP; END \$\$;" >/dev/null; }

measure() {  # $1 = jobname 라벨
  local name="$1"
  clear_jobs
  local jobid
  jobid=$(psqlv "SELECT cron.schedule('$name', '1 seconds', 'SELECT 1');")
  dim "  jobid=$jobid 로 ${DURATION}초 관측..." >&2
  sleep "$DURATION"
  clear_jobs
  echo "$jobid"
}

report() {  # $1 = jobid
  local jobid="$1"
  local samples
  samples=$(psqlv "SELECT count(*) FROM cron.job_run_details WHERE jobid=$jobid AND status='succeeded';")
  [ "$samples" -ge 3 ] || { echo "성공 표본 부족: $samples" >&2; return 1; }
  psqlc <<SQL
SELECT count(*) AS 실행횟수,
       round(avg(extract(epoch FROM (end_time - start_time)))::numeric * 1000, 3) AS 평균ms,
       round(stddev(extract(epoch FROM (end_time - start_time)))::numeric * 1000, 3) AS 표준편차ms,
       round(min(extract(epoch FROM (end_time - start_time)))::numeric * 1000, 3) AS 최소ms,
       round(max(extract(epoch FROM (end_time - start_time)))::numeric * 1000, 3) AS 최대ms
FROM   cron.job_run_details
WHERE  jobid = $jobid AND status = 'succeeded';
SQL
}

switch_to_bgworker() {
  step "cron.use_background_workers = on 으로 전환 + 재시작 (postmaster 컨텍스트라 재시작 필요)"
  psqlc -c "ALTER SYSTEM SET cron.use_background_workers = on;" >/dev/null
  docker restart "$C" >/dev/null
  dim "  재시작 후 대기..."
  wait_ready
  psqlc -c "SHOW cron.use_background_workers;"
}

[[ "$DURATION" =~ ^[0-9]+$ ]] && [ "$DURATION" -ge 5 ] || { echo "DURATION은 5 이상의 정수" >&2; exit 1; }
trap 'docker compose down -v >/dev/null 2>&1' EXIT
case "${1:-all}" in
  down) docker compose down -v ;;
  all)
    up

    step "phase 1: 기본(libpq 연결) 모드 - ${DURATION}초"
    psqlc -c "SHOW cron.use_background_workers;"
    JOB_OFF=$(measure probe-libpq)
    step "결과: libpq 모드 (jobid=$JOB_OFF)"
    report "$JOB_OFF"

    switch_to_bgworker

    step "phase 2: background worker 모드 - ${DURATION}초"
    JOB_ON=$(measure probe-bgworker)
    step "결과: background worker 모드 (jobid=$JOB_ON)"
    report "$JOB_ON"

    step "정리"
    docker compose down -v
    echo "완료. 두 표의 평균ms 를 비교하세요 - 이력 시간은 연결/worker 기동 전체 비용이 아님에 주의하세요."
    ;;
  *) echo "usage: ./bench.sh [all|down]" >&2; exit 1 ;;
esac
