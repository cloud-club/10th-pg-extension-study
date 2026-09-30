#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 02 - 유사도 임계값과 KNN 의 비용
#
# labs/03-similarity-and-knn 은 열 몇 행짜리 장난감 테이블에서 "이런 게 된다"를
# 보여줬다. 실제 규모에서 던져야 할 질문은 다르다:
#
#   (1) pg_trgm.similarity_threshold 를 낮추면 후보가 얼마나 폭증하나?
#       그리고 어느 지점부터 인덱스가 의미를 잃나?
#   (2) similarity() 는 본문이 길어지면 무너진다고 했는데, 실제 말뭉치에서
#       word_similarity() 와 재현율이 얼마나 차이나나?
#   (3) KNN(ORDER BY <->)은 LIMIT 을 키울수록 얼마나 비싸지나?
#       GiST 없이(= 정렬로) 하는 것과 비교하면?
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
CONTAINER=pg-study-pgtrgm-exp02
ROWS="${ROWS:-200000}"
QUERY='클라우드클럽 스터디'

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
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null

cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v rows="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
-- id 를 serial 이 아니라 generate_series 값으로 직접 주고 ORDER BY 로 삽입 순서를 고정한다.
-- serial + 순서 미보장 INSERT ... SELECT 를 쓰면 힙의 물리적 행 순서가 실행마다 달라지고,
-- GiST 는 삽입 순서에 따라 페이지 분할이 달라져 KNN 버퍼 수가 재현되지 않는다
-- (실측: LIMIT 1 에서 230 / 156 / 117 로 흔들렸다).
INSERT INTO docs (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :rows) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;

-- "정답"으로 삼을 변형들을 심는다. 유사도 검색이 이 6건을 어디까지 잡아내는지가
-- 재현율(recall) 이다. 길이를 다르게 해서 similarity() 의 길이 편향도 본다.
INSERT INTO docs (id, doc) VALUES
  (:rows + 1, '클라우드클럽 스터디'),                                       -- 정확히 일치
  (:rows + 2, '클라우드 클럽 스터디'),                                      -- 띄어쓰기
  (:rows + 3, '클라으드클럽 스터디'),                                       -- 오타
  (:rows + 4, '클라우드클럽 스터디 모임'),                                  -- 짧은 확장
  (:rows + 5, '클라우드클럽 스터디 10기 참여 안내 공지입니다'),               -- 중간 확장
  (:rows + 6, '오늘 클라우드클럽 스터디 에서 인덱스 튜닝을 다뤘고 다음 주에는 전문검색을 다룬다');  -- 긴 확장
VACUUM ANALYZE docs;
SQL

psqlc -c "CREATE INDEX docs_gin ON docs USING gin (doc gin_trgm_ops);" >/dev/null
psqlc -c "VACUUM ANALYZE docs;" >/dev/null

TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
echo "  전체 ${TOTAL}행 (말뭉치 출처: $CORPUS_SOURCE)"

# ---------------------------------------------------------------------------
# (1) 임계값 스윕
# ---------------------------------------------------------------------------
cyan "== (1) similarity_threshold 를 낮추면 무슨 일이 벌어지나 =="
SW="$(mktemp)"
echo "임계값,매치행수,인덱스스캔행,인덱스버퍼,실행ms" > "$SW"

for th in 0.6 0.5 0.4 0.3 0.2 0.1 0.05; do
  out=$(psqlc -tAc "SET enable_seqscan=off; SET pg_trgm.similarity_threshold=$th; EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc % '$QUERY';")
  { echo "### threshold=$th"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"
  # psql -tAc 에 여러 문장을 주면 SET 의 명령 태그("SET")까지 찍힌다. 마지막 줄만 취한다.
  hits=$(psqlc -tAc "SET pg_trgm.similarity_threshold=$th; SELECT count(*) FROM docs WHERE doc % '$QUERY';" | tail -1)
  ir=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'rows=[0-9]+ loops=' | grep -oE '[0-9]+')
  ib=$(echo "$out" | grep -A2 'Bitmap Index Scan' | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 | grep -oE '[0-9]+' | paste -sd+ - | bc)
  ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+')
  printf '    임계값 %-5s  매치 %-8s 인덱스스캔행 %-8s 버퍼 %-7s %s ms\n' "$th" "$hits" "${ir:--}" "${ib:--}" "${ms:--}"
  echo "$th,$hits,${ir:--},${ib:--},${ms:--}" >> "$SW"
done

# ---------------------------------------------------------------------------
# (2) similarity vs word_similarity 재현율
# ---------------------------------------------------------------------------
cyan "== (2) 심어둔 정답 6건을 각 함수가 어디까지 잡아내나 =="
psqlc <<SQL
SELECT doc,
       round(similarity(doc, '$QUERY')::numeric, 4)              AS similarity,
       round(word_similarity('$QUERY', doc)::numeric, 4)         AS word_sim,
       round(strict_word_similarity('$QUERY', doc)::numeric, 4)  AS strict_word_sim,
       char_length(doc) AS 글자수
FROM docs
WHERE id > $ROWS          -- 말뭉치 뒤에 심어둔 정답 6건만
ORDER BY 글자수;
SQL
dim "   similarity 는 문서가 길어질수록 떨어진다. word_similarity 는 그렇지 않다."
dim "   기본 임계값: similarity 0.3 / word_similarity 0.6 / strict 0.5"

cyan "== 기본 임계값에서 각 연산자의 재현율 (정답 6건 중) =="
psqlc <<SQL
SELECT '%  (similarity 0.3)'   AS 연산자, count(*) AS 잡은건수
FROM docs WHERE id > $ROWS AND doc % '$QUERY'
UNION ALL
SELECT '%> (word_sim 0.6)',    count(*)
FROM docs WHERE id > $ROWS AND doc %> '$QUERY'
UNION ALL
SELECT '%>> (strict_word 0.5)', count(*)
FROM docs WHERE id > $ROWS AND doc %>> '$QUERY';
SQL
dim "   doc %> '검색어' 는 '검색어' <% doc 과 같다 - 인덱스를 타려면 이 방향이어야 한다."

# ---------------------------------------------------------------------------
# (3) KNN 비용
# ---------------------------------------------------------------------------
cyan "== (3) KNN: LIMIT 을 키우면 얼마나 비싸지나 (GiST) =="
psqlc -c "DROP INDEX IF EXISTS docs_gin;" >/dev/null
psqlc -c "CREATE INDEX docs_gist ON docs USING gist (doc gist_trgm_ops(siglen=256));" >/dev/null
psqlc -c "VACUUM ANALYZE docs;" >/dev/null

KN="$(mktemp)"
echo "방식,LIMIT,버퍼,실행ms" > "$KN"

knn() {  # $1 = LIMIT, $2 = 라벨, $3 = 추가 SET
  local lim="$1" label="$2" setup="${3:-}" out bufs ms
  out=$(psqlc -tAc "$setup EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT doc FROM docs ORDER BY doc <-> '$QUERY' LIMIT $lim;")
  { echo "### $label LIMIT=$lim"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"
  bufs=$(echo "$out" | grep -oE 'Buffers: shared hit=[0-9]+( read=[0-9]+)?' | head -1 | grep -oE '[0-9]+' | paste -sd+ - | bc)
  ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+')
  printf '    %-22s LIMIT %-5s 버퍼 %-9s %s ms\n' "$label" "$lim" "${bufs:--}" "${ms:--}"
  echo "$label,$lim,${bufs:--},${ms:--}" >> "$KN"
}

for lim in 1 5 10 50 100; do
  knn "$lim" "GiST 인덱스 정렬" "SET enable_seqscan=off;"
done
# 대조군: 인덱스를 못 쓰게 해서 전체 정렬로 강제한다
for lim in 1 10 100; do
  knn "$lim" "인덱스 없이(전체 정렬)" "SET enable_indexscan=off; SET enable_bitmapscan=off;"
done

echo
cyan "== 결과 요약: 임계값 스윕 =="
column -t -s, "$SW"
echo
cyan "== 결과 요약: KNN =="
column -t -s, "$KN"
echo
dim "전체 ${TOTAL}행 · 말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$SW" "$KN"
