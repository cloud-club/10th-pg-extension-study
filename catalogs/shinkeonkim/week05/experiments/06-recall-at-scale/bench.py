#!/usr/bin/env python3
"""실험 06 — DiskANN의 recall 우위는 더 큰 규모(300,000행)에서도 보이는가.

실험 01(51,000행)에서 DiskANN은 가장 싼 설정부터 recall@10=1.0으로 포화해 있었다 -
"이 규모가 DiskANN에게 너무 쉬웠을 뿐"이라는 가능성을 그 문서에 한계로 남겼다.
이 실험은 행 수를 300,000(실험 02와 같은 규모)으로 올려, 같은 "가장 싼 설정"끼리
비교했을 때도 여전히 DiskANN이 포화해 있는지, 아니면 그제서야 HNSW/IVFFlat과
같은 recall/비용 트레이드오프가 드러나는지를 본다.

빌드 비용이 크므로(DiskANN 300,000행 ~583초, 실험 02 기준) 파라미터는 "가장 싼 값"과
"중간값" 두 개로만 줄인다(실험 01의 4단계 스윕 대신).
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

N = 300_000
DIM = 128
NQ = 50
K = 10
NEAR_PER_QUERY = 20
NEAR_NOISE = 0.5
LISTS = 300  # rows/1000


def setup_data():
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
    sql('CREATE TABLE ground_truth (qid bigint, neighbor_id bigint);'
        ' CREATE TABLE ann_results (config text, qid bigint, neighbor_id bigint);')


def compute_ground_truth():
    sql('TRUNCATE ground_truth; SET enable_indexscan = off; SET enable_bitmapscan = off;'
        f" INSERT INTO ground_truth (qid, neighbor_id)"
        f" SELECT q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;"
        ' RESET enable_indexscan; RESET enable_bitmapscan;')


def run_config(label, load_stmt, set_stmt):
    sql(f"TRUNCATE ann_results;"
        f" {load_stmt} {set_stmt}"
        f" INSERT INTO ann_results (config, qid, neighbor_id)"
        f" SELECT '{label}', q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    recall = float(scalar(f"""
        WITH gt AS (SELECT qid, array_agg(neighbor_id) a FROM ground_truth GROUP BY qid),
             ann AS (SELECT qid, array_agg(neighbor_id) a FROM ann_results WHERE config = '{label}' GROUP BY qid)
        SELECT round(avg(cardinality(ARRAY(SELECT unnest(gt.a) INTERSECT SELECT unnest(ann.a))))::numeric / {K}, 4)
        FROM gt JOIN ann USING (qid);
    """))
    out = sql_raw(f"{load_stmt} {set_stmt}"
                  " EXPLAIN (ANALYZE, BUFFERS)"
                  " SELECT q.qid, nn.id FROM queries q,"
                  f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    buf = re.search(r'Buffers: shared hit=(\d+)(?: read=(\d+))?', out)
    hit = int(buf.group(1)) if buf else 0
    read = int(buf.group(2)) if buf and buf.group(2) else 0
    ms = re.search(r'Execution Time: ([\d.]+) ms', out)
    ms_val = float(ms.group(1)) if ms else None
    return {'config': label, 'recall_at_10': recall, 'buffers_per_query': round((hit + read) / NQ, 1),
            'ms_per_50_queries': ms_val, 'ms_per_query': round(ms_val / NQ, 3) if ms_val else None}


def main():
    up()
    env = environment()
    setup_data()
    compute_ground_truth()
    results = {'environment': env, 'n_vectors': N, 'dim': DIM, 'n_queries': NQ, 'k': K, 'configs': []}

    sql('DROP INDEX IF EXISTS idx_hnsw, idx_ivfflat, idx_diskann;')
    out = sql_raw("LOAD 'vector'; \\timing on\nCREATE INDEX idx_hnsw ON vectors USING hnsw (embedding vector_l2_ops);")
    hnsw_build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    hnsw_mb = float(scalar("SELECT round(pg_relation_size('idx_hnsw')/1024.0/1024.0, 2);"))
    for ef in (10, 100):
        r = run_config(f'hnsw_ef{ef}', "LOAD 'vector';", f'SET hnsw.ef_search = {ef};')
        r.update(index='hnsw', param='ef_search', value=ef, build_ms=hnsw_build_ms, index_mb=hnsw_mb)
        results['configs'].append(r); print(r); save(RESULTS / 'run.json', results)

    sql('DROP INDEX IF EXISTS idx_hnsw;')
    out = sql_raw(f"LOAD 'vector'; \\timing on\nCREATE INDEX idx_ivfflat ON vectors USING ivfflat (embedding vector_l2_ops) WITH (lists = {LISTS});")
    ivf_build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    ivf_mb = float(scalar("SELECT round(pg_relation_size('idx_ivfflat')/1024.0/1024.0, 2);"))
    for probes in (1, 30):
        r = run_config(f'ivfflat_probes{probes}', "LOAD 'vector';", f'SET ivfflat.probes = {probes};')
        r.update(index='ivfflat', param='probes', value=probes, build_ms=ivf_build_ms, index_mb=ivf_mb, lists=LISTS)
        results['configs'].append(r); print(r); save(RESULTS / 'run.json', results)

    sql('DROP INDEX IF EXISTS idx_ivfflat;')
    out = sql_raw("LOAD 'vectorscale-0.9.1'; \\timing on\nCREATE INDEX idx_diskann ON vectors USING diskann (embedding vector_l2_ops);")
    diskann_build_ms = float(re.search(r'Time: ([\d.]+) ms', out).group(1))
    diskann_mb = float(scalar("SELECT round(pg_relation_size('idx_diskann')/1024.0/1024.0, 2);"))
    for sls in (10, 100):
        r = run_config(f'diskann_sls{sls}', "LOAD 'vectorscale-0.9.1';", f'SET diskann.query_search_list_size = {sls};')
        r.update(index='diskann', param='query_search_list_size', value=sls, build_ms=diskann_build_ms, index_mb=diskann_mb)
        results['configs'].append(r); print(r); save(RESULTS / 'run.json', results)

    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
