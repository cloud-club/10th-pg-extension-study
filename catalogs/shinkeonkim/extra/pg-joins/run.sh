#!/usr/bin/env bash
set -euo pipefail
lab_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
mkdir -p "$lab_dir/results"
docker compose -f "$lab_dir/compose.yaml" up -d --wait
docker compose -f "$lab_dir/compose.yaml" exec -T db psql -X -U postgres -d study -v ON_ERROR_STOP=1 < "$lab_dir/lab.sql" > "$lab_dir/results/plan.txt"
python3 "$lab_dir/verify.py"
