#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 실험 서버 기동
#
#   ./run.sh          빌드 + 기동 -> http://localhost:8000
#   ./run.sh down     정리 (데이터 볼륨까지)
#   ./run.sh logs     로그 따라가기
#
# 최초 1회는 PostgreSQL 세 버전에 pg_bigm 을 소스 빌드하므로 5~10분 걸린다.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-up}" in
  down) docker compose down -v; exit 0 ;;
  logs) docker compose logs -f api; exit 0 ;;
esac

echo "== 이미지 빌드 + 기동 (최초 1회는 pg_bigm 빌드로 5~10분) =="
docker compose up --build -d

echo "== API 가 뜰 때까지 대기 =="
for _ in $(seq 1 120); do
  if curl -sf http://localhost:8000/api/meta >/dev/null 2>&1; then
    echo
    echo "  준비됐습니다 →  http://localhost:8000"
    echo
    curl -s http://localhost:8000/api/meta | head -c 400; echo
    exit 0
  fi
  sleep 2
done
echo "API 가 뜨지 않았습니다. ./run.sh logs 로 확인하세요." >&2
exit 1
