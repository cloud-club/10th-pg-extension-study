#!/usr/bin/env python3
"""IVFFlat·HNSW 설명 페이지의 실측 데이터를 전용 임시 DB에서 만들어
src/data/pgvector-index-demo.json 으로 저장한다.

    python3 scripts/capture-pgvector-index-demo.py

capture-pgvector-demo.py(설치·문법·필터 예제)와 따로 둔다 — 그쪽 출력을 바꾸지 않고
인덱스 구조 설명에 필요한 측정만 더하기 위해서다.

데이터: 32차원, 무리(cluster) 100개. 무리 중심은 [0,1) 균등분포, 점은 중심 ± 0.2 균등 흔들림.
테이블 20,000행, 질문 100개는 테이블에 없는 같은 분포의 점(따로 생성)이다. 정답은 인덱스 없이 구한다.
측정은 인덱스 빌드마다 RUNS 회 반복한다(HNSW·IVFFlat 빌드는 실행마다 결과가 조금씩 다르다).
"""
import json
from pathlib import Path
import re
import sys

OWNER = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(OWNER / 'week05/experiments/runtime'))
import harness as h  # noqa: E402

h.COMPOSE += ['-p', 'pgvector-index-demo-capture']
OUT = OWNER / 'web/src/data/pgvector-index-demo.json'
RUNS = 2
ROWS, DIM, CLUSTERS, NQ = 20_000, 32, 100, 100

# 행 × 차원을 실제로 곱해(cross join) 칸마다 random() 을 다시 계산한다 — InitPlan 함정 회피
GEN = """CREATE TABLE centers AS
  SELECT c, d, random() AS x FROM generate_series(0, {clusters} - 1) c, generate_series(1, {dim}) d;
CREATE TABLE {table} (id bigint PRIMARY KEY, cluster int, embedding vector({dim}));
INSERT INTO {table}
  SELECT v, v % {clusters}, array_agg(ce.x + (random() - 0.5) * 0.4 ORDER BY ce.d)::vector
  FROM generate_series(1, {rows}) v JOIN centers ce ON ce.c = v % {clusters}
  GROUP BY v;"""
ANN = 'SELECT q.id AS qid, nn.id FROM {qs} q, LATERAL (SELECT id FROM {t} ORDER BY embedding <-> q.embedding LIMIT 10) nn'
PREP = "LOAD 'vector';\nSET enable_seqscan = off;\nSET max_parallel_workers_per_gather = 0;\n"


def timed(statement):
    """psql \\timing 으로 서버 왕복 시간을 잰다(docker exec 오버헤드 제외). 마지막 Time: 줄을 쓴다."""
    out = h.sql_raw('\\timing on\n' + statement)
    return float(re.findall(r'Time: ([\d.]+) ms', out)[-1]), out


def plan_cost(prefix, q, qs):
    """EXPLAIN (ANALYZE, BUFFERS) 의 맨 위 노드에서 (질의당 버퍼, 질의당 ms). 질문 테이블을 읽은 페이지는 뺀다."""
    nq = int(h.scalar(f'SELECT count(*) FROM {qs};'))
    pages = int(h.scalar(f"SELECT relpages FROM pg_class WHERE relname = '{qs}';"))
    plan = json.loads(h.sql(prefix + f'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {q};'))[0]
    top = plan['Plan']
    return round((top['Shared Hit Blocks'] + top['Shared Read Blocks'] - pages) / nq, 1), round(plan['Execution Time'] / nq, 3)


def measure(setting='', t='pts', qs='qs', truth='truth'):
    """질문 전체에 대한 recall@10, 질의당 버퍼, 질의당 ms."""
    q = ANN.format(qs=qs, t=t)
    nq = int(h.scalar(f'SELECT count(*) FROM {qs};'))
    recall = float(h.scalar(PREP + setting + f'SELECT round(count(*)::numeric / ({nq} * 10), 3) FROM ({q}) a JOIN {truth} USING (qid, id);'))
    bufs, ms = plan_cost(PREP + setting, q, qs)
    return {'recall': recall, 'buffers_per_query': bufs, 'ms_per_query': ms}


def build(sql, index):
    ms, _ = timed(sql)
    mb = h.table_size_mb(None, index)
    return round(ms, 1), mb


data = {'runs': RUNS}
try:
    h.up()
    env = h.environment()
    data['note'] = (f"PostgreSQL 16.15 · pgvector {env['vector_version']} (timescale/timescaledb-ha:pg16) · "
                    f"shared_buffers {env['shared_buffers']} · maintenance_work_mem {env['maintenance_work_mem']} · "
                    f"CPU {env['cpu_count']}. 질의는 병렬 없이(max_parallel_workers_per_gather=0) 측정. 시간은 실행마다 달라진다.")

    # ---- 데이터 ------------------------------------------------------------------
    h.sql('SELECT setseed(0.5);\n' + GEN.format(clusters=CLUSTERS, dim=DIM, table='pts', rows=ROWS))
    h.sql(f"""CREATE TABLE qs (id bigint PRIMARY KEY, embedding vector({DIM}));
INSERT INTO qs SELECT v, array_agg(ce.x + (random() - 0.5) * 0.4 ORDER BY ce.d)::vector
  FROM generate_series(1, {NQ}) v JOIN centers ce ON ce.c = (v * 7) % {CLUSTERS} GROUP BY v;
VACUUM ANALYZE pts; VACUUM ANALYZE qs;
SET enable_indexscan = off; SET enable_bitmapscan = off;
CREATE TABLE truth AS {ANN.format(qs='qs', t='pts')};""")
    data['dataset'] = {
        'rows': ROWS, 'dim': DIM, 'clusters': CLUSTERS, 'queries': NQ,
        'distinct_vectors': int(h.scalar('SELECT count(DISTINCT embedding) FROM pts;')),
        'table_mb': h.table_size_mb('pts'),
        'generate_sql': GEN.format(clusters=CLUSTERS, dim=DIM, table='pts', rows=ROWS),
    }
    assert data['dataset']['distinct_vectors'] == ROWS, '생성 SQL 이 같은 벡터를 반복했다'

    # 인덱스 없이(정확한 검색) — 비교 기준선
    bufs, ms = plan_cost('SET max_parallel_workers_per_gather = 0;\n', ANN.format(qs='qs', t='pts'), 'qs')
    data['exact'] = {'buffers_per_query': bufs, 'ms_per_query': ms}

    # ---- IVFFlat: lists × probes -------------------------------------------------
    ivf = []
    for lists in (20, 141, 500):           # rows/1000 · √rows · 극단적으로 잘게
        for run in range(RUNS):
            ms, mb = build(f'CREATE INDEX ivf ON pts USING ivfflat (embedding vector_l2_ops) WITH (lists = {lists});', 'ivf')
            for probes in (1, 2, 4, 8, 16, 32):
                if probes > lists:
                    continue
                r = measure(f'SET ivfflat.probes = {probes};\n')
                ivf.append({'lists': lists, 'run': run, 'probes': probes, 'build_ms': ms, 'index_mb': mb, **r})
            h.sql('DROP INDEX ivf;')
    data['ivfflat'] = ivf

    # ---- HNSW: m, ef_construction, ef_search ------------------------------------
    hn = []
    efc_err = 'CREATE INDEX ON pts USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 16);'
    try:
        h.sql(efc_err)
        raise AssertionError('ef_construction < 2*m 이 통과했다')
    except RuntimeError as e:
        data['efc_error'] = {'sql': efc_err, 'output': str(e).strip()}
    for m, efc in ((4, 64), (8, 64), (16, 64), (32, 64), (16, 32), (16, 200)):
        for run in range(RUNS):
            ms, mb = build(f'CREATE INDEX hn ON pts USING hnsw (embedding vector_l2_ops) WITH (m = {m}, ef_construction = {efc});', 'hn')
            for ef in (10, 20, 40, 100, 200):
                r = measure(f'SET hnsw.ef_search = {ef};\n')
                hn.append({'m': m, 'ef_construction': efc, 'run': run, 'ef_search': ef, 'build_ms': ms, 'index_mb': mb, **r})
            h.sql('DROP INDEX hn;')
    data['hnsw'] = hn

    # ---- 분포가 바뀌면: 무리 0~49 로 만든 뒤 50~99 를 넣는다 --------------------------
    h.sql(f"""CREATE TABLE half (LIKE pts INCLUDING ALL);
INSERT INTO half SELECT * FROM pts WHERE cluster < 50;
CREATE TABLE qs_new (id bigint PRIMARY KEY, embedding vector({DIM}));
INSERT INTO qs_new SELECT id, embedding FROM qs WHERE (id * 7) % {CLUSTERS} >= 50;
VACUUM ANALYZE half; VACUUM ANALYZE qs_new;""")
    nq_new = int(h.scalar('SELECT count(*) FROM qs_new;'))
    shift = []
    for kind, ddl in (('ivfflat', 'CREATE INDEX sh ON half USING ivfflat (embedding vector_l2_ops) WITH (lists = 20);'),
                      ('hnsw', 'CREATE INDEX sh ON half USING hnsw (embedding vector_l2_ops);')):
        setting = 'SET ivfflat.probes = 2;\n' if kind == 'ivfflat' else 'SET hnsw.ef_search = 40;\n'
        for run in range(RUNS):
            h.sql('TRUNCATE half;\nINSERT INTO half SELECT * FROM pts WHERE cluster < 50;\n' + ddl)
            h.sql('INSERT INTO half SELECT * FROM pts WHERE cluster >= 50;\nVACUUM ANALYZE half;')
            h.sql(f"""DROP TABLE IF EXISTS truth_new;
SET enable_indexscan = off; SET enable_bitmapscan = off;
CREATE TABLE truth_new AS {ANN.format(qs='qs_new', t='half')};""")
            before = measure(setting, t='half', qs='qs_new', truth='truth_new')
            h.sql('REINDEX INDEX sh;')
            after = measure(setting, t='half', qs='qs_new', truth='truth_new')
            shift.append({'index': kind, 'run': run, 'setting': setting.strip(), 'before_reindex': before, 'after_reindex': after})
            h.sql('DROP INDEX sh;')
    data['shift'] = {'queries': nq_new, 'results': shift}

    # ---- 지우고 VACUUM: 인덱스 종류별 VACUUM 시간 ----------------------------------
    vac = []
    for kind, ddl in (('없음', ''),
                      ('IVFFlat', 'CREATE INDEX dv ON del USING ivfflat (embedding vector_l2_ops) WITH (lists = 20);'),
                      ('HNSW', 'CREATE INDEX dv ON del USING hnsw (embedding vector_l2_ops);')):
        for run in range(RUNS):
            h.sql('DROP TABLE IF EXISTS del;\nCREATE TABLE del AS SELECT * FROM pts;\nALTER TABLE del ADD PRIMARY KEY (id);\n'
                  'ALTER TABLE del SET (autovacuum_enabled = off);\n' + ddl)
            h.sql('DELETE FROM del WHERE id % 5 = 0;')
            ms, _ = timed('VACUUM del;')
            vac.append({'index': kind, 'run': run, 'vacuum_ms': round(ms, 1)})
    data['vacuum'] = {'deleted_fraction': 0.2, 'results': vac}

    # ---- maintenance_work_mem 이 그래프를 못 담으면 ----------------------------------
    mwm = []
    for setting in ('1GB', '1MB'):
        for run in range(RUNS):
            ms, out = timed(f"SET maintenance_work_mem = '{setting}';\nSET max_parallel_maintenance_workers = 0;\n"
                            'CREATE INDEX mw ON pts USING hnsw (embedding vector_l2_ops);')
            notice = [ln.strip() for ln in out.splitlines() if ln.startswith(('NOTICE', 'DETAIL'))]
            mwm.append({'maintenance_work_mem': setting, 'run': run, 'build_ms': round(ms, 1), 'notice': notice})
            h.sql('DROP INDEX mw;')
    data['mwm'] = {'sql': "SET maintenance_work_mem = '1MB';\nSET max_parallel_maintenance_workers = 0;\n"
                          'CREATE INDEX ON pts USING hnsw (embedding vector_l2_ops);',
                   'results': mwm}

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print(f'→ {OUT.relative_to(OWNER)} 갱신')
finally:
    h.down()
