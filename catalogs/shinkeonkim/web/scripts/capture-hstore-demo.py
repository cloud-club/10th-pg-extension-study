#!/usr/bin/env python3
"""hstore 페이지에 싣는 SQL 예제와 실제 출력을 전용 임시 DB에서 실행해 src/data/hstore-demo.json 으로 저장한다.

    python3 scripts/capture-hstore-demo.py

페이지의 코드 블록은 모두 이 파일의 결과(`demo.<이름>.sql` / `.output`)만 쓴다.
출력에 들어가는 PID·경과 시간은 실행마다 달라질 수 있다.
"""
import json
from pathlib import Path
import sys

OWNER = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(OWNER / 'week04/hstore/experiments/runtime'))
import harness as h  # noqa: E402

h.COMPOSE += ['-p', 'hstore-demo-capture']
OUT = OWNER / 'web/src/data/hstore-demo.json'
LAB04 = OWNER / 'week04/hstore/labs/04-concurrency/scripts'


def capture(sql, db='study'):
    """실행하고 aligned 표 출력을 그대로 저장한다."""
    return {'sql': sql, 'output': h.sql('\\pset format aligned\n\\pset tuples_only off\n' + sql, db=db)}


def capture_error(sql, db='study'):
    """실패해야 하는 문장. 오류 메시지를 출력으로 저장한다. 성공하면 예제가 틀린 것이다."""
    try:
        h.sql(sql, db=db)
    except RuntimeError as e:
        return {'sql': sql, 'output': str(e).strip()}
    raise AssertionError('오류가 나야 하는 예제가 성공했다: ' + sql)


def run(sql, db='study'):
    """출력이 필요 없는 준비 문장."""
    h.sql(sql, db=db)
    return sql


def shell(command):
    proc = h._compose('exec', '-T', 'postgres', 'bash', '-c', command, text=True, capture_output=True)
    return proc.stdout.strip() + (('\n' + proc.stderr.strip()) if proc.stderr.strip() else '')


demo = {}
try:
    h.up(extension=False)
    demo['note'] = ('PostgreSQL 16.15 · hstore 1.8 · 별도 임시 study DB에서 실측. '
                    'PID·경과 시간·물리 크기는 실행마다 달라질 수 있다.')

    # ---- 설치 -----------------------------------------------------------------
    demo['available'] = capture("""SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'hstore';""")
    demo['trusted'] = capture("""SELECT name, version, trusted, relocatable
FROM pg_available_extension_versions WHERE name = 'hstore';""")
    demo['create'] = run('CREATE EXTENSION hstore;')
    demo['objects'] = capture("""SELECT classid::regclass AS kind, count(*) AS n
FROM pg_depend
WHERE refclassid = 'pg_extension'::regclass
  AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'hstore')
  AND deptype = 'e'
GROUP BY 1 ORDER BY 2 DESC;""")

    # ---- 리터럴 ---------------------------------------------------------------
    demo['literal_basic'] = capture("""SELECT 'a=>1, b=>2'::hstore AS basic,
       '  a  =>  1 ,   b=>2 '::hstore AS whitespace_ignored;""")
    demo['literal_quoted'] = capture("""SELECT '"key with space"=>"value, with comma"'::hstore AS quoted;
SELECT 'say=>"he said \\"hi\\""'::hstore AS escaped_quote;""")
    demo['literal_sorted'] = capture("SELECT 'ccc=>1, b=>2, aa=>3, ab=>4'::hstore AS sorted;")
    demo['literal_duplicate'] = capture("SELECT 'a=>1, a=>2'::hstore AS duplicate_key;")
    demo['literal_nulls'] = capture("""SELECT h -> 'a' IS NULL AS a_null, h -> 'b' IS NULL AS b_null,
       h -> 'c' IS NULL AS c_null, exist(h, 'a') AS a_exists, defined(h, 'a') AS a_defined
FROM (SELECT 'a=>NULL, b=>"NULL", c=>""'::hstore AS h) s;""")
    demo['text_type'] = capture("""SELECT pg_typeof('n=>42'::hstore -> 'n') AS value_type,
       ('n=>42'::hstore -> 'n')::int + 1 AS after_cast;""")
    demo['text_type_error'] = capture_error("SELECT ('n=>42'::hstore -> 'n') + 1;")

    # ---- 연산자와 함수 -----------------------------------------------------------
    demo['setup_product'] = run("""CREATE TABLE product (id serial PRIMARY KEY, name text NOT NULL, attrs hstore NOT NULL DEFAULT '');
INSERT INTO product (name, attrs) VALUES
  ('shirt',  'color=>red,   size=>M, material=>cotton'),
  ('mug',    'color=>white, capacity=>350ml, material=>ceramic'),
  ('laptop', 'brand=>acme,  ram=>16GB, ssd=>512GB, color=>silver'),
  ('hoodie', 'color=>red,   size=>L, material=>cotton, promo=>yes');""")
    demo['op_fetch'] = capture("""SELECT name, attrs -> 'color' AS color,
       attrs -> ARRAY['color', 'size'] AS color_and_size
FROM product ORDER BY id;""")
    demo['op_exists'] = capture("""SELECT name FROM product WHERE attrs ? 'promo';
SELECT name FROM product WHERE attrs ?& ARRAY['color', 'size'] ORDER BY id;
SELECT name FROM product WHERE attrs ?| ARRAY['ram', 'capacity'] ORDER BY id;""")
    demo['op_contains'] = capture("""SELECT name FROM product WHERE attrs @> 'color=>red' ORDER BY id;
SELECT name FROM product WHERE attrs @> 'color=>red, material=>cotton' ORDER BY id;
SELECT 'color=>red'::hstore <@ (SELECT attrs FROM product WHERE id = 1) AS contained;""")
    demo['op_merge'] = capture("""SELECT attrs || 'color=>blue, stock=>10' AS merged
FROM product WHERE id = 1;""")
    demo['op_delete'] = capture("""SELECT attrs - 'material'::text AS del_key,
       attrs - ARRAY['material', 'size'] AS del_keys,
       attrs - 'color=>red, size=>XL'::hstore AS del_pairs
FROM product WHERE id = 1;""")
    demo['op_delete_error'] = capture_error("SELECT attrs - 'material' FROM product WHERE id = 1;")
    demo['fn_keys_vals'] = capture("""SELECT akeys(attrs) AS keys, avals(attrs) AS vals FROM product WHERE id = 1;
SELECT (each(attrs)).key, (each(attrs)).value FROM product WHERE id = 1;""")
    demo['fn_build'] = capture("""SELECT hstore(ARRAY['a', 'b'], ARRAY['1', '2']) AS from_arrays,
       hstore('k', 'v') AS one_pair;
SELECT hstore(p) AS from_record FROM product p WHERE id = 1;
SELECT hstore(array_agg(name), array_agg(attrs -> 'color')) AS name_to_color FROM product;""")
    demo['fn_populate'] = capture("""CREATE TYPE spec AS (color text, size text, ram text);
SELECT * FROM populate_record(NULL::spec, (SELECT attrs FROM product WHERE id = 3));""")
    demo['fn_key_stats'] = capture("""SELECT k AS attr, count(*) AS rows
FROM product, LATERAL skeys(attrs) AS k
GROUP BY k ORDER BY rows DESC, attr;""")

    # ---- 첨자와 갱신 ----------------------------------------------------------------
    demo['sub_read'] = capture("""SELECT extversion FROM pg_extension WHERE extname = 'hstore';
SELECT name, attrs['color'] AS color FROM product ORDER BY id;""")
    demo['sub_write'] = capture("""UPDATE product SET attrs['color'] = 'blue', attrs['stock'] = '7' WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;""")
    demo['upd_concat'] = capture("""UPDATE product SET attrs = attrs || 'color=>green, size=>XL, stock=>3' WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;""")
    demo['upd_delete'] = capture("""UPDATE product SET attrs = attrs - 'stock'::text WHERE id = 1;
SELECT name, attrs FROM product WHERE id = 1;""")
    demo['upd_counter'] = capture("""UPDATE product
SET attrs = attrs || hstore('views', (coalesce((attrs -> 'views')::int, 0) + 1)::text)
WHERE id = 2
RETURNING attrs -> 'views' AS views;""")
    demo['sub_null_error'] = capture_error("UPDATE product SET attrs[NULL] = 'x' WHERE id = 1;")

    # ---- json / jsonb 변환 ------------------------------------------------------------
    demo['to_json'] = capture("""SELECT hstore_to_json('n=>42, t=>true, s=>hello, z=>NULL') AS json_strict;
SELECT hstore_to_jsonb('n=>42, t=>true, s=>hello, z=>NULL') AS jsonb_strict;""")
    demo['to_jsonb_loose'] = capture("""SELECT hstore_to_jsonb_loose('n=>42, flag=>t, off=>f, word=>true, s=>hello, z=>NULL, ver=>1.10, zip=>007') AS jsonb_loose;""")
    demo['jsonb_to_hstore'] = capture("""WITH src AS (
  SELECT '{"a": 1, "b": true, "c": [1, 2], "d": {"x": 1}}'::jsonb AS j
)
SELECT hstore(array_agg(key), array_agg(value)) AS as_hstore
FROM src, LATERAL jsonb_each_text(src.j);""")
    demo['jsonb_order'] = capture("""SELECT '{"ccc": 1, "b": 2, "aa": 3, "b": 9}'::jsonb AS jsonb_value,
       'ccc=>1, b=>2, aa=>3, b=>9'::hstore AS hstore_value;""")
    demo['sort_text'] = capture("""SELECT h -> 'n' AS as_text
FROM unnest(ARRAY['n=>9', 'n=>10', 'n=>2']::hstore[]) AS h
ORDER BY h -> 'n';
SELECT h -> 'n' AS as_int
FROM unnest(ARRAY['n=>9', 'n=>10', 'n=>2']::hstore[]) AS h
ORDER BY (h -> 'n')::int;""")

    # ---- Redis 해시처럼 쓰기 -----------------------------------------------------------
    demo['kv_setup'] = run("CREATE TABLE kv (k text PRIMARY KEY, h hstore NOT NULL DEFAULT '');")
    demo['kv_hset'] = capture("""-- HSET user:1 name Kim age 30  (키가 있으면 필드를 합치고, 없으면 만든다)
INSERT INTO kv VALUES ('user:1', 'name=>Kim, age=>30')
ON CONFLICT (k) DO UPDATE SET h = kv.h || EXCLUDED.h
RETURNING k, h;""")
    demo['kv_hget'] = capture("""SELECT h -> 'name' AS hget_name, h ? 'age' AS hexists_age,
       akeys(h) AS hkeys, avals(h) AS hvals, array_length(akeys(h), 1) AS hlen
FROM kv WHERE k = 'user:1';""")
    demo['kv_hincrby'] = capture("""-- HINCRBY user:1 age 1
UPDATE kv SET h = h || hstore('age', ((h -> 'age')::int + 1)::text)
WHERE k = 'user:1'
RETURNING h -> 'age' AS age;""")
    demo['kv_hgetall'] = capture("""-- HGETALL user:1
SELECT (each(h)).* FROM kv WHERE k = 'user:1';""")
    demo['kv_hdel'] = capture("""-- HDEL user:1 age
UPDATE kv SET h = h - 'age'::text WHERE k = 'user:1' RETURNING h;""")

    # ---- 저장 구조 (pageinspect) ---------------------------------------------------------
    demo['st_setup'] = run("""CREATE EXTENSION pageinspect;
CREATE TABLE s (id int, attrs hstore);
INSERT INTO s VALUES (1, 'ccc=>333, aa=>1, b=>NULL, aa=>9');""")
    demo['st_logical'] = capture("SELECT attrs, pg_column_size(attrs) AS stored_bytes FROM s;")
    demo['st_hex'] = capture("""SELECT t_hoff, encode(substring(t_data FROM 5), 'hex') AS hstore_hex
FROM heap_page_items(get_raw_page('s', 0));""")
    demo['st_u32'] = run("""CREATE FUNCTION u32(b bytea, off int) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT get_byte(b, off)::bigint + get_byte(b, off + 1)::bigint * 256
       + get_byte(b, off + 2)::bigint * 65536 + get_byte(b, off + 3)::bigint * 16777216
$$;""")
    demo['st_header'] = capture("""WITH raw AS (
  SELECT substring(t_data FROM 5) AS b FROM heap_page_items(get_raw_page('s', 0))
)
SELECT get_byte(b, 0) >> 1                    AS varlena_total_bytes,
       (u32(b, 1) & x'0FFFFFFF'::int)         AS pair_count,
       (u32(b, 1) >> 31) = 1                  AS new_format_flag
FROM raw;""")
    demo['st_entries'] = capture("""WITH raw AS (
  SELECT substring(t_data FROM 5) AS b FROM heap_page_items(get_raw_page('s', 0))
), hdr AS (
  SELECT b, (u32(b, 1) & x'0FFFFFFF'::int)::int AS n FROM raw
), ent AS (
  SELECT g AS i, CASE WHEN g % 2 = 0 THEN 'key' ELSE 'value' END AS role,
         u32(b, 5 + 4 * g) AS e, b, n
  FROM hdr, generate_series(0, 2 * n - 1) g
), pos AS (
  SELECT *, e & x'3FFFFFFF'::int AS end_pos,
         coalesce(lag(e & x'3FFFFFFF'::int) OVER (ORDER BY i), 0) AS start_pos
  FROM ent
)
SELECT i, role, (e >> 31) & 1 AS isfirst, (e >> 30) & 1 AS isnull, end_pos, end_pos - start_pos AS len,
       CASE WHEN (e >> 30) & 1 = 1 THEN NULL
            ELSE convert_from(substring(b FROM (5 + 8 * n + 1 + start_pos)::int FOR (end_pos - start_pos)::int), 'UTF8') END AS text
FROM pos ORDER BY i;""")
    demo['st_formula'] = capture("""SELECT pg_column_size(attrs) AS stored,
       4 + 4 + 4 * 2 * 3 + (1 + 2 + 1 + 3 + 3)     AS raw_by_formula,
       4 + 4 + 4 * 2 * 3 + (1 + 2 + 1 + 3 + 3) - 3 AS short_header_by_formula
FROM s;""")
    demo['st_null_vs_empty'] = capture("""SELECT pg_column_size('a=>NULL'::hstore) AS null_value,
       pg_column_size('a=>""'::hstore)   AS empty_string,
       pg_column_size('a=>x'::hstore)    AS one_char;""")

    # ---- 인덱스 --------------------------------------------------------------------------
    demo['ix_opclasses'] = capture("""SELECT am.amname AS index_method, opc.opcname AS operator_class, amop.amopopr::regoperator AS operator
FROM pg_opclass opc
JOIN pg_am am ON am.oid = opc.opcmethod
JOIN pg_amop amop ON amop.amopfamily = opc.opcfamily AND amop.amoplefttype = 'hstore'::regtype
WHERE opc.opcintype = 'hstore'::regtype
ORDER BY 1, 2, 3;""")
    demo['ix_setup'] = run("""CREATE TABLE item (id int PRIMARY KEY, attrs hstore NOT NULL);
INSERT INTO item
SELECT id,
       hstore(ARRAY['color','size','brand','sku_grp'],
              ARRAY[(ARRAY['red','green','blue','black','white','gray','pink','navy'])[1 + id % 8],
                    (ARRAY['S','M','L','XL','XXL'])[1 + (id / 8) % 5],
                    'brand' || lpad((id % 40)::text, 2, '0'),
                    'g' || lpad((id % 1000)::text, 4, '0')])
       || CASE WHEN id % 1000 = 7 THEN hstore('promo', 'yes') ELSE ''::hstore END
FROM generate_series(1, 100000) id;
INSERT INTO item SELECT 100000 + i, 'shade=>red, color=>blue, sku_grp=>g0007'::hstore FROM generate_series(1, 500) i;
VACUUM (ANALYZE) item;""")
    demo['ix_seq'] = capture("EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';")
    demo['ix_gin_create'] = run('CREATE INDEX item_gin ON item USING gin (attrs);')
    demo['ix_gin_contains'] = capture("EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';")
    demo['ix_gin_exists'] = capture("""EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs ? 'promo';
EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs ?& ARRAY['promo', 'color'];""")
    demo['ix_arrow_seq'] = capture("EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07';")
    demo['ix_recheck'] = capture("""EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM item WHERE attrs @> 'color=>red, sku_grp=>g0007';""")
    demo['ix_expr_create'] = run("CREATE INDEX item_brand ON item ((attrs -> 'brand'));")
    demo['ix_expr'] = capture("EXPLAIN (COSTS OFF) SELECT count(*) FROM item WHERE attrs -> 'brand' = 'brand07';")
    demo['ix_gist_create'] = run("""CREATE INDEX item_gist16 ON item USING gist (attrs gist_hstore_ops(siglen = 16));
CREATE INDEX item_gist128 ON item USING gist (attrs gist_hstore_ops(siglen = 128));""")
    demo['ix_sizes'] = capture("""SELECT c.relname AS index, am.amname AS method, pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c JOIN pg_am am ON am.oid = c.relam
WHERE c.relname LIKE 'item\\_%' ESCAPE '\\' AND c.relkind = 'i'
ORDER BY pg_relation_size(c.oid) DESC;
SELECT pg_size_pretty(pg_relation_size('item')) AS table_heap;""")

    # ---- 운영: 통계·모니터링·승격 ------------------------------------------------------------
    demo['ops_cleanup'] = run('DROP INDEX item_gist16, item_gist128;')
    demo['ops_estimate_contains'] = capture("""EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF) SELECT * FROM item WHERE attrs ? 'promo';
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF) SELECT * FROM item WHERE attrs @> 'sku_grp=>g0007';
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF) SELECT * FROM item WHERE attrs @> 'color=>red';""")
    demo['ops_estimate_expr_before'] = capture("""-- 식 인덱스를 만든 직후, 아직 ANALYZE 전
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF) SELECT * FROM item WHERE attrs -> 'brand' = 'brand07';""")
    demo['ops_analyze'] = run('ANALYZE item;')
    demo['ops_estimate_expr_after'] = capture("""-- ANALYZE 뒤
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF) SELECT * FROM item WHERE attrs -> 'brand' = 'brand07';""")
    demo['ops_monitor'] = capture("""SELECT c.relname,
       pg_size_pretty(pg_relation_size(c.oid)) AS heap,
       pg_size_pretty(coalesce(pg_relation_size(c.reltoastrelid), 0)) AS toast,
       s.n_live_tup, s.n_dead_tup,
       round(100.0 * s.n_tup_hot_upd / nullif(s.n_tup_upd, 0), 1) AS hot_pct
FROM pg_class c JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE c.relname = 'item';""")
    demo['ops_key_width'] = capture("""SELECT count(*) AS rows,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY pg_column_size(attrs)) AS median_bytes,
       max(pg_column_size(attrs)) AS max_bytes,
       max(array_length(akeys(attrs), 1)) AS max_keys
FROM item;""")
    demo['ops_promote_setup'] = run("ALTER TABLE item ADD COLUMN brand text;")
    demo['ops_promote'] = capture("""-- 자주 쓰는 키를 열로 승격: 값을 복사하고 hstore에서는 뺀다
UPDATE item SET brand = attrs -> 'brand', attrs = attrs - 'brand'::text WHERE id <= 5;
SELECT id, brand, attrs FROM item WHERE id <= 3 ORDER BY id;""")

    # ---- 실전 액션: 사용자 설정 테이블로 CRUD 레시피 ------------------------------------------
    demo['crud_setup'] = run("""CREATE TABLE app_user (id serial PRIMARY KEY, email text NOT NULL, settings hstore NOT NULL DEFAULT '');
INSERT INTO app_user (email, settings) VALUES
  ('kim@example.com',   'theme=>dark,  locale=>ko, marketing_email=>off'),
  ('lee@example.com',   'theme=>light, locale=>en, marketing_email=>on, notify_push=>on'),
  ('park@example.com',  'theme=>dark,  locale=>en');""")
    demo['crud_insert_literal'] = capture("""INSERT INTO app_user (email, settings) VALUES ('choi@example.com', 'theme=>dark, locale=>ko')
RETURNING id, email, settings;""")
    demo['crud_insert_from_json'] = capture("""-- API 요청 본문(JSON)을 그대로 hstore 컬럼에 받는다
WITH payload AS (SELECT '{"theme": "dark", "locale": "ja"}'::jsonb AS body)
INSERT INTO app_user (email, settings)
SELECT 'yamada@example.com', hstore(array_agg(key), array_agg(value))
FROM payload, LATERAL jsonb_each_text(payload.body)
RETURNING id, email, settings;""")
    demo['crud_read_one_key'] = capture("""SELECT email, settings -> 'theme' AS theme FROM app_user ORDER BY email;""")
    demo['crud_read_many_keys'] = capture("""SELECT email, settings -> ARRAY['theme', 'locale'] AS theme_and_locale FROM app_user ORDER BY email;""")
    demo['crud_read_key_exists'] = capture("""SELECT email, settings ? 'notify_push' AS has_notify_push FROM app_user ORDER BY email;""")
    demo['crud_read_filter'] = capture("""-- 조건에 맞는 사용자만: 다크 테마 + 마케팅 메일 끔
SELECT email FROM app_user WHERE settings @> 'theme=>dark, marketing_email=>off';""")
    demo['crud_read_reverse'] = capture("""-- "이 값을 가진 사람은 누구?" 역방향 조회
SELECT email FROM app_user WHERE settings @> 'theme=>dark' ORDER BY email;""")
    demo['crud_read_unnest'] = capture("""-- 한 사용자의 설정을 행으로 펼친다 (화면에 표로 보여줄 때)
SELECT (each(settings)).key, (each(settings)).value FROM app_user WHERE email = 'lee@example.com';""")
    demo['crud_read_aggregate'] = capture("""-- 전체 사용자 기준 가장 흔한 설정 키
SELECT key, count(*) AS users FROM app_user, LATERAL skeys(settings) AS key GROUP BY key ORDER BY users DESC, key;""")
    demo['crud_update_merge'] = capture("""-- 키 하나 추가/변경: 나머지는 그대로 둔 채
UPDATE app_user SET settings = settings || 'theme=>light' WHERE email = 'kim@example.com'
RETURNING email, settings;""")
    demo['crud_update_upsert'] = capture("""-- UPSERT: 있으면 설정을 병합, 없으면 새로 만든다
INSERT INTO app_user (id, email, settings) VALUES (1, 'kim@example.com', 'beta=>on')
ON CONFLICT (id) DO UPDATE SET settings = app_user.settings || excluded.settings
RETURNING email, settings;""")
    demo['crud_update_rename_key'] = capture("""-- 키 이름 바꾸기: hstore에 rename이 없어 "꺼내고 새 이름으로 넣고 옛 키 지우기"로 한다
UPDATE app_user
SET settings = (settings - 'locale'::text) || hstore('language', settings -> 'locale')
WHERE email = 'lee@example.com'
RETURNING email, settings;""")
    demo['crud_delete_key'] = capture("""-- 키 하나 삭제
UPDATE app_user SET settings = settings - 'locale'::text WHERE email = 'park@example.com'
RETURNING email, settings;""")
    demo['crud_delete_by_value'] = capture("""-- 값이 특정 조건에 맞는 키만 삭제: hstore가 직접 못 하므로 CASE로 조건부 처리
UPDATE app_user
SET settings = CASE WHEN settings -> 'marketing_email' = 'off' THEN settings - 'marketing_email'::text ELSE settings END
RETURNING email, settings ? 'marketing_email' AS still_has_marketing_email;""")
    demo['crud_delete_by_prefix'] = capture("""-- 접두사로 여러 키 한 번에 삭제: hstore에 패턴 삭제가 없어 each로 걸러 다시 조립한다
UPDATE app_user u
SET settings = coalesce((SELECT hstore(array_agg(key), array_agg(value))
                          FROM each(u.settings) AS kv(key, value) WHERE key NOT LIKE 'notify_%'), '')
WHERE email = 'lee@example.com'
RETURNING email, settings;""")
    demo['crud_delete_clear'] = capture("""-- 컬럼 전체 비우기
UPDATE app_user SET settings = '' WHERE email = 'choi@example.com' RETURNING email, settings;""")

    # ---- 여러 hstore 컬럼을 한 테이블에 두는 경우 -------------------------------------------
    demo['multi_translate_setup'] = run("""CREATE TABLE post (
  id serial PRIMARY KEY,
  title_translations hstore NOT NULL DEFAULT '',
  body_translations hstore NOT NULL DEFAULT ''
);
INSERT INTO post (title_translations, body_translations) VALUES
  ('en=>"Hello", ko=>"안녕하세요", ja=>"こんにちは"',
   'en=>"Welcome to our blog", ko=>"블로그에 오신 것을 환영합니다"');""")
    demo['multi_translate_read'] = capture("""SELECT id, title_translations -> 'ko' AS title_ko, body_translations -> 'ko' AS body_ko FROM post;""")
    demo['multi_translate_index'] = capture("""CREATE INDEX ON post USING gin (title_translations);
CREATE INDEX ON post USING gin (body_translations);
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes WHERE tablename = 'post' ORDER BY indexname;""")
    demo['multi_audit_setup'] = run("""CREATE TABLE config (
  id serial PRIMARY KEY,
  attrs hstore NOT NULL DEFAULT '',
  attrs_prev hstore NOT NULL DEFAULT ''
);
INSERT INTO config (attrs) VALUES ('timeout=>30, retries=>3, region=>us-east');""")
    demo['multi_audit_update'] = run("""UPDATE config SET attrs_prev = attrs, attrs = attrs || 'timeout=>60, region=>ap-northeast' WHERE id = 1;""")
    demo['multi_audit_diff'] = capture("""-- 같은 행 안의 두 hstore를 빼서 "무엇이 어떻게 바뀌었는지"를 바로 얻는다
SELECT id, attrs - attrs_prev AS changed_to, attrs_prev - attrs AS changed_from FROM config WHERE id = 1;""")

    # ---- 동시 세션 (lab 04 스크립트를 그대로 실행) -----------------------------------------
    shell('mkdir -p /lab')
    h._compose('cp', str(LAB04), 'postgres:/lab/scripts', capture_output=True, check=True)
    for name, script in (('cc_row_lock', 's1-row-lock.sh'), ('cc_lost_update', 's2-lost-update.sh'),
                         ('cc_atomic_for_update', 's3-atomic-vs-for-update.sh'),
                         ('cc_repeatable_read', 's4-repeatable-read.sh'), ('cc_counter', 's5-counter-pgbench.sh')):
        demo[name] = {'sql': f'bash /lab/scripts/{script}', 'output': shell(f'bash /lab/scripts/{script}')}

    # ---- trusted 확장: study 와 분리된 임시 DB에서 실행해 지금까지 만든 테이블에 영향이 없게 한다 -----
    demo['trust_catalog'] = capture("""SELECT v.name, v.trusted, v.superuser
FROM pg_available_extension_versions v
JOIN pg_available_extensions e ON e.name = v.name AND e.default_version = v.version
WHERE v.name IN ('hstore', 'pg_trgm', 'pgcrypto', 'citext', 'ltree', 'uuid-ossp',
                  'pageinspect', 'pg_stat_statements', 'dblink', 'postgres_fdw', 'adminpack')
ORDER BY v.trusted DESC, v.name;""")
    run("CREATE DATABASE trust_demo;")
    demo['trust_role_setup'] = run("CREATE ROLE app_owner LOGIN;")
    demo['trust_no_create'] = capture_error("""SET SESSION AUTHORIZATION app_owner;
CREATE EXTENSION hstore;""", db='trust_demo')
    demo['trust_grant'] = run("GRANT CREATE ON DATABASE trust_demo TO app_owner;")
    demo['trust_ok'] = capture("""SET SESSION AUTHORIZATION app_owner;
CREATE EXTENSION hstore;
SELECT extname, extowner::regrole AS owner FROM pg_extension WHERE extname = 'hstore';""", db='trust_demo')
    demo['trust_pageinspect_denied'] = capture_error("""SET SESSION AUTHORIZATION app_owner;
CREATE EXTENSION pageinspect;""", db='trust_demo')
    demo['trust_ownership_split'] = capture("""SELECT extname, extowner::regrole AS extension_owner FROM pg_extension WHERE extname = 'hstore';
SELECT proname, proowner::regrole AS function_owner FROM pg_proc WHERE proname = 'hstore_in';""", db='trust_demo')
    demo['trust_cannot_alter'] = capture_error("""SET SESSION AUTHORIZATION app_owner;
COMMENT ON FUNCTION hstore_in(cstring) IS 'x';""", db='trust_demo')
    demo['trust_can_drop'] = capture("""SET SESSION AUTHORIZATION app_owner;
DROP EXTENSION hstore;
SELECT count(*) AS hstore_extensions_left FROM pg_extension WHERE extname = 'hstore';""", db='trust_demo')
    demo['trust_public_database_acl'] = capture("""SELECT has_database_privilege('public', current_database(), 'CREATE') AS public_has_create,
       has_database_privilege('public', current_database(), 'CONNECT') AS public_has_connect;""", db='trust_demo')
    demo['jsonb_opclass'] = capture("""SELECT t.typname, am.amname, opc.opcname
FROM pg_opclass opc
JOIN pg_am am ON am.oid = opc.opcmethod
JOIN pg_type t ON t.oid = opc.opcintype
WHERE t.typname IN ('hstore', 'jsonb')
ORDER BY t.typname, am.amname;""")

    OUT.write_text(json.dumps(demo, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS: {len(demo) - 1}개 예제를 실행하고 web/src/data/hstore-demo.json 에 저장했다')
finally:
    h.down()
