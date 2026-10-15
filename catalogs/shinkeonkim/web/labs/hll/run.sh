#!/usr/bin/env bash
set -euo pipefail
hll_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
docker compose -f "$hll_dir/compose.yaml" up -d --build --wait
python3 "$hll_dir/bench.py"
python3 "$hll_dir/inspect-storage.py"
