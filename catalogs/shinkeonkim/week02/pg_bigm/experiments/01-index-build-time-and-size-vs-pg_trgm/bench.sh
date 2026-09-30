#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 01 - gin_bigm_ops vs gin_trgm_ops: 인덱스 빌드 시간과 크기
#
#   ./bench.sh          빌드 -> 기동 -> 3개 규모(5만/20만/100만 행)에서
#                       bigm/trgm 인덱스를 각각 만들고 시간·크기를 잰다 -> 정리
#   ./bench.sh down     컨테이너 정리만
#
# 측정값은 실제로 이 스크립트를 실행해서 나온 숫자만 README.md 에 옮겨 적는다.
#
# 2차 개정 - 데이터 생성 방식을 바꿨다.
#   이전 판은 어휘 15문장을 random() 으로 두 개씩 골라 붙였다. 문제가 둘이었다:
#     (1) 반복도가 극단적으로 높아 유니크 조각이 비현실적으로 적었다. 그 결과
#         "bigm 과 trgm 의 크기 차이는 5~13%" 라는 결론이 나왔는데, 실제 말뭉치로
#         잰 bigm-vs-trgm/experiments/02 에서는 25% 였다. 데이터가 결론을 바꾼 것이다.
#     (2) random() 은 실행 계획에 따라 호출 순서가 달라져 재현되지 않았다.
#   그래서 NSMC 말뭉치 + generate_series 나머지 연산으로 바꿨다(다른 실험과 동일).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
source ./corpus.sh

DB=study
USER=postgres
CONTAINER=pg-study-pgbigm-exp01-index-build
SCALES=(50000 200000 1000000)

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
  dim "  nproc: $(docker exec "$CONTAINER" nproc)"
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_bigm;"
  psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
}

# 실제 벽시계 시간(초)으로 CREATE INDEX 하나를 측정한다.
time_create_index() {  # $1 = index name, $2 = table, $3 = opclass
  local idx="$1" tbl="$2" opclass="$3"
  local start end
  start=$(date +%s.%N)
  psqlc -c "CREATE INDEX ${idx} ON ${tbl} USING gin (body ${opclass});" >/dev/null
  end=$(date +%s.%N)
  awk -v s="$start" -v e="$end" 'BEGIN{printf "%.2f", e-s}'
}

index_size_mb() {  # $1 = index name
  psqlc -tAc "SELECT round(pg_relation_size('$1')::numeric / 1024 / 1024, 2);"
}

RESULTS_FILE="$(mktemp)"
echo "rows,bigm_seconds,bigm_mb,trgm_seconds,trgm_mb" > "$RESULTS_FILE"

run_scale() {
  local n="$1" tbl="exp_docs_${n}"
  cyan "== ${n}행 =="

  dim "  테이블 생성 + 데이터 적재 (NSMC 말뭉치를 순환 참조 - 완전히 결정적)"
  psqlc -v n="$n" <<'SQL' >/dev/null
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS exp_docs;
CREATE TABLE exp_docs (id int PRIMARY KEY, body text NOT NULL);

-- 이전 판은 어휘 15문장을 random() 으로 골라 붙였다. 반복도가 너무 높아
-- "크기 차이 5~13%" 라는 (실제 말뭉치에서는 27~73% 인) 결론을 만들었고,
-- random() 때문에 재현도 안 됐다. 지금은 말뭉치를 나머지 연산으로 순환 참조한다.
-- 문장 두 개를 이어 붙여 평균 길이를 이전 판(100~250자)과 비슷하게 맞춘다.
INSERT INTO exp_docs (id, body)
SELECT g,
       a.doc || ' ' || b.doc || ' (doc-' || g || ')'
FROM generate_series(1, :n) g
JOIN corpus_raw a ON a.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
JOIN corpus_raw b ON b.id = 1 + (g * 7 - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;

VACUUM ANALYZE exp_docs;
SQL
  dim "  평균 길이: $(psqlc -tAc "SELECT round(avg(char_length(body)),1) FROM exp_docs;")자 · 말뭉치: $CORPUS_SOURCE"

  local bigm_s bigm_mb trgm_s trgm_mb
  bigm_s=$(time_create_index "exp_docs_bigm_idx" "exp_docs" "gin_bigm_ops")
  bigm_mb=$(index_size_mb "exp_docs_bigm_idx")
  echo "  bigm: ${bigm_s}s, ${bigm_mb} MB"
  psqlc -c "DROP INDEX exp_docs_bigm_idx;" >/dev/null

  trgm_s=$(time_create_index "exp_docs_trgm_idx" "exp_docs" "gin_trgm_ops")
  trgm_mb=$(index_size_mb "exp_docs_trgm_idx")
  echo "  trgm: ${trgm_s}s, ${trgm_mb} MB"

  echo "${n},${bigm_s},${bigm_mb},${trgm_s},${trgm_mb}" >> "$RESULTS_FILE"
  psqlc -c "DROP TABLE exp_docs;" >/dev/null
}

case "${1:-all}" in
  down) docker compose down -v; exit 0 ;;
esac

up
for n in "${SCALES[@]}"; do run_scale "$n"; done

cyan "== 결과 요약 (실측값) =="
column -t -s, "$RESULTS_FILE"
echo
dim "이 표를 그대로 README.md 의 '결과' 섹션에 옮겨 적는다."

cyan "== 정리 =="
docker compose down -v
rm -f "$RESULTS_FILE"
