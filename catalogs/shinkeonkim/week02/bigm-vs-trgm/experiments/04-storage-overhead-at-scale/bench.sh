#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 04 - n-gram 인덱스는 저장 용량을 얼마나 늘리나 (규모별)
#
# "인덱스가 29 MB 다" 는 그 자체로는 판단 근거가 안 된다. 알아야 할 것은
#   (1) 원본 테이블 대비 몇 배인가  <- 이게 용량 산정의 실제 단위다
#   (2) 규모가 커져도 그 비율이 유지되나, 아니면 좋아지거나 나빠지나
#   (3) 어떤 인덱스가 얼마나 더 드나 (bigm / trgm / GiST / tsvector)
#
# 두 가지 데이터로 잰다 - 이 구분이 이 실험의 핵심이다.
#
#   docs      말뭉치를 순환 참조한다. 행이 늘어도 **어휘가 늘지 않는다**.
#             -> 유니크 조각(엔트리 트리)이 금방 포화된다 = 고정비만 남는다
#   docs_grow 각 행에 그 행에만 있는 한글 토큰을 하나 붙인다.
#             -> **행이 늘수록 어휘도 계속 는다** = 고정비가 계속 자란다
#
# 실서비스는 대개 그 중간이다(상품명·주소·사용자명은 계속 늘고, 설명문은 반복된다).
# 두 극단을 재두면 "우리 데이터는 어느 쪽에 가까운가"로 용량을 가늠할 수 있다.
#
# 규모를 100,000 -> 5,000,000 행까지 키워가며 잰다.
# 5M 행은 이 컨테이너에서 20~30분 걸릴 수 있다. 빠르게 보려면:
#   SCALES="100000 500000" ./bench.sh
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
CONTAINER=pg-study-bigmvstrgm-exp04
SCALES="${SCALES:-100000 500000 1000000 5000000}"

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

psqlc >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');
SQL
CORPUS_N=$(psqlc -tAc "SELECT count(*) FROM corpus_raw;")
echo "  말뭉치 ${CORPUS_N}행 (출처: $CORPUS_SOURCE)"

RESULTS="$(mktemp)"
echo "데이터,행수,테이블MB,인덱스,인덱스MB,테이블대비배수,유니크엔트리,빌드초" > "$RESULTS"

seed() {  # $1 = n, $2 = fixed | grow
  # id 는 generate_series 값으로 직접 준다 (serial 은 삽입 순서가 실행마다 달라진다).
  #
  # grow 판은 각 행에 '그 행에만 있는 한글 낱말'을 붙인다. id 를 44진법으로 펼쳐
  # 한글 음절로 바꾸므로, 행이 늘면 새로운 음절 조합이 계속 생긴다 = 어휘가 자란다.
  # (난수를 쓰지 않으므로 실행마다 완전히 같다)
  psqlc -v n="$1" -v mode="$2" >/dev/null <<'SQL'
DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);

-- 44개 음절 풀. 44^4 = 3,748,096 가지라 500만 행까지 거의 안 겹친다.
CREATE OR REPLACE FUNCTION grow_token(g int) RETURNS text AS $$
  SELECT string_agg(substr('가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누', 1 + ((g / p) % 44)::int, 1), '')
  FROM (VALUES (1), (44), (1936), (85184)) v(p);
$$ LANGUAGE sql IMMUTABLE;

INSERT INTO docs (id, doc)
SELECT g,
       CASE WHEN :'mode' = 'grow'
            THEN c.doc || ' ' || grow_token(g) || ' #' || g
            ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
VACUUM ANALYZE docs;
SQL
}

# 유니크 엔트리 수는 표본 2만 행으로 추정한다 (전수는 5M 행에서 너무 느리다).
uniq_entries() {  # $1 = bigm | trgm | tsv
  case "$1" in
    bigm) psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT unnest(show_bigm(doc)) g FROM docs WHERE id <= 20000) x;" ;;
    trgm) psqlc -tAc "SELECT count(DISTINCT g) FROM (SELECT unnest(show_trgm(doc)) g FROM docs WHERE id <= 20000) x;" ;;
    tsv)  psqlc -tAc "SELECT count(DISTINCT l) FROM (SELECT unnest(string_to_array(strip(to_tsvector('simple',doc))::text,' ')) l FROM docs WHERE id <= 20000) x;" ;;
    *)    echo "-" ;;
  esac
}

measure_index() {  # $1=n $2=라벨 $3=DDL조각 $4=엔트리종류
  local n="$1" label="$2" ddl="$3" kind="$4" t0 t1 secs mb tbl ratio uq
  psqlc -c "DROP INDEX IF EXISTS idx_s;" >/dev/null
  t0=$(date +%s.%N)
  psqlc -c "CREATE INDEX idx_s ON docs USING $ddl;" >/dev/null
  t1=$(date +%s.%N)
  secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}')
  mb=$(psqlc -tAc "SELECT round(pg_relation_size('idx_s')/1024.0/1024.0, 1);")
  tbl=$(psqlc -tAc "SELECT round(pg_relation_size('docs')/1024.0/1024.0, 1);")
  ratio=$(awk -v i="$mb" -v t="$tbl" 'BEGIN{printf "%.2f", i/t}')
  uq=$(uniq_entries "$kind")
  printf '    %-28s %8s MB  테이블대비 %5sx  유니크엔트리 %-9s %6ss\n' "$label" "$mb" "$ratio" "$uq" "$secs"
  echo "$MODE,$n,$tbl,$label,$mb,$ratio,$uq,$secs" >> "$RESULTS"
  psqlc -c "DROP INDEX IF EXISTS idx_s;" >/dev/null
}

# grow 판은 5M 까지 돌리면 너무 오래 걸린다. 기본은 100만까지만 본다.
GROW_SCALES="${GROW_SCALES:-100000 500000 1000000}"

for MODE in fixed grow; do
  case "$MODE" in
    fixed) LIST="$SCALES"; cyan "###### 어휘 고정 (말뭉치 순환 참조)" ;;
    grow)  LIST="$GROW_SCALES"; cyan "###### 어휘 증가 (행마다 고유 낱말을 붙인다)" ;;
  esac
  for n in $LIST; do
    cyan "== [$MODE] ${n}행 =="
    seed "$n" "$MODE"
    TBL=$(psqlc -tAc "SELECT pg_size_pretty(pg_relation_size('docs'));")
    echo "    테이블 크기: $TBL"
    measure_index "$n" "gin_bigm_ops"              "gin (doc gin_bigm_ops)"                bigm
    measure_index "$n" "gin_trgm_ops"              "gin (doc gin_trgm_ops)"                trgm
    measure_index "$n" "gist_trgm_ops(siglen=256)" "gist (doc gist_trgm_ops(siglen=256))"  -
    measure_index "$n" "gin tsvector(simple)"      "gin (to_tsvector('simple', doc))"      tsv
    measure_index "$n" "btree (비교용)"             "btree (doc)"                           -
  done
done

echo
cyan "== 결과 요약 =="
column -t -s, "$RESULTS"
echo
dim "'테이블대비배수' 가 이 실험의 답이다 - 인덱스가 원본의 몇 배를 더 쓰는가."
dim "fixed 는 어휘가 포화되므로 배수가 떨어지고, grow 는 어휘가 계속 늘어 배수가 덜 떨어진다."
dim "실서비스는 그 중간이다 - 두 곡선 사이에서 자기 데이터의 위치를 가늠하면 된다."
dim "유니크엔트리는 표본 2만 행 기준 추정치 (전수는 큰 규모에서 너무 느리다)."
dim "말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$RESULTS"
