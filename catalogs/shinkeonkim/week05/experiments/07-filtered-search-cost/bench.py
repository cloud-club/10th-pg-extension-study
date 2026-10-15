#!/usr/bin/env python3
"""실험 07 — 라벨 필터링 검색: DiskANN 네이티브 라벨 필터 vs HNSW + WHERE + `hnsw.iterative_scan`.

두 데이터셋을 같은 절차로 잰다.
  correct        : 행마다 노이즈가 다른, 서로 다른 벡터 50,000개 (이 실험의 본 측정)
  duplicate_bug  : 첫 판에서 실수로 쓴 생성 방식 - 스칼라 서브쿼리가 InitPlan 으로 한 번만 평가돼
                   라벨마다 5,000행이 전부 같은 벡터가 된다(서로 다른 벡터 10개). 첫 판의 극적인 결과
                   ("HNSW 는 어떤 설정으로도 0행")가 이 데이터 탓이었음을 기록하려고 그대로 다시 잰다.

각 데이터셋에서:
  - 서로 다른 벡터 수 (생성 검증)
  - HNSW 인덱스 스캔이 필터 없이 끝까지 몇 행에 닿는가 (그래프 연결성)
  - 필터 검색(라벨 10)의 정확도: 질의 20개 각각의 정확한 필터 top-10(Seq Scan)과의 교집합 → recall@10,
    반환 행 수, 라벨이 틀린 행 수
  - 비용: 질의 20개를 LATERAL 로 묶은 EXPLAIN (ANALYZE, BUFFERS) 의 버퍼·시간(3회 중앙값)
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

DIM = 32
N_LABELS = 10
ROWS_PER_LABEL = 5_000
K = 10
NQ = 20
TARGET_LABEL = 10
QUERY_NEAR_LABEL = 1
NOISE = 0.8  # (random()-0.5)*0.8 -> 차원당 ±0.4

FILTER = f"labels && ARRAY[{TARGET_LABEL}]::smallint[]"


def generate(dataset):
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.111);'
        ' DROP TABLE IF EXISTS docs, queries, truth, got;'
        f' CREATE TABLE docs (id bigserial PRIMARY KEY, embedding vector({DIM}), labels smallint[]);')
    for label in range(1, N_LABELS + 1):
        if dataset == 'correct':
            # cross join + GROUP BY: random() 이 (행, 차원)마다 다시 평가된다
            sql(f"INSERT INTO docs (embedding, labels)"
                f" SELECT array_agg((CASE WHEN d = {label} THEN 10.0 ELSE 0.0 END + (random() - 0.5) * {NOISE})::float4"
                f"                  ORDER BY d)::vector, ARRAY[{label}]::smallint[]"
                f" FROM generate_series(1, {ROWS_PER_LABEL}) i, generate_series(1, {DIM}) d GROUP BY i ORDER BY i;")
        else:
            # 첫 판의 생성 방식 그대로: 서브쿼리가 바깥 행을 참조하지 않아 InitPlan 으로 한 번만 평가된다
            sql(f"INSERT INTO docs (embedding, labels)"
                f" SELECT (ARRAY(SELECT (CASE WHEN g = {label} THEN 10.0 ELSE 0.0 END + (random() - 0.5) * {NOISE})::float4"
                f"               FROM generate_series(1, {DIM}) g))::vector, ARRAY[{label}]::smallint[]"
                f" FROM generate_series(1, {ROWS_PER_LABEL});")
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.222);'
        f' CREATE TABLE queries (qid int PRIMARY KEY, embedding vector({DIM}));'
        f" INSERT INTO queries SELECT v, array_agg((CASE WHEN d = {QUERY_NEAR_LABEL} THEN 10.0 ELSE 0.0 END"
        f"                      + (random() - 0.5) * {NOISE})::float4 ORDER BY d)::vector"
        f" FROM generate_series(1, {NQ}) v, generate_series(1, {DIM}) d GROUP BY v;"
        ' VACUUM ANALYZE docs;')
    # 정답: 인덱스를 쓰지 않는 정확한 필터 top-10
    sql('SET enable_indexscan = off; SET enable_bitmapscan = off;'
        ' CREATE TABLE truth AS SELECT q.qid, nn.id FROM queries q,'
        f' LATERAL (SELECT id FROM docs WHERE {FILTER} ORDER BY embedding <-> q.embedding LIMIT {K}) nn;')
    dist = sql("SELECT round(min(d)::numeric, 3), round(percentile_cont(0.5) WITHIN GROUP (ORDER BY d)::numeric, 3),"
               " round(max(d)::numeric, 3) FROM (SELECT d.embedding <-> q.embedding AS d FROM docs d, queries q"
               f" WHERE {FILTER.replace('labels', 'd.labels')}) s;").split('|')
    exact = scalar("SELECT round(avg(d.embedding <-> q.embedding)::numeric, 3) FROM truth t"
                   " JOIN docs d USING (id) JOIN queries q USING (qid);")
    return {
        'rows': int(scalar('SELECT count(*) FROM docs;')),
        'distinct_vectors': int(scalar('SELECT count(DISTINCT embedding) FROM docs;')),
        'label10_distance': {'min': float(dist[0]), 'median': float(dist[1]), 'max': float(dist[2])},
        'avg_distance_exact': float(exact),
    }


def reachable(load):
    """필터 없이 인덱스 스캔이 끝날 때까지 몇 행을 돌려주는가 (iterative scan 한도는 크게 푼다)."""
    return int(scalar(f"{load} SET enable_seqscan = off; SET hnsw.iterative_scan = relaxed_order;"
                      " SET hnsw.max_scan_tuples = 1000000; SET work_mem = '256MB';"
                      " SELECT count(*) FROM (SELECT id FROM docs ORDER BY embedding <->"
                      " (SELECT embedding FROM queries WHERE qid = 1) LIMIT 1000000) s;"))


def measure(label, load, settings, index):
    pre = f"{load} SET enable_seqscan = off; {settings}"
    sql(f"DROP TABLE IF EXISTS got; {pre} CREATE TABLE got AS SELECT q.qid, nn.id, nn.labels FROM queries q,"
        f" LATERAL (SELECT id, labels FROM docs WHERE {FILTER} ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
    returned = float(scalar(f"SELECT round(count(*)::numeric / {NQ}, 2) FROM got;"))
    wrong = int(scalar(f"SELECT count(*) FROM got WHERE NOT (labels @> ARRAY[{TARGET_LABEL}]::smallint[]);"))
    recall = float(scalar(f"SELECT round(count(*)::numeric / ({NQ} * {K}), 4) FROM got JOIN truth USING (qid, id);"))
    # 라벨 10 의 점들은 질의에서 거의 같은 거리라 recall@10 이 동률 경쟁이 된다 - 거리 품질을 함께 본다
    dist = scalar("SELECT coalesce(round(avg(d.embedding <-> q.embedding)::numeric, 3)::text, 'none') FROM got g"
                  " JOIN docs d USING (id) JOIN queries q USING (qid);")

    times, bufs = [], []
    for _ in range(3):
        out = sql_raw(f"{pre} EXPLAIN (ANALYZE, BUFFERS)"
                      " SELECT q.qid, nn.id FROM queries q,"
                      f" LATERAL (SELECT id FROM docs WHERE {FILTER} ORDER BY embedding <-> q.embedding LIMIT {K}) nn;")
        t = re.search(r'Execution Time: ([\d.]+) ms', out)
        b = re.search(r'Buffers: shared hit=(\d+)(?: read=(\d+))?', out)
        if t:
            times.append(float(t.group(1)))
        if b:
            bufs.append(int(b.group(1)) + int(b.group(2) or 0))
    times.sort()
    bufs.sort()
    return {
        'config': label, 'index': index,
        'avg_rows_returned': returned, 'wrong_label_rows': wrong, 'recall_at_10': recall,
        'avg_distance_returned': None if dist == 'none' else float(dist),
        'ms_per_query': round(times[1] / NQ, 4), 'buffers_per_query': round(bufs[1] / NQ, 1),
    }


def run_dataset(dataset):
    out = {'dataset': dataset, **generate(dataset), 'configs': []}

    sql('DROP INDEX IF EXISTS idx_hnsw, idx_diskann;')
    t = sql_raw("LOAD 'vector'; \\timing on\nCREATE INDEX idx_hnsw ON docs USING hnsw (embedding vector_l2_ops);")
    out['hnsw_build_ms'] = float(re.search(r'Time: ([\d.]+) ms', t).group(1))
    out['hnsw_reachable_rows'] = reachable("LOAD 'vector';")
    for mode in ('off', 'relaxed_order', 'strict_order'):
        r = measure(f'hnsw_iterative_{mode}', "LOAD 'vector';", f"SET hnsw.iterative_scan = {mode};", 'hnsw')
        out['configs'].append(r)
        print(dataset, r)

    sql('DROP INDEX idx_hnsw;')
    t = sql_raw("LOAD 'vectorscale-0.9.1'; \\timing on\n"
                "CREATE INDEX idx_diskann ON docs USING diskann (embedding vector_l2_ops, labels);")
    out['diskann_build_ms'] = float(re.search(r'Time: ([\d.]+) ms', t).group(1))
    r = measure('diskann_label_filter', "LOAD 'vectorscale-0.9.1';", '', 'diskann')
    out['configs'].append(r)
    print(dataset, r)
    sql('DROP INDEX idx_diskann;')
    return out


def main():
    up()
    results = {'environment': environment(), 'dim': DIM, 'n_labels': N_LABELS, 'rows_per_label': ROWS_PER_LABEL,
               'k': K, 'n_queries': NQ, 'target_label': TARGET_LABEL, 'datasets': {}}
    for dataset in ('correct', 'duplicate_bug'):
        results['datasets'][dataset] = run_dataset(dataset)
        save(RESULTS / 'run.json', results)
    c = results['datasets']['correct']
    assert c['distinct_vectors'] == c['rows'], '본 측정 데이터에 중복 벡터가 있다 - 생성 방식을 확인할 것'
    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
