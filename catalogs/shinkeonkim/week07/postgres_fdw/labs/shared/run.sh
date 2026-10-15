#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
compose() { docker compose -f compose.yaml "$@"; }
prepare() {
 compose up -d --wait
 compose exec -T remote psql -X -U postgres -d school -v ON_ERROR_STOP=1 < remote.sql
 compose exec -T local psql -X -U postgres -d study -v ON_ERROR_STOP=1 < local.sql
}
case "${1:-up}" in
 up) prepare ;;
 psql) compose exec local psql -X -U postgres -d study ;;
 remote) compose exec remote psql -X -U postgres -d school ;;
 logs) compose logs remote ;;
 down) compose down -v ;;
 *) echo 'usage: ./run.sh [up|psql|remote|logs|down]' >&2; exit 1 ;;
esac
