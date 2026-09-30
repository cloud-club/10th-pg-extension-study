#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 10 - 1글자 검색은 왜 pg_bigm 에서만 되나 (부분 일치 / comparePartial)
#
# "GIN 엔트리가 정렬돼 있으니 접두어 구간 탐색이 되고, 그래서 pg_bigm 은
#  1글자도 인덱스를 탄다" 는 설명을 이 카탈로그가 계속 써왔는데 **재본 적이 없다.**
# 여기서 그 사슬을 한 칸씩 확인한다.
#
#   A. 1글자로 조각이 만들어지는가          show_bigm / show_trgm
#   B. GIN 엔트리가 실제로 정렬돼 있는가    pg_bigm 은 text, pg_trgm 은 int32
#   C. 1글자 검색이 인덱스를 타는가         플래너를 건드리지 않고 잰다
#   D. 2·3글자와 비교하면 어디까지 이득인가
#
# 측정 원칙: 인덱스는 한 번에 하나만 두고(상대는 트랜잭션 안에서 치우고 롤백),
#           플랜에서 실제로 쓴 인덱스 이름을 읽어 검증 열에 남긴다.
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
CONTAINER=pg-study-bigmvstrgm-exp10
ROWS="${ROWS:-200000}"
REPEAT="${REPEAT:-2}"

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
psqlc -tAc "SELECT 'PostgreSQL ' || current_setting('server_version')
            || ' / pg_bigm ' || (SELECT extversion FROM pg_extension WHERE extname='pg_bigm')
            || ' / pg_trgm ' || (SELECT extversion FROM pg_extension WHERE extname='pg_trgm');"

# ---------------------------------------------------------------------------
cyan "== A. 1글자를 주면 조각이 나오는가 =="
for s in '클' '클럽' '클라우드'; do
  printf '  %-10s bigm %s\n' "\"$s\"" "$(psqlc -tAc "SELECT show_bigm('$s')::text;")"
  printf '  %-10s trgm %s\n' ""       "$(psqlc -tAc "SELECT show_trgm('$s')::text;")"
done
dim "  주의: show_bigm/show_trgm 은 **색인하는 쪽**(extractValue)이다. 1글자 '낱말' 이면 양쪽 다 조각이 나온다"
dim "  - 낱말 앞뒤에 패딩을 붙일 수 있기 때문이다 (bigm 2개, trgm 2개)."
dim "  갈리는 것은 **질의하는 쪽**(extractQuery)이다. '%클%' 은 양옆이 % 라 패딩을 붙일 수 없어서"
dim "  trgm 은 3글자를 못 채우고 조각이 0개가 되고, bigm 은 조각 대신 '클' 을 부분 일치 키로 넘긴다."
dim "  그 차이가 아래 C 절의 플랜으로 나타난다."

# ---------------------------------------------------------------------------
cyan "== B. GIN 엔트리가 무엇으로 저장되는가 =="
psqlc -tAc "
SELECT format('%-14s 엔트리 타입 %-34s comparePartial %s',
              o.opcname,
              coalesce(kt.typname, it.typname || ' (opckeytype=0 - 입력 타입 그대로)'),
              coalesce((SELECT string_agg(ap.amproc::text, ', ')
                        FROM pg_amproc ap
                        WHERE ap.amprocfamily = o.opcfamily AND ap.amprocnum = 5), '없음'))
FROM pg_opclass o
JOIN pg_type it ON it.oid = o.opcintype
LEFT JOIN pg_type kt ON kt.oid = o.opckeytype
WHERE o.opcname IN ('gin_bigm_ops','gin_trgm_ops')
ORDER BY o.opcname;" | sed 's/^/    /'
dim "  엔트리 타입이 text 면 사전순으로 정렬되고, int4(해시) 면 원문 순서와 무관한 순서가 된다."
dim "  opckeytype = 0 은 '입력 타입을 그대로 엔트리로 쓴다'는 뜻이다 - pg_bigm 이 그렇다."
dim "  amprocnum 5 = comparePartial - 부분 일치 구간을 어디까지 훑을지 판정하는 GIN 지원 함수다."
dim "  이 함수가 없으면 '이 글자로 시작하는 엔트리 전부' 같은 구간 질의를 등록할 수 없다."

# ---------------------------------------------------------------------------
cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v n="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
-- 주입 문자열은 말뭉치에 없는 글자로 고른다. 'ퟛ'(U+D7DB)은 한글 음절 영역 끝이라
-- NSMC 에 나오지 않는다 - 1글자 검색의 정답 행 수를 정확히 통제할 수 있다.
INSERT INTO docs (id, doc)
SELECT g,
       CASE
         WHEN g % 1000 = 0 THEN '앞 ' || c.doc || ' ퟛ가운데'   -- 낱말 '가운데'에 박혀 있다
         WHEN g % 1000 = 500 THEN 'ퟛ시작 ' || c.doc            -- 낱말 맨 앞
         ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
CREATE INDEX docs_bigm ON docs USING gin (doc gin_bigm_ops);
CREATE INDEX docs_trgm ON docs USING gin (doc gin_trgm_ops);
VACUUM ANALYZE docs;
SQL
echo "  정답 행 수"
for q in "doc LIKE '%ퟛ%'" "doc LIKE '%ퟛ가%'" "doc LIKE '%ퟛ가운%'" "doc LIKE '%ퟛ시작%'"; do
  printf '    %-24s %s행\n' "$q" "$(psqlc -tAc "SELECT count(*) FROM docs WHERE $q;")"
done

RESULTS="$(mktemp)"
echo "회차,엔진,검색어길이,패턴,정답행수,플랜,쓴인덱스,검증,인덱스행,recheck제거,버퍼,실행ms" > "$RESULTS"

measure() {  # $1=회차 $2=엔진 $3=길이라벨 $4=패턴
  local run="$1" eng="$2" len="$3" pat="$4" drop out hits plan used idxrows recheck bufs ms ok
  case "$eng" in
    bigm) drop="DROP INDEX docs_trgm;" ;;
    trgm) drop="DROP INDEX docs_bigm;" ;;
    none) drop="DROP INDEX docs_bigm; DROP INDEX docs_trgm;" ;;
  esac
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE doc LIKE '$pat';" | tail -1)
  out=$(psqlc -tAq <<SQL
BEGIN;
$drop
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE doc LIKE '$pat';
ROLLBACK;
SQL
)
  plan=$(echo "$out"    | grep -oE 'Parallel Seq Scan|Seq Scan|Bitmap Index Scan' | head -1 || true)
  used=$(echo "$out"    | grep -oE 'Bitmap Index Scan on [a-z_]+' | head -1 | awk '{print $NF}' || true)
  idxrows=$(echo "$out" | grep 'Bitmap Index Scan' | head -1 | grep -oE 'rows=[0-9.]+ loops=' | grep -oE '[0-9.]+' || true)
  recheck=$(echo "$out" | grep -oE 'Rows Removed by Index Recheck: [0-9]+' | grep -oE '[0-9]+$' | head -1 || true)
  bufs=$(echo "$out"    | grep -oE 'Buffers: shared [a-z=0-9 ]+' | head -1 | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || true)
  ms=$(echo "$out"      | grep -oE 'Execution Time: [0-9.]+' | grep -oE '[0-9.]+' || true)
  if [ "$eng" = none ]; then ok=$([ -z "$used" ] && echo ✔ || echo ✘)
  else ok=$([ "$used" = "docs_$eng" ] && echo ✔ || echo ✘); fi
  printf '    %-5s %-8s %-12s 정답 %-6s %-18s %-11s %s  후보 %-9s recheck %-9s 버퍼 %-7s %s ms\n' \
         "$eng" "$len" "$pat" "$hits" "${plan:--}" "${used:--}" "$ok" "${idxrows:--}" "${recheck:-0}" "${bufs:--}" "${ms:--}"
  echo "$run,$eng,$len,$pat,$hits,${plan:--},${used:--},$ok,${idxrows:--},${recheck:-0},${bufs:--},${ms:--}" >> "$RESULTS"
}

run_all() {
  local run="$1"
  cyan "== [${run}회차] C. 1글자 검색 =="
  for eng in none bigm trgm; do measure "$run" "$eng" "1글자" '%ퟛ%'; done
  cyan "== [${run}회차] D. 길이를 늘려가며 =="
  for eng in none bigm trgm; do measure "$run" "$eng" "2글자" '%ퟛ가%'; done
  echo
  for eng in none bigm trgm; do measure "$run" "$eng" "3글자" '%ퟛ가운%'; done
}
for r in $(seq 1 "$REPEAT"); do run_all "$r"; echo; done

cyan "== 2회 실행 비교 =="
python3 - "$RESULTS" <<'PY'
import csv, sys, collections
rows = list(csv.DictReader(open(sys.argv[1])))
g = collections.defaultdict(list)
for r in rows: g[(r['엔진'], r['검색어길이'])].append(r)
bad = 0
for k, v in g.items():
    if len(v) < 2: continue
    if not all(v[0][c] == v[1][c] for c in ('정답행수','플랜','쓴인덱스','인덱스행','recheck제거','버퍼')):
        bad += 1
        print(f"  ✘ {k[0]:5s} {k[1]:6s} 1회 {v[0]['인덱스행']}/{v[0]['버퍼']}  2회 {v[1]['인덱스행']}/{v[1]['버퍼']}")
print(f"  {'✔ 결정적 지표 전부 동일' if bad == 0 else f'✘ {bad}칸 재현 실패'}")
PY

echo; cyan "== 결과 CSV =="; cat "$RESULTS"
if [ "${1:-all}" != keep ]; then cyan "== 정리 =="; docker compose down -v; fi
