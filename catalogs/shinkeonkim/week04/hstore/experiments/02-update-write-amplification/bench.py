#!/usr/bin/env python3
"""실험 02 — 키 하나를 바꿀 때 쓰이는 양(쓰기 증폭).

행 1000개, 키 개수 K ∈ {5, 50, 500}. 각 행의 키 하나(`attr_001`)의 값을 바꾸는 UPDATE를 행마다 한 번씩 실행한다.
비교 대상: hstore(`||`), hstore(첨자 h['k']=), jsonb(jsonb_set), 열 K개인 일반 테이블(열 하나), EAV(행 하나).

측정: UPDATE 1건당 WAL 바이트, 힙과 TOAST 증가량, HOT 갱신 비율, GIN 인덱스가 있을 때의 차이.
autovacuum은 테이블 단위로 꺼서 죽은 튜플이 회수되지 않은 상태를 그대로 잰다. 체크포인트가 끼지 않도록
런타임 설정(max_wal_size=8GB, checkpoint_timeout=1h)을 쓰고, 1차 패스로 페이지를 먼저 건드려
전체 페이지 쓰기(FPW)가 측정에 섞이지 않게 한다.
"""
import os
import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, scalar, environment, save, summarize

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
REPETITIONS = int(os.environ.get('REPETITIONS', '5'))
RESULTS.mkdir(parents=True, exist_ok=True)

ROWS = 1000
KEY_COUNTS = (5, 50, 500)
VAL = "substr(md5(i::text || ':' || k::text), 1, 12)"


def setup(kcount):
    cols = ', '.join(f'a{k:03d} text' for k in range(1, kcount + 1))
    col_values = ', '.join(f"substr(md5(i::text || ':{k}'), 1, 12)" for k in range(1, kcount + 1))
    sql(f"""
    DROP TABLE IF EXISTS w_hs, w_hs_gin, w_jb, w_cols, w_eav, src;
    CREATE TABLE src AS
      SELECT i, 'attr_' || lpad(k::text, 3, '0') AS key, {VAL} AS value
      FROM generate_series(1, {ROWS}) i, generate_series(1, {kcount}) k;
    CREATE TABLE w_hs (id int PRIMARY KEY, attrs hstore);
    CREATE TABLE w_hs_gin (id int PRIMARY KEY, attrs hstore);
    CREATE INDEX ON w_hs_gin USING gin (attrs);
    CREATE TABLE w_jb (id int PRIMARY KEY, attrs jsonb);
    CREATE TABLE w_cols (id int PRIMARY KEY, {cols});
    CREATE TABLE w_eav (id int, k text, v text, PRIMARY KEY (id, k));
    INSERT INTO w_hs SELECT i, hstore(array_agg(key), array_agg(value)) FROM src GROUP BY i;
    INSERT INTO w_hs_gin SELECT * FROM w_hs;
    INSERT INTO w_jb SELECT i, jsonb_object_agg(key, value) FROM src GROUP BY i;
    INSERT INTO w_cols SELECT i, {col_values} FROM generate_series(1, {ROWS}) i;
    INSERT INTO w_eav SELECT i, key, value FROM src;
    ALTER TABLE w_hs SET (autovacuum_enabled = off);
    ALTER TABLE w_hs_gin SET (autovacuum_enabled = off);
    ALTER TABLE w_jb SET (autovacuum_enabled = off);
    ALTER TABLE w_cols SET (autovacuum_enabled = off);
    ALTER TABLE w_eav SET (autovacuum_enabled = off);
    VACUUM (ANALYZE) w_hs, w_hs_gin, w_jb, w_cols, w_eav;
    CHECKPOINT;
    """)


# 표에 이름을 붙인 UPDATE 문. 모두 행마다 하나의 키(첫 번째 속성)만 바꾼다.
CASES = {
    'hstore_concat': ("w_hs", "UPDATE w_hs SET attrs = attrs || hstore('attr_001', 'x' || {pass_no}::text || substr(md5(id::text), 1, 8)) WHERE id = {i}"),
    'hstore_subscript': ("w_hs", "UPDATE w_hs SET attrs['attr_001'] = 'x' || {pass_no}::text || substr(md5(id::text), 1, 8) WHERE id = {i}"),
    'hstore_concat_gin': ("w_hs_gin", "UPDATE w_hs_gin SET attrs = attrs || hstore('attr_001', 'x' || {pass_no}::text || substr(md5(id::text), 1, 8)) WHERE id = {i}"),
    'jsonb_set': ("w_jb", "UPDATE w_jb SET attrs = jsonb_set(attrs, '{{attr_001}}', to_jsonb('x' || {pass_no}::text || substr(md5(id::text), 1, 8))) WHERE id = {i}"),
    'plain_column': ("w_cols", "UPDATE w_cols SET a001 = 'x' || {pass_no}::text || substr(md5(id::text), 1, 8) WHERE id = {i}"),
    'eav_row': ("w_eav", "UPDATE w_eav SET v = 'x' || {pass_no}::text || substr(md5(id::text), 1, 8) WHERE id = {i} AND k = 'attr_001'"),
}


def exec_ms(query, repeat=7):
    """EXPLAIN ANALYZE의 Execution Time 중앙값(밀리초). 첫 실행은 캐시 적재라 버린다."""
    times = []
    for _ in range(repeat + 1):
        out = sql(f'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) {query}')
        line = [l for l in out.splitlines() if l.startswith('Execution Time')][0]
        times.append(float(line.split(':')[1].replace('ms', '').strip()))
    return sorted(times[1:])[len(times[1:]) // 2]


def read_costs(kcount):
    """행 1000개에서 키 하나(중간 위치)를 읽는 데 걸리는 서버 실행 시간."""
    key = f'attr_{kcount // 2 + 1:03d}'
    col = f'a{kcount // 2 + 1:03d}'
    return {
        'hstore': exec_ms(f"SELECT count(attrs -> '{key}') FROM w_hs"),
        'jsonb': exec_ms(f"SELECT count(attrs ->> '{key}') FROM w_jb"),
        'plain_column': exec_ms(f'SELECT count({col}) FROM w_cols'),
        'eav_row': exec_ms(f"SELECT count(v) FROM w_eav WHERE id BETWEEN 1 AND {ROWS} AND k = '{key}'"),
    }


def toast_size(table):
    return int(scalar(f"SELECT coalesce(pg_relation_size(reltoastrelid), 0) FROM pg_class WHERE oid = '{table}'::regclass"))


def run_case(case, kcount):
    table, template = CASES[case]

    def one_pass(pass_no):
        stmts = ';\n'.join(template.format(i=i, pass_no=pass_no) for i in range(1, ROWS + 1)) + ';'
        return stmts

    sql(one_pass(0))                       # 1차 패스: 페이지를 먼저 건드려 FPW를 소진한다
    before = {
        'lsn': scalar('SELECT pg_current_wal_lsn();'),
        'heap': int(scalar(f"SELECT pg_relation_size('{table}')")),
        'toast': toast_size(table),
        'index': int(scalar(f"SELECT pg_indexes_size('{table}')")),
    }
    stats0 = rows(f"SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables WHERE relname = '{table}'")[0]
    checkpoints0 = int(scalar('SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter'))

    t0 = time.monotonic()
    sql(one_pass(1))                       # 2차 패스: 측정 대상
    elapsed = time.monotonic() - t0
    wal = int(scalar(f"SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '{before['lsn']}')"))
    # 통계는 백엔드가 종료될 때 반영되므로 잠깐 기다린다
    sql('SELECT pg_sleep(1.2);')
    stats1 = rows(f"SELECT n_tup_upd, n_tup_hot_upd, n_dead_tup FROM pg_stat_user_tables WHERE relname = '{table}'")[0]
    after_heap = int(scalar(f"SELECT pg_relation_size('{table}')"))
    after_toast = toast_size(table)
    upd = stats1['n_tup_upd'] - stats0['n_tup_upd']
    hot = stats1['n_tup_hot_upd'] - stats0['n_tup_hot_upd']
    assert upd == ROWS, (case, upd)
    # 측정 구간에 체크포인트가 끼면 FPW가 WAL에 섞인다. 끼었다면 그 회차는 무효다.
    assert int(scalar('SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter')) == checkpoints0, 'checkpoint during measurement'
    return {
        'wal_bytes_per_update': wal / ROWS,
        'heap_growth_bytes': after_heap - before['heap'],
        'toast_growth_bytes': after_toast - before['toast'],
        'hot_ratio': hot / upd,
        'seconds_per_1000_updates': elapsed,
        'dead_tuples': stats1['n_dead_tup'],
    }


for repetition in range(1, REPETITIONS + 1):
    try:
        up()
        env = environment()
        result = {}
        for kcount in KEY_COUNTS:
            setup(kcount)
            result[kcount] = {}
            result[kcount]['read_ms_1000_rows'] = read_costs(kcount)
            for case in CASES:
                # EAV는 K가 커져도 행 하나만 바뀐다. 다른 방식과 같은 순서로 측정한다.
                result[kcount][case] = run_case(case, kcount)
            width = rows(f"SELECT round(avg(pg_column_size(attrs)))::int AS avg_bytes FROM w_hs")[0]['avg_bytes']
            result[kcount]['hstore_avg_column_bytes'] = width
        save(RESULTS / f'{repetition}.json', {'environment': env, 'repetition': repetition, 'rows': ROWS, 'cases': result})
        line = ', '.join(
            f"K={k}: hs {result[k]['hstore_concat']['wal_bytes_per_update']:.0f}B / jsonb {result[k]['jsonb_set']['wal_bytes_per_update']:.0f}B / eav {result[k]['eav_row']['wal_bytes_per_update']:.0f}B"
            for k in KEY_COUNTS)
        print(f'run {repetition}: {line}', flush=True)
    finally:
        down()
