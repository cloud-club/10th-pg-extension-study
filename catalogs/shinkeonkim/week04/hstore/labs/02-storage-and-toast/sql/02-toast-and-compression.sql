-- ===========================================================================
-- 02. 큰 hstore 는 TOAST 로 나간다 — 그리고 jsonb 보다 잘 압축되지 않는다
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;
DROP TABLE IF EXISTS src, t_hs, t_jb;

CREATE TABLE src AS
SELECT i, 'attr_' || lpad(k::text, 3, '0') AS key,
       (ARRAY['red','green','blue','black','white','small','medium','large','cotton','steel'])[1 + (i * 7 + k * 13) % 10] AS value
FROM   generate_series(1, 200) i, generate_series(1, 200) k;      -- 200행 × 키 200개, 값은 10종류뿐

CREATE TABLE t_hs (id int PRIMARY KEY, attrs hstore);
CREATE TABLE t_jb (id int PRIMARY KEY, attrs jsonb);
INSERT INTO t_hs SELECT i, hstore(array_agg(key), array_agg(value)) FROM src GROUP BY i;
INSERT INTO t_jb SELECT i, jsonb_object_agg(key, value) FROM src GROUP BY i;
VACUUM (ANALYZE) t_hs, t_jb;

\echo '--- 같은 내용, 같은 200개 키: 행 하나가 차지하는 저장 크기 ---'
SELECT 'hstore' AS type, pg_column_size(attrs) AS stored_bytes,
       pg_column_compression(attrs) AS compression, length(attrs::text) AS text_bytes
FROM   t_hs WHERE id = 1
UNION ALL
SELECT 'jsonb', pg_column_size(attrs), pg_column_compression(attrs), length(attrs::text)
FROM   t_jb WHERE id = 1;

\echo ''
\echo '--- TOAST 테이블까지 포함한 전체 크기 ---'
SELECT 'hstore' AS type, pg_size_pretty(pg_relation_size('t_hs')) AS heap,
       pg_size_pretty(pg_relation_size((SELECT reltoastrelid FROM pg_class WHERE oid = 't_hs'::regclass))) AS toast,
       pg_size_pretty(pg_total_relation_size('t_hs')) AS total
UNION ALL
SELECT 'jsonb', pg_size_pretty(pg_relation_size('t_jb')),
       pg_size_pretty(pg_relation_size((SELECT reltoastrelid FROM pg_class WHERE oid = 't_jb'::regclass))),
       pg_size_pretty(pg_total_relation_size('t_jb'));

\echo ''
\echo '--- 왜 갈리나: hstore 는 끝 위치(누적)를, jsonb 는 대부분 길이를 저장한다 ---'
\echo '    같은 문자열에 두 방식의 배열을 붙여 bytea 로 만들고 pglz 로 압축해 본다.'
DROP TABLE IF EXISTS layout;
CREATE TABLE layout (kind text, payload bytea);
WITH pieces AS (
  SELECT ord, piece, octet_length(piece) AS len,
         sum(octet_length(piece)) OVER (ORDER BY ord) AS endpos
  FROM (SELECT (row_number() OVER (ORDER BY key)) * 2 - 1 AS ord, convert_to(key, 'UTF8') AS piece FROM src WHERE i = 1
        UNION ALL
        SELECT (row_number() OVER (ORDER BY key)) * 2, convert_to(value, 'UTF8') FROM src WHERE i = 1) u
), agg AS (
  SELECT string_agg(int4send(endpos::int), ''::bytea ORDER BY ord) AS offsets,
         string_agg(int4send(len), ''::bytea ORDER BY ord)         AS lengths,
         string_agg(piece, ''::bytea ORDER BY ord)                 AS strings
  FROM pieces
)
INSERT INTO layout SELECT 'offsets (hstore 방식)', offsets || strings FROM agg
UNION ALL SELECT 'lengths (jsonb 방식)', lengths || strings FROM agg;
SELECT kind, octet_length(payload) AS raw_bytes, pg_column_size(payload) AS stored_bytes,
       pg_column_compression(payload) AS compression
FROM   layout ORDER BY kind;
\echo ''
\echo '  ^ 문자열은 똑같다. 앞에 붙은 4바이트 배열이 "1,3,4,7,..." 처럼 계속 커지는 값이면 반복이 없어 압축이 안 된다.'

\echo ''
\echo '--- 한 키만 바꿔도 값 전체를 다시 쓴다: 갱신 뒤 TOAST 테이블이 얼마나 커지나 ---'
SELECT pg_relation_size((SELECT reltoastrelid FROM pg_class WHERE oid = 't_hs'::regclass)) AS toast_before \gset
UPDATE t_hs SET attrs = attrs || hstore('attr_001', 'changed') WHERE id <= 100;   -- 100행, 각 행 키 하나
SELECT pg_relation_size((SELECT reltoastrelid FROM pg_class WHERE oid = 't_hs'::regclass)) - :toast_before AS toast_growth_bytes,
       (SELECT round(avg(pg_column_size(attrs))) FROM t_hs WHERE id <= 100) AS avg_value_bytes;

\echo ''
\echo '--- 검증 ---'
DO $$
BEGIN
  ASSERT (SELECT pg_column_compression(attrs) FROM t_jb WHERE id = 1) IS NOT NULL, 'jsonb 는 압축된다';
  ASSERT (SELECT pg_column_size(attrs) FROM t_hs WHERE id = 1) > 3 * (SELECT pg_column_size(attrs) FROM t_jb WHERE id = 1), 'hstore 는 jsonb 보다 훨씬 덜 압축된다 (이 데이터에서 3배 이상)';
  ASSERT (SELECT pg_column_size(payload) FROM layout WHERE kind LIKE 'offsets%') > 3 * (SELECT pg_column_size(payload) FROM layout WHERE kind LIKE 'lengths%'), '같은 문자열이라도 끝 위치 배열은 길이 배열보다 훨씬 덜 압축된다';
  RAISE NOTICE '✔ TOAST·압축 검증 통과';
END $$;
