#!/usr/bin/env python3
"""실험 03 — 인덱스 종류별 크기·생성 시간·조회 시간·삽입 비용.

같은 20만 행(속성 12개)을 인덱스 설정별 테이블에 복사해 비교한다.
  none / hstore GIN / hstore GiST(siglen 16, 128) / btree 표현식 ((attrs->'brand')) / jsonb GIN(jsonb_ops, jsonb_path_ops)
쿼리 5종(선택도 0.1%~2.5%)은 모든 설정에서 결과 행 수가 같은지 먼저 검사한 뒤 시간을 잰다.
"""
import json
import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, scalar, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
REPETITIONS = int(os.environ.get('REPETITIONS', '5'))
RESULTS.mkdir(parents=True, exist_ok=True)

N = 200_000
INSERT_ROWS = 20_000

# 인덱스 설정: (테이블 접미사, 컬럼, 인덱스 DDL 또는 None)
CONFIGS = {
    'none':         ('attrs', None),
    'hstore_gin':   ('attrs', 'CREATE INDEX ix ON t_{name} USING gin (attrs)'),
    'hstore_gist16': ('attrs', 'CREATE INDEX ix ON t_{name} USING gist (attrs gist_hstore_ops(siglen=16))'),
    'hstore_gist128': ('attrs', 'CREATE INDEX ix ON t_{name} USING gist (attrs gist_hstore_ops(siglen=128))'),
    'btree_brand':  ('attrs', "CREATE INDEX ix ON t_{name} ((attrs -> 'brand'))"),
    'jsonb_gin':    ('jb', 'CREATE INDEX ix ON t_{name} USING gin (jb)'),
    'jsonb_gin_path': ('jb', 'CREATE INDEX ix ON t_{name} USING gin (jb jsonb_path_ops)'),
}

# (이름, 설명, hstore용 조건, jsonb용 조건)
QUERIES = {
    'contain_2keys_common': ('color=red & size=M (약 2.5%)', "attrs @> 'color=>red,size=>M'", "jb @> '{\"color\":\"red\",\"size\":\"M\"}'"),
    'contain_2keys_narrow': ('brand=brand07 & material=steel (약 0.25%)', "attrs @> 'brand=>brand07,material=>steel'", "jb @> '{\"brand\":\"brand07\",\"material\":\"steel\"}'"),
    'contain_rare_value':   ('sku_grp=g0123 (약 0.1%)', "attrs @> 'sku_grp=>g0123'", "jb @> '{\"sku_grp\":\"g0123\"}'"),
    'key_exists_rare':      ("키 'promo' 존재 (약 0.1%)", "attrs ? 'promo'", "jb ? 'promo'"),
    'equal_expression':     ("attrs->'brand' = 'brand07' (약 2.5%)", "attrs -> 'brand' = 'brand07'", "jb ->> 'brand' = 'brand07'"),
}


def load_base():
    sql(f"""
    DROP TABLE IF EXISTS base;
    CREATE TABLE base AS
    SELECT id,
           hstore(ARRAY['color','size','brand','material','sku_grp','k1','k2','k3','k4','k5','k6'],
                  ARRAY[(ARRAY['red','green','blue','black','white','gray','pink','navy'])[1 + id % 8],
                        (ARRAY['S','M','L','XL','XXL'])[1 + (id / 8) % 5],
                        'brand' || lpad((id % 40)::text, 2, '0'),
                        (ARRAY['steel','cotton','wool','nylon','glass','wood','paper','clay','iron','silk'])[1 + (id / 40) % 10],
                        'g' || lpad((id % 1000)::text, 4, '0'),
                        substr(md5(id::text || 'a'), 1, 8), substr(md5(id::text || 'b'), 1, 8),
                        substr(md5(id::text || 'c'), 1, 8), substr(md5(id::text || 'd'), 1, 8),
                        substr(md5(id::text || 'e'), 1, 8), substr(md5(id::text || 'f'), 1, 8)])
           || CASE WHEN id % 1000 = 7 THEN hstore('promo', 'yes') ELSE ''::hstore END AS attrs
    FROM generate_series(1, {N}) id;
    ALTER TABLE base ADD COLUMN jb jsonb;
    UPDATE base SET jb = hstore_to_jsonb(attrs);
    ALTER TABLE base ADD PRIMARY KEY (id);
    VACUUM (ANALYZE) base;
    """)


def plan_of(table, cond):
    out = sql(f'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM {table} WHERE {cond}')
    root = json.loads(out)[0]
    nodes = []

    def walk(n):
        nodes.append(n)
        for c in n.get('Plans', []):
            walk(c)
    walk(root['Plan'])
    return {
        'ms': root['Execution Time'],
        'nodes': [n['Node Type'] + (f" ({n['Index Name']})" if 'Index Name' in n else '') for n in nodes],
        'recheck_removed': sum(n.get('Rows Removed by Index Recheck', 0) for n in nodes),
        'heap_blocks': sum(n.get('Exact Heap Blocks', 0) + n.get('Lossy Heap Blocks', 0) for n in nodes),
        'shared_hit': root['Plan'].get('Shared Hit Blocks', 0),
        'shared_read': root['Plan'].get('Shared Read Blocks', 0),
    }


def measure_config(name):
    column, ddl = CONFIGS[name]
    table = f't_{name}'
    sql(f'DROP TABLE IF EXISTS {table}; CREATE TABLE {table} AS SELECT * FROM base;')
    build_s = 0.0
    if ddl:
        t0 = time.monotonic()
        sql(ddl.format(name=name))
        build_s = time.monotonic() - t0
    sql(f'VACUUM (ANALYZE) {table};')
    idx_bytes = int(scalar(f"SELECT pg_indexes_size('{table}')")) if ddl else 0
    result = {'index_bytes': idx_bytes, 'build_seconds': build_s,
              'table_bytes': int(scalar(f"SELECT pg_relation_size('{table}')")), 'queries': {}}
    for qname, (_desc, hcond, jcond) in QUERIES.items():
        cond = jcond if column == 'jb' else hcond
        count = int(scalar(f'SELECT count(*) FROM {table} WHERE {cond}'))
        plans = [plan_of(table, cond) for _ in range(8)]
        plans = plans[1:]                                 # 첫 실행은 캐시 적재
        best = sorted(plans, key=lambda p: p['ms'])[len(plans) // 2]
        result['queries'][qname] = {'rows': count, 'ms': best['ms'], 'plan': best['nodes'],
                                    'recheck_removed': best['recheck_removed'], 'heap_blocks': best['heap_blocks']}
    # 삽입 비용: 새 행 2만 개. 인덱스 유지 비용이 그대로 드러난다.
    lsn = scalar('SELECT pg_current_wal_lsn();')
    t0 = time.monotonic()
    sql(f"INSERT INTO {table} SELECT id + 1000000, attrs, jb FROM base LIMIT {INSERT_ROWS};")
    result['insert_seconds'] = time.monotonic() - t0
    result['insert_wal_bytes'] = int(scalar(f"SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '{lsn}')"))
    sql(f'DROP TABLE {table};')
    return result


for repetition in range(1, REPETITIONS + 1):
    try:
        up()
        env = environment()
        load_base()
        base_bytes = rows("SELECT pg_relation_size('base') AS heap, round(avg(pg_column_size(attrs)))::int AS hstore_col, round(avg(pg_column_size(jb)))::int AS jsonb_col FROM base")[0]
        result = {name: measure_config(name) for name in CONFIGS}
        # 정합성: 같은 조건은 어떤 설정에서도 같은 행 수여야 한다 (hstore끼리·jsonb끼리·서로도)
        for q in QUERIES:
            counts = {name: result[name]['queries'][q]['rows'] for name in CONFIGS}
            assert len(set(counts.values())) == 1, (q, counts)
        save(RESULTS / f'{repetition}.json', {'environment': env, 'repetition': repetition, 'rows': N,
                                               'insert_rows': INSERT_ROWS, 'base': base_bytes, 'configs': result,
                                               'queries': {q: v[0] for q, v in QUERIES.items()}})
        pick = lambda n, q: f"{result[n]['queries'][q]['ms']:.1f}ms"
        print(f"run {repetition}: contain_2keys_common none={pick('none','contain_2keys_common')} "
              f"gin={pick('hstore_gin','contain_2keys_common')} gist16={pick('hstore_gist16','contain_2keys_common')} "
              f"jsonb_gin={pick('jsonb_gin','contain_2keys_common')}", flush=True)
    finally:
        down()
