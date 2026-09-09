#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 05-fastapi-search-api 전용 실행 스크립트.
#
# 01~04 lab 과 달리 이 lab 은 SQL 스크립트가 아니라 FastAPI 앱을 띄운다 -
# 그래서 공통 run.sh(psql 기반) 대신 이 lab만의 스크립트를 쓴다.
#
#   ./run.sh            빌드 -> 기동 -> curl 데모 시퀀스 실행
#   ./run.sh up          빌드 & 기동만 (데모 없이)
#   ./run.sh demo        데모 시퀀스만 다시 실행 (컨테이너가 안 떠 있으면 먼저 띄운다)
#   ./run.sh logs        API 로그 follow
#   ./run.sh down        컨테이너 + 볼륨 삭제
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

API="http://localhost:18944"

dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
cyan() { printf '\033[36m%s\033[0m\n' "$*"; }

pretty() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))'
  else
    cat
  fi
}

call() {  # $1 = 설명, $2.. = curl 인자
  local desc="$1"; shift
  echo
  cyan "-- $desc --------------------------------------------"
  dim  "  \$ curl $*"
  curl -sS "$@" | pretty
}

wait_healthy() {
  dim "  postgres / api 가 준비될 때까지 기다린다..."
  for _ in $(seq 1 120); do
    if docker compose exec -T postgres pg_isready -h 127.0.0.1 -p 5432 -U postgres -d study >/dev/null 2>&1 \
       && curl -sS "$API/health" >/dev/null 2>&1; then
      echo "  ✔ 준비 완료"
      return 0
    fi
    sleep 1
  done
  echo "  ✘ 기동 실패 - ./run.sh logs 로 확인하세요" >&2
  exit 1
}

up() {
  cyan "=============================================================="
  cyan "  lab: 05-fastapi-search-api"
  dim  "  DB   postgres://postgres@localhost:15944/study"
  dim  "  API  $API  (Swagger UI: $API/docs)"
  cyan "=============================================================="
  dim "  이미지를 빌드하고 postgres + api 컨테이너를 띄운다."
  docker compose up --build -d
  wait_healthy
}

demo() {
  call "2글자 키워드로 검색 - pg_bigm 이 짧은 키워드에 강한 이유" \
       -G "$API/articles/search" --data-urlencode "q=검색"

  call "긴 구절로 검색" \
       -G "$API/articles/search" --data-urlencode "q=백엔드 개발"

  call "제목 유사도 검색 - 오탈자가 있어도 매칭된다 (\"장고로 배우는 백엔드 개발\" 제목을 살짝 틀려서 질의)" \
       -G "$API/articles/similar" --data-urlencode "q=장고로 배우는 백엔드 개펄" --data-urlencode "threshold=0.3"

  call "디버그: 검색어가 2-gram 으로 어떻게 쪼개지는지" \
       -G "$API/articles/debug/bigm" --data-urlencode "text=검색"

  echo
  cyan "-- 끝 --"
  dim "  Swagger UI 로 직접 만져보려면: $API/docs"
  dim "  가이드를 보려면: HANDS-ON.md"
  dim "  정리하려면: ./run.sh down"
}

case "${1:-all}" in
  all)   up; demo ;;
  up)    up ;;
  demo)  docker compose ps -q postgres >/dev/null 2>&1 && [ -n "$(docker compose ps -q postgres)" ] || up
         demo ;;
  logs)  docker compose logs -f api ;;
  down)  docker compose down -v ;;
  *)     echo "usage: ./run.sh [all|up|demo|logs|down]" >&2; exit 1 ;;
esac
