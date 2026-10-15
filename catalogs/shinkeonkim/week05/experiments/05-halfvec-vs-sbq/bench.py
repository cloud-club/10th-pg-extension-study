#!/usr/bin/env python3
"""실험 05 — 메모리를 아끼는 두 가지 선택: pgvector `halfvec`(16비트 절반 정밀도) vs
pgvectorscale DiskANN의 SBQ 압축. `pgvectorscale.md`의 "대안" 절이 halfvec을 "pgvector
안에서 메모리를 줄이는 대안"으로 언급만 하고 직접 비교하지는 않았다 - 이 실험이 그 비교다.

세 가지를 같은 데이터·같은 ground truth로 비교한다:
  1) HNSW + vector(float4, 원본)
  2) HNSW + halfvec(float2, pgvector 0.7.0+)
  3) DiskANN + vector(SBQ 압축, 기본값)
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, sql_raw, scalar, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
RESULTS.mkdir(parents=True, exist_ok=True)

N = 50_000
DIM = 128
NQ = 50
K = 10
NEAR_PER_QUERY = 20
NEAR_NOISE = 0.5
EF_SEARCH = 100          # HNSW 질의 파라미터 고정값 (표현 방식 효과만 보려고 튜닝 스윕은 안 함)
SEARCH_LIST_SIZE = 100   # DiskANN 기본값


def setup_data():
    # 실험 01과 같은 생성 방식 (균등분포 난수의 집중 현상 문제를 겪고 고친 버전) - 재사용.
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.123);'
        ' DROP TABLE IF EXISTS vectors, queries, ground_truth, ann_results;'
        ' CREATE TABLE vectors (id bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO vectors (id, embedding)"
        f" SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{N}) v, generate_series(1,{DIM}) d GROUP BY v;"
        f" SELECT setval('vectors_id_seq', {N});")
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.456);'
        ' CREATE TABLE queries (qid bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO queries (qid, embedding)"
        f" SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{NQ}) v, generate_series(1,{DIM}) d GROUP BY v;")
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.789);'
        f" INSERT INTO vectors (embedding)"
        f" SELECT (ARRAY(SELECT (qv[g] + (random()-0.5)*2*{NEAR_NOISE})::float4"
        f"               FROM generate_series(1,{DIM}) g))::vector"
        f" FROM queries q, generate_series(1,{NEAR_PER_QUERY}) rep,"
        f" LATERAL (SELECT embedding::float4[] AS qv) e;")
    # halfvec 컬럼은 원본 vector에서 캐스팅해서 만든다 - 같은 임베딩의 저정밀도 버전.
    sql("ALTER TABLE vectors ADD COLUMN embedding_half halfvec(128);"
        " UPDATE vectors SET embedding_half = embedding::halfvec(128);")
    sql('CREATE TABLE ground_truth (qid bigint, neighbor_id bigint);'
        ' CREATE TABLE ann_results (config text, qid bigint, neighbor_id bigint);')


def compute_ground_truth():
    # ground truth는 항상 원본(float4) 정밀도의 정확한 거리로 정의한다 - "진짜 정답"은
    # 정밀도를 낮추기 전의 데이터가 기준이어야 공정하다.
    sql('TRUNCATE ground_truth; SET enable_indexscan = off; SET enable_bitmapscan = off;'
        f" INSERT INTO ground_truth (qid, neighbor_id)"
        f" SELECT q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;"
        ' RESET enable_indexscan; RESET enable_bitmapscan;')


def recall_for(label):
    return float(scalar(f"""
        WITH gt AS (SELECT qid, array_agg(neighbor_id) a FROM ground_truth GROUP BY qid),
             ann AS (SELECT qid, array_agg(neighbor_id) a FROM ann_results WHERE config = '{label}' GROUP BY qid)
        SELECT round(avg(cardinality(ARRAY(SELECT unnest(gt.a) INTERSECT SELECT unnest(ann.a))))::numeric / {K}, 4)
        FROM gt JOIN ann USING (qid);
    """))


def measure_vector_hnsw():
    sql('DROP INDEX IF EXISTS idx_hnsw_full, idx_hnsw_half, idx_diskann;')
    out = sql_raw("LOAD 'vector'; \\timing on\n"
                   "CREATE INDEX idx_hnsw_full ON vectors USING hnsw (embedding vector_l2_ops);")
    build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    size_mb = float(scalar("SELECT round(pg_relation_size('idx_hnsw_full')/1024.0/1024.0, 3);"))

    sql(f"TRUNCATE ann_results; LOAD 'vector'; SET hnsw.ef_search = {EF_SEARCH};"
        f" INSERT INTO ann_results (config, qid, neighbor_id)"
        f" SELECT 'vector_hnsw', q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    recall = recall_for('vector_hnsw')

    out_t = sql_raw(f"LOAD 'vector'; SET hnsw.ef_search = {EF_SEARCH};"
                     " EXPLAIN (ANALYZE, BUFFERS)"
                     " SELECT q.qid, nn.id FROM queries q,"
                     f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    buf = int(re.search(r'Buffers: shared hit=(\d+)', out_t).group(1))
    ms = float(re.search(r'Execution Time: ([\d.]+) ms', out_t).group(1))

    return {'config': 'vector(float4)+HNSW', 'build_ms': build_ms, 'index_mb': size_mb,
            'recall_at_10': recall, 'buffers_per_query': round(buf / NQ, 1), 'ms_per_query': round(ms / NQ, 3)}


def measure_halfvec_hnsw():
    sql('DROP INDEX IF EXISTS idx_hnsw_full, idx_hnsw_half, idx_diskann;')
    out = sql_raw("LOAD 'vector'; \\timing on\n"
                   "CREATE INDEX idx_hnsw_half ON vectors USING hnsw (embedding_half halfvec_l2_ops);")
    build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    size_mb = float(scalar("SELECT round(pg_relation_size('idx_hnsw_half')/1024.0/1024.0, 3);"))

    sql(f"TRUNCATE ann_results; LOAD 'vector'; SET hnsw.ef_search = {EF_SEARCH};"
        f" INSERT INTO ann_results (config, qid, neighbor_id)"
        f" SELECT 'halfvec_hnsw', q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding_half <-> (q.embedding::halfvec(128)) LIMIT {K}) nn;")
    recall = recall_for('halfvec_hnsw')

    out_t = sql_raw(f"LOAD 'vector'; SET hnsw.ef_search = {EF_SEARCH};"
                     " EXPLAIN (ANALYZE, BUFFERS)"
                     " SELECT q.qid, nn.id FROM queries q,"
                     f" LATERAL (SELECT id FROM vectors ORDER BY embedding_half <-> (q.embedding::halfvec(128)) LIMIT {K}) nn;")
    buf = int(re.search(r'Buffers: shared hit=(\d+)', out_t).group(1))
    ms = float(re.search(r'Execution Time: ([\d.]+) ms', out_t).group(1))

    return {'config': 'halfvec(float2)+HNSW', 'build_ms': build_ms, 'index_mb': size_mb,
            'recall_at_10': recall, 'buffers_per_query': round(buf / NQ, 1), 'ms_per_query': round(ms / NQ, 3)}


def measure_diskann():
    sql('DROP INDEX IF EXISTS idx_hnsw_full, idx_hnsw_half, idx_diskann;')
    out = sql_raw("LOAD 'vectorscale-0.9.1'; \\timing on\n"
                   "CREATE INDEX idx_diskann ON vectors USING diskann (embedding vector_l2_ops);")
    build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    size_mb = float(scalar("SELECT round(pg_relation_size('idx_diskann')/1024.0/1024.0, 3);"))

    sql(f"TRUNCATE ann_results; LOAD 'vectorscale-0.9.1'; SET diskann.query_search_list_size = {SEARCH_LIST_SIZE};"
        f" INSERT INTO ann_results (config, qid, neighbor_id)"
        f" SELECT 'diskann', q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    recall = recall_for('diskann')

    out_t = sql_raw(f"LOAD 'vectorscale-0.9.1'; SET diskann.query_search_list_size = {SEARCH_LIST_SIZE};"
                     " EXPLAIN (ANALYZE, BUFFERS)"
                     " SELECT q.qid, nn.id FROM queries q,"
                     f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    buf = int(re.search(r'Buffers: shared hit=(\d+)', out_t).group(1))
    ms = float(re.search(r'Execution Time: ([\d.]+) ms', out_t).group(1))

    return {'config': 'vector(SBQ)+DiskANN', 'build_ms': build_ms, 'index_mb': size_mb,
            'recall_at_10': recall, 'buffers_per_query': round(buf / NQ, 1), 'ms_per_query': round(ms / NQ, 3)}


def main():
    up()
    env = environment()
    setup_data()
    compute_ground_truth()
    table_mb = float(scalar("SELECT round(pg_total_relation_size('vectors')/1024.0/1024.0, 3);"))

    results = {'environment': env, 'n_vectors': N, 'dim': DIM, 'table_mb': table_mb, 'configs': []}
    for fn in (measure_vector_hnsw, measure_halfvec_hnsw, measure_diskann):
        r = fn()
        results['configs'].append(r)
        print(r)
        save(RESULTS / 'run.json', results)

    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
