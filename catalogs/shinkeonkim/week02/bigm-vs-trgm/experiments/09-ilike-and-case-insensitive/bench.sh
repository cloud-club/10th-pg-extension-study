#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Experiment 09 - ILIKE 는 실제로 빨라지는가
#
# 실험 03 은 "연산자가 인덱스를 타는가"를 `enable_seqscan=off` 로 강제해서 봤다.
# 그건 "인덱스 경로가 존재하는가"이지 "그게 이득인가"가 아니다.
# 여기서는 **플래너를 건드리지 않고** 시간·버퍼를 잰다.
#
#   (A) ILIKE 가 pg_trgm 에서 LIKE 만큼 빠른가
#   (B) 2글자 함정이 ILIKE 에도 그대로 오는가
#   (C) 한글처럼 대소문자가 없는 문자에서도 ILIKE 값을 치르는가
#   (D) pg_bigm 은 ILIKE 가 없다 - lower() 함수 인덱스가 대안이 되는가
#   (E) 정규식 ~* 는
#   (F) 코어 전문검색(to_tsvector + GIN)과 견주면 어떤가
#
# 측정 원칙
#   · 인덱스는 한 번에 하나만 둔다. 상대 인덱스를 **트랜잭션 안에서 치우고**
#     재고 롤백한다 - 공존하면 플래너가 골라버린다.
#   · 플랜에서 실제로 쓴 인덱스 이름을 읽어 기록한다(가정하지 않는다).
#   · `enable_seqscan` 을 건드리지 않는다. Seq Scan 이 나오면 그것이 결과다.
#   · 정답 행 수를 먼저 세고, 모든 칸에서 그 값이 유지되는지 확인한다.
#   · 결정적 지표(후보 행·recheck·버퍼)는 2회 돌려 같은지 본다.
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
CONTAINER=pg-study-bigmvstrgm-exp09
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
# 데이터 - 대소문자 변형을 id 나머지로 심는다.
#   그러면 LIKE 와 ILIKE 의 정답 행 수가 '설계로' 달라진다:
#     LIKE  '%CloudClub%'  -> 표기가 정확히 같은 것만        (1/1000)
#     ILIKE '%cloudclub%'  -> 세 표기 전부                   (3/1000)
#   대소문자가 없는 한글 마커도 같은 비율로 심어 대조군으로 쓴다.
# ---------------------------------------------------------------------------
cyan "== 데이터 준비 (${ROWS}행) =="
psqlc -v n="$ROWS" >/dev/null <<'SQL'
DROP TABLE IF EXISTS corpus_raw;
CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL);
COPY corpus_raw(doc) FROM '/tmp/corpus.txt' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\b');

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id int PRIMARY KEY, doc text NOT NULL);
INSERT INTO docs (id, doc)
SELECT g,
       CASE g % 1000
         WHEN 0   THEN 'CloudClub 모임 ' || c.doc          -- 대문자 섞인 표기
         WHEN 250 THEN 'CLOUDCLUB 모임 ' || c.doc          -- 전부 대문자
         WHEN 500 THEN 'cloudclub 모임 ' || c.doc          -- 전부 소문자
         WHEN 750 THEN '클라우드클럽 모임 ' || c.doc       -- 대소문자가 없는 대조군
         WHEN 100 THEN 'Zx 표식 ' || c.doc                 -- 2글자 마커 (말뭉치에 없다)
         ELSE c.doc || ' #' || g
       END
FROM generate_series(1, :n) g
JOIN corpus_raw c ON c.id = 1 + (g - 1) % (SELECT count(*) FROM corpus_raw)
ORDER BY g;
VACUUM ANALYZE docs;
SQL

echo "  정답 행 수 (설계대로인지 먼저 확인한다)"
for q in "doc LIKE '%CloudClub%'" "doc ILIKE '%cloudclub%'" "doc ILIKE '%CLOUDCLUB%'" \
         "doc LIKE '%클라우드클럽%'" "doc ILIKE '%클라우드클럽%'" \
         "doc LIKE '%Zx%'" "doc ILIKE '%zx%'"; do
  printf '    %-34s %s행\n' "$q" "$(psqlc -tAc "SELECT count(*) FROM docs WHERE $q;")"
done

RESULTS="$(mktemp)"
echo "회차,엔진,라벨,조건,정답행수,플랜,쓴인덱스,검증,인덱스행,recheck제거,버퍼,실행ms" > "$RESULTS"

# ---------------------------------------------------------------------------
# 인덱스는 한 번에 하나. 상대는 트랜잭션 안에서만 치운다(롤백하면 되살아난다).
# ---------------------------------------------------------------------------
cyan "== tsvector 생성 컬럼 추가 (F 절 대조군) =="
psqlc >/dev/null <<'SQL'
ALTER TABLE docs ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', doc)) STORED;
SQL
psqlc -tAc "SELECT '  tsv 컬럼 자체가 ' || pg_size_pretty(pg_column_size(tsv)::bigint * count(*)) FROM docs;" || true

cyan "== 인덱스 생성 =="
psqlc >/dev/null <<'SQL'
DROP INDEX IF EXISTS docs_bigm; DROP INDEX IF EXISTS docs_trgm;
DROP INDEX IF EXISTS docs_lbigm; DROP INDEX IF EXISTS docs_ltrgm;
DROP INDEX IF EXISTS docs_tsv;
CREATE INDEX docs_bigm  ON docs USING gin (doc gin_bigm_ops);
CREATE INDEX docs_trgm  ON docs USING gin (doc gin_trgm_ops);
-- (D) pg_bigm 에는 ILIKE 가 없다. 대소문자 무시 검색의 정석 대안이 함수 인덱스다.
CREATE INDEX docs_lbigm ON docs USING gin (lower(doc) gin_bigm_ops);
CREATE INDEX docs_ltrgm ON docs USING gin (lower(doc) gin_trgm_ops);
-- 코어 전문검색. 같은 GIN 이지만 넣는 것이 조각이 아니라 어휘소다.
CREATE INDEX docs_tsv   ON docs USING gin (tsv);
SQL
psqlc -c "VACUUM ANALYZE docs;" >/dev/null
psqlc -tAc "SELECT indexrelname || ' ' || pg_size_pretty(pg_relation_size(indexrelid))
            FROM pg_stat_user_indexes WHERE relname='docs' ORDER BY 1;" | sed 's/^/    /'

ALL_IDX="docs_bigm docs_trgm docs_lbigm docs_ltrgm docs_tsv"
drop_others() {  # 재는 인덱스 하나만 남긴다
  local keep="$1" out=""
  for i in $ALL_IDX; do
    [ "$i" = "docs_$keep" ] || out="$out DROP INDEX $i;"
  done
  echo "$out"
}

measure() {  # $1=회차 $2=엔진 $3=라벨 $4=WHERE 조건
  local run="$1" eng="$2" label="$3" cond="$4" out hits plan used idxrows recheck bufs ms ok
  hits=$(psqlc -tAc "SELECT count(*) FROM docs WHERE $cond;" | tail -1)
  out=$(psqlc -tAq <<SQL
BEGIN;
$(drop_others "$eng")
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT count(*) FROM docs WHERE $cond;
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
  # tsvector 는 Bitmap Index Scan 이름이 docs_tsv 로 나온다 - 같은 규칙으로 검증된다

  printf '    %-6s %-26s 정답 %-6s %-18s %-12s %s  후보 %-9s recheck %-9s 버퍼 %-7s %s ms\n' \
         "$eng" "$label" "$hits" "${plan:--}" "${used:--}" "$ok" "${idxrows:--}" "${recheck:-0}" "${bufs:--}" "${ms:--}"
  echo "$run,$eng,$label,$cond,$hits,${plan:--},${used:--},$ok,${idxrows:--},${recheck:-0},${bufs:--},${ms:--}" >> "$RESULTS"
}

# 각 칸에서 재는 조합. 라벨은 나중에 표로 옮길 때 그대로 쓴다.
run_all() {
  local run="$1"
  cyan "== [${run}회차] A. LIKE vs ILIKE (ASCII, 대소문자 섞인 표기) =="
  for eng in none bigm trgm; do measure "$run" "$eng" "LIKE '%CloudClub%'"  "doc LIKE '%CloudClub%'";  done
  echo
  for eng in none bigm trgm; do measure "$run" "$eng" "ILIKE '%cloudclub%'" "doc ILIKE '%cloudclub%'"; done

  cyan "== [${run}회차] B. 2글자 함정이 ILIKE 에도 오는가 =="
  for eng in none bigm trgm; do measure "$run" "$eng" "ILIKE '%zx%' (2글자)" "doc ILIKE '%zx%'"; done

  cyan "== [${run}회차] C. 대소문자가 없는 한글에서도 ILIKE 값을 치르는가 =="
  for eng in none bigm trgm; do measure "$run" "$eng" "LIKE '%클라우드클럽%'"  "doc LIKE '%클라우드클럽%'";  done
  echo
  for eng in none bigm trgm; do measure "$run" "$eng" "ILIKE '%클라우드클럽%'" "doc ILIKE '%클라우드클럽%'"; done

  cyan "== [${run}회차] D. pg_bigm 의 대안 - lower() 함수 인덱스 =="
  dim "  pg_bigm 에는 ILIKE 가 없다. lower(doc) 에 인덱스를 걸고 소문자로 비교하면 같은 결과를 얻는다."
  for eng in none lbigm ltrgm; do
    measure "$run" "$eng" "lower(doc) LIKE '%cloudclub%'" "lower(doc) LIKE '%cloudclub%'"
  done

  cyan "== [${run}회차] E. 정규식 ~* =="
  for eng in none bigm trgm; do measure "$run" "$eng" "~* 'cloudclub'" "doc ~* 'cloudclub'"; done

  cyan "== [${run}회차] F. 코어 전문검색(tsvector + GIN)과 견주면 =="
  dim "  주의: tsquery 는 '낱말' 을 찾고 LIKE 는 '부분 문자열' 을 찾는다. 정답 행 수를 반드시 같이 볼 것."
  dim "  F1·F2 는 마커를 낱말로 심어서 정답이 우연히 같아지는 구간이다 - 속도만 나란히 보려고 만든 조건이다."
  measure "$run" "tsv"  "tsquery cloudclub"  "tsv @@ to_tsquery('simple','cloudclub')"
  measure "$run" "trgm" "ILIKE cloudclub(재)" "doc ILIKE '%cloudclub%'"
  measure "$run" "lbigm" "lower+bigm cloudclub" "lower(doc) LIKE '%cloudclub%'"
  echo
  measure "$run" "tsv"  "tsquery 클라우드클럽"  "tsv @@ to_tsquery('simple','클라우드클럽')"
  measure "$run" "bigm" "LIKE 클라우드클럽(재)" "doc LIKE '%클라우드클럽%'"
  echo
  dim "  F3: 낱말 '가운데' 를 찾으면 어떻게 되나 - 여기서 정답이 갈린다."
  measure "$run" "tsv"  "tsquery 우드클럽"   "tsv @@ to_tsquery('simple','우드클럽')"
  measure "$run" "bigm" "LIKE %우드클럽%"   "doc LIKE '%우드클럽%'"
  measure "$run" "none" "LIKE %우드클럽%"   "doc LIKE '%우드클럽%'"
}

for r in $(seq 1 "$REPEAT"); do run_all "$r"; echo; done

cyan "== 2회 실행 비교 (결정적 지표가 재현되는가) =="
python3 - "$RESULTS" <<'PY'
import csv, sys, collections
rows = list(csv.DictReader(open(sys.argv[1])))
key = lambda r: (r['엔진'], r['라벨'])
g = collections.defaultdict(list)
for r in rows: g[key(r)].append(r)
bad = 0
for k, v in g.items():
    if len(v) < 2: continue
    same = all(v[0][c] == v[1][c] for c in ('정답행수','플랜','쓴인덱스','인덱스행','recheck제거','버퍼'))
    if not same:
        bad += 1
        print(f"  ✘ {k[0]:6s} {k[1]:28s} 1회 {v[0]['인덱스행']}/{v[0]['버퍼']}  2회 {v[1]['인덱스행']}/{v[1]['버퍼']}")
print(f"  {'✔ 결정적 지표 전부 동일' if bad == 0 else f'✘ {bad}칸이 재현되지 않았다'}")
PY

echo
cyan "== 결과 CSV =="
cat "$RESULTS"

if [ "${1:-all}" != keep ]; then
  cyan "== 정리 =="
  docker compose down -v
fi
