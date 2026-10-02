#!/usr/bin/env python3
"""실험 01 — 같은 속성 묶음을 hstore, jsonb, 행 단위(EAV)로 저장했을 때의 크기.

키 개수 K ∈ {5, 20, 100, 500}, 값 종류 2가지(낮은 엔트로피 / 높은 엔트로피)를 각각 새 테이블에 넣고
행당 저장 크기, 힙·TOAST·전체 크기, 압축 여부를 잰다. 값은 결정적으로 생성하므로 반복해도 같아야 한다.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, scalar, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
REPETITIONS = int(os.environ.get('REPETITIONS', '3'))
RESULTS.mkdir(parents=True, exist_ok=True)

KEY_COUNTS = (5, 20, 100, 500)
ROWS = {5: 5000, 20: 5000, 100: 5000, 500: 2000}
PROFILES = {
    # 색상·크기처럼 값의 가짓수가 적은 속성. 압축이 잘 된다.
    'low': "(ARRAY['red','green','blue','black','white','small','medium','large','cotton','steel'])[1 + (i * 7 + k * 13) % 10]",
    # 해시처럼 무작위에 가까운 값. 압축이 거의 안 된다.
    'high': "substr(md5(i::text || ':' || k::text), 1, 12)",
}


def compression_probe():
    """압축이 갈리는 이유를 가르는 대조 측정.

    (1) 같은 값을 lz4로 압축해도 hstore와 jsonb가 갈리는가.
    (2) 같은 키·값 문자열에 '길이 배열'을 붙인 것과 '끝 위치(누적 offset) 배열'을 붙인 것을
        bytea로 만들어 pglz로 압축하면 크기가 어떻게 갈리는가. hstore의 HEntry는 끝 위치(offset),
        jsonb의 JEntry는 대부분 길이를 담는다.
    """
    sql("""
    DROP TABLE IF EXISTS p_hs_lz4, p_jb_lz4, p_layout;
    CREATE TABLE p_hs_lz4 (id int, attrs hstore COMPRESSION lz4);
    CREATE TABLE p_jb_lz4 (id int, attrs jsonb COMPRESSION lz4);
    INSERT INTO p_hs_lz4 SELECT id, attrs FROM t_hs;
    INSERT INTO p_jb_lz4 SELECT id, attrs FROM t_jb;
    CREATE TABLE p_layout (id int, kind text, payload bytea);
    WITH items AS (            -- 행마다 key1,value1,key2,value2,... 순서의 조각과 길이·누적 끝 위치
      SELECT i, ord, piece, octet_length(piece) AS len,
             sum(octet_length(piece)) OVER (PARTITION BY i ORDER BY ord) AS endpos
      FROM (SELECT i, (row_number() OVER (PARTITION BY i ORDER BY key)) * 2 - 1 AS ord, convert_to(key, 'UTF8') AS piece FROM src
            UNION ALL
            SELECT i, (row_number() OVER (PARTITION BY i ORDER BY key)) * 2, convert_to(value, 'UTF8') FROM src) u
    ), agg AS (
      SELECT i,
             string_agg(int4send(endpos::int), ''::bytea ORDER BY ord) AS offsets,
             string_agg(int4send(len), ''::bytea ORDER BY ord)         AS lengths,
             string_agg(piece, ''::bytea ORDER BY ord)                 AS strings
      FROM items GROUP BY i
    )
    INSERT INTO p_layout SELECT i, 'offsets', offsets || strings FROM agg
    UNION ALL SELECT i, 'lengths', lengths || strings FROM agg;
    """)
    out = {}
    out['lz4_hstore_avg'] = int(scalar('SELECT round(avg(pg_column_size(attrs))) FROM p_hs_lz4'))
    out['lz4_jsonb_avg'] = int(scalar('SELECT round(avg(pg_column_size(attrs))) FROM p_jb_lz4'))
    for method in ('pglz', 'lz4'):
        sql(f"""
        CREATE TABLE p_layout_{method} (id int, kind text, payload bytea COMPRESSION {method});
        INSERT INTO p_layout_{method} SELECT * FROM p_layout;
        """)
        for kind in ('offsets', 'lengths'):
            out[f'layout_{kind}_{method}_avg'] = int(scalar(
                f"SELECT round(avg(pg_column_size(payload))) FROM p_layout_{method} WHERE kind = '{kind}'"))
    out['layout_raw_avg'] = int(scalar("SELECT round(avg(octet_length(payload))) FROM p_layout WHERE kind = 'offsets'"))
    sql('DROP TABLE p_layout_pglz, p_layout_lz4;')
    return out


def measure(kcount, profile):
    n = ROWS[kcount]
    val = PROFILES[profile]
    sql(f"""
    DROP TABLE IF EXISTS t_hs, t_jb, t_eav, src;
    CREATE TABLE t_hs (id int PRIMARY KEY, attrs hstore);
    CREATE TABLE t_jb (id int PRIMARY KEY, attrs jsonb);
    CREATE TABLE t_eav (id int, k text, v text, PRIMARY KEY (id, k));
    CREATE TABLE src AS
      SELECT i, 'attr_' || lpad(k::text, 3, '0') AS key, {val} AS value
      FROM generate_series(1, {n}) i, generate_series(1, {kcount}) k;
    INSERT INTO t_hs SELECT i, hstore(array_agg(key), array_agg(value)) FROM src GROUP BY i;
    INSERT INTO t_jb SELECT i, jsonb_object_agg(key, value) FROM src GROUP BY i;
    INSERT INTO t_eav SELECT i, key, value FROM src;
    VACUUM (ANALYZE) t_hs, t_jb, t_eav;
    """)
    res = {}
    for name in ('t_hs', 't_jb'):
        r = rows(f"""
        SELECT round(avg(pg_column_size(attrs)))::int AS avg_column_bytes,
               max(pg_column_size(attrs)) AS max_column_bytes,
               round(avg(length(attrs::text)))::int AS avg_text_bytes,
               count(*) FILTER (WHERE pg_column_compression(attrs) IS NOT NULL) AS compressed_rows,
               pg_relation_size('{name}') AS heap_bytes,
               coalesce(pg_relation_size((SELECT reltoastrelid FROM pg_class WHERE oid = '{name}'::regclass)), 0) AS toast_bytes,
               pg_total_relation_size('{name}') AS total_bytes
        FROM {name}""")[0]
        res[name[2:]] = r
    res['eav'] = rows("""
        SELECT pg_relation_size('t_eav') AS heap_bytes, 0 AS toast_bytes,
               pg_total_relation_size('t_eav') AS total_bytes,
               (SELECT count(*) FROM t_eav) AS rows""")[0]
    # 압축되기 전의 이론 크기: varlena 헤더 4 + size_ 4 + HEntry 4바이트 × 2K + 문자열 길이 합.
    # 디스크에는 raw가 130바이트 이하면 1바이트 짧은 헤더로 저장되므로 3바이트가 줄어든다.
    formula = rows(f"""
        SELECT pg_column_size(attrs) AS actual,
               pg_column_compression(attrs) AS compression,
               8 + 8 * {kcount} + (SELECT sum(length(key) + length(value)) FROM src WHERE i = 1) AS raw
        FROM t_hs WHERE id = 1""")[0]
    # 저장 형태: 짧은 헤더(-3) / 그대로 인라인 / 압축되지 않은 채 TOAST 테이블로 나감(-4, 헤더 제외 크기) / 압축
    raw, actual = formula['raw'], formula['actual']
    if formula['compression'] is not None:
        formula['form'] = 'compressed'
    elif actual == raw - 3 and raw <= 130:
        formula['form'] = 'inline-short-header'
    elif actual == raw:
        formula['form'] = 'inline'
    elif actual == raw - 4:
        formula['form'] = 'external-uncompressed'
    else:
        formula['form'] = 'unexplained'
    res['formula'] = formula
    if kcount >= 100:
        res['compression_probe'] = compression_probe()
    res['rows'] = n
    res['keys'] = kcount
    res['profile'] = profile
    return res


for repetition in range(1, REPETITIONS + 1):
    try:
        up()
        env = environment()
        cells = [measure(k, p) for k in KEY_COUNTS for p in PROFILES]
        for c in cells:
            assert c['formula']['form'] != 'unexplained', c['formula']
        save(RESULTS / f'{repetition}.json', {'environment': env, 'repetition': repetition, 'cells': cells})
        print(f'run {repetition}: ' + ', '.join(
            f"K={c['keys']}/{c['profile']} hs={c['hs']['avg_column_bytes']}B jb={c['jb']['avg_column_bytes']}B"
            for c in cells), flush=True)
    finally:
        down()
