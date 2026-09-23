#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 03 - 연산자 지원 행렬과 유사도 점수 대조
#
# 앞의 두 실험이 "얼마나 빠른가"를 잰다면, 이 실험은 "애초에 되는가"를 잰다.
# 성능 비교는 두 확장이 같은 일을 할 수 있을 때만 의미가 있는데, 실제로는
# 할 수 있는 일 자체가 다르다.
#
#   (1) 연산자별로 각 인덱스가 실제로 쓰이는가 (EXPLAIN 으로 판정)
#   (2) 같은 오탈자에 두 확장이 매기는 유사도 점수가 얼마나 다른가
#   (3) 임계값을 같게 두면 결과 집합이 어떻게 달라지는가
#   (4) 대소문자 · 구두점 처리 차이
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
CONTAINER=pg-study-bigmvstrgm-exp03
ROWS="${ROWS:-100000}"

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

cyan "== 데이터 준비 (${ROWS}행 + 스터디 예시 문자열) =="
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

-- 유사도 검색의 정답을 알 수 있도록, 변형 문자열을 명시적으로 심는다
INSERT INTO docs (doc) VALUES
  ('클라우드클럽'),      -- 정확히 일치
  ('클라우드 클럽'),     -- 띄어쓰기 변형
  ('클라으드클럽'),      -- 한 글자 오타
  ('클라우드클럽스터디'), -- 접미 확장
  ('클둥이'), ('클클'),
  ('김신건'), ('김신컨'), -- 오탈자 쌍
  ('신건'), ('신컨'),
  ('CloudClub'), ('cloudclub'),          -- 대소문자
  ('서버 192.168.0.1 접속'),              -- 구두점
  ('버전 v1.2.3 배포');
VACUUM ANALYZE docs;
SQL

# ---------------------------------------------------------------------------
# (1) 연산자별 인덱스 사용 여부
# ---------------------------------------------------------------------------
cyan "== (1) 연산자별로 인덱스가 실제로 쓰이는가 =="
dim "   EXPLAIN 에 Index Cond 가 붙는지, 그리고 인덱스가 후보를 몇 행까지 좁혔는지를 본다."

MATRIX="$(mktemp)"
echo "연산자,조건,인덱스,결과" > "$MATRIX"

check_op() {  # $1 = 연산자 라벨, $2 = WHERE 조건, $3 = bigm|trgm|gist
  local label="$1" cond="$2" kind="$3" out verdict idxrows
  psqlc -c "DROP INDEX IF EXISTS docs_bigm" -c "DROP INDEX IF EXISTS docs_trgm" -c "DROP INDEX IF EXISTS docs_gist" >/dev/null
  case "$kind" in
    bigm) psqlc -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);" >/dev/null ;;
    trgm) psqlc -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);" >/dev/null ;;
    gist) psqlc -c "CREATE INDEX docs_gist ON docs USING gist (doc gist_trgm_ops);" >/dev/null ;;
  esac
  psqlc -c "VACUUM ANALYZE docs;" >/dev/null

  # 연산자 자체를 지원하지 않으면 여기서 에러가 난다 - 그것도 결과다
  if ! out=$(psqlc -tAc "SET enable_seqscan=off; EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM docs WHERE $cond;" 2>&1); then
    verdict="연산자 미지원(에러)"
  elif echo "$out" | grep -q 'Index Cond\|Order By'; then
    idxrows=$(echo "$out" | grep -E 'Bitmap Index Scan|Index Scan' | head -1 | grep -oE 'actual rows=[0-9]+' | grep -oE '[0-9]+')
    verdict="인덱스 사용 (후보 ${idxrows:-?}행)"
  else
    verdict="인덱스 미사용 (Seq Scan)"
  fi
  printf '    %-26s %-5s  %s\n' "$label" "$kind" "$verdict"
  echo "$label,$cond,$kind,$verdict" >> "$MATRIX"
}

for kind in bigm trgm gist; do
  check_op "LIKE '%클라우드클럽%'"  "doc LIKE '%클라우드클럽%'"        "$kind"
  check_op "LIKE '%클클%' (2글자)"  "doc LIKE '%클클%'"                "$kind"
  check_op "ILIKE '%CLOUDCLUB%'"    "doc ILIKE '%CLOUDCLUB%'"          "$kind"
  check_op "~ 'cloudclub' (ASCII)"  "doc ~ 'cloudclub'"                "$kind"
  check_op "~ '클라우드클럽' (한글)" "doc ~ '클라우드클럽'"             "$kind"
  check_op "= '클둥이'"             "doc = '클둥이'"                   "$kind"
  echo
done

cyan "== 유사도 연산자 (각 확장 고유 문법) =="
check_op "=% '클라우드클럽' (bigm)"  "doc =% '클라우드클럽'"  bigm
check_op "% '클라우드클럽' (trgm)"   "doc % '클라우드클럽'"   trgm
check_op "% '클라우드클럽' (trgm)"   "doc % '클라우드클럽'"   gist
# word_similarity 는 피연산자 순서가 중요하다. word_similarity(a,b) 는
# "a 가 b 의 어떤 부분과 얼마나 닮았나"이므로, 문서에서 검색어를 찾으려면
# '검색어' <% doc 라고 써야 의미가 맞다. 그리고 GIN 연산자 패밀리에는
# %> (교환 연산자)만 등록되어 있어서, 인덱스를 타려면 인덱스 컬럼이 왼쪽에
# 와야 한다 - 세 방향을 모두 재서 어느 것이 인덱스를 타는지 확인한다.
check_op "doc <% '검색어' (방향 주의)"  "doc <% '클라우드클럽'"  trgm
check_op "doc %> '검색어'"              "doc %> '클라우드클럽'"  trgm
check_op "'검색어' <% doc (권장)"       "'클라우드클럽' <% doc"  trgm
# strict_word_similarity (<<%, %>>) - PostgreSQL 9.6 에서 word_similarity 가 들어오고
# 11 에서 strict 판이 추가됐다. word_similarity 는 문서 안의 '아무 부분 문자열'과
# 비교하지만 strict 판은 '단어 경계에 맞춘 부분'하고만 비교한다.
# 인덱스를 타는지 여기서 확인한다 (word_similarity 와 다른 연산자다).
check_op "doc <<% '검색어'"             "doc <<% '클라우드클럽'"  trgm
check_op "doc %>> '검색어'"             "doc %>> '클라우드클럽'"  trgm
check_op "'검색어' <<% doc (권장)"      "'클라우드클럽' <<% doc"  trgm
check_op "'검색어' <<% doc (GiST)"      "'클라우드클럽' <<% doc"  gist

echo
cyan "== word_similarity vs strict_word_similarity — 무엇이 다른가 =="
# 셋을 나란히 보면 차이가 분명해진다.
#   similarity              : 문서 '전체'와 비교         -> 긴 문서일수록 점수가 떨어진다
#   word_similarity         : 문서 안 '아무 부분'과 비교 -> 단어 중간에서 끊겨도 된다
#   strict_word_similarity  : '단어 경계에 맞춘 부분'과만 비교
psqlc <<'SQL'
SELECT s AS 문서,
       round(similarity('클럽', s)::numeric, 4)              AS "similarity",
       round(word_similarity('클럽', s)::numeric, 4)         AS "word_sim",
       round(strict_word_similarity('클럽', s)::numeric, 4)  AS "strict_word_sim"
FROM (VALUES
        ('클럽'),
        ('클럽 하우스'),
        ('클라우드클럽'),
        ('클라우드클럽 십기 스터디 참여 안내문')
     ) v(s);
SQL
dim "   ^ similarity 는 문서가 길어질수록 떨어지지만 word_similarity 는 유지된다."
dim "     strict 판은 '클라우드클럽' 안의 '클럽' 처럼 단어 중간에서 시작하는 부분을 인정하지 않는다."
dim "   pg_bigm 에는 word_similarity 계열이 아예 없다 - bigm_similarity 하나뿐이다."

echo
cyan "== KNN 정렬 - GiST 만 가능하다 =="
psqlc -c "DROP INDEX IF EXISTS docs_bigm" -c "DROP INDEX IF EXISTS docs_trgm" -c "DROP INDEX IF EXISTS docs_gist" >/dev/null
psqlc -c "CREATE INDEX docs_gist ON docs USING gist (doc gist_trgm_ops);" >/dev/null
psqlc -c "VACUUM ANALYZE docs;" >/dev/null
psqlc -c "SET enable_seqscan=off; EXPLAIN (COSTS OFF) SELECT doc FROM docs ORDER BY doc <-> '클라우드클럽' LIMIT 3;"
dim "   pg_bigm 에는 <-> 에 대응하는 연산자가 아예 없다 - 이 쿼리를 쓸 수 없다."

# ---------------------------------------------------------------------------
# (2)(3)(4) 유사도 점수와 결과 집합
# ---------------------------------------------------------------------------
cyan "== (2) 같은 오탈자에 두 확장이 매기는 점수 =="
psqlc <<'SQL'
SELECT a AS 원본, b AS 변형,
       round(bigm_similarity(a,b)::numeric, 4) AS bigm,
       round(similarity(a,b)::numeric, 4)      AS trgm,
       round((bigm_similarity(a,b) / NULLIF(similarity(a,b),0))::numeric, 2) AS 배수
FROM (VALUES
  ('신건','신컨'),
  ('김신건','김신컨'),
  ('클둥이','클동이'),
  ('클라우드클럽','클라으드클럽'),
  ('클라우드클럽','클라우드 클럽'),
  ('클라우드클럽','클라우드클럽스터디'),
  ('클라우드클럽','클클'),
  ('CloudClub','cloudclub')
) AS t(a,b);
SQL
dim "   bigm 공식: 공통 / max(len1,len2)      (DIVUNION 이 define 되어 있지 않다)"
dim "   trgm 공식: 공통 / (len1+len2-공통)    (자카드)"
dim "   -> 분모가 자카드 쪽이 크거나 같으므로 bigm 점수가 구조적으로 높다."

cyan "== (3) 임계값을 같은 0.3 으로 두면 결과 집합이 어떻게 다른가 =="
psqlc <<'SQL'
SET pg_bigm.similarity_limit = 0.3;
SET pg_trgm.similarity_threshold = 0.3;
\echo 'pg_bigm  =% 클라우드클럽 :'
SELECT doc, round(bigm_similarity(doc,'클라우드클럽')::numeric,4) AS sim
FROM docs WHERE doc =% '클라우드클럽' ORDER BY sim DESC LIMIT 10;
\echo 'pg_trgm  %  클라우드클럽 :'
SELECT doc, round(similarity(doc,'클라우드클럽')::numeric,4) AS sim
FROM docs WHERE doc % '클라우드클럽' ORDER BY sim DESC LIMIT 10;
SQL

cyan "== (4) 대소문자 · 구두점 처리 =="
psqlc <<'SQL'
\echo '대소문자:'
SELECT bigm_similarity('CloudClub','cloudclub') AS bigm,
       similarity('CloudClub','cloudclub')      AS trgm;
\echo ''
\echo '구두점 - 조각이 어떻게 잘리나:'
SELECT show_bigm('192.168.0.1') AS bigm_조각;
SELECT show_trgm('192.168.0.1') AS trgm_조각;
\echo ''
\echo '구두점을 포함한 부분 문자열 검색 (정답 1행):'
SET enable_seqscan = off;
SQL

psqlc -c "DROP INDEX IF EXISTS docs_trgm" -c "DROP INDEX IF EXISTS docs_gist" \
       -c "CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops)" -c "VACUUM ANALYZE docs" >/dev/null
echo "  bigm:"
psqlc -c "SET enable_seqscan=off; EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM docs WHERE doc LIKE '%168.0%';" | grep -E 'Bitmap Index Scan|Rows Removed'
psqlc -c "DROP INDEX IF EXISTS docs_bigm" \
       -c "CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops)" -c "VACUUM ANALYZE docs" >/dev/null
echo "  trgm:"
psqlc -c "SET enable_seqscan=off; EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM docs WHERE doc LIKE '%168.0%';" | grep -E 'Bitmap Index Scan|Rows Removed'

echo
cyan "== 결과 요약: 연산자 지원 행렬 =="
column -t -s, "$MATRIX"
echo
dim "말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$MATRIX"
