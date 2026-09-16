#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
API=http://localhost:18934
up() {
  docker compose up --build -d
  for _ in $(seq 1 90); do
    if curl -fsS "$API/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  docker compose logs --tail=50
  echo 'API/DB가 준비되지 않았습니다' >&2
  exit 1
}
demo() {
  cat LESSON.md
  if ! curl -fsS "$API/health" >/dev/null 2>&1; then up; fi
  python3 demo.py "$API"
  echo "관찰: $API/docs · 정리: ./run.sh down"
}
case "${1:-all}" in
  all) cat LESSON.md; up; demo ;;
  up) up; echo "기동만 완료. ./run.sh demo 또는 $API/docs로 진행하세요." ;;
  demo) demo ;;
  explain) cat LESSON.md ;;
  logs) docker compose logs -f ;;
  down) docker compose down -v ;;
  *) echo 'usage: ./run.sh [all|up|demo|explain|logs|down]' >&2; exit 1 ;;
esac
