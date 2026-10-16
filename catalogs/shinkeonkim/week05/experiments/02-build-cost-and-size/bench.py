#!/usr/bin/env python3
"""실험 02 — 행 수에 따른 인덱스 빌드 시간·크기 (HNSW vs IVFFlat vs DiskANN).

가설: pgvectorscale(DiskANN)의 설계 의도(SBQ 압축으로 더 큰 규모에서 메모리를 아낀다)가
사실이라면, 행 수가 늘어날수록 DiskANN 인덱스가 HNSW보다 "원본 대비 크기"가 덜 커져야 한다.
빌드 시간은 Timescale 자사 벤치마크가 "DiskANN 빌드는 단일 스레드라 느리다"고 인정한 부분을
작은 규모에서 직접 재현해본다. diskann.min_vectors_for_parallel_build(기본 65536)를
가로지르는 지점을 넣어 병렬 빌드 전환도 함께 본다.
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

DIM = 128
ROW_COUNTS = (20_000, 100_000, 300_000)


def generate(n):
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.321);'
        ' DROP TABLE IF EXISTS vectors;'
        ' CREATE TABLE vectors (id bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO vectors (id, embedding)"
        f" SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{n}) v, generate_series(1,{DIM}) d GROUP BY v;")


def build_and_measure(create_stmt, index_name, load_lib):
    sql('DROP INDEX IF EXISTS idx_hnsw, idx_ivfflat, idx_diskann;')
    out = sql_raw(f"LOAD '{load_lib}'; \\timing on\n{create_stmt}")
    m = re.search(r'Time: ([\d.]+) ms', out)
    build_ms = float(m.group(1)) if m else None
    notice = re.search(r'NOTICE:.*', out)
    size_mb = float(scalar(f"SELECT round(pg_relation_size('{index_name}')/1024.0/1024.0, 3);"))
    return build_ms, size_mb, (notice.group(0) if notice else None)


def main():
    up()
    env = environment()
    results = {'environment': env, 'dim': DIM, 'rows': []}

    for n in ROW_COUNTS:
        generate(n)
        table_mb = float(scalar("SELECT round(pg_total_relation_size('vectors')/1024.0/1024.0, 3);"))
        row = {'n': n, 'table_mb': table_mb}

        row['hnsw_build_ms'], row['hnsw_mb'], _ = build_and_measure(
            'CREATE INDEX idx_hnsw ON vectors USING hnsw (embedding vector_l2_ops);', 'idx_hnsw', 'vector')

        row['ivfflat_lists'] = max(1, n // 1000) if n < 1_000_000 else int(n ** 0.5)
        row['ivfflat_build_ms'], row['ivfflat_mb'], _ = build_and_measure(
            f"CREATE INDEX idx_ivfflat ON vectors USING ivfflat (embedding vector_l2_ops) WITH (lists = {row['ivfflat_lists']});",
            'idx_ivfflat', 'vector')

        row['diskann_build_ms'], row['diskann_mb'], row['diskann_notice'] = build_and_measure(
            'CREATE INDEX idx_diskann ON vectors USING diskann (embedding vector_l2_ops);',
            'idx_diskann', 'vectorscale-0.9.1')
        row['diskann_parallel_build_threshold_crossed'] = n >= 65536

        for k in ('hnsw', 'ivfflat', 'diskann'):
            row[f'{k}_ratio_to_table'] = round(row[f'{k}_mb'] / table_mb, 3)

        results['rows'].append(row)
        print(row)

    save(RESULTS / 'run.json', results)
    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
