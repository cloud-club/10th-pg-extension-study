#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 07 - PostgreSQL 버전별 벤치 (16 / 17 / 18 / 19beta1)
#
# 질문: 지금까지의 결론이 PostgreSQL 16 에만 해당하는 이야기인가?
#
# 특히 확인하고 싶은 것:
#   (1) "trgm 은 2글자 %X% 에서 GIN_SEARCH_MODE_ALL 로 무너진다" 가 여전한가
#   (2) 인덱스 크기·빌드 시간이 버전에 따라 달라지나
#   (3) 같은 조각 통계가 나오나 (= 확장 자체의 동작이 안 바뀌었나)
#
# 각 버전마다 pg_bigm 을 그 버전의 서버 헤더로 다시 빌드한다(PGXS 라 그래야 한다).
# 컨테이너는 한 번에 하나만 띄운다 - 동시에 띄우면 CPU 경합으로 시간이 오염된다.
#
#   ./bench.sh                  전 버전 (16 17 18 19)
#   VERSIONS="16 18" ./bench.sh 일부만
#   ROWS=200000 ./bench.sh      행 수 축소
#   ./bench.sh down             정리만
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
DBUSER=postgres
CONTAINER=pg-study-bigmvstrgm-exp07
ROWS="${ROWS:-500000}"
VERSIONS="${VERSIONS:-16 17 18 19}"
# 실험 05 와 같은 20글자 기준 문자열 / 주입 비율
BASE20='클둥이클라우드클럽십기스터디참여클둥클럽'
GRID_MOD="${GRID_MOD:-1000}"

# PGVER -> 도커 태그. 19 는 아직 GA 가 아니라 태그 이름이 다르다.
tag_for() {
  case "$1" in
    19) echo "19beta1-trixie" ;;
    *)  echo "$1-trixie" ;;
  esac
}

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
psqlc() { docker exec -i "$CONTAINER" psql -U "$DBUSER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

wait_healthy() {
  for _ in $(seq 1 120); do
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U "$DBUSER" -d "$DB" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "postgres never became ready" >&2; return 1
}

case "${1:-all}" in
  down) cleanup; exit 0 ;;
esac

cyan "== 말뭉치 준비 =="
fetch_corpus

RES_Q="$(mktemp)"; RES_IDX="$(mktemp)"; RES_ENV="$(mktemp)"; RES_GRID="$(mktemp)"
RES_SEL="$(mktemp)"; RES_SIZE="$(mktemp)"; RES_REC="$(mktemp)"
echo "PG,검색어,글자수,정답행수,엔진,인덱스스캔행,recheck제거,버퍼,실행ms" > "$RES_Q"
echo "PG,인덱스,크기MB,빌드초" > "$RES_IDX"
echo "PG,server_version,테이블MB,조각_bigm_uniq,조각_trgm_uniq" > "$RES_ENV"
echo "PG,엔진,패턴,길이,정답행수,실행ms" > "$RES_GRID"
echo "PG,검색어,글자수,정답행수,선택도%,엔진,인덱스스캔행,recheck제거,버퍼,실행ms" > "$RES_SEL"
echo "PG,인덱스,크기MB,테이블대비배수,유니크엔트리,빌드초" > "$RES_SIZE"
echo "PG,키워드,LIKE정답,tsquery,재현율%,접두어,접두어재현율%" > "$RES_REC"

# ---------------------------------------------------------------------------
measure() {  # $1 = 검색어, $2 = 엔진(none|bigm|trgm) -> "행|recheck|버퍼|ms"
  local kw="$1" eng="$2" pat="%$1%" out rows recheck bufs ms setup
  if [ "$eng" = none ]; then
    setup="SET enable_indexscan=off; SET enable_bitmapscan=off;"
  else
    setup="SET enable_seqscan=off;"
  fi
  out=$(psqlc -tAc "$setup EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$pat';")
  # `|| true` 가 붙은 이유: none 엔진에는 Bitmap Index Scan 노드가 아예 없어서
  # grep 이 1 을 돌려주고, set -e 때문에 스크립트가 죽는다.
  # PostgreSQL 18 부터 EXPLAIN ANALYZE 의 actual rows 가 소수로 나온다
  #   PG16/17 : (actual time=.. rows=500 loops=1)
  #   PG18+   : (actual time=.. rows=500.00 loops=1)
  # 그래서 [0-9]+ 로만 잡으면 18 에서 전부 '-' 가 된다. 실제로 한 번 당했다.
  rows=$(echo "$out"    | grep 'Bitmap Index Scan' | head -1 \
                        | grep -oE 'rows=[0-9.]+ loops=' | grep -oE '[0-9.]+' \
                        | awk '{printf "%d", $1}' || true)
  # 버퍼 줄도 18 에서 위치가 달라질 수 있어 넉넉히 훑는다
  bufs=$(echo "$out"    | grep -A3 'Bitmap Index Scan' \
                        | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 \
                        | grep -oE '[0-9]+' | paste -sd+ - | bc || true)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' \
                        | grep -oE '[0-9]+$' | head -1 || true)
  ms=$(echo "$out"      | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
  echo "${rows:--}|${recheck:-0}|${bufs:--}|${ms:--}"
}

make_index() {  # $1 = bigm|trgm  -> 빌드 시간(초)을 표준출력으로
  local t0 t1
  psqlc -c "DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;" >/dev/null
  t0=$(date +%s.%N)
  if [ "$1" = bigm ]; then
    psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
  else
    psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null
  fi
  t1=$(date +%s.%N)
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null
  echo "$t1 $t0" | awk '{printf "%.1f", $1-$2}'
}

# ---------------------------------------------------------------------------
for V in $VERSIONS; do
  TAG=$(tag_for "$V")
  cyan "======================================================================"
  cyan "== PostgreSQL $V  (postgres:$TAG)"
  cyan "======================================================================"

  cleanup
  if ! docker build -q --build-arg PGVER="$V" --build-arg PGTAG="$TAG" \
        -t "pg-study-vermatrix:$V" . >/tmp/exp07-build-$V.log 2>&1; then
    echo "  ✘ PG $V 이미지 빌드 실패 - 이 버전은 건너뛴다"
    tail -12 /tmp/exp07-build-$V.log | sed 's/^/      /'
    echo "$V,BUILD_FAILED,-,-,-" >> "$RES_ENV"
    continue
  fi

  docker run -d --name "$CONTAINER" \
    -e POSTGRES_DB=$DB -e POSTGRES_USER=$DBUSER -e POSTGRES_PASSWORD=postgres \
    "pg-study-vermatrix:$V" \
    postgres -c maintenance_work_mem=256MB >/dev/null
  wait_healthy || { echo "  ✘ PG $V 기동 실패"; continue; }

  copy_corpus_into "$CONTAINER"
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_bigm;" >/dev/null
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
  SRV=$(psqlc -tAc "SHOW server_version;")
  echo "  server_version = $SRV"

  # --- 데이터: 다른 실험과 같은 결정적 주입 방식 ---------------------------
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

UPDATE docs SET doc = doc || ' 클라우드클럽' WHERE id % 1000 = 0;   -- 6글자
UPDATE docs SET doc = doc || ' 클둥이'       WHERE id % 1000 = 1;   -- 3글자
UPDATE docs SET doc = doc || ' 클클'         WHERE id % 1000 = 2;   -- 2글자
VACUUM ANALYZE docs;
SQL

  TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
  TBL=$(psqlc -tAc "SELECT round(pg_relation_size('docs')/1048576.0);")

  # --- 조각 통계: 확장 자체의 동작이 버전에 따라 바뀌지 않았는지 확인 -------
  # LIMIT 은 '표본 문서 수'에 걸어야 한다. DISTINCT 결과에 걸면 그냥 20000 이 나온다(한 번 틀렸다).
  UB=$(psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT doc FROM docs ORDER BY id LIMIT 20000) t, unnest(show_bigm(t.doc)) g;")
  UT=$(psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT doc FROM docs ORDER BY id LIMIT 20000) t, unnest(show_trgm(t.doc)) g;")
  echo "$V,$SRV,$TBL,$UB,$UT" >> "$RES_ENV"
  echo "  테이블 ${TBL}MB · 유니크 조각 bigm ${UB} / trgm ${UT} (표본)"

  # --- 길이 x 패턴 격자 (실험 05 와 같은 설계) ----------------------------
  # 실험 05 는 PG16 한 버전에서만 쟀다. 시각화의 버전 선택기가 이 격자에도 붙으려면
  # 버전별 값이 있어야 하므로 여기서 함께 잰다.
  #
  # 정답 행 수를 45칸 전부 같게 만드는 것이 핵심이다 - 그래야 보이는 차이가
  # '길이와 패턴' 때문이라고 말할 수 있다. 주입 행을 <BASE20> 문장 <BASE20> 로 만들면
  # 부분일치/접두어/접미어 세 패턴이 모두 같은 행 집합에 걸린다.
  psqlc -v n="$ROWS" -v m="$GRID_MOD" -v b="$BASE20" >/dev/null <<'SQL'
DROP TABLE IF EXISTS gdocs;
CREATE TABLE gdocs (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO gdocs (id, doc)
SELECT g,
       CASE WHEN g % :m = 0
            THEN :'b' || ' ' || c.doc || ' ' || :'b'
            ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
VACUUM ANALYZE gdocs;
SQL

  grid_pattern() {  # $1 = 길이, $2 = 모양
    case "$2" in
      infix)  psqlc -tAc "SELECT '%' || left('$BASE20', $1) || '%';" ;;
      prefix) psqlc -tAc "SELECT left('$BASE20', $1) || '%';" ;;
      suffix) psqlc -tAc "SELECT '%' || right('$BASE20', $1);" ;;
    esac
  }
  grid_ms() {  # $1 = 패턴, $2 = 엔진
    local setup out
    if [ "$2" = none ]; then setup="SET enable_indexscan=off; SET enable_bitmapscan=off;"
    else                      setup="SET enable_seqscan=off;"; fi
    out=$(psqlc -tAc "$setup EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM gdocs WHERE doc LIKE '$1';")
    echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true
  }

  echo "    길이 x 패턴 격자 (45칸)"
  for ENG2 in none bigm trgm; do
    psqlc -c "DROP INDEX IF EXISTS gdocs_bigm; DROP INDEX IF EXISTS gdocs_trgm;" >/dev/null
    case "$ENG2" in
      bigm) psqlc -c "CREATE INDEX gdocs_bigm ON gdocs USING gin (doc gin_bigm_ops);" >/dev/null ;;
      trgm) psqlc -c "CREATE INDEX gdocs_trgm ON gdocs USING gin (doc gin_trgm_ops);" >/dev/null ;;
    esac
    psqlc -c "VACUUM ANALYZE gdocs;" >/dev/null
    for PAT in infix prefix suffix; do
      LINE="      $ENG2/$PAT:"
      for L in 2 3 5 10 20; do
        P=$(grid_pattern "$L" "$PAT")
        HITS=$(psqlc -tAc "SELECT count(*) FROM gdocs WHERE doc LIKE '$P';")
        MS=$(grid_ms "$P" "$ENG2")
        LINE="$LINE ${L}글자 ${MS:--}ms(${HITS}행)"
        echo "$V,$ENG2,$PAT,$L,$HITS,${MS:--}" >> "$RES_GRID"
      done
      echo "$LINE"
    done
  done
  psqlc -c "DROP INDEX IF EXISTS gdocs_bigm; DROP INDEX IF EXISTS gdocs_trgm; DROP TABLE gdocs;" >/dev/null

  # --- 인덱스 없는 상태에서 먼저 잰다 --------------------------------------
  psqlc -c "DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;" >/dev/null
  for KW in 클클 클둥이 클라우드클럽; do
    CH=$(psqlc -tAc "SELECT char_length('$KW');")
    HITS=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '%$KW%';")
    R=$(measure "$KW" none)
    IFS='|' read -r a b c d <<< "$R"
    echo "$V,$KW,$CH,$HITS,none,$a,$b,$c,$d" >> "$RES_Q"
    printf '    %-14s %d글자 정답 %6s행  none  %8s ms\n' "$KW" "$CH" "$HITS" "$d"
  done

  # --- 엔진별 ---------------------------------------------------------------
  for ENG in bigm trgm; do
    SEC=$(make_index "$ENG")
    MB=$(psqlc -tAc "SELECT round(pg_relation_size('docs_$ENG')/1048576.0, 1);")
    echo "$V,$ENG,$MB,$SEC" >> "$RES_IDX"
    printf '    %-5s 인덱스 %6s MB · 빌드 %5s초\n' "$ENG" "$MB" "$SEC"
    for KW in 클클 클둥이 클라우드클럽; do
      CH=$(psqlc -tAc "SELECT char_length('$KW');")
      HITS=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '%$KW%';")
      R=$(measure "$KW" "$ENG")
      IFS='|' read -r a b c d <<< "$R"
      echo "$V,$KW,$CH,$HITS,$ENG,$a,$b,$c,$d" >> "$RES_Q"
      printf '      %-14s 인덱스스캔행 %-9s recheck %-9s 버퍼 %-7s %s ms\n' "$KW" "$a" "$b" "$c" "$d"
    done
  done

  # --- 실험 01 축: 길이 × 선택도 -------------------------------------------
  # 길이 축(2/3/6글자)과 선택도 축(0.1~30%)을 한 테이블에서 잰다. 실험 01 과 같은 설계.
  # 검색어가 서로의 부분 문자열이 되면 정답 행수가 오염되므로 전부 '클둥+X' 3글자로 통일한다.
  cyan "  -- 길이 × 선택도 (실험 01 축)"
  psqlc -v n="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS sdocs;
CREATE TABLE sdocs (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO sdocs (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
-- 길이 축 (전부 0.1%)
UPDATE sdocs SET doc = doc || ' 클라우드클럽' WHERE id % 1000 = 0;   -- 6글자
UPDATE sdocs SET doc = doc || ' 클둥이'       WHERE id % 1000 = 1;   -- 3글자
UPDATE sdocs SET doc = doc || ' 클클'         WHERE id % 1000 = 2;   -- 2글자
-- 선택도 축 (전부 3글자)
UPDATE sdocs SET doc = doc || ' 클둥일'       WHERE id % 100 = 7;               -- 1%
UPDATE sdocs SET doc = doc || ' 클둥오'       WHERE id % 100 BETWEEN 10 AND 14; -- 5%
UPDATE sdocs SET doc = doc || ' 클둥삼'       WHERE id % 10 = 3;                -- 10%
UPDATE sdocs SET doc = doc || ' 클둥사'       WHERE id % 10 BETWEEN 4 AND 6;    -- 30%
VACUUM ANALYZE sdocs;
SQL
  sel_measure() {  # $1 = 검색어, $2 = 엔진 -> "행|recheck|버퍼|ms"
    local out rows recheck bufs ms
    out=$(psqlc -tAc "SET enable_seqscan=off;
          EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM sdocs WHERE doc LIKE '%$1%';")
    rows=$(echo "$out"    | grep 'Bitmap Index Scan' | head -1 \
                          | grep -oE 'rows=[0-9.]+ loops=' | grep -oE '[0-9.]+' \
                          | awk '{printf "%d", $1}' || true)
    bufs=$(echo "$out"    | grep -A3 'Bitmap Index Scan' \
                          | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 \
                          | grep -oE '[0-9]+' | paste -sd+ - | bc || true)
    recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' \
                          | grep -oE '[0-9]+$' | head -1 || true)
    ms=$(echo "$out"      | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
    echo "${rows:--}|${recheck:-0}|${bufs:--}|${ms:--}"
  }
  for ENG3 in bigm trgm; do
    psqlc -c "DROP INDEX IF EXISTS sdocs_i;" >/dev/null
    if [ "$ENG3" = bigm ]; then
      psqlc -c "CREATE INDEX sdocs_i ON sdocs USING gin (doc gin_bigm_ops);" >/dev/null
    else
      psqlc -c "CREATE INDEX sdocs_i ON sdocs USING gin (doc gin_trgm_ops);" >/dev/null
    fi
    psqlc -c "VACUUM ANALYZE sdocs;" >/dev/null
    for KW3 in 클라우드클럽 클둥이 클클 클둥일 클둥오 클둥삼 클둥사; do
      CH3=$(psqlc -tAc "SELECT char_length('$KW3');")
      HIT3=$(psqlc -tAc "SELECT count(*) FROM sdocs WHERE doc LIKE '%$KW3%';")
      PCT3=$(psqlc -tAc "SELECT round(100.0 * $HIT3 / $TOTAL, 3);")
      R3=$(sel_measure "$KW3" "$ENG3")
      IFS='|' read -r a b c d <<< "$R3"
      echo "$V,$KW3,$CH3,$HIT3,$PCT3,$ENG3,$a,$b,$c,$d" >> "$RES_SEL"
    done
    printf '     %-5s 완료\n' "$ENG3"
  done
  psqlc -c "DROP INDEX IF EXISTS sdocs_i; DROP TABLE sdocs;" >/dev/null

  # --- 실험 04 축: 인덱스 5종 크기 (한 규모) -------------------------------
  cyan "  -- 인덱스 5종 크기 (실험 04 축)"
  TBLMB=$(psqlc -tAc "SELECT round(pg_relation_size('docs')/1048576.0, 1);")
  size_one() {  # $1=라벨 $2=DDL $3=엔트리종류
    local t0 t1 secs mb ratio uq
    psqlc -c "DROP INDEX IF EXISTS idx_s;" >/dev/null
    t0=$(date +%s.%N); psqlc -c "CREATE INDEX idx_s ON docs USING $2;" >/dev/null; t1=$(date +%s.%N)
    secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}')
    mb=$(psqlc -tAc "SELECT round(pg_relation_size('idx_s')/1048576.0, 1);")
    ratio=$(awk -v i="$mb" -v t="$TBLMB" 'BEGIN{printf "%.2f", i/t}')
    case "$3" in
      bigm) uq=$(psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT doc FROM docs ORDER BY id LIMIT 20000) t, unnest(show_bigm(t.doc)) g;") ;;
      trgm) uq=$(psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT doc FROM docs ORDER BY id LIMIT 20000) t, unnest(show_trgm(t.doc)) g;") ;;
      tsv)  uq=$(psqlc -tAc "SELECT count(DISTINCT l) FROM (SELECT doc FROM docs ORDER BY id LIMIT 20000) t, unnest(string_to_array(strip(to_tsvector('simple',t.doc))::text,' ')) l;") ;;
      *)    uq="-" ;;
    esac
    printf '     %-28s %7s MB  %5sx  엔트리 %-9s %6ss\n' "$1" "$mb" "$ratio" "$uq" "$secs"
    echo "$V,$1,$mb,$ratio,$uq,$secs" >> "$RES_SIZE"
    psqlc -c "DROP INDEX IF EXISTS idx_s;" >/dev/null
  }
  size_one "gin_bigm_ops"              "gin (doc gin_bigm_ops)"                bigm
  size_one "gin_trgm_ops"              "gin (doc gin_trgm_ops)"                trgm
  size_one "gist_trgm_ops(siglen=256)" "gist (doc gist_trgm_ops(siglen=256))"  -
  size_one "gin (tsvector)"            "gin (to_tsvector('simple', doc))"      tsv
  size_one "btree (대조군)"            "btree (doc)"                           -

  # --- 실험 06 축: 전문검색 재현율 -----------------------------------------
  # LIKE '%키워드%' 를 정답으로 놓고 tsquery 가 몇 %를 찾는지. 순수 집계라
  # 버전에 따라 달라질 이유가 없어 보이지만, '없다'를 확인하는 것도 결과다.
  cyan "  -- 전문검색 재현율 (실험 06 축)"
  psqlc -c "ALTER TABLE docs ADD COLUMN IF NOT EXISTS tsv tsvector
            GENERATED ALWAYS AS (to_tsvector('simple', doc)) STORED;" >/dev/null
  for KW6 in 영화 연기 배우 스토리 감동 재미; do
    read -r lk ts pre <<< "$(psqlc -tAc "
      SELECT (SELECT count(*) FROM docs WHERE doc LIKE '%$KW6%')::text || ' ' ||
             (SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple','$KW6'))::text || ' ' ||
             (SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple','$KW6:*'))::text;" | tr '|' ' ')"
    r1=$(awk -v a="$ts"  -v b="$lk" 'BEGIN{printf "%.1f", (b>0? 100.0*a/b : 0)}')
    r2=$(awk -v a="$pre" -v b="$lk" 'BEGIN{printf "%.1f", (b>0? 100.0*a/b : 0)}')
    printf '     %-8s LIKE %-8s tsquery %-8s (%5s%%)  접두어 %-8s (%5s%%)\n' "$KW6" "$lk" "$ts" "$r1" "$pre" "$r2"
    echo "$V,$KW6,$lk,$ts,$r1,$pre,$r2" >> "$RES_REC"
  done
  psqlc -c "ALTER TABLE docs DROP COLUMN IF EXISTS tsv;" >/dev/null

  cleanup
done

echo
cyan "== 환경 =="
column -t -s, "$RES_ENV"
echo
cyan "== 인덱스 크기 · 빌드 =="
column -t -s, "$RES_IDX"
echo
cyan "== 질의 =="
column -t -s, "$RES_Q"
echo
cyan "== 길이 x 패턴 격자 (버전별) =="
column -t -s, "$RES_GRID"
echo
cyan "== 길이 x 선택도 (버전별) =="
column -t -s, "$RES_SEL"
echo
cyan "== 인덱스 5종 크기 (버전별) =="
column -t -s, "$RES_SIZE"
echo
cyan "== 전문검색 재현율 (버전별) =="
column -t -s, "$RES_REC"
echo
dim "${ROWS}행 · 말뭉치 출처: $CORPUS_SOURCE"
dim "인덱스스캔행이 전체 행수와 비슷하면 GIN_SEARCH_MODE_ALL(인덱스 전체 스캔) 상태다."
rm -f "$RES_Q" "$RES_IDX" "$RES_ENV" "$RES_GRID" "$RES_SEL" "$RES_SIZE" "$RES_REC"
