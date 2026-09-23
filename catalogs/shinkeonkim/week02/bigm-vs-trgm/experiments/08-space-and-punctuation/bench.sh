#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 08 - 공백과 구두점은 조각에 어떻게 들어가나
#
# "중간에 공백이 들어간 문장은 공백을 포함한 조각이 생기나?" 라는 질문에서 출발했다.
# 답이 두 갈래라 셋을 나눠 잰다.
#
#   A. 조각의 생김새 (결정적)  show_bigm / show_trgm 을 그대로 찍는다.
#        - 공백이 조각 안에 실제로 들어가는가
#        - 조각이 공백을 가로지르는가
#        - 구두점은 어떻게 되는가
#   B. 검색 동작                공백이 든 패턴이 인덱스를 타는가
#   C. 2글자 우회               '% X %' 로 감싸면 trgm 이 살아나는가
#
# 측정 원칙: B·C 는 **상대 인덱스를 트랜잭션 안에서 치우고** 재고 롤백한다.
#   인덱스 둘이 공존하면 플래너가 하나를 골라버려 "누구를 쟀는지"가 흐려진다.
#   그래서 플랜에서 실제로 쓴 인덱스 이름을 매번 같이 찍는다.
#
#   ./bench.sh          빌드 -> 측정 -> 정리
#   ./bench.sh keep     컨테이너를 남긴다
#   ./bench.sh down     정리만
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
DBUSER=postgres
CONTAINER=pg-study-bigmvstrgm-exp08
ROWS="${ROWS:-200000}"
INJECT_MOD="${INJECT_MOD:-1000}"          # 0.1%
PHRASE='클라우드 클럽'                     # 가운데에 공백이 하나 있는 검색 대상

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
psqlc() { docker exec -i "$CONTAINER" psql -U "$DBUSER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

wait_healthy() {
  for _ in $(seq 1 120); do
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U "$DBUSER" -d "$DB" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "postgres never became ready" >&2; exit 1
}

case "${1:-all}" in
  down) docker compose down -v; exit 0 ;;
esac

cyan "== 말뭉치 준비 =="
fetch_corpus

cyan "== 이미지 빌드 + 기동 =="
docker compose up --build -d
wait_healthy
copy_corpus_into "$CONTAINER"
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_bigm;" >/dev/null
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
psqlc -tAc "SELECT 'PostgreSQL ' || current_setting('server_version')
            || ' / pg_bigm ' || (SELECT extversion FROM pg_extension WHERE extname='pg_bigm')
            || ' / pg_trgm ' || (SELECT extversion FROM pg_extension WHERE extname='pg_trgm');"

# ---------------------------------------------------------------------------
cyan "== A. 조각의 생김새 (결정적 - 2회 실행 동일) =="
# show_trgm 은 한글을 CRC32 로 해싱해 보여주므로 눈으로 못 읽는다.
# 그래서 같은 규칙을 ASCII 로도 한 번 더 찍는다 - 규칙 자체는 문자와 무관하다.
frag() {  # $1 = 원본 문자열
  local s="$1"
  printf '  %-22s bigm %s\n' "\"$s\"" "$(psqlc -tAc "SELECT show_bigm('$s')::text;")"
  printf '  %-22s trgm %s\n' ""       "$(psqlc -tAc "SELECT show_trgm('$s')::text;")"
}
echo "-- 공백이 있는 경우 / 없는 경우"
frag '클라우드 클럽'
frag '클라우드클럽'
echo "-- 같은 규칙을 눈으로 읽으려고 ASCII 로"
frag 'ab cd'
frag 'abcd'
echo "-- 구두점"
frag '192.168.0.1'
frag 'foo|bar'

echo
echo "  읽는 법:"
dim "    · 공백은 조각 '안에' 들어간다 - 다만 낱말의 시작/끝 표시(패딩) 자리로만 들어간다"
dim "    · 공백을 가로지르는 조각은 어느 쪽에서도 안 생긴다 ('ab cd' 에 'b c' 가 없다)"
dim "    · 구두점은 갈린다 - bigm 은 조각 안에 남기고, trgm 은 낱말 구분자로 쓰고 버린다"

# ---------------------------------------------------------------------------
cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v n="$ROWS" -v m="$INJECT_MOD" -v p="$PHRASE" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
-- 주입 행에만 '클라우드 클럽' 이 들어간다. 말뭉치에 없는 문자열이라 정답 수가 정확히 통제된다.
INSERT INTO docs (id, doc)
SELECT g,
       CASE WHEN g % :m = 0 THEN :'p' || ' 모임 ' || c.doc
            ELSE c.doc || ' #' || g END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);
CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);
VACUUM ANALYZE docs;
SQL
TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
INJECTED=$(psqlc -tAc "SELECT count(*) FROM docs WHERE id % $INJECT_MOD = 0;")
echo "  전체 ${TOTAL}행 / 주입 ${INJECTED}행"

RESULTS="$(mktemp)"
echo "엔진,패턴,정답행수,플랜,쓴인덱스,인덱스스캔행,recheck제거,버퍼,실행ms" > "$RESULTS"

measure() {  # $1 = bigm|trgm|none  $2 = LIKE 패턴
  local eng="$1" pat="$2" drop out hits plan used idxrows recheck bufs ms ok
  case "$eng" in
    bigm) drop="DROP INDEX docs_trgm;" ;;
    trgm) drop="DROP INDEX docs_bigm;" ;;
    none) drop="DROP INDEX docs_bigm; DROP INDEX docs_trgm;" ;;
  esac
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '$pat';" | tail -1)
  # 상대 인덱스를 트랜잭션 안에서만 치운다 - 롤백하면 되살아나므로 재생성 비용이 없다
  out=$(psqlc -tAq <<SQL
BEGIN;
$drop
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$pat';
ROLLBACK;
SQL
)
  plan=$(echo "$out"    | grep -oE 'Parallel Seq Scan|Seq Scan|Bitmap Index Scan' | head -1 || true)
  used=$(echo "$out"    | grep -oE 'Bitmap Index Scan on [a-z_]+' | head -1 | awk '{print $NF}' || true)
  idxrows=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'rows=[0-9]+ loops=' | grep -oE '[0-9]+' || true)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' | grep -oE '[0-9]+$' | head -1 || true)
  bufs=$(echo "$out"    | grep -oE 'Buffers: shared [a-z=0-9 ]+' | head -1 | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || true)
  ms=$(echo "$out"      | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
  # 라벨이 진짜인지 플랜으로 검증한다 - 이 실험의 존재 이유이기도 하다
  if [ "$eng" = none ]; then ok=$([ -z "$used" ] && echo ✔ || echo ✘)
  else ok=$([ "$used" = "docs_$eng" ] && echo ✔ || echo ✘); fi

  printf '    %-5s %-14s 정답 %-6s %-18s 쓴인덱스 %-12s %s  인덱스행 %-8s recheck %-8s 버퍼 %-7s %s ms\n' \
         "$eng" "$pat" "$hits" "${plan:--}" "${used:--}" "$ok" "${idxrows:--}" "${recheck:-0}" "${bufs:--}" "${ms:--}"
  echo "$eng,$pat,$hits,${plan:--},${used:--},${idxrows:--},${recheck:-0},${bufs:--},${ms:--}" >> "$RESULTS"
}

# ---------------------------------------------------------------------------
cyan "== B. 공백이 든 패턴은 인덱스를 타는가 =="
dim "  '%드 클%' 은 3글자(드·공백·클)라 trgm 도 조각을 만들 수 있다."
for eng in none bigm trgm; do measure "$eng" '%드 클%'; done
echo
dim "  대조군 - 공백 없는 2글자. 여기서 trgm 이 무너진다."
for eng in none bigm trgm; do measure "$eng" '%클럽%'; done

# ---------------------------------------------------------------------------
cyan "== C. 2글자를 공백으로 감싸면 trgm 이 살아나는가 =="
dim "  '% 클럽 %' 은 앞뒤 공백이 패딩 자리를 채워줘 3-gram 이 만들어진다."
dim "  대신 의미가 '부분 문자열'에서 '낱말'로 바뀐다 - 정답 행 수를 같이 본다."
for eng in bigm trgm; do measure "$eng" '% 클럽 %'; done

echo
cyan "== 결과 CSV =="
cat "$RESULTS"

if [ "${1:-all}" != keep ]; then
  cyan "== 정리 =="
  docker compose down -v
fi
