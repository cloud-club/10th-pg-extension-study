#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 00 - Before / After 의 실행 계획은 실제로 언제 바뀌는가
#
# docs/01-what-and-why.md 는 "인덱스가 없으면 전체 스캔, 있으면 인덱스를 탄다"고
# 적어뒀다. 그런데 정말 그런가? 플래너는 비용을 보고 고르므로,
#   - 테이블이 작으면 인덱스가 있어도 Seq Scan 이 더 싸다
#   - 매치되는 행이 너무 많아도(선택도가 낮아도) Seq Scan 이 더 싸다
# 이 실험은 "행 수"와 "선택도"를 격자로 놓고 전환점을 실제로 찾는다.
#
# 중요: enable_seqscan 을 절대 건드리지 않는다. 다른 lab 들은 인덱스 경로를 보려고
# 강제로 껐지만, 여기서는 "플래너가 자유롭게 골랐을 때 무엇을 고르나"가 질문이다.
#
#   ./bench.sh          빌드 -> 기동 -> 측정 -> 정리
#   ./bench.sh keep     정리하지 않고 컨테이너를 남긴다 (psql 로 더 파보고 싶을 때)
#   ./bench.sh down     컨테이너 정리만
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
DBUSER=postgres
CONTAINER=pg-study-pgbigm-exp00-explain

# 행 수: 작은 쪽을 촘촘히 본다 - 전환점이 거기 있을 것으로 예상되기 때문이다
SCALES=(${SCALES_OVERRIDE:-100 1000 10000 100000 1000000})

# 검색어. 스터디 공용 예시 문자열을 쓴다.
#   클둥이       3글자 - 희귀(주입 비율 0.1%)
#   클클         2글자 - 희귀(주입 비율 0.1%)
#   코아         2글자 - 흔함(주입 비율 30%)   <- 선택도 축
KW_RARE3='클둥이'
KW_RARE2='클클'
KW_COMMON='코아'

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

# 말뭉치 원본을 한 번만 적재해두고, 규모별로 여기서 잘라 쓴다.
cyan "== 말뭉치 적재 =="
psqlc >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
-- QUOTE 를 백스페이스로 지정해 본문의 따옴표/백슬래시를 원문 그대로 읽는다
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');
SQL
CORPUS_ROWS=$(psqlc -tAc "SELECT count(*) FROM corpus_raw;")
echo "  말뭉치 $CORPUS_ROWS 행 적재 (출처: $CORPUS_SOURCE)"

RESULTS="$(mktemp)"
echo "행수,키워드,정답행수,선택도%,인덱스없음_플랜,인덱스있음_플랜,인덱스스캔행,recheck제거행" > "$RESULTS"

seed() {  # $1 = n
  local n="$1"
  psqlc -v n="$n" >/dev/null <<'SQL'
DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id serial PRIMARY KEY, doc text NOT NULL);

-- 말뭉치를 순환 참조해 원하는 행 수를 채운다. 말뭉치보다 큰 규모를 요구하면
-- 같은 문장이 반복되지만, 뒤에 붙는 일련번호가 달라 완전히 같은 행은 아니다.
INSERT INTO docs (doc)
SELECT c.doc || ' #' || g
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw);

-- 스터디 예시 키워드를 "정해진 비율로" 주입한다. random() 이 아니라 id 나머지를
-- 쓰는 이유: 시드와 무관하게 항상 정확히 같은 비율/같은 물리적 배치가 나온다.
-- 0.1% + id=50 한 행. id=50 을 따로 넣는 이유: 100행 규모에서는 id%1000=0 인 행이
-- 하나도 없어 정답이 0건이 되어버린다(전환점을 볼 수 없다). 큰 규모에서는 1행이
-- 비율에 사실상 영향을 주지 않는다.
UPDATE docs SET doc = doc || ' 클둥이'  WHERE id % 1000 = 0 OR id = 50;
UPDATE docs SET doc = doc || ' 클클'    WHERE id % 1000 = 1;   -- 0.1%
UPDATE docs SET doc = doc || ' 코아'    WHERE id % 10  BETWEEN 0 AND 2;  -- 30%

VACUUM ANALYZE docs;
SQL
}

# EXPLAIN 결과에서 스캔 방식만 뽑는다.
plan_of() {  # $1 = LIKE 패턴
  psqlc -tAc "EXPLAIN (COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$1';" \
    | grep -oE 'Seq Scan|Bitmap Index Scan|Bitmap Heap Scan|Index Scan|Parallel Seq Scan' \
    | head -1
}

# 인덱스가 있을 때 실제로 인덱스가 후보를 얼마나 좁혔는지
probe_index() {  # $1 = LIKE 패턴 -> "인덱스스캔행 recheck제거행"
  local out
  out=$(psqlc -tAc "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT count(*) FROM docs WHERE doc LIKE '$1';")
  # 표에 들어가는 숫자의 출처를 감사할 수 있도록 플랜 원문을 남긴다.
  { echo "### pattern=$1"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"
  local idxrows recheck
  # "Bitmap Index Scan" 줄 자체에 붙은 actual rows 만 읽는다.
  # (처음엔 grep -A1 로 다음 줄까지 긁었다가, 다른 노드의 actual rows 를 잘못 집어
  #  재현되지 않는 값이 표에 들어간 적이 있다. 노드를 반드시 한 줄로 특정할 것.)
  idxrows=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'actual rows=[0-9]+' | grep -oE '[0-9]+')
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' | grep -oE '[0-9]+$' | head -1)
  echo "${idxrows:--} ${recheck:-0}"
}

measure_kw() {  # $1 = n, $2 = 키워드
  local n="$1" kw="$2" pat="%$2%"
  local hits pct plan_noidx plan_idx probe

  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '$pat';")
  pct=$(psqlc -tAc "SELECT round(100.0 * $hits / $n, 3);")

  # (A) 인덱스 없음 - 플래너가 자유롭게 고른다
  psqlc -c "DROP INDEX IF EXISTS docs_bigm;" >/dev/null
  psqlc -c "ANALYZE docs;" >/dev/null
  plan_noidx=$(plan_of "$pat")

  # (B) 인덱스 있음 - 역시 플래너가 자유롭게 고른다 (enable_seqscan 을 건드리지 않는다)
  #
  # 인덱스를 만든 "뒤에" VACUUM 을 한 번 더 돌린다. 처음에는 ANALYZE 만 했는데,
  # 그러면 seed() 의 UPDATE 들이 남긴 죽은 튜플이 인덱스에 그대로 남아
  # Bitmap Index Scan 이 정답의 약 2배를 돌려줬다 (100만 행에서 정답 1,001행 대비
  # 인덱스 2,000행). 죽은 튜플은 가시성 검사에서 조용히 걸러지므로
  # "Rows Removed by Index Recheck" 에도 안 잡혀서 원인을 찾기 어려웠다.
  # 측정하려는 것은 "인덱스가 후보를 얼마나 좁히나"이지 "죽은 튜플이 얼마나 끼나"가
  # 아니므로, 깨끗한 인덱스 상태에서 재는 것이 맞다.
  psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null
  plan_idx=$(plan_of "$pat")

  if [ "$plan_idx" = "Bitmap Heap Scan" ] || [ "$plan_idx" = "Bitmap Index Scan" ]; then
    probe=$(probe_index "$pat")
  else
    probe="- -"
  fi
  set -- $probe

  printf '    %-8s 정답 %7s행 (%6s%%)  |  인덱스없음: %-18s 인덱스있음: %-18s 인덱스스캔행 %s\n' \
         "$kw" "$hits" "$pct" "$plan_noidx" "$plan_idx" "$1"
  echo "$n,$kw,$hits,$pct,$plan_noidx,$plan_idx,$1,$2" >> "$RESULTS"
}

for n in "${SCALES[@]}"; do
  cyan "== ${n}행 =="
  seed "$n"
  measure_kw "$n" "$KW_RARE3"
  measure_kw "$n" "$KW_RARE2"
  measure_kw "$n" "$KW_COMMON"
done

echo
cyan "== 결과 요약 =="
column -t -s, "$RESULTS"
echo
dim "말뭉치 출처: $CORPUS_SOURCE"
dim "이 표를 그대로 README.md 의 '결과' 절에 옮겨 적는다."

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$RESULTS"
