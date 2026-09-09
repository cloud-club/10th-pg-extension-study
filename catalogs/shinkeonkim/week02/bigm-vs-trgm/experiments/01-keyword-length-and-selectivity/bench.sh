#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 01 - 키워드 길이 x 선택도 격자에서 bigm 과 trgm 을 나란히 잰다
#
# 이 카탈로그의 핵심 실험이다. 질문은 하나다:
#
#   "pg_bigm 이 pg_trgm 보다 낫다"는 말이 정확히 어느 칸에서 참인가?
#
# 측정 지표로 벽시계 시간을 쓰지 않는다. pg_bigm/experiments/02 가 세 번째 실행에서
# 결과가 재현되지 않아 분석을 수정해야 했던 경험 때문이다. 대신 EXPLAIN ANALYZE 의
# 결정적인 값 세 개를 본다:
#
#   idx_rows   Bitmap Index Scan 이 돌려준 행 수   <- 인덱스가 후보를 얼마나 좁혔나
#   recheck    Rows Removed by Index Recheck       <- 힙에서 몇 개를 버렸나
#   idx_bufs   인덱스 스캔이 읽은 버퍼 수          <- 실제 I/O 량
#
# 특히 idx_rows 가 전체 행 수와 같으면 GIN_SEARCH_MODE_ALL(인덱스 전체 스캔) 상태다.
# 시간은 참고용으로만 함께 적는다.
#
#   ./bench.sh          빌드 -> 기동 -> 측정 -> 정리
#   ./bench.sh keep     컨테이너를 남긴다
#   ./bench.sh down     정리만
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
DBUSER=postgres
CONTAINER=pg-study-bigmvstrgm-exp01
ROWS="${ROWS:-200000}"

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
# 스터디 공용 예시 문자열을 "키워드 길이 x 선택도" 격자가 되도록 주입한다.
#
#   길이 축 : 2글자(클클/신컨/코아) vs 3글자(클둥이/김신건) vs 6글자(클라우드클럽)
#             -> 3-gram 은 2글자에서 조각을 못 만든다. 이게 실험의 초점이다.
#   선택도 축: 희귀 0.1% vs 흔함 30%
#
# 주입은 random() 이 아니라 id 나머지로 한다 - 실행마다 정확히 같은 비율,
# 같은 물리적 배치가 나오도록.
psqlc -v rows="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id serial PRIMARY KEY, doc text NOT NULL);
INSERT INTO docs (doc)
SELECT c.doc || ' #' || g
FROM generate_series(1, :rows) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw);

-- 희귀 (약 0.1%)
UPDATE docs SET doc = doc || ' 클라우드클럽' WHERE id % 1000 = 0;   -- 6글자
UPDATE docs SET doc = doc || ' 클둥이'       WHERE id % 1000 = 1;   -- 3글자
UPDATE docs SET doc = doc || ' 클클'         WHERE id % 1000 = 2;   -- 2글자
UPDATE docs SET doc = doc || ' 김신건'       WHERE id % 1000 = 3;   -- 3글자
UPDATE docs SET doc = doc || ' 신컨'         WHERE id % 1000 = 4;   -- 2글자
-- 선택도 축을 촘촘히 — 0.1% 와 30% 두 점만으로는 전환점이 어디인지 알 수 없었다.
-- 같은 3글자 검색어를 선택도만 바꿔가며 다섯 개 심는다(길이를 통제 변수로 고정).
-- 주의: 서로가 서로의 부분 문자열이 되면 안 된다. 처음에 '클둥이오' 를 썼다가
-- '클둥이' 의 정답 행수가 200 -> 10,200 으로 오염됐다. 전부 3글자 '클둥+X' 로 통일한다.
UPDATE docs SET doc = doc || ' 클둥일'       WHERE id % 100 = 7;              -- 3글자, 1%
UPDATE docs SET doc = doc || ' 클둥오'       WHERE id % 100 BETWEEN 10 AND 14; -- 3글자, 5%
UPDATE docs SET doc = doc || ' 클둥삼'       WHERE id % 10 = 3;               -- 3글자, 10%
-- 흔함 (30%)
UPDATE docs SET doc = doc || ' 코아'         WHERE id % 10 BETWEEN 0 AND 2;  -- 2글자
UPDATE docs SET doc = doc || ' 클둥사'       WHERE id % 10 BETWEEN 4 AND 6;  -- 3글자, 30%
VACUUM ANALYZE docs;
SQL

TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
echo "  전체 ${TOTAL}행 (말뭉치 출처: $CORPUS_SOURCE)"

RESULTS="$(mktemp)"
echo "검색어,글자수,정답행수,선택도%,인덱스,인덱스스캔행,recheck제거,인덱스버퍼,실행ms" > "$RESULTS"

# 인덱스는 한 번에 하나만 존재하게 한다 - 둘 다 있으면 플래너가 하나를 골라버려
# "같은 조건에서 두 인덱스를 비교"할 수 없다.
make_index() {  # $1 = bigm | trgm
  psqlc -c "DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;" >/dev/null
  if [ "$1" = bigm ]; then
    psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
  else
    psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null
  fi
  # 인덱스 생성 후 VACUUM - 죽은 튜플이 인덱스에 남아 후보 수를 부풀리는 것을 막는다
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null
}

measure() {  # $1 = 검색어, $2 = 인덱스 종류
  local kw="$1" idx="$2" pat="%$1%" out idxrows recheck idxbufs ms
  # enable_seqscan=off : 이 실험의 질문은 "플래너가 무엇을 고르나"가 아니라
  # "인덱스를 썼을 때 그 인덱스가 후보를 얼마나 좁히나"이므로 인덱스 경로를 강제한다.
  # (플래너 선택 자체를 보는 실험은 pg_bigm/experiments/00 에 따로 있다)
  out=$(psqlc -tAc "SET enable_seqscan=off; EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$pat';")
  { echo "### kw=$kw idx=$idx"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"

  # 주의: EXPLAIN ANALYZE 의 노드 줄 형식은 TIMING 설정에 따라 다르다.
  #   TIMING ON  : "(actual time=1.2..3.4 rows=200 loops=1)"
  #   TIMING OFF : "(actual rows=200 loops=1)"
  # 여기서는 실행 시간도 함께 보려고 TIMING 을 켜두므로 " rows=N loops=" 를 찾는다.
  idxrows=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'rows=[0-9]+ loops=' | grep -oE '[0-9]+')
  # 인덱스 스캔 노드 바로 다음의 Buffers 줄이 인덱스가 읽은 버퍼다
  idxbufs=$(echo "$out" | grep -A2 'Bitmap Index Scan' | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 \
            | grep -oE '[0-9]+' | paste -sd+ - | bc)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' | grep -oE '[0-9]+$' | head -1)
  ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+')
  echo "${idxrows:--}|${recheck:-0}|${idxbufs:--}|${ms:--}"
}

run_kw() {  # $1 = 검색어
  local kw="$1" chars hits pct b t
  chars=$(psqlc -tAc "SELECT char_length('$kw');")
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '%$kw%';")
  pct=$(psqlc -tAc "SELECT round(100.0 * $hits / $TOTAL, 3);")

  make_index bigm; b=$(measure "$kw" bigm)
  make_index trgm; t=$(measure "$kw" trgm)

  IFS='|' read -r br brc bb bms <<< "$b"
  IFS='|' read -r tr trc tb tms <<< "$t"

  printf '  %-14s %d글자  정답 %7s행 (%7s%%)\n' "$kw" "$chars" "$hits" "$pct"
  printf '      bigm  인덱스스캔행 %-9s recheck제거 %-9s 버퍼 %-7s %s ms\n' "$br" "$brc" "$bb" "$bms"
  printf '      trgm  인덱스스캔행 %-9s recheck제거 %-9s 버퍼 %-7s %s ms\n' "$tr" "$trc" "$tb" "$tms"

  echo "$kw,$chars,$hits,$pct,bigm,$br,$brc,$bb,$bms" >> "$RESULTS"
  echo "$kw,$chars,$hits,$pct,trgm,$tr,$trc,$tb,$tms" >> "$RESULTS"
}

cyan "== 측정 =="
# 앞의 여섯은 '길이 축', 뒤의 넷은 '선택도 축'(길이를 3글자로 고정해 선택도만 변수로 둔다).
for kw in 클라우드클럽 클둥이 김신건 클클 신컨 코아 클둥일 클둥오 클둥삼 클둥사; do
  run_kw "$kw"
done

echo
cyan "== 결과 요약 =="
column -t -s, "$RESULTS"
echo
dim "전체 ${TOTAL}행 · 말뭉치 출처: $CORPUS_SOURCE"
dim "인덱스스캔행이 전체 행수와 비슷하면 GIN_SEARCH_MODE_ALL(인덱스 전체 스캔) 상태다."

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$RESULTS"
