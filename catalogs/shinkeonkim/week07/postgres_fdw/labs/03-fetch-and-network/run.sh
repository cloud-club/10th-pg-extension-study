#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
shared="../shared"
case "${1:-all}" in
 explain) echo '웹 실습: #/postgres-fdw/lab-fetch' ;;
 up) "$shared/run.sh" up ;;
 psql) "$shared/run.sh" psql ;;
 remote) "$shared/run.sh" remote ;;
 down) "$shared/run.sh" down ;;
 all|sql)
   "$shared/run.sh" up
   for file in sql/*.sql; do
     docker compose -f "$shared/compose.yaml" exec -T local psql -X -e -U postgres -d study -v ON_ERROR_STOP=1 < "$file"
   done
   python3 verify.py
   ;;
 *) echo 'usage: ./run.sh [all|up|sql|psql|remote|explain|down]' >&2; exit 1 ;;
esac
