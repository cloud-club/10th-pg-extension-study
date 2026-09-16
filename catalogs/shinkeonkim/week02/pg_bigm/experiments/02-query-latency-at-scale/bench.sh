#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 02 - LIKE 검색 실제 실행 시간: 인덱스 없음 vs bigm vs trgm
#
#   ./bench.sh          빌드 -> 기동 -> 3개 규모 x 2개 키워드(짧은/긴) x 3가지
#                       인덱스 상태에서 EXPLAIN ANALYZE 실행시간을 잰다 -> 정리
#   ./bench.sh down     컨테이너 정리만
#
# 2차 개정 - 이 실험은 이 카탈로그의 '측정 원칙'이 나온 자리다.
#   1차 판은 어휘 15문장을 random() 으로 조합한 합성 데이터를 썼는데,
#   세 번째 실행에서 결과가 재현되지 않아 핵심 주장을 철회해야 했다. 원인은 둘:
#     (1) random() 의 호출 순서가 실행 계획에 따라 달라져 데이터 자체가 달라졌다
#     (2) 어휘 15개뿐이라 '검색' 같은 키워드가 전체의 40% 와 매치됐다
#         - 선택도가 통제되지 않으니 "인덱스가 이득인가"를 물을 수 없는 상태였다
#   지금은 NSMC 말뭉치 + generate_series 나머지 주입으로 바꾸고, 키워드를 정해진
#   비율에 심은 뒤 실제 선택도를 다시 재서 함께 기록한다. 그리고 벽시계 시간 대신
#   EXPLAIN 의 결정적 지표(후보 행 / recheck / 버퍼)를 주 지표로 본다.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
USER=postgres
CONTAINER=pg-study-pgbigm-exp02-query-latency
SCALES=(50000 200000 1000000)
# 스터디 공용 예시 문자열. 정해진 비율로 주입하고 실제 선택도를 다시 잰다.
SHORT_KW='클클'          # 2글자 - pg_trgm 이 조각을 못 만드는 구간
LONG_KW='클라우드클럽'   # 6글자 - 두 확장 모두 정상 동작하는 대조군
INJECT_MOD="${INJECT_MOD:-1000}"   # 1/1000 = 0.1% 에 주입

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }

psqlc() { docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

wait_healthy() {
  for _ in $(seq 1 60); do
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U "$USER" -d "$DB" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "postgres never became ready" >&2; exit 1
}

up() {
  cyan "== 말뭉치 준비 =="
  fetch_corpus
  cyan "== 이미지 빌드 + 기동 =="
  docker compose up --build -d
  wait_healthy
  copy_corpus_into "$CONTAINER"
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_bigm;"
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
}

seed() {  # $1 = n
  psqlc -v n="$1" -v m="$INJECT_MOD" <<'SQL' >/dev/null
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS exp_docs;
CREATE TABLE exp_docs (id int PRIMARY KEY, body text NOT NULL);

-- 말뭉치를 나머지 연산으로 순환 참조한다(random() 을 쓰지 않는다 - 재현되지 않았다).
-- 키워드는 id 나머지로 정확히 0.1% 에 심는다. 두 키워드가 서로의 부분 문자열이
-- 아니어야 정답 행수가 오염되지 않는다: '클클' 은 '클라우드클럽' 안에 없다.
INSERT INTO exp_docs (id, body)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;

UPDATE exp_docs SET body = body || ' 클라우드클럽' WHERE id % :m = 0;
UPDATE exp_docs SET body = body || ' 클클'         WHERE id % :m = 1;
VACUUM ANALYZE exp_docs;
SQL
}

# 선택도를 통제 변수로 명시한다 - 실제 매치 비율을 먼저 재서 기록한다.
report_selectivity() {
  local n="$1" a b
  a=$(psqlc -tAc "SELECT count(*) FROM exp_docs WHERE body LIKE '%${SHORT_KW}%';")
  b=$(psqlc -tAc "SELECT count(*) FROM exp_docs WHERE body LIKE '%${LONG_KW}%';")
  dim "  선택도: ${SHORT_KW} ${a}행 ($(awk -v x="$a" -v y="$n" 'BEGIN{printf "%.3f", 100*x/y}')%) · ${LONG_KW} ${b}행 ($(awk -v x="$b" -v y="$n" 'BEGIN{printf "%.3f", 100*x/y}')%)"
  SEL_SHORT="$a"; SEL_LONG="$b"
}

# 시간보다 먼저 보는 결정적 지표 - "인덱스가 후보를 정답까지 좁혔는가"
det_metrics() {  # $1 = 패턴, $2 = 플랜 설정 -> "후보|recheck|버퍼"
  local out rows recheck bufs
  out=$(psqlc -tAc "$2 EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM exp_docs WHERE body LIKE '$1';")
  rows=$(echo "$out"    | grep 'Bitmap Index Scan' | head -1 \
                        | grep -oE 'rows=[0-9.]+ loops=' | grep -oE '[0-9.]+' \
                        | awk '{printf "%d", $1}' || true)
  bufs=$(echo "$out"    | grep -A3 'Bitmap Index Scan' \
                        | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 \
                        | grep -oE '[0-9]+' | paste -sd+ - | bc || true)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' \
                        | grep -oE '[0-9]+$' | head -1 || true)
  echo "${rows:--}|${recheck:-0}|${bufs:--}"
}

# EXPLAIN ANALYZE 를 워밍업 1회 + 측정 3회 돌려서 "Execution Time" 평균(ms)을 낸다.
avg_exec_ms() {  # $1 = LIKE 패턴 (psql 리터럴로 안전하게 넣을 문자열), $2 = 강제 플랜 설정 SQL(없으면 "")
  local pattern="$1" plan_setup="$2"
  local total=0 n=3 i out ms
  psqlc -c "${plan_setup} EXPLAIN ANALYZE SELECT count(*) FROM exp_docs WHERE body LIKE '${pattern}';" >/dev/null
  for i in $(seq 1 "$n"); do
    out=$(psqlc -tAc "${plan_setup} EXPLAIN (ANALYZE, TIMING) SELECT count(*) FROM exp_docs WHERE body LIKE '${pattern}';")
    ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+')
    total=$(awk -v t="$total" -v m="$ms" 'BEGIN{printf "%.4f", t+m}')
  done
  awk -v t="$total" -v n="$n" 'BEGIN{printf "%.3f", t/n}'
}

RESULTS_FILE="$(mktemp)"
echo "rows,keyword,no_index_ms,bigm_ms,trgm_ms" > "$RESULTS_FILE"
# 결정적 지표를 따로 남긴다 - 이쪽이 주 지표이고 시간은 보조다
DET_FILE="$(mktemp)"
echo "행수,인덱스,검색어,정답행수,인덱스스캔행,recheck제거,버퍼,실행ms" > "$DET_FILE"

run_scale() {
  local n="$1"
  cyan "== ${n}행 =="
  seed "$n"
  report_selectivity "$n"

  local short_pat="%${SHORT_KW}%" long_pat="%${LONG_KW}%"

  dim "  (A) 인덱스 없음 - 시퀀셜 스캔 강제"
  local noidx_short noidx_long
  noidx_short=$(avg_exec_ms "$short_pat" "SET enable_bitmapscan=off; SET enable_indexscan=off;")
  noidx_long=$(avg_exec_ms  "$long_pat"  "SET enable_bitmapscan=off; SET enable_indexscan=off;")
  echo "    짧은 키워드(${SHORT_KW}): ${noidx_short} ms / 긴 구절: ${noidx_long} ms"

  dim "  (B) gin_bigm_ops 인덱스"
  psqlc -c "CREATE INDEX exp_docs_bigm_idx ON exp_docs USING gin (body gin_bigm_ops);" >/dev/null
  local bigm_short bigm_long
  bigm_short=$(avg_exec_ms "$short_pat" "SET enable_seqscan=off;")
  bigm_long=$(avg_exec_ms  "$long_pat"  "SET enable_seqscan=off;")
  local bs bl
  bs=$(det_metrics "$short_pat" "SET enable_seqscan=off;")
  bl=$(det_metrics "$long_pat"  "SET enable_seqscan=off;")
  echo "    짧은 키워드(${SHORT_KW}): ${bigm_short} ms  [후보|recheck|버퍼 = ${bs}]"
  echo "    긴 구절(${LONG_KW}):     ${bigm_long} ms  [후보|recheck|버퍼 = ${bl}]"
  echo "${n},bigm,${SHORT_KW},${SEL_SHORT},${bs//|/,},${bigm_short}" >> "$DET_FILE"
  echo "${n},bigm,${LONG_KW},${SEL_LONG},${bl//|/,},${bigm_long}"   >> "$DET_FILE"
  psqlc -c "DROP INDEX exp_docs_bigm_idx;" >/dev/null

  dim "  (C) gin_trgm_ops 인덱스"
  psqlc -c "CREATE INDEX exp_docs_trgm_idx ON exp_docs USING gin (body gin_trgm_ops);" >/dev/null
  local trgm_short trgm_long
  trgm_short=$(avg_exec_ms "$short_pat" "SET enable_seqscan=off;")
  trgm_long=$(avg_exec_ms  "$long_pat"  "SET enable_seqscan=off;")
  local ts tl
  ts=$(det_metrics "$short_pat" "SET enable_seqscan=off;")
  tl=$(det_metrics "$long_pat"  "SET enable_seqscan=off;")
  echo "    짧은 키워드(${SHORT_KW}): ${trgm_short} ms  [후보|recheck|버퍼 = ${ts}]"
  echo "    긴 구절(${LONG_KW}):     ${trgm_long} ms  [후보|recheck|버퍼 = ${tl}]"
  echo "${n},trgm,${SHORT_KW},${SEL_SHORT},${ts//|/,},${trgm_short}" >> "$DET_FILE"
  echo "${n},trgm,${LONG_KW},${SEL_LONG},${tl//|/,},${trgm_long}"   >> "$DET_FILE"
  psqlc -c "DROP INDEX exp_docs_trgm_idx;" >/dev/null

  echo "${n},short(${SHORT_KW}),${noidx_short},${bigm_short},${trgm_short}" >> "$RESULTS_FILE"
  echo "${n},long,${noidx_long},${bigm_long},${trgm_long}" >> "$RESULTS_FILE"
}

case "${1:-all}" in
  down) docker compose down -v; exit 0 ;;
esac

up
for n in "${SCALES[@]}"; do run_scale "$n"; done

cyan "== 결과 요약 (실측 평균, ms) =="
column -t -s, "$RESULTS_FILE"
echo
cyan "== 결과 요약: 결정적 지표 (주 지표) =="
column -t -s, "$DET_FILE"
echo
dim "인덱스스캔행이 전체 행수와 비슷하면 GIN_SEARCH_MODE_ALL(인덱스 전체 스캔) 상태다."
dim "시간은 보조 지표다 - 자릿수 차이만 해석할 것."
echo
dim "이 표를 그대로 README.md 의 '결과' 섹션에 옮겨 적는다."

cyan "== 정리 =="
docker compose down -v
rm -f "$RESULTS_FILE" "$DET_FILE"
