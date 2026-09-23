#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 06 - 내장 전문검색(tsvector/tsquery) vs n-gram 인덱스
#
# 먼저 짚을 것: tsvector/tsquery 는 **익스텐션이 아니다.** PostgreSQL 코어에
# 내장된 타입·연산자다 (CREATE EXTENSION 이 필요 없다). pg_bigm/pg_trgm 과는
# 애초에 층위가 다르다 - 그래서 "무엇을 못 하는가"를 정확히 아는 게 중요하다.
#
# 질문:
#   (1) "부분 문자열이 들어있는 문서" 를 찾는 요구에 대해, 전문검색은 몇 %를 찾나?
#       (한국어는 조사가 붙어 별개 어휘소가 되므로 놓치는 게 생긴다)
#   (2) 접두어 검색(:*)을 쓰면 얼마나 회복되나?
#   (3) 속도와 인덱스 크기는?
#   (4) 전문검색만 할 수 있는 것(랭킹·구절 검색)은 무엇인가?
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
CONTAINER=pg-study-bigmvstrgm-exp06
ROWS="${ROWS:-1000000}"
# 실제 말뭉치(영화 리뷰)에 흔한 한국어 단어들. 조사가 붙는 정도가 서로 다르다.
KEYWORDS="영화 연기 배우 스토리 감동 재미"

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

cyan "== tsvector 는 익스텐션인가 =="
psqlc <<'SQL'
\echo '  설치된 익스텐션 목록:'
SELECT extname FROM pg_extension ORDER BY 1;
\echo '  ^ pg_bigm/pg_trgm 은 있지만 tsvector 는 없다. 코어 내장이라 설치할 것이 없다.'
SELECT 'tsvector' AS 타입, typname, typtype FROM pg_type WHERE typname IN ('tsvector','tsquery') LIMIT 2;
SQL

cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v n="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO docs (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
-- PostgreSQL 12+ 의 생성 컬럼으로 tsvector 를 유지한다 (실무 권장 형태)
ALTER TABLE docs ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', doc)) STORED;
VACUUM ANALYZE docs;
SQL
TOTAL=$(psqlc -tAc "SELECT count(*) FROM docs;")
echo "  전체 ${TOTAL}행 (말뭉치 출처: $CORPUS_SOURCE)"

cyan "== 인덱스 3종 생성 =="
build() { # $1 라벨 $2 DDL
  local t0 t1
  t0=$(date +%s.%N)
  psqlc -c "CREATE INDEX $2;" >/dev/null
  t1=$(date +%s.%N)
  printf '    %-22s %6ss\n' "$1" "$(awk -v a=$t0 -v b=$t1 'BEGIN{printf "%.1f", b-a}')"
}
build "gin(tsv)"       "docs_tsv  ON docs USING gin (tsv)"
build "gin_bigm_ops"   "docs_bigm ON docs USING gin (doc gin_bigm_ops)"
build "gin_trgm_ops"   "docs_trgm ON docs USING gin (doc gin_trgm_ops)"
psqlc -c "VACUUM ANALYZE docs;" >/dev/null

cyan "== 인덱스 크기 (테이블 대비) =="
psqlc <<'SQL'
SELECT '테이블(doc+tsv 포함)' AS 대상, pg_size_pretty(pg_relation_size('docs')) AS 크기, '-' AS 테이블대비
UNION ALL SELECT 'gin(tsv)',     pg_size_pretty(pg_relation_size('docs_tsv')),
                 round(pg_relation_size('docs_tsv')::numeric/pg_relation_size('docs'),2)::text||'x'
UNION ALL SELECT 'gin_bigm_ops', pg_size_pretty(pg_relation_size('docs_bigm')),
                 round(pg_relation_size('docs_bigm')::numeric/pg_relation_size('docs'),2)::text||'x'
UNION ALL SELECT 'gin_trgm_ops', pg_size_pretty(pg_relation_size('docs_trgm')),
                 round(pg_relation_size('docs_trgm')::numeric/pg_relation_size('docs'),2)::text||'x';
SQL

# ---------------------------------------------------------------------------
# (1)(2) 재현율 - "부분 문자열이 들어있는 문서" 를 기준(정답)으로 삼는다
# ---------------------------------------------------------------------------
cyan "== (1) 재현율: LIKE '%키워드%' 를 정답으로 놓고 전문검색이 몇 %를 찾나 =="
REC="$(mktemp)"
echo "키워드,LIKE정답,tsquery,tsquery재현율%,tsquery접두어,접두어재현율%,정확일치어휘소" > "$REC"
for kw in $KEYWORDS; do
  read -r like ts tspre lex <<<"$(psqlc -tA -F' ' <<SQL
SELECT
  (SELECT count(*) FROM docs WHERE doc LIKE '%$kw%'),
  (SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple', '$kw')),
  (SELECT count(*) FROM docs WHERE tsv @@ to_tsquery('simple', '$kw:*')),
  (SELECT count(DISTINCT l) FROM (
     SELECT unnest(string_to_array(strip(tsv)::text, ' ')) l FROM docs WHERE doc LIKE '%$kw%' LIMIT 200000
   ) x WHERE l LIKE '%''$kw%');
SQL
)"
  r1=$(awk -v a="$ts" -v b="$like" 'BEGIN{printf "%.1f", (b>0)?100*a/b:0}')
  r2=$(awk -v a="$tspre" -v b="$like" 'BEGIN{printf "%.1f", (b>0)?100*a/b:0}')
  printf '    %-8s LIKE %-8s tsquery %-8s (%5s%%)  접두어 %-8s (%5s%%)  어휘소변형 %s개\n' \
         "$kw" "$like" "$ts" "$r1" "$tspre" "$r2" "$lex"
  echo "$kw,$like,$ts,$r1,$tspre,$r2,$lex" >> "$REC"
done

cyan "== 놓치는 것의 정체 - '영화' 를 포함하지만 tsquery 가 못 찾는 문서 예시 =="
psqlc <<'SQL'
SELECT left(doc, 46) AS 문서, left(strip(tsv)::text, 60) AS 어휘소
FROM docs
WHERE doc LIKE '%영화%' AND NOT (tsv @@ to_tsquery('simple','영화'))
LIMIT 6;
SQL
dim "  ^ '영화가/영화를/공포영화' 처럼 조사가 붙거나 복합어 안에 들어가면 별개 어휘소가 된다."

# ---------------------------------------------------------------------------
# (3) 속도
# ---------------------------------------------------------------------------
cyan "== (3) 검색 속도 (같은 키워드, 각 방식의 고유 문법) =="
# ---------------------------------------------------------------------------
# 주의 — 여기서 한 번 틀렸다.
#
# 처음에는 docs_tsv / docs_bigm / docs_trgm 세 인덱스를 다 만들어 둔 채로
# "LIKE (bigm 인덱스)" 를 쟀다. 그런데 **doc LIKE '%키워드%' 는 bigm 으로도 trgm 으로도
# 풀 수 있어서, 플래너가 둘 중 하나를 골라버린다.** 라벨은 bigm 이라고 붙여놨지만
# 실제로 무엇을 썼는지는 확인한 적이 없었다.
#
# 이 카탈로그의 다른 실험들은 "인덱스는 한 번에 하나만 존재하게 한다"는 원칙을
# 지키고 있었는데, 이 실험만 세 개를 동시에 두는 바람에 빠져나갔다.
#
# 고친 방법:
#   (1) n-gram 쪽을 잴 때는 **상대 인덱스를 지우고** 잰다
#   (2) 플랜에서 'Index Scan on <이름>' 을 읽어 **정말 그 인덱스를 썼는지 기록**한다
#       - 가정하지 말고 확인한다. 표에 '쓴 인덱스' 열을 만든 이유다.
#   (3) 이왕 나눈 김에 trgm 으로 LIKE 를 푸는 경우도 함께 잰다
# ---------------------------------------------------------------------------
SPD="$(mktemp)"
echo "키워드,방식,매치행수,쓴인덱스,버퍼,실행ms" > "$SPD"
speed() { # $1 kw $2 라벨 $3 WHERE절
  local out bufs ms hits used
  out=$(psqlc -tAc "SET enable_seqscan=off; EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE $3;")
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE $3;" | tail -1)
  bufs=$(echo "$out" | grep -oE 'Buffers: shared [a-z=0-9 ]+' | head -1 | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || true)
  ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
  # 어떤 인덱스를 실제로 썼는지 플랜에서 읽는다
  used=$(echo "$out" | grep -oE 'Index Scan on [a-z_]+' | head -1 | awk '{print $NF}' || true)
  printf '    %-8s %-24s 매치 %-9s [%s] 버퍼 %-9s %s ms\n' \
         "$1" "$2" "$hits" "${used:-인덱스없음}" "${bufs:--}" "${ms:--}"
  echo "$1,$2,$hits,${used:-인덱스없음},${bufs:--},${ms:--}" >> "$SPD"
}

# tsquery 는 docs_tsv 로만 풀 수 있어 경합이 없다 -> 세 인덱스가 다 있어도 안전하다
for kw in 영화 스토리; do
  speed "$kw" "tsquery @@" "tsv @@ to_tsquery('simple','$kw')"
done

# LIKE 는 bigm/trgm 둘 다 후보라 반드시 하나만 남기고 재야 한다
psqlc -c "DROP INDEX IF EXISTS docs_trgm;" >/dev/null
for kw in 영화 스토리; do
  speed "$kw" "LIKE (bigm 인덱스)" "doc LIKE '%$kw%'"
done
psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null
psqlc -c "DROP INDEX IF EXISTS docs_bigm;" >/dev/null
psqlc -c "VACUUM ANALYZE docs;" >/dev/null
for kw in 영화 스토리; do
  speed "$kw" "LIKE (trgm 인덱스)" "doc LIKE '%$kw%'"
done
psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null
psqlc -c "VACUUM ANALYZE docs;" >/dev/null

dim "  '쓴 인덱스' 열이 라벨과 맞는지 반드시 볼 것 - 안 맞으면 그 줄은 비교에 쓸 수 없다."
dim "  주의: 매치 행수가 다르다 - 같은 일을 하는 게 아니다. 속도만 비교하면 오해한다."

# ---------------------------------------------------------------------------
# (4) 전문검색만 할 수 있는 것
# ---------------------------------------------------------------------------
cyan "== (4) 전문검색만 되는 것: 관련도 랭킹 =="
psqlc <<'SQL'
SELECT left(doc, 50) AS 문서, round(ts_rank(tsv, q)::numeric, 5) AS rank
FROM docs, to_tsquery('simple','영화 & 연기') q
WHERE tsv @@ q
ORDER BY ts_rank(tsv, q) DESC, id
LIMIT 5;
SQL
dim "  ^ n-gram 인덱스에는 ts_rank 에 대응하는 것이 없다 (유사도는 '질의와 문서의 닮은 정도'이지 관련도 랭킹이 아니다)."

cyan "== 전문검색만 되는 것: 구절 검색 (<-> 연산자) =="
psqlc <<'SQL'
SELECT count(*) AS 구절_영화_연기_인접 FROM docs WHERE tsv @@ phraseto_tsquery('simple','영화 연기');
SELECT count(*) AS AND_영화_연기      FROM docs WHERE tsv @@ to_tsquery('simple','영화 & 연기');
SQL
dim "  ^ 구절 검색은 어휘소의 '위치'를 쓰는데, n-gram 인덱스는 위치를 저장하지 않는다."

cyan "== n-gram 만 되는 것: 어휘 중간의 부분 문자열 =="
psqlc <<'SQL'
SELECT 'LIKE ''%화가%''(부분 문자열)' AS 질의, count(*) FROM docs WHERE doc LIKE '%화가%'
UNION ALL
SELECT 'tsquery ''화가''', count(*) FROM docs WHERE tsv @@ to_tsquery('simple','화가');
SQL
dim "  ^ '영화가' 안의 '화가' 는 어휘소 경계를 가로지르므로 전문검색으로는 못 찾는다."

echo
cyan "== 결과 요약: 재현율 =="
column -t -s, "$REC"
echo
cyan "== 결과 요약: 속도 =="
column -t -s, "$SPD"
echo
dim "전체 ${TOTAL}행 · 말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$REC" "$SPD"
