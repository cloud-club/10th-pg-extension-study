#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 05 - 검색어 길이 × 패턴 모양 × 엔진
#
# 세 가지를 한 격자에서 잰다.
#
#   엔진   : 인덱스 없음(순수 LIKE) / gin_bigm_ops / gin_trgm_ops
#   길이   : 2, 3, 5, 10, 20 글자
#   패턴   : '%X%' (부분 일치) / 'X%' (접두어) / '%X' (접미어)
#
# 핵심 설계: 정답 행 수를 세 패턴 × 다섯 길이에서 "모두 같게" 만든다.
#   주입 행의 형태를 다음과 같이 만든다.
#       <BASE20> <말뭉치 문장> <BASE20>
#   그러면
#     - '%' || left(BASE20,L) || '%'  -> 앞쪽 BASE20 에 걸린다
#     -        left(BASE20,L) || '%'  -> 문서가 BASE20 으로 시작하므로 걸린다
#     - '%' || right(BASE20,L)        -> 문서가 BASE20 으로 끝나므로 걸린다
#   길이 L 을 바꿔도 걸리는 행 집합은 같다. 즉 "선택도"를 고정한 채
#   "검색어 길이"와 "패턴 모양"만 변수로 남길 수 있다.
#
#   BASE20 은 말뭉치에 없는 문자열로 고르고, 실제 매치 수를 매번 출력해
#   말뭉치 오염이 있으면 바로 드러나게 한다.
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
CONTAINER=pg-study-bigmvstrgm-exp05
ROWS="${ROWS:-1000000}"
INJECT_MOD="${INJECT_MOD:-2000}"     # id % 2000 = 0 -> 0.05%
BASE20='클둥이클라우드클럽십기스터디참여클둥클럽'   # 정확히 20글자
LENGTHS="2 3 5 10 20"

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

cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v n="$ROWS" -v m="$INJECT_MOD" -v b="$BASE20" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
-- 주입 행은 앞뒤가 모두 BASE20 이라 접두어/접미어/부분일치 세 패턴이 같은 행에 걸린다.
-- 나머지 행은 뒤에 ' #<id>' 가 붙으므로 접미어 패턴에 절대 걸리지 않는다(오염 차단).
INSERT INTO docs (id, doc)
SELECT g,
       CASE WHEN g % :m = 0
            THEN :'b' || ' ' || c.doc || ' ' || :'b'
            ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
VACUUM ANALYZE docs;
SQL

TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
INJECTED=$(psqlc -tAc "SELECT count(*) FROM docs WHERE id % $INJECT_MOD = 0;")
echo "  전체 ${TOTAL}행 / 주입 ${INJECTED}행 ($(awk -v a="$INJECTED" -v b="$TOTAL" 'BEGIN{printf "%.3f", 100*a/b}')%)"
echo "  BASE20 = $BASE20 ($(psqlc -tAc "SELECT char_length('$BASE20');")글자)"

RESULTS="$(mktemp)"
echo "엔진,길이,패턴,검색어,정답행수,플랜,인덱스스캔행,recheck제거,버퍼,실행ms" > "$RESULTS"

pattern_for() {  # $1 = 길이, $2 = 모양 -> LIKE 패턴을 psql 로 만들어 돌려준다
  case "$2" in
    infix)  psqlc -tAc "SELECT '%' || left('$BASE20', $1) || '%';" ;;
    prefix) psqlc -tAc "SELECT left('$BASE20', $1) || '%';" ;;
    suffix) psqlc -tAc "SELECT '%' || right('$BASE20', $1);" ;;
  esac
}

measure() {  # $1=엔진 $2=길이 $3=모양 $4=패턴 $5=강제설정
  local eng="$1" len="$2" shape="$3" pat="$4" setup="$5" out hits plan idxrows recheck bufs ms
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '$pat';" | tail -1)
  out=$(psqlc -tAc "$setup EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$pat';")
  { echo "### $eng L=$len $shape pat=$pat"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"

  # 주의: 인덱스 없는 엔진의 플랜에는 'Bitmap Index Scan' 이 없다. set -e 아래에서
  # grep 이 매치에 실패하면 그 자리에서 스크립트가 죽으므로 전부 '|| true' 로 감싼다.
  plan=$(echo "$out"    | grep -oE 'Parallel Seq Scan|Seq Scan|Bitmap Index Scan' | head -1 || true)
  idxrows=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'rows=[0-9]+ loops=' | grep -oE '[0-9]+' || true)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' | grep -oE '[0-9]+$' | head -1 || true)
  bufs=$(echo "$out"    | grep -oE 'Buffers: shared [a-z=0-9 ]+' | head -1 | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || true)
  ms=$(echo "$out"      | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)

  printf '    %-8s %2s글자 %-7s 정답 %-6s %-18s 인덱스행 %-9s recheck %-9s 버퍼 %-8s %s ms\n' \
         "$eng" "$len" "$shape" "$hits" "${plan:--}" "${idxrows:--}" "${recheck:-0}" "${bufs:--}" "${ms:--}"
  echo "$eng,$len,$shape,$pat,$hits,${plan:--},${idxrows:--},${recheck:-0},${bufs:--},${ms:--}" >> "$RESULTS"
}

run_engine() {  # $1 = none | bigm | trgm
  local eng="$1" setup
  psqlc -c "DROP INDEX IF EXISTS docs_bigm;" -c "DROP INDEX IF EXISTS docs_trgm;" >/dev/null
  case "$eng" in
    none) setup="SET enable_indexscan=off; SET enable_bitmapscan=off;" ;;   # 순수 LIKE (시퀀셜 스캔)
    bigm) psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
          setup="SET enable_seqscan=off;" ;;
    trgm) psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null
          setup="SET enable_seqscan=off;" ;;
  esac
  # 인덱스 생성 뒤 VACUUM - 죽은 튜플이 후보 수를 부풀리지 않게 한다
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null

  cyan "== 엔진: $eng =="
  for len in $LENGTHS; do
    for shape in infix prefix suffix; do
      measure "$eng" "$len" "$shape" "$(pattern_for "$len" "$shape")" "$setup"
    done
  done
}

for eng in none bigm trgm; do run_engine "$eng"; done

# ---------------------------------------------------------------------------
# 후속 확인 A - "인덱스 없이 접미어(%X)가 부분일치(%X%)보다 느리다"는 왜인가
#
# README 는 "끝에서부터 비교해야 해서"라고 추정만 하고 확인하지 않았다. 다시 보니
# 더 단순한 설명이 있다: **매치가 문자열의 어디에 있느냐** 다.
#
#   주입 행 = <BASE20> <문장> <BASE20>
#     '%X%' 는 맨 앞의 BASE20 에서 바로 걸린다  -> 매처가 첫 위치에서 성공하고 끝난다
#     '%X'  는 맨 뒤에서만 걸린다               -> 매처가 문자열 끝까지 가야 한다
#
# 그러면 "접미어라서 느린 게 아니라 매치가 뒤에 있어서 느린 것"이다.
# 이를 가르려면 **매치를 뒤에만 둔 부분일치**를 만들어 비교하면 된다.
# 앞 BASE20 을 뺀 테이블(docs_tail)을 따로 만들어 같은 %X% 를 재본다.
# ---------------------------------------------------------------------------
cyan "== 후속 A: 접미어가 느린 이유 - '접미어라서'인가 '매치가 뒤에 있어서'인가 =="
psqlc -v n="$ROWS" -v m="$INJECT_MOD" -v b="$BASE20" >/dev/null <<'SQL'
DROP TABLE IF EXISTS docs_tail;
CREATE TABLE docs_tail (id int PRIMARY KEY, doc text NOT NULL);
-- docs 와 같은데 '앞쪽 BASE20 을 뺐다'. 즉 매치가 문자열 끝에만 있다.
INSERT INTO docs_tail (id, doc)
SELECT g,
       CASE WHEN g % :m = 0
            THEN c.doc || ' ' || :'b'
            ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
VACUUM ANALYZE docs_tail;
SQL

tail_probe() {  # $1 = 테이블, $2 = 패턴, $3 = 라벨
  local out ms rows
  out=$(psqlc -tAc "SET enable_indexscan=off; SET enable_bitmapscan=off;
        EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM $1 WHERE doc LIKE '$2';")
  ms=$(echo "$out"   | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
  rows=$(psqlc -tAc "SELECT count(*) FROM $1 WHERE doc LIKE '$2';")
  printf '    %-34s %-16s 정답 %6s행  %8s ms\n' "$3" "$2" "$rows" "$ms"
}
K5=$(psqlc -tAc "SELECT left('$BASE20', 5);")
K5R=$(psqlc -tAc "SELECT right('$BASE20', 5);")
echo "  docs      (앞뒤 모두 BASE20 - 원래 실험 데이터)"
tail_probe docs      "%$K5%"  "  부분일치 - 매치가 맨 앞에 있다"
tail_probe docs      "%$K5R"  "  접미어   - 매치가 맨 뒤에 있다"
echo "  docs_tail (뒤에만 BASE20 - 매치를 끝으로 몰았다)"
tail_probe docs_tail "%$K5R%" "  부분일치 - 매치가 맨 뒤에 있다"
tail_probe docs_tail "%$K5R"  "  접미어   - 매치가 맨 뒤에 있다"
dim "  ^ 아래 두 줄(같은 위치의 매치)이 서로 비슷하면 '접미어라서 느린 것'이 아니라"
dim "    '매치가 뒤에 있어서 느린 것'이다 - LIKE 매처는 첫 매치에서 멈추기 때문이다."

# ---------------------------------------------------------------------------
# 후속 확인 B - "3글자 이상에서 bigm 이 trgm 보다 1.5~2배 빠르다"가 진짜인가
#
# 버퍼가 거의 같은데 시간만 2배 차이났다. 시간은 노이즈가 크므로, 먼저 **차이가
# 실재하는지**부터 확인한다. 같은 질의를 20회 반복해 중앙값을 본다.
# (원인 규명보다 실재 확인이 먼저다 - 없는 차이를 설명하면 안 된다)
# ---------------------------------------------------------------------------
cyan "== 후속 B: bigm 이 trgm 보다 빠르다는 게 실재하는가 (20회 중앙값) =="
median_ms() {  # $1 = 인덱스(bigm|trgm), $2 = 패턴
  local i out ms all=()
  psqlc -c "DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;" >/dev/null
  if [ "$1" = bigm ]; then
    psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
  else
    psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null
  fi
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null
  for i in $(seq 1 20); do
    out=$(psqlc -tAc "SET enable_seqscan=off;
          EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$2';")
    ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
    all+=("$ms")
  done
  printf '%s\n' "${all[@]}" | sort -n | awk '{a[NR]=$1} END {printf "%s %s %s", a[1], a[int(NR/2)+1], a[NR]}'
}
for L in 3 5 20; do
  KW=$(psqlc -tAc "SELECT left('$BASE20', $L);")
  read -r bmin bmed bmax <<< "$(median_ms bigm "%$KW%")"
  read -r tmin tmed tmax <<< "$(median_ms trgm "%$KW%")"
  ratio=$(awk -v a="$tmed" -v b="$bmed" 'BEGIN{ printf "%.2f", (b>0? a/b : 0) }')
  printf '    %2s글자  bigm 중앙 %6s ms (%s~%s)   trgm 중앙 %6s ms (%s~%s)   비 %sx\n' \
         "$L" "$bmed" "$bmin" "$bmax" "$tmed" "$tmin" "$tmax" "$ratio"
done
dim "  ^ min~max 범위가 서로 겹치면 '1.5~2배 차이'는 노이즈였다는 뜻이다."
dim "    겹치지 않으면 실재하는 차이이고, 그때 비로소 원인을 물을 수 있다."
psqlc -c "DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;" >/dev/null

echo
cyan "== 결과 요약 =="
column -t -s, "$RESULTS"
echo
dim "정답행수가 모든 칸에서 같아야 한다 - 다르면 말뭉치 오염이 있다는 뜻이다."
dim "전체 ${TOTAL}행 · 말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$RESULTS"
