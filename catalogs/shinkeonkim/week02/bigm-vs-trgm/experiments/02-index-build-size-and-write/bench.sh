#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 02 - 인덱스 빌드 비용 · 크기 · 쓰기 처리량, 그리고 조각 통계
#
# 질문 네 개:
#   (1) 같은 한국어 데이터에서 bigm/trgm/GiST/tsvector 인덱스는 각각 얼마나 크고
#       얼마나 오래 걸려 만들어지나?
#   (2) 유니크 조각(엔트리) 수는 몇 개인가? "2-gram 이라 조각이 많아서 인덱스가 크다"는
#       흔한 설명이 실제로 맞나?
#   (3) 인덱스가 있을 때 INSERT 처리량이 얼마나 떨어지나?
#   (4) 영문 데이터에서는 결론이 뒤집히나? (한국어 편향 확인)
#       - 영문 대조군은 Project Gutenberg 3권(퍼블릭 도메인)의 실제 산문이다.
#         이전 판의 어휘 12개 합성 데이터는 유니크 조각 수를 비현실적으로 작게 만들었다.
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
CONTAINER=pg-study-bigmvstrgm-exp02
ROWS="${ROWS:-200000}"
REPEATS="${REPEATS:-2}"

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
fetch_corpus_en

cyan "== 이미지 빌드 + 기동 =="
docker compose up --build -d
wait_healthy
copy_corpus_into "$CONTAINER"
copy_corpus_en_into "$CONTAINER"
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_bigm;" >/dev/null
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null

cyan "== 데이터 준비 =="
psqlc -v rows="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

-- 한국어
DROP TABLE IF EXISTS docs_ko;
CREATE TABLE docs_ko (id int PRIMARY KEY, doc text NOT NULL);
-- id 를 serial 이 아니라 generate_series 값으로 직접 준다.
-- serial 을 쓰면 INSERT ... SELECT 의 실행 순서(병렬 여부 등)에 따라 id 부여가 달라져
-- "WHERE id <= 20000" 표본이 실행마다 바뀌고, 조각 통계가 재현되지 않는다.
INSERT INTO docs_ko (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :rows) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw);

-- 영문 대조군: 결론이 언어에 의존하는지 확인하기 위한 것.
--
-- 이전 판은 어휘 12개를 조합해 만든 합성 데이터였다. 반복도가 극단적으로 높아
-- 유니크 조각 수가 비현실적으로 작게 나왔고(2-gram 294개), "영문 2-gram 은 선택도가
-- 나쁘다"는 방향은 맞아도 배수는 믿을 수 없었다. 그래서 실제 영문 말뭉치로 바꿨다.
--
--   Project Gutenberg 3권(Pride and Prejudice / Moby Dick / Frankenstein)을 합쳐
--   문장 단위로 자른 것. 퍼블릭 도메인이라 자동 다운로드에 제약이 없다.
--   한국어 쪽과 마찬가지로 generate_series 의 나머지 연산으로 순환 참조해
--   완전히 결정적으로 만든다.
DROP TABLE IF EXISTS corpus_en_raw;
CREATE TABLE corpus_en_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_en_raw(doc) FROM '/tmp/corpus_en.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs_en;
CREATE TABLE docs_en (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO docs_en (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :rows) g
JOIN corpus_en_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_en_raw);

VACUUM ANALYZE docs_ko;
VACUUM ANALYZE docs_en;
SQL

# ---------------------------------------------------------------------------
# (2) 유니크 조각 수 - 인덱스 크기의 진짜 원인을 확인한다
# ---------------------------------------------------------------------------
cyan "== 조각(엔트리) 통계 - 표본 20,000행 =="
dim "  주의: show_bigm()/show_trgm() 는 '문서별로 중복을 제거한' 조각을 돌려준다"
dim "  (generate_bigm/generate_trgm 이 마지막에 qsort + unique 를 돌린다)."
dim "  그래서 '중복 제거 전 조각 수'는 문자열 길이로 따로 계산해 함께 낸다."
psqlc <<'SQL'
-- 중복 제거 전(이론상 생 조각 수):
--   길이 k 인 단어 하나에서 나오는 조각 수는 두 확장 모두 k+1 이다.
--     2-gram: (k + 앞패딩1 + 뒤패딩1) - 2 + 1 = k+1
--     3-gram: (k + 앞패딩2 + 뒤패딩1) - 3 + 1 = k+1
--   다만 "단어"를 나누는 기준이 다르다:
--     pg_bigm : #define iswordchr(c) (!t_isspace(c))      -> 공백만 구분자
--     pg_trgm : #define ISWORDCHR(c,len) t_isalnum_with_len(c,len)  -> 영숫자가 아니면 전부 구분자
--   따라서 생 조각 수 = (단어 문자 수) + (단어 개수) 이고, 그 값이 서로 다르다.
WITH k AS (
  SELECT
    sum(char_length(replace(doc,' ',''))
        + array_length(regexp_split_to_array(btrim(doc),'\s+'),1))                       AS bigm_raw,
    sum(char_length(regexp_replace(doc,'[^[:alnum:]가-힣]','','g'))
        + coalesce(array_length(regexp_split_to_array(
            btrim(regexp_replace(doc,'[^[:alnum:]가-힣]+',' ','g')),'\s+'),1),0))        AS trgm_raw
  FROM docs_ko WHERE id <= 20000
), e AS (
  SELECT
    (SELECT count(*)          FROM (SELECT unnest(show_bigm(doc)) g FROM docs_ko WHERE id<=20000) x) AS bigm_dedup,
    (SELECT count(DISTINCT g) FROM (SELECT unnest(show_bigm(doc)) g FROM docs_ko WHERE id<=20000) x) AS bigm_uniq,
    (SELECT count(*)          FROM (SELECT unnest(show_trgm(doc)) g FROM docs_ko WHERE id<=20000) x) AS trgm_dedup,
    (SELECT count(DISTINCT g) FROM (SELECT unnest(show_trgm(doc)) g FROM docs_ko WHERE id<=20000) x) AS trgm_uniq
)
SELECT '한국어' AS 데이터,'bigm' AS n_gram, k.bigm_raw AS 중복제거전, e.bigm_dedup AS 중복제거후,
       round(100.0*(k.bigm_raw-e.bigm_dedup)/k.bigm_raw,1) AS 중복손실률,
       e.bigm_uniq AS 유니크조각, round(e.bigm_dedup::numeric/e.bigm_uniq,1) AS 조각당평균출현
FROM k, e
UNION ALL
SELECT '한국어','trgm', k.trgm_raw, e.trgm_dedup,
       round(100.0*(k.trgm_raw-e.trgm_dedup)/k.trgm_raw,1), e.trgm_uniq,
       round(e.trgm_dedup::numeric/e.trgm_uniq,1)
FROM k, e;
SQL

psqlc <<'SQL'
WITH k AS (
  SELECT
    sum(char_length(replace(doc,' ',''))
        + array_length(regexp_split_to_array(btrim(doc),'\s+'),1))                AS bigm_raw,
    sum(char_length(regexp_replace(doc,'[^[:alnum:]]','','g'))
        + coalesce(array_length(regexp_split_to_array(
            btrim(regexp_replace(doc,'[^[:alnum:]]+',' ','g')),'\s+'),1),0))      AS trgm_raw
  FROM docs_en WHERE id <= 20000
), e AS (
  SELECT
    (SELECT count(*)          FROM (SELECT unnest(show_bigm(doc)) g FROM docs_en WHERE id<=20000) x) AS bigm_dedup,
    (SELECT count(DISTINCT g) FROM (SELECT unnest(show_bigm(doc)) g FROM docs_en WHERE id<=20000) x) AS bigm_uniq,
    (SELECT count(*)          FROM (SELECT unnest(show_trgm(doc)) g FROM docs_en WHERE id<=20000) x) AS trgm_dedup,
    (SELECT count(DISTINCT g) FROM (SELECT unnest(show_trgm(doc)) g FROM docs_en WHERE id<=20000) x) AS trgm_uniq
)
SELECT '영문' AS 데이터,'bigm' AS n_gram, k.bigm_raw AS 중복제거전, e.bigm_dedup AS 중복제거후,
       round(100.0*(k.bigm_raw-e.bigm_dedup)/k.bigm_raw,1) AS 중복손실률,
       e.bigm_uniq AS 유니크조각, round(e.bigm_dedup::numeric/e.bigm_uniq,1) AS 조각당평균출현
FROM k, e
UNION ALL
SELECT '영문','trgm', k.trgm_raw, e.trgm_dedup,
       round(100.0*(k.trgm_raw-e.trgm_dedup)/k.trgm_raw,1), e.trgm_uniq,
       round(e.trgm_dedup::numeric/e.trgm_uniq,1)
FROM k, e;
SQL

# ---------------------------------------------------------------------------
# (1)(4) 빌드 시간과 크기
# ---------------------------------------------------------------------------
BUILD="$(mktemp)"
echo "언어,인덱스,회차,빌드초,크기MB" > "$BUILD"

build_one() {  # $1=테이블 $2=라벨 $3=인덱스DDL조각 $4=회차 $5=언어
  local tbl="$1" label="$2" ddl="$3" round="$4" lang="$5" t0 t1 secs mb
  psqlc -c "DROP INDEX IF EXISTS idx_bench;" >/dev/null
  t0=$(date +%s.%N)
  psqlc -c "CREATE INDEX idx_bench ON $tbl USING $ddl;" >/dev/null
  t1=$(date +%s.%N)
  secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", b-a}')
  mb=$(psqlc -tAc "SELECT round(pg_relation_size('idx_bench')/1024.0/1024.0, 2);")
  printf '    %-6s %-28s %2s회차  %6ss  %8s MB\n' "$lang" "$label" "$round" "$secs" "$mb"
  echo "$lang,$label,$round,$secs,$mb" >> "$BUILD"
  psqlc -c "DROP INDEX IF EXISTS idx_bench;" >/dev/null
}

cyan "== 인덱스 빌드 시간 · 크기 (${ROWS}행, ${REPEATS}회 반복) =="
for r in $(seq 1 "$REPEATS"); do
  build_one docs_ko "gin_bigm_ops"           "gin (doc gin_bigm_ops)"            "$r" "한국어"
  build_one docs_ko "gin_trgm_ops"           "gin (doc gin_trgm_ops)"            "$r" "한국어"
  build_one docs_ko "gist_trgm_ops"          "gist (doc gist_trgm_ops)"          "$r" "한국어"
  build_one docs_ko "gist_trgm_ops siglen=64" "gist (doc gist_trgm_ops(siglen=64))" "$r" "한국어"
  build_one docs_ko "gin tsvector(simple)"   "gin (to_tsvector('simple', doc))"  "$r" "한국어"
  build_one docs_en "gin_bigm_ops"           "gin (doc gin_bigm_ops)"            "$r" "영문"
  build_one docs_en "gin_trgm_ops"           "gin (doc gin_trgm_ops)"            "$r" "영문"
done

# ---------------------------------------------------------------------------
# (3) 쓰기 처리량
# ---------------------------------------------------------------------------
cyan "== INSERT 처리량 (10,000행 추가) =="
WRITE="$(mktemp)"
echo "인덱스,초,행당us" > "$WRITE"

write_test() {  # $1 = 라벨, $2 = 인덱스 DDL 조각 ("" 이면 인덱스 없음)
  local label="$1" ddl="$2" t0 t1 secs us
  psqlc -c "DROP TABLE IF EXISTS wr; CREATE TABLE wr (id serial PRIMARY KEY, doc text NOT NULL);" >/dev/null
  # 인덱스를 "먼저" 만들고 INSERT 한다 - 실제 운영에서 벌어지는 순서다
  [ -n "$ddl" ] && psqlc -c "CREATE INDEX wr_idx ON wr USING $ddl;" >/dev/null
  t0=$(date +%s.%N)
  psqlc -c "INSERT INTO wr (doc) SELECT doc FROM corpus_raw WHERE id <= 10000;" >/dev/null
  t1=$(date +%s.%N)
  secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", b-a}')
  us=$(awk -v s="$secs" 'BEGIN{printf "%.1f", s*1000000/10000}')
  printf '    %-28s %6ss  (행당 %s us)\n' "$label" "$secs" "$us"
  echo "$label,$secs,$us" >> "$WRITE"
}

write_test "인덱스 없음"                 ""
write_test "gin_bigm_ops"                "gin (doc gin_bigm_ops)"
write_test "gin_trgm_ops"                "gin (doc gin_trgm_ops)"
write_test "gin_bigm_ops FASTUPDATE=off" "gin (doc gin_bigm_ops) WITH (fastupdate = off)"
write_test "gin_trgm_ops FASTUPDATE=off" "gin (doc gin_trgm_ops) WITH (fastupdate = off)"
write_test "gist_trgm_ops"               "gist (doc gist_trgm_ops)"

echo
cyan "== 결과 요약: 빌드 시간 · 크기 =="
column -t -s, "$BUILD"
echo
cyan "== 결과 요약: INSERT 처리량 =="
column -t -s, "$WRITE"
echo
dim "${ROWS}행 · 말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$BUILD" "$WRITE"
