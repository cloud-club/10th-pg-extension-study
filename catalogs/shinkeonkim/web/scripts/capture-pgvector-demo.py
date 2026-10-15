#!/usr/bin/env python3
"""pgvector·pgvectorscale 페이지의 SQL 예제와 실제 출력을 전용 임시 DB에서 실행해
src/data/pgvector-demo.json 으로 저장한다.

    python3 scripts/capture-pgvector-demo.py

week05 실험 런타임(timescale/timescaledb-ha:pg16 - pgvector 0.8.6 + pgvectorscale 0.9.1)을
별도 Compose 프로젝트로 띄워서 쓰므로 실험과 충돌하지 않는다. 페이지의 코드 블록은 이 파일의
결과(`demo.<이름>.sql` / `.output`)만 쓴다. 경과 시간은 실행마다 달라질 수 있다.
"""
import json
from pathlib import Path
import sys

OWNER = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(OWNER / 'week05/experiments/runtime'))
import harness as h  # noqa: E402

h.COMPOSE += ['-p', 'pgvector-demo-capture']
OUT = OWNER / 'web/src/data/pgvector-demo.json'
ALIGNED = '\\pset format aligned\n\\pset tuples_only off\n'


def capture(sql, db='study', prefix=''):
    """실행하고 aligned 표 출력을 그대로 저장한다. prefix 는 보여주지 않는 준비 문장(LOAD/SET)."""
    return {'sql': sql, 'output': h.sql(ALIGNED + prefix + sql, db=db)}


def capture_notice(sql, db='study', prefix=''):
    """NOTICE(stderr)까지 함께 저장한다. 인덱스 빌드 파라미터는 NOTICE 로만 나온다."""
    out = h.sql_raw(ALIGNED + prefix + sql, db=db)
    lines = [ln for ln in out.splitlines() if ln.strip() and not ln.startswith(('LOAD', 'SET', 'Output format'))]
    return {'sql': sql, 'output': '\n'.join(lines)}


def capture_error(sql, db='study', prefix=''):
    """실패해야 하는 문장. 오류 메시지를 출력으로 저장한다. 성공하면 예제가 틀린 것이다."""
    try:
        h.sql(prefix + sql, db=db)
    except RuntimeError as e:
        return {'sql': sql, 'output': str(e).strip()}
    raise AssertionError('오류가 나야 하는 예제가 성공했다: ' + sql)


def run(sql, db='study'):
    h.sql(sql, db=db)
    return sql


LOAD_V = "LOAD 'vector';\n"
LOAD_VS = "LOAD 'vectorscale-0.9.1';\n"
SERIAL = 'SET max_parallel_workers_per_gather = 0;\n'

demo = {}
try:
    h.up(extensions=())
    demo['note'] = ('PostgreSQL 16.15 · pgvector 0.8.6 · pgvectorscale 0.9.1 (timescale/timescaledb-ha:pg16) · '
                    '별도 임시 study DB에서 실측. 경과 시간은 실행마다 달라질 수 있다.')

    # ---- 설치와 trusted ---------------------------------------------------------
    demo['available'] = capture("""SELECT name, version, superuser, trusted, relocatable, requires
FROM pg_available_extension_versions
WHERE name = 'vector' OR (name = 'vectorscale' AND version = '0.9.1');""")
    demo['create'] = run('CREATE EXTENSION vector;\nCREATE EXTENSION vectorscale CASCADE;')
    demo['installed'] = capture("SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'vectorscale') ORDER BY 1;")
    run('CREATE DATABASE trusted_test;')
    run("CREATE ROLE app_user LOGIN NOSUPERUSER;\nGRANT CREATE ON DATABASE trusted_test TO app_user;")
    demo['nonsuper'] = capture_error("SET ROLE app_user;\nCREATE EXTENSION vector;", db='trusted_test')
    demo['nonsuper_cascade'] = capture_error("SET ROLE app_user;\nCREATE EXTENSION vectorscale CASCADE;", db='trusted_test')

    # ---- 타입과 거리 -------------------------------------------------------------
    demo['types'] = capture("""SELECT '[1,2,3]'::vector(3)        AS vec,
       '[1,2,3]'::halfvec(3)       AS half,
       '{1:1,3:2}/5'::sparsevec    AS sparse,
       '101'::bit(3)               AS bits;""")
    demo['dim_error'] = capture_error("SELECT '[1,2,3]'::vector(4);")
    demo['items'] = run("""CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));
INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]'), ('[1,2,4]');""")
    demo['distances'] = capture("""SELECT embedding,
       embedding <-> '[1,2,3]' AS l2,
       embedding <#> '[1,2,3]' AS neg_inner,
       embedding <=> '[1,2,3]' AS cosine,
       embedding <+> '[1,2,3]' AS l1
FROM items ORDER BY l2;""")
    demo['bit_distances'] = capture("""SELECT '101'::bit(3) <~> '100'::bit(3) AS hamming,
       '101'::bit(3) <%> '100'::bit(3) AS jaccard;""")
    demo['opclasses'] = capture("""SELECT am.amname AS method, string_agg(oc.opcname, ', ' ORDER BY oc.opcname) AS opclasses
FROM pg_opclass oc JOIN pg_am am ON am.oid = oc.opcmethod
WHERE am.amname IN ('hnsw', 'ivfflat', 'diskann')
GROUP BY am.amname ORDER BY am.amname;""")
    demo['gucs'] = capture("""SELECT name, setting FROM pg_settings
WHERE name LIKE 'hnsw.%' OR name LIKE 'ivfflat.%' OR name LIKE 'diskann.query%'
ORDER BY name;""", prefix=LOAD_V + LOAD_VS)
    demo['gucs_before_load'] = capture("SELECT count(*) AS visible FROM pg_settings WHERE name LIKE 'hnsw.%';")
    demo['hnsw_tiny'] = capture_notice("CREATE INDEX ON items USING hnsw (embedding vector_l2_ops);")
    demo['explain_tiny'] = capture("EXPLAIN (COSTS OFF)\nSELECT id FROM items ORDER BY embedding <-> '[1,2,3]' LIMIT 1;")

    # ---- 측정 함정: 차원의 저주와 InitPlan ------------------------------------------
    run(SERIAL + """SELECT setseed(0.123);
CREATE TABLE uni128 AS
SELECT v AS id, array_agg(random() ORDER BY d)::vector AS e
FROM generate_series(1, 2000) v, generate_series(1, 128) d GROUP BY v;
SELECT setseed(0.123);
CREATE TABLE uni2 AS
SELECT v AS id, array_agg(random() ORDER BY d)::vector AS e
FROM generate_series(1, 2000) v, generate_series(1, 2) d GROUP BY v;""")
    demo['concentration'] = capture("""SELECT dims,
       round(min(d)::numeric, 3) AS nearest, round(avg(d)::numeric, 3) AS average,
       round(max(d)::numeric, 3) AS farthest, round((min(d) / max(d))::numeric, 3) AS nearest_over_farthest
FROM (
  SELECT 128 AS dims, e <-> (SELECT e FROM uni128 WHERE id = 1) AS d FROM uni128 WHERE id <> 1
  UNION ALL
  SELECT 2, e <-> (SELECT e FROM uni2 WHERE id = 1) FROM uni2 WHERE id <> 1
) s GROUP BY dims ORDER BY dims;""")
    demo['initplan_wrong'] = capture("""-- 잘못된 생성: 행마다 스칼라 서브쿼리로 난수 배열을 만든다
CREATE TABLE wrong AS
SELECT v AS id, (SELECT array_agg(random()) FROM generate_series(1, 128))::vector AS e
FROM generate_series(1, 2000) v;
SELECT count(*) AS rows, count(DISTINCT e) AS distinct_vectors FROM wrong;""")
    demo['initplan_plan'] = capture("""EXPLAIN (COSTS OFF)
SELECT v, (SELECT array_agg(random()) FROM generate_series(1, 128))::vector
FROM generate_series(1, 2000) v;""")
    demo['initplan_right'] = capture("""SELECT count(*) AS rows, count(DISTINCT e) AS distinct_vectors FROM uni128;""")

    # ---- IVFFlat 빌드 순서와 튜닝 손잡이 ----------------------------------------------
    run(SERIAL + """SELECT setseed(0.42);
CREATE TABLE early (id bigint PRIMARY KEY, embedding vector(8));
CREATE INDEX early_idx ON early USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);
INSERT INTO early SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1, 5000) v, generate_series(1, 8) d GROUP BY v;
SELECT setseed(0.42);
CREATE TABLE proper (id bigint PRIMARY KEY, embedding vector(8));
INSERT INTO proper SELECT v, array_agg(random() ORDER BY d)::vector
FROM generate_series(1, 5000) v, generate_series(1, 8) d GROUP BY v;
CREATE INDEX proper_idx ON proper USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);
VACUUM ANALYZE early; VACUUM ANALYZE proper;""")
    demo['ivf_empty_notice'] = capture_notice("""CREATE TABLE empty_t (id bigint, embedding vector(8));
CREATE INDEX ON empty_t USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);""")
    demo['ivf_sizes'] = capture("""SELECT 'early (빈 테이블에 먼저)' AS build_order, pg_relation_size('early_idx') AS index_bytes
UNION ALL
SELECT 'proper (데이터 먼저)', pg_relation_size('proper_idx');""")
    # 질의 100개(id 1~100 자신의 벡터)의 정확한 top-10 을 인덱스 없이 구해 두고, probes=1 결과와 비교한다
    for t in ('early', 'proper'):
        run(f"""SET enable_indexscan = off; SET enable_bitmapscan = off;
CREATE TABLE truth_{t} AS SELECT q.id AS qid, nn.id FROM {t} q,
LATERAL (SELECT id FROM {t} ORDER BY embedding <-> q.embedding LIMIT 10) nn WHERE q.id <= 100;""")
    demo['ivf_recall'] = capture("""SET ivfflat.probes = 1;
SELECT 'early (빈 테이블에 먼저)' AS build_order,
       round(count(*)::numeric / 1000, 3) AS recall_at_10
FROM (SELECT q.id AS qid, nn.id FROM early q,
      LATERAL (SELECT id FROM early ORDER BY embedding <-> q.embedding LIMIT 10) nn WHERE q.id <= 100) ann
JOIN truth_early USING (qid, id)
UNION ALL
SELECT 'proper (데이터 먼저)',
       round(count(*)::numeric / 1000, 3)
FROM (SELECT q.id AS qid, nn.id FROM proper q,
      LATERAL (SELECT id FROM proper ORDER BY embedding <-> q.embedding LIMIT 10) nn WHERE q.id <= 100) ann
JOIN truth_proper USING (qid, id);""", prefix=LOAD_V)
    for p in (1, 10):
        demo[f'ivf_probes_{p}'] = capture(
            f"""SET ivfflat.probes = {p};
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id FROM proper ORDER BY embedding <-> (SELECT embedding FROM proper WHERE id = 1) LIMIT 10;""", prefix=LOAD_V)
    run('CREATE INDEX proper_hnsw ON proper USING hnsw (embedding vector_l2_ops);\nDROP INDEX proper_idx;')
    for ef in (10, 200):
        demo[f'hnsw_ef_{ef}'] = capture(
            f"""SET hnsw.ef_search = {ef};
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id FROM proper ORDER BY embedding <-> (SELECT embedding FROM proper WHERE id = 1) LIMIT 10;""", prefix=LOAD_V)

    # ---- DiskANN ---------------------------------------------------------------
    demo['diskann_build'] = capture_notice(
        "CREATE INDEX items_diskann ON items USING diskann (embedding vector_l2_ops);", prefix=LOAD_VS)
    demo['diskann_layout_error'] = capture_error(
        "CREATE INDEX ON items USING diskann (embedding vector_l2_ops) WITH (storage_layout = SbqCompression);",
        prefix=LOAD_VS)
    demo['diskann_plain'] = capture_notice(
        "CREATE INDEX items_diskann_plain ON items USING diskann (embedding vector_l2_ops) WITH (storage_layout = plain);",
        prefix=LOAD_VS)
    demo['diskann_gucs'] = capture("SELECT name, setting FROM pg_settings WHERE name LIKE 'diskann.%' ORDER BY name;",
                                   prefix=LOAD_VS)

    # ---- 라벨 필터링 (실험 07 과 같은 설계) ------------------------------------------
    # 행 × 차원 cross join + GROUP BY 로 만든다. 행마다 스칼라 서브쿼리를 쓰면 InitPlan 으로 한 번만
    # 평가돼 라벨마다 같은 벡터가 된다 - 실험 07 첫 판이 그 실수였다(아래 docs_dup 이 그 재현).
    docs_sql = """CREATE TABLE docs (id bigserial PRIMARY KEY, embedding vector(32), labels smallint[]);
INSERT INTO docs (embedding, labels)
SELECT array_agg((CASE WHEN d = l THEN 10.0 ELSE 0.0 END + (random() - 0.5) * 0.8)::float4 ORDER BY d)::vector,
       ARRAY[l]::smallint[]
FROM generate_series(1, 10) l, generate_series(1, 5000) i, generate_series(1, 32) d
GROUP BY l, i ORDER BY l, i;
-- 질의 벡터 q: 라벨 1 의 중심 근처. 필터는 라벨 10 (라벨 2~10 중심은 q 에서 모두 같은 거리)
CREATE TABLE q AS
SELECT array_agg((CASE WHEN d = 1 THEN 10.0 ELSE 0.0 END + (random() - 0.5) * 0.8)::float4 ORDER BY d)::vector AS embedding
FROM generate_series(1, 32) d;"""
    run(SERIAL + "SELECT setseed(0.111);\n" + docs_sql + "\nVACUUM ANALYZE docs;")
    demo['docs_setup'] = docs_sql
    demo['docs_distinct'] = capture("SELECT count(*) AS rows, count(DISTINCT embedding) AS distinct_vectors FROM docs;")
    filtered = """SELECT count(*) AS rows_returned
FROM (SELECT id FROM docs
      WHERE labels && ARRAY[10]::smallint[]
      ORDER BY embedding <-> (SELECT embedding FROM q) LIMIT 10) s;"""
    demo['filter_exact'] = capture('SET enable_indexscan = off;\n' + filtered)
    run('CREATE INDEX docs_hnsw ON docs USING hnsw (embedding vector_l2_ops);')
    for mode in ('off', 'relaxed_order'):
        demo[f'filter_hnsw_{mode}'] = capture(f"SET hnsw.iterative_scan = {mode};\n" + filtered, prefix=LOAD_V)
    plan_sql = """EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id FROM docs WHERE labels && ARRAY[10]::smallint[]
ORDER BY embedding <-> (SELECT embedding FROM q) LIMIT 10;"""
    demo['filter_hnsw_off_plan'] = capture("SET hnsw.iterative_scan = off;\n" + plan_sql, prefix=LOAD_V)
    demo['filter_hnsw_relaxed_plan'] = capture("SET hnsw.iterative_scan = relaxed_order;\n" + plan_sql, prefix=LOAD_V)
    run('DROP INDEX docs_hnsw;')
    demo['filter_diskann_build'] = capture_notice(
        'CREATE INDEX docs_diskann ON docs USING diskann (embedding vector_l2_ops, labels);', prefix=LOAD_VS)
    demo['filter_diskann'] = capture(filtered, prefix=LOAD_VS)
    demo['filter_diskann_plan'] = capture(plan_sql, prefix=LOAD_VS)

    # ---- 실험 07 첫 판의 실수 재현: 서로 다른 벡터가 10개뿐인 데이터 ------------------------
    dup_sql = """CREATE TABLE docs_dup (id bigserial PRIMARY KEY, embedding vector(32), labels smallint[]);
-- 라벨마다 한 번씩 INSERT. 서브쿼리가 바깥 행을 참조하지 않아 5,000행이 같은 벡터를 받는다
INSERT INTO docs_dup (embedding, labels)
SELECT (ARRAY(SELECT (CASE WHEN g = 1 THEN 10.0 ELSE 0.0 END + (random() - 0.5) * 0.8)::float4
              FROM generate_series(1, 32) g))::vector, ARRAY[1]::smallint[]
FROM generate_series(1, 5000);
-- ... 라벨 2~10 도 같은 방식"""
    run(SERIAL + "SELECT setseed(0.111);\nCREATE TABLE docs_dup (id bigserial PRIMARY KEY, embedding vector(32), labels smallint[]);")
    for label in range(1, 11):
        run(f"""INSERT INTO docs_dup (embedding, labels)
SELECT (ARRAY(SELECT (CASE WHEN g = {label} THEN 10.0 ELSE 0.0 END + (random() - 0.5) * 0.8)::float4
              FROM generate_series(1, 32) g))::vector, ARRAY[{label}]::smallint[]
FROM generate_series(1, 5000);""")
    run('VACUUM ANALYZE docs_dup;\nCREATE INDEX docs_dup_hnsw ON docs_dup USING hnsw (embedding vector_l2_ops);')
    demo['dup_setup'] = dup_sql
    demo['dup_distinct'] = capture("SELECT count(*) AS rows, count(DISTINCT embedding) AS distinct_vectors FROM docs_dup;")
    demo['dup_reachable'] = capture("""SET enable_seqscan = off;
SET hnsw.iterative_scan = relaxed_order;
SET hnsw.max_scan_tuples = 1000000;
-- 필터 없이, 인덱스 스캔이 끝날 때까지 몇 행을 돌려주나
SELECT count(*) AS reachable_rows
FROM (SELECT id FROM docs_dup ORDER BY embedding <-> (SELECT embedding FROM q) LIMIT 1000000) s;""", prefix=LOAD_V)
    demo['dup_filter'] = capture("""SET enable_seqscan = off;
SET hnsw.iterative_scan = relaxed_order;
SELECT count(*) AS rows_returned
FROM (SELECT id FROM docs_dup WHERE labels && ARRAY[10]::smallint[]
      ORDER BY embedding <-> (SELECT embedding FROM q) LIMIT 10) s;""", prefix=LOAD_V)
    demo['docs_reachable'] = capture("""SET enable_seqscan = off;
SET hnsw.iterative_scan = relaxed_order;
SET hnsw.max_scan_tuples = 1000000;
SELECT count(*) AS reachable_rows
FROM (SELECT id FROM docs ORDER BY embedding <-> (SELECT embedding FROM q) LIMIT 1000000) s;""",
                                     prefix=LOAD_V + 'CREATE INDEX docs_hnsw2 ON docs USING hnsw (embedding vector_l2_ops);\n')

    OUT.write_text(json.dumps(demo, ensure_ascii=False, indent=1) + '\n')
    print(f'→ {OUT.relative_to(OWNER)} 갱신 ({len(demo)}개 항목)')
finally:
    h.down()
