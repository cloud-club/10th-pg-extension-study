#!/usr/bin/env python3
"""실험 03 — DiskANN의 SBQ 압축(storage_layout=SbqCompression) vs 비압축(plain).

가설: SBQ 압축은 인덱스를 작게 만드는 대신 recall이나 버퍼 비용에서 대가를 치를 것이다.
같은 데이터·같은 query_search_list_size에서 storage_layout만 바꿔 직접 비교한다.
데이터 생성·재현율 계산 방식은 실험 01과 같다(균등분포 난수의 집중 현상 문제를 겪고 고친 것도 동일).
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
SEARCH_LIST_SIZE = 100  # 기본값으로 고정 - storage_layout만 바꿔 비교


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


def measure(layout):
    sql('DROP INDEX IF EXISTS idx_diskann;')
    out = sql_raw("LOAD 'vectorscale-0.9.1'; \\timing on\n"
                   f"CREATE INDEX idx_diskann ON vectors USING diskann (embedding vector_l2_ops)"
                   f" WITH (storage_layout = {layout});")
    m = re.search(r'Time: ([\d.]+) ms', out)
    build_ms = float(m.group(1)) if m else None
    size_mb = float(scalar("SELECT round(pg_relation_size('idx_diskann')/1024.0/1024.0, 3);"))
    notice = re.search(r'NOTICE:.*', out)

    sql(f"TRUNCATE ann_results;"
        f" LOAD 'vectorscale-0.9.1'; SET diskann.query_search_list_size = {SEARCH_LIST_SIZE};"
        f" INSERT INTO ann_results (config, qid, neighbor_id)"
        f" SELECT '{layout}', q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    recall = float(scalar(f"""
        WITH gt AS (SELECT qid, array_agg(neighbor_id) a FROM ground_truth GROUP BY qid),
             ann AS (SELECT qid, array_agg(neighbor_id) a FROM ann_results WHERE config = '{layout}' GROUP BY qid)
        SELECT round(avg(cardinality(ARRAY(SELECT unnest(gt.a) INTERSECT SELECT unnest(ann.a))))::numeric / {K}, 4)
        FROM gt JOIN ann USING (qid);
    """))

    times = []
    for _ in range(3):
        out_t = sql_raw(f"LOAD 'vectorscale-0.9.1'; SET diskann.query_search_list_size = {SEARCH_LIST_SIZE};"
                         " EXPLAIN (ANALYZE, BUFFERS)"
                         " SELECT q.qid, nn.id FROM queries q,"
                         f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
        t = re.search(r'Execution Time: ([\d.]+) ms', out_t)
        if t:
            times.append(float(t.group(1)))
        buf = re.search(r'Buffers: shared hit=(\d+)', out_t)
    times.sort()
    median_ms = times[len(times) // 2] if times else None
    hit = int(buf.group(1)) if buf else 0

    return {
        'storage_layout': layout, 'build_ms': build_ms, 'index_mb': size_mb,
        'recall_at_10': recall, 'buffers_per_query': round(hit / NQ, 1),
        'median_ms_for_50_queries': median_ms, 'notice': notice.group(0) if notice else None,
    }


def main():
    up()
    env = environment()
    setup_data()
    compute_ground_truth()

    results = {'environment': env, 'n_vectors': N, 'dim': DIM, 'search_list_size': SEARCH_LIST_SIZE, 'configs': []}
    for layout in ('memory_optimized', 'plain'):
        r = measure(layout)
        results['configs'].append(r)
        print(r)
        save(RESULTS / 'run.json', results)  # 중간 저장 - 다음 설정이 서버를 죽여도 결과가 남는다

    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
