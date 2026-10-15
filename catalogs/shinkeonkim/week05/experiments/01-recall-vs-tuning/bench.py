#!/usr/bin/env python3
"""실험 01 — ANN 튜닝 파라미터에 따른 recall@10 vs 비용(버퍼·시간).

가설: HNSW(ef_search) · IVFFlat(probes) · DiskANN(query_search_list_size) 모두
"파라미터를 올리면 recall은 오르고 비용(버퍼·시간)도 같이 오른다"는 트레이드오프를 보일 것이다.
정확한(exact) 결과를 기준(ground truth)으로 두고 재현율을 직접 계산한다.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, sql_raw, rows, scalar, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
RESULTS.mkdir(parents=True, exist_ok=True)

N = 50_000
DIM = 128
NQ = 50
K = 10
LISTS = 50  # pgvector 권장값: rows < 1M 이면 rows/1000
NEAR_PER_QUERY = 20   # 질의마다 "진짜 가까운 점"을 섞어 넣는 개수
NEAR_NOISE = 0.5      # 차원당 노이즈 반경 (균등분포 -B..B)

# 주의 - 두 가지 문제를 차례로 겪고 고쳤다. 재현하려는 사람을 위해 둘 다 남긴다.
#
# (1) 처음에는 N개 벡터를 전부 순수 균등분포 난수로만 만들었다. 128차원 균등분포에서는
#     "차원의 저주"로 모든 쌍의 L2 거리가 거의 완전히 같은 값(약 4.0)으로 수렴해버려서
#     (집중 현상, concentration of measure) 최근접 이웃 자체가 사실상 정의되지 않았다.
#     그래서 질의마다 "진짜로 가까운 점" NEAR_PER_QUERY개를 질의 벡터 + 작은 노이즈로
#     직접 섞어 넣어 거리 분포에 실제 구조(가까운 점 vs 배경 잡음)를 만든다.
# (2) 그 다음 `(SELECT array_agg(random()) FROM generate_series(1,128))::vector`를 행마다
#     SELECT 목록에 넣었더니, 플래너가 이 스칼라 서브쿼리를 바깥 행과 무관하다고 보고
#     InitPlan으로 "딱 한 번만" 평가해 재사용했다 - N개 행이 전부 동일한 벡터가 돼버렸다
#     (`SELECT count(DISTINCT embedding)`가 1이었다). HNSW self-query(자기 자신을 질의해도
#     거리 0인 지점을 못 찾음)로 발견했다. 해결: 실제 cross join + GROUP BY로 바꿔
#     random()이 행마다 진짜로 다시 평가되게 한다(스칼라 서브쿼리로 감싸지 않는다).
#     ground truth는 여전히 전수(exact) 계산이다 - 섞어 넣은 점이 항상 top-10 안에
#     들어간다고 가정하지 않는다.


def setup_data():
    sql('SET max_parallel_workers_per_gather = 0;'
        ' SELECT setseed(0.123);'
        ' DROP TABLE IF EXISTS vectors, queries, ground_truth, ann_results;'
        ' CREATE TABLE vectors (id bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO vectors (id, embedding)"
        f" SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{N}) v, generate_series(1,{DIM}) d GROUP BY v;"
        # id를 명시해서 넣었기 때문에 bigserial 시퀀스가 전진하지 않는다 (nextval()을 호출한 적이
        # 없다). 뒤의 "근접점 주입" INSERT는 id를 생략하고 DEFAULT에 맡기므로, 시퀀스를 직접
        # 당겨두지 않으면 거기서 다시 id=1부터 내주다가 PK 충돌이 난다 - 실제로 겪은 오류다.
        f" SELECT setval('vectors_id_seq', {N});")
    sql('SET max_parallel_workers_per_gather = 0;'
        ' SELECT setseed(0.456);'
        ' CREATE TABLE queries (qid bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO queries (qid, embedding)"
        f" SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{NQ}) v, generate_series(1,{DIM}) d GROUP BY v;")
    sql('SET max_parallel_workers_per_gather = 0;'
        ' SELECT setseed(0.789);'
        f" INSERT INTO vectors (embedding)"
        f" SELECT (ARRAY(SELECT (qv[g] + (random()-0.5)*2*{NEAR_NOISE})::float4"
        f"               FROM generate_series(1,{DIM}) g))::vector"
        f" FROM queries q, generate_series(1,{NEAR_PER_QUERY}) rep,"
        f" LATERAL (SELECT embedding::float4[] AS qv) e;")
    sql('CREATE TABLE ground_truth (qid bigint, neighbor_id bigint);'
        ' CREATE TABLE ann_results (config text, qid bigint, neighbor_id bigint);')


def checksum():
    # 재현성 확인용 - 두 번 돌려 데이터 생성이 결정적인지 본다.
    return scalar("SELECT md5(string_agg(embedding::text, ',' ORDER BY id)) FROM vectors;")


def compute_ground_truth():
    sql('TRUNCATE ground_truth;'
        ' SET enable_indexscan = off; SET enable_bitmapscan = off;'
        f" INSERT INTO ground_truth (qid, neighbor_id)"
        f" SELECT q.qid, nn.id FROM queries q,"
        f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;"
        ' RESET enable_indexscan; RESET enable_bitmapscan;')


def run_config(label, load_stmt, set_stmt):
    sql(f"TRUNCATE ann_results; DELETE FROM ann_results WHERE config = '{label}';"
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

    out = sql_raw(f"""
        {load_stmt} {set_stmt}
        EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
        SELECT q.qid, nn.id FROM queries q,
        LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;
    """)
    buf = re.search(r'Buffers: shared hit=(\d+)(?: read=(\d+))?', out)
    hit = int(buf.group(1)) if buf else 0
    read = int(buf.group(2)) if buf and buf.group(2) else 0

    times = []
    for _ in range(3):
        out_t = sql_raw(f"{load_stmt} {set_stmt}"
                         " EXPLAIN (ANALYZE, BUFFERS)"
                         " SELECT q.qid, nn.id FROM queries q,"
                         f" LATERAL (SELECT id FROM vectors ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
        m = re.search(r'Execution Time: ([\d.]+) ms', out_t)
        if m:
            times.append(float(m.group(1)))
    times.sort()
    median_ms = times[len(times) // 2] if times else None

    return {
        'config': label, 'recall_at_10': recall,
        'buffers_hit_total': hit, 'buffers_read_total': read,
        'buffers_per_query': round((hit + read) / NQ, 1),
        'median_exec_ms_for_50_queries': median_ms,
        'per_query_ms': round(median_ms / NQ, 3) if median_ms else None,
    }


def main():
    up()
    env = environment()
    setup_data()
    cs1 = checksum()
    compute_ground_truth()

    results = {'environment': env, 'n_vectors': N, 'dim': DIM, 'n_queries': NQ, 'k': K, 'configs': []}

    # --- HNSW ---
    sql('DROP INDEX IF EXISTS idx_hnsw, idx_ivfflat, idx_diskann;')
    out = sql_raw("LOAD 'vector'; \\timing on\n"
                   "CREATE INDEX idx_hnsw ON vectors USING hnsw (embedding vector_l2_ops);")
    m = re.search(r'Time: ([\d.]+) ms', out)
    hnsw_build_ms = float(m.group(1)) if m else None
    hnsw_size_mb = float(scalar("SELECT round(pg_relation_size('idx_hnsw')/1024.0/1024.0, 2);"))
    for ef in (10, 40, 100, 200):
        r = run_config(f'hnsw_ef{ef}', "LOAD 'vector';", f'SET hnsw.ef_search = {ef};')
        r.update(index='hnsw', param='ef_search', value=ef, build_ms=hnsw_build_ms, index_mb=hnsw_size_mb)
        results['configs'].append(r)
        print(r)

    # --- IVFFlat ---
    sql('DROP INDEX IF EXISTS idx_hnsw;')
    out = sql_raw(f"LOAD 'vector'; \\timing on\n"
                   f"CREATE INDEX idx_ivfflat ON vectors USING ivfflat (embedding vector_l2_ops) WITH (lists = {LISTS});")
    m = re.search(r'Time: ([\d.]+) ms', out)
    ivf_build_ms = float(m.group(1)) if m else None
    ivf_size_mb = float(scalar("SELECT round(pg_relation_size('idx_ivfflat')/1024.0/1024.0, 2);"))
    for probes in (1, 10, 50):
        r = run_config(f'ivfflat_probes{probes}', "LOAD 'vector';", f'SET ivfflat.probes = {probes};')
        r.update(index='ivfflat', param='probes', value=probes, build_ms=ivf_build_ms, index_mb=ivf_size_mb, lists=LISTS)
        results['configs'].append(r)
        print(r)

    # --- DiskANN ---
    sql('DROP INDEX IF EXISTS idx_ivfflat;')
    out = sql_raw("LOAD 'vectorscale-0.9.1'; \\timing on\n"
                   "CREATE INDEX idx_diskann ON vectors USING diskann (embedding vector_l2_ops);")
    m = re.search(r'Time: ([\d.]+) ms', out)
    diskann_build_ms = float(m.group(1)) if m else None
    diskann_size_mb = float(scalar("SELECT round(pg_relation_size('idx_diskann')/1024.0/1024.0, 2);"))
    diskann_notice = re.search(r'NOTICE.*storage_layout=\w+\.', out)
    for sls in (10, 50, 100, 200):
        r = run_config(f'diskann_sls{sls}', "LOAD 'vectorscale-0.9.1';",
                        f'SET diskann.query_search_list_size = {sls};')
        r.update(index='diskann', param='query_search_list_size', value=sls,
                 build_ms=diskann_build_ms, index_mb=diskann_size_mb)
        results['configs'].append(r)
        print(r)

    results['data_checksum_run1'] = cs1
    results['diskann_build_notice'] = diskann_notice.group(0) if diskann_notice else None
    save(RESULTS / 'run.json', results)
    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
