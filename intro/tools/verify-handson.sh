#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 각 lab 의 HANDS-ON.md 에 적힌 SQL 을 "적힌 순서 그대로" 깨끗한 DB 에서 실행해
# 가이드가 실제로 따라할 수 있는 상태인지 확인한다.
#
#   ./tools/verify-handson.sh              전체
#   ./tools/verify-handson.sh 00 03      일부만
#
# ```sql              → 에러 없이 통과해야 한다
# ```sql expect-error → 반드시 에러가 나야 한다 (교육 목적의 실패 예시)
# ```bash             → 검사하지 않는다 (호스트에서 치는 명령)
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TOOLS="$ROOT/tools"
LOGDIR="${TMPDIR:-/tmp}/pg-extension-study-handson"
mkdir -p "$LOGDIR"
FAILED=0

targets=()
if [ $# -gt 0 ]; then
  for a in "$@"; do
    for d in "$ROOT"/labs/"$a"*/; do [ -d "$d" ] && targets+=("$d"); done
  done
else
  for d in "$ROOT"/labs/[0-9][0-9]-*/; do targets+=("$d"); done
fi

for d in "${targets[@]}"; do
  name="$(basename "$d")"
  md="$d/HANDS-ON.md"
  if [ ! -f "$md" ]; then
    printf '  \033[33m·\033[0m %-28s HANDS-ON.md 없음\n' "$name"; continue
  fi

  script="$LOGDIR/$name.sql"
  log="$LOGDIR/$name.log"
  # 블록 수는 추출기가 stderr 로 알려준다 ("N blocks")
  python3 "$TOOLS/extract-handson.py" "$md" > "$script" 2> "$LOGDIR/$name.count"
  nblocks=$(awk '{print $1}' "$LOGDIR/$name.count")

  ( cd "$d" || exit 1
    ./run.sh down >/dev/null 2>&1
    if ! ./run.sh up >"$log" 2>&1; then
      printf '  \033[31m✘\033[0m %-28s 컨테이너 기동 실패\n' "$name"; exit 1
    fi
    cid=$(docker compose ps -q postgres)
    docker cp "$script" "$cid:/tmp/handson.sql" >/dev/null 2>&1
    docker exec -i "$cid" psql -U postgres -d study -f /tmp/handson.sql >>"$log" 2>&1
    ./run.sh down >/dev/null 2>&1 )
  rc=$?
  [ $rc -ne 0 ] && { FAILED=1; continue; }

  # 블록별 판정: 각 @@BLOCK ~ @@ENDBLOCK 사이에 ERROR 가 있었는지
  python3 - "$log" "$nblocks" "$name" <<'PY'
import re, sys
log, nblocks, name = open(sys.argv[1], encoding='utf-8', errors='replace').read(), int(sys.argv[2]), sys.argv[3]
blocks = {}
cur = None
for line in log.splitlines():
    m = re.match(r'@@BLOCK (\d+) (OK|XFAIL)', line)
    if m:
        cur = (int(m.group(1)), m.group(2)); blocks[cur] = []; continue
    if line.startswith('@@ENDBLOCK'):
        cur = None; continue
    if cur and re.search(r'^(psql:.*:)?\s*ERROR:', line):
        blocks[cur].append(line.strip())

bad = []
for (n, kind), errs in sorted(blocks.items()):
    if kind == 'OK' and errs:
        bad.append(f"블록 {n}: 에러 - {errs[0][:90]}")
    if kind == 'XFAIL' and not errs:
        bad.append(f"블록 {n}: 에러가 나야 하는데 통과함")
missing = nblocks - len(blocks)
if missing > 0:
    bad.append(f"{missing}개 블록이 실행되지 않음 (앞 블록에서 중단)")

if bad:
    print(f"  \033[31m✘\033[0m {name:<28} {len(blocks)}/{nblocks} 블록")
    for b in bad: print(f"      {b}")
    sys.exit(1)
print(f"  \033[32m✔\033[0m {name:<28} {nblocks}개 블록 전부 의도대로")
PY
  [ $? -ne 0 ] && FAILED=1
done

echo
if [ $FAILED -eq 0 ]; then printf '\033[32m✔ HANDS-ON 가이드 전부 통과\033[0m\n'
else printf '\033[31m✘ 고쳐야 할 가이드가 있습니다 - %s\033[0m\n' "$LOGDIR"; exit 1; fi
