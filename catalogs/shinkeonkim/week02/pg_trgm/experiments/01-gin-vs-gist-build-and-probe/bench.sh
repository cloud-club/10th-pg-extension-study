#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 01 - GiST 의 siglen 은 실제로 얼마나 중요한가
#
# labs/02-gin-vs-gist 에서 "기본 siglen 12 에서는 GiST 가 GIN 보다 버퍼를 400배
# 더 읽는데, siglen=64 로 올리면 GIN 과 같아진다"는 것을 봤다. 그런데 그건
# 5만 행 한 점에서 잰 것이고, siglen 을 여러 값으로 훑어보지도 않았다.
#
# 이 실험은 siglen 을 12(기본)부터 256까지 훑으면서
#   - 인덱스 크기
#   - 빌드 시간
#   - 검색 시 인덱스 버퍼 수 (= GiST 시그니처가 얼마나 잘 거르는지)
# 를 재서 "언제 siglen 을 올려야 하는가"에 실측으로 답한다.
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
CONTAINER=pg-study-pgtrgm-exp01
ROWS="${ROWS:-200000}"
# 256 에서 버퍼가 급락해 "여기가 상한인가"를 알 수 없었다. 그래서 512·1024 를 더 넣는다.
# gist_trgm_ops 의 siglen 허용 범위는 1~2024 다 (PG13+, gist_trgm_ops 의 opclass 파라미터).
SIGLENS=(12 24 48 64 128 256 512 1024)

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

# SAT_ONLY=1 이면 스윕을 건너뛰고 포화/결정성 절만 돈다 (오프셋을 고친 뒤 재확인용)
SAT_ONLY="${SAT_ONLY:-0}"

cyan "== 말뭉치 준비 =="
fetch_corpus

cyan "== 이미지 빌드 + 기동 =="
docker compose up --build -d
wait_healthy
copy_corpus_into "$CONTAINER"
psqlc -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null

cyan "== 데이터 준비 (${ROWS}행) =="
# 두 가지 길이의 텍스트를 만든다. GiST 시그니처는 "문서 하나에서 나오는 조각 수"에
# 따라 포화되므로, 짧은 문서와 긴 문서에서 siglen 의 효과가 다를 것으로 예상된다.
psqlc -v rows="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

-- 짧은 문서: 말뭉치 문장 1개 (평균 35글자)
DROP TABLE IF EXISTS docs_short;
CREATE TABLE docs_short (id int PRIMARY KEY, doc text NOT NULL);
-- id 를 serial 이 아니라 generate_series 값으로 직접 주고 ORDER BY 로 삽입 순서를 고정한다.
-- serial + 순서 미보장 INSERT ... SELECT 를 쓰면 힙의 물리적 행 순서가 실행마다 달라지고,
-- GiST 는 삽입 순서에 따라 페이지 분할이 달라져 KNN 버퍼 수가 재현되지 않는다
-- (실측: LIMIT 1 에서 230 / 156 / 117 로 흔들렸다).
INSERT INTO docs_short (id, doc)
SELECT g, c.doc || ' #' || g
FROM generate_series(1, :rows) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;

-- 긴 문서: 말뭉치 문장 6개를 이어붙인다 (평균 210글자)
DROP TABLE IF EXISTS docs_long;
CREATE TABLE docs_long (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO docs_long (id, doc)
SELECT g, (SELECT string_agg(c.doc, ' ')
        FROM corpus_raw c
        WHERE c.id BETWEEN 1 + ((g * 6 - 6) % 199000) AND 6 + ((g * 6 - 6) % 199000))
       || ' #' || g
FROM generate_series(1, :rows) g
ORDER BY g;

-- 정답이 정확히 1행인 희귀 문자열을 각 테이블에 심는다
INSERT INTO docs_short (id, doc) VALUES (:rows + 1, '희귀한 클라우드클럽 문서 하나');
INSERT INTO docs_long  (id, doc) VALUES (:rows + 1, '희귀한 클라우드클럽 문서 하나');

VACUUM ANALYZE docs_short;
VACUUM ANALYZE docs_long;
SQL

psqlc -c "SELECT 'docs_short' AS t, count(*), round(avg(char_length(doc)),1) AS 평균글자
          FROM docs_short
          UNION ALL
          SELECT 'docs_long', count(*), round(avg(char_length(doc)),1) FROM docs_long;"

RESULTS="$(mktemp)"
echo "테이블,인덱스,빌드초,크기MB,인덱스스캔행,인덱스버퍼,실행ms" > "$RESULTS"

probe() {  # $1 = 테이블, $2 = 라벨 (결과 행에 그대로 들어간다)
  local tbl="$1" label="$2" out idxrows idxbufs ms
  out=$(psqlc -tAc "SET enable_seqscan=off; EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM $tbl WHERE doc LIKE '%클라우드클럽%';")
  { echo "### $tbl / $label"; echo "$out"; echo; } >> "${PLAN_LOG:-/dev/null}"
  # TIMING 이 켜져 있으므로 노드 줄 형식은 "(actual time=..  rows=N loops=1)" 이다
  idxrows=$(echo "$out" | grep -E 'Bitmap Index Scan|Index Scan' | head -1 | grep -oE 'rows=[0-9]+ loops=' | grep -oE '[0-9]+')
  idxbufs=$(echo "$out" | grep -A2 -E 'Bitmap Index Scan|Index Scan' | grep -oE 'shared hit=[0-9]+( read=[0-9]+)?' | tail -1 | grep -oE '[0-9]+' | paste -sd+ - | bc)
  ms=$(echo "$out" | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+')
  echo "${idxrows:--}|${idxbufs:--}|${ms:--}"
}

build_and_probe() {  # $1 = 테이블, $2 = 라벨, $3 = 인덱스 DDL 조각
  local tbl="$1" label="$2" ddl="$3" t0 t1 secs mb p
  psqlc -c "DROP INDEX IF EXISTS idx_probe;" >/dev/null
  t0=$(date +%s.%N)
  psqlc -c "CREATE INDEX idx_probe ON $tbl USING $ddl;" >/dev/null
  t1=$(date +%s.%N)
  secs=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", b-a}')
  psqlc -c "VACUUM ANALYZE $tbl;" >/dev/null
  mb=$(psqlc -tAc "SELECT round(pg_relation_size('idx_probe')/1024.0/1024.0, 2);")
  p=$(probe "$tbl" "$label")
  IFS='|' read -r ir ib ms <<< "$p"
  printf '    %-11s %-26s  %6ss  %8s MB  후보 %-8s 버퍼 %-8s %s ms\n' \
         "$tbl" "$label" "$secs" "$mb" "$ir" "$ib" "$ms"
  echo "$tbl,$label,$secs,$mb,$ir,$ib,$ms" >> "$RESULTS"
  psqlc -c "DROP INDEX IF EXISTS idx_probe;" >/dev/null
}

for tbl in docs_short docs_long; do
  [ "$SAT_ONLY" = 1 ] && break
  cyan "== $tbl =="
  build_and_probe "$tbl" "gin_trgm_ops (기준)" "gin (doc gin_trgm_ops)"
  for sl in "${SIGLENS[@]}"; do
    if [ "$sl" = 12 ]; then
      build_and_probe "$tbl" "gist siglen=12 (기본)" "gist (doc gist_trgm_ops)"
    else
      build_and_probe "$tbl" "gist siglen=$sl" "gist (doc gist_trgm_ops(siglen=$sl))"
    fi
  done
done

# ---------------------------------------------------------------------------
# (A) ALLISTRUE 포화를 직접 관측한다 (pageinspect)
#
# GiST/trgm 의 키는 trgm.h 의 TRGM 구조체다:
#     typedef struct { int32 vl_len_; uint8 flag; char data[...]; } TRGM;
# 즉 varlena 헤더 4바이트 뒤 다섯 번째 바이트가 flag 이고, ALLISTRUE 는 0x04 다.
#     #define ARRKEY 0x01  /  SIGNKEY 0x02  /  ALLISTRUE 0x04
# 시그니처가 포화되면 PostgreSQL 은 비트맵을 통째로 버리고 이 플래그만 세운다
# - "이 서브트리 아래는 전부 가능성 있음" 이라는 뜻이라, 필터로서 쓸모가 없어진다.
#
# flag 바이트는 key_data 의 **12번째 바이트**(0-기반)다. 두 번 헛짚고 나서 알아냈다.
#
#   gist_page_items_bytea() 가 돌려주는 key_data 는 '키 datum' 이 아니라
#   **IndexTuple 통째**다. 그래서 앞에 두 겹의 헤더가 붙어 있다:
#
#     [0..5]   ItemPointerData t_tid       (6바이트)
#     [6..7]   unsigned short  t_info      (2바이트)   -> 여기까지 IndexTupleData
#     [8..11]  varlena 헤더 (SET_VARSIZE)  (4바이트)   -> 여기부터 TRGM
#     [12]     uint8 flag                              <- 이게 우리가 찾던 바이트
#     [13..]   char data[]  (시그니처 또는 트라이그램 배열)
#
#   TRGM 구조체는 trgm.h 의 { int32 vl_len_; uint8 flag; char data[]; } 다.
#   ARRKEY 0x01 = 리프(트라이그램 배열), SIGNKEY 0x02 = 내부 노드(시그니처),
#   ALLISTRUE 0x04 = 시그니처가 포화돼 비트맵을 버린 상태.
#
#   처음엔 4로, 다음엔 0으로 잡았다가 둘 다 틀렸다. 증상이 달랐다:
#     off=4  -> 모든 siglen 에서 포화율이 ~50% 로 거의 일정 (데이터 바이트라 비트가 반반)
#     off=0  -> 값이 전부 0 (t_tid 의 블록 번호 상위 바이트)
#   20,000행짜리 인덱스로 오프셋 0/4/8/12 의 값 분포를 찍어보니 12번만
#   1/2 (+포화 시 6) 로 떨어져서 확정했다.
#
#   교훈: 바이트 오프셋을 가정으로 쓰지 말고 **값의 분포로 검증**할 것.
#   그래서 아래 질의는 flag 값 분포(vals)를 항상 함께 낸다.

cyan "== ALLISTRUE 포화 관측 (pageinspect) =="
psqlc -c "CREATE EXTENSION IF NOT EXISTS pageinspect;" >/dev/null 2>&1 || {
  dim "  pageinspect 를 설치할 수 없어 이 절은 건너뜁니다."
  SKIP_INSPECT=1
}

if [ -z "${SKIP_INSPECT:-}" ]; then
  ALLTRUE="$(mktemp)"
  echo "테이블,siglen,인덱스MB,전체엔트리,리프(ARRKEY),내부(SIGNKEY),ALLISTRUE,내부대비포화율%,flag값" > "$ALLTRUE"
  for tbl in docs_short docs_long; do
    for sl in "${SIGLENS[@]}"; do
      if [ "$sl" = 12 ]; then
        psqlc -c "CREATE INDEX idx_sat ON $tbl USING gist (doc gist_trgm_ops);" >/dev/null
      else
        psqlc -c "CREATE INDEX idx_sat ON $tbl USING gist (doc gist_trgm_ops(siglen=$sl));" >/dev/null
      fi
      mb=$(psqlc -tAc "SELECT round(pg_relation_size('idx_sat')/1048576.0, 2);")
      # 인덱스의 모든 페이지를 훑어 키의 flag 바이트(오프셋 12)를 센다.
      read -r total leaf sign alltrue vals <<< "$(psqlc -tAc "
        WITH k AS (
          SELECT get_byte(key_data, 12) AS f
          FROM generate_series(1, pg_relation_size('idx_sat') / 8192 - 1) blk,
               LATERAL gist_page_items_bytea(get_raw_page('idx_sat', blk::int))
          WHERE key_data IS NOT NULL AND octet_length(key_data) >= 13
        )
        SELECT count(*)::text || ' ' ||
               count(*) FILTER (WHERE (f & 1) <> 0)::text || ' ' ||
               count(*) FILTER (WHERE (f & 2) <> 0)::text || ' ' ||
               count(*) FILTER (WHERE (f & 4) <> 0)::text || ' ' ||
               (SELECT string_agg(DISTINCT f::text, '/' ORDER BY f::text) FROM k)
        FROM k;" | tr '|' ' ')"
      # 포화율은 '전체 엔트리' 가 아니라 '시그니처를 쓰는 내부 노드' 대비로 봐야 한다
      # (리프는 ARRKEY 라 애초에 시그니처가 아니다).
      pct=$(awk -v a="${alltrue:-0}" -v t="${sign:-0}" 'BEGIN{ printf "%.1f", (t>0? 100.0*a/t : 0) }')
      printf '    %-11s siglen=%-5s %8s MB  전체 %-8s 리프 %-8s 내부 %-7s ALLISTRUE %-7s (내부의 %5s%%)  flag=%s\n' \
             "$tbl" "$sl" "$mb" "${total:-?}" "${leaf:-?}" "${sign:-?}" "${alltrue:-?}" "$pct" "${vals:-?}"
      echo "$tbl,$sl,$mb,${total:-?},${leaf:-?},${sign:-?},${alltrue:-?},$pct,${vals:-?}" >> "$ALLTRUE"
      psqlc -c "DROP INDEX idx_sat;" >/dev/null
    done
  done
  echo
  dim "  ALLISTRUE 엔트리는 '이 아래는 전부 가능성 있음'이라 필터로서 쓸모가 없다."
  dim "  flag 값은 1(ARRKEY=리프) / 2(SIGNKEY=내부) / 6(SIGNKEY|ALLISTRUE=포화) 만 나와야 한다."
  dim "  다른 값이 섞여 나오면 오프셋이 틀린 것이다 - 그 표는 읽지 말 것."
fi

# ---------------------------------------------------------------------------
# (B) GiST 빌드가 왜 비결정적인가 - 같은 데이터로 세 번 만들어 비교한다
#
# 이전 재현성 검증에서 "삽입 순서를 고정해도 GiST 버퍼가 +-5% 흔들린다"는 것까지는
# 확인했지만 원인을 못 밝혔다. 여기서는 '무엇이 달라지는지'라도 좁힌다:
#   페이지 수가 다른가 / 엔트리 수가 다른가 / 트리 깊이가 다른가?
# ---------------------------------------------------------------------------
if [ -z "${SKIP_INSPECT:-}" ]; then
  cyan "== GiST 빌드 비결정성 - 같은 데이터로 3회 빌드해 구조를 비교 =="
  for i in 1 2 3; do
    psqlc -c "CREATE INDEX idx_det ON docs_long USING gist (doc gist_trgm_ops(siglen=256));" >/dev/null
    read -r pages entries leaves <<< "$(psqlc -tAc "
      SELECT (pg_relation_size('idx_det')/8192)::text || ' ' ||
             (SELECT count(*) FROM generate_series(1, pg_relation_size('idx_det')/8192 - 1) b,
                     LATERAL gist_page_items_bytea(get_raw_page('idx_det', b::int)))::text || ' ' ||
             (SELECT count(*) FROM generate_series(1, pg_relation_size('idx_det')/8192 - 1) b,
                     LATERAL gist_page_opaque_info(get_raw_page('idx_det', b::int))
               WHERE flags @> ARRAY['leaf'])::text
      " | tr '|' ' ')"
    printf '    %d회차  페이지 %-6s 엔트리 %-8s 리프페이지 %-6s\n' "$i" "$pages" "$entries" "$leaves"
    psqlc -c "DROP INDEX idx_det;" >/dev/null
  done
  dim "  세 번의 값이 같으면 '빌드 자체는 결정적이고 흔들리는 것은 측정'이라는 뜻이다."
  dim "  다르면 페이지 분할이 실제로 달라진 것이다 - 어느 쪽인지 여기서 갈린다."
fi

echo
cyan "== 결과 요약 =="
column -t -s, "$RESULTS"
echo
dim "정답은 두 테이블 모두 1행이다. '후보' 가 1 에서 멀수록 시그니처가 못 거른 것이다."
dim "말뭉치 출처: $CORPUS_SOURCE"

case "${1:-all}" in
  keep) dim "컨테이너를 남겨둡니다: docker exec -it $CONTAINER psql -U $DBUSER -d $DB" ;;
  *)    cyan "== 정리 =="; docker compose down -v ;;
esac
rm -f "$RESULTS"
