-- ===========================================================================
-- 01. 디스크에 저장된 hstore 의 바이트를 직접 읽는다 (pageinspect)
--
-- 구조 (contrib/hstore/hstore.h):
--   [varlena 헤더][size_ : 플래그 + 쌍 개수][HEntry × 2·개수][문자열 영역]
--   HEntry = 4바이트. 최상위 비트 ISFIRST, 다음 비트 ISNULL, 나머지 30비트는 "문자열 영역 안의 끝 위치"
--   키 i 는 HEntry[2i], 값 i 는 HEntry[2i+1]
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS pageinspect;

DROP TABLE IF EXISTS s;
CREATE TABLE s (id int, attrs hstore);
-- 일부러 순서를 섞고, 중복 키 하나와 NULL 값 하나를 넣는다
INSERT INTO s VALUES (1, 'ccc=>333, aa=>1, b=>NULL, aa=>9');

\echo '--- 논리적으로 보이는 값 ---'
SELECT attrs, pg_column_size(attrs) AS stored_bytes FROM s;

\echo ''
\echo '--- 힙 페이지의 원시 바이트 (t_data 는 튜플 헤더를 뺀 사용자 데이터: 앞 4바이트는 id, 그다음이 hstore) ---'
SELECT t_hoff, encode(substring(t_data FROM 5), 'hex') AS hstore_hex
FROM   heap_page_items(get_raw_page('s', 0));

-- 리틀 엔디언 4바이트 정수 읽기
CREATE OR REPLACE FUNCTION u32(b bytea, off int) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT get_byte(b, off)::bigint + get_byte(b, off + 1)::bigint * 256
       + get_byte(b, off + 2)::bigint * 65536 + get_byte(b, off + 3)::bigint * 16777216
$$;

\echo ''
\echo '--- 헤더 해독: 1바이트 짧은 헤더(130바이트 이하) → 길이, size_ → 개수와 플래그 ---'
WITH raw AS (
  SELECT substring(t_data FROM 5) AS b FROM heap_page_items(get_raw_page('s', 0))
)
SELECT get_byte(b, 0) >> 1                         AS varlena_total_bytes,
       (u32(b, 1) & x'0FFFFFFF'::int)              AS pair_count,
       (u32(b, 1) >> 31) = 1                       AS new_format_flag,
       5 + 8 * (u32(b, 1) & x'0FFFFFFF'::int)      AS string_area_starts_at
FROM raw;

\echo ''
\echo '--- HEntry 해독: 끝 위치(누적)만 저장하고, 길이는 앞 항목과의 차이로 구한다 ---'
WITH raw AS (
  SELECT substring(t_data FROM 5) AS b FROM heap_page_items(get_raw_page('s', 0))
), hdr AS (
  SELECT b, (u32(b, 1) & x'0FFFFFFF'::int)::int AS n FROM raw
), ent AS (
  SELECT g AS i,
         CASE WHEN g % 2 = 0 THEN 'key' ELSE 'value' END AS role,
         g / 2 AS pair_no,
         u32(b, 5 + 4 * g) AS e, b, n
  FROM   hdr, generate_series(0, 2 * n - 1) g
), pos AS (
  SELECT *, e & x'3FFFFFFF'::int AS end_pos,
         coalesce(lag(e & x'3FFFFFFF'::int) OVER (ORDER BY i), 0) AS start_pos
  FROM   ent
)
SELECT i, pair_no, role,
       (e >> 31) & 1                       AS isfirst,
       (e >> 30) & 1                       AS isnull,
       end_pos,
       end_pos - start_pos                 AS len,
       CASE WHEN (e >> 30) & 1 = 1 THEN NULL
            ELSE convert_from(substring(b FROM (5 + 8 * n + 1 + start_pos)::int FOR (end_pos - start_pos)::int), 'UTF8')
       END AS text
FROM   pos ORDER BY i;

\echo ''
\echo '  ^ 키는 (길이, 바이트) 순으로 정렬되어 b, aa, ccc 순서다. 중복된 aa 는 하나만 남았고,'
\echo '    NULL 값은 ISNULL 비트만 켜져 있고 문자열 영역을 쓰지 않는다 (len = 0).'

\echo ''
\echo '--- 크기 공식: 헤더 4 + size_ 4 + HEntry 4×2×쌍 + 문자열 = 원본 크기 (짧은 헤더면 -3) ---'
SELECT pg_column_size(attrs) AS stored,
       4 + 4 + 4 * 2 * 3 + (1 + 2 + 1 + 3 + 3) AS by_formula_raw,
       4 + 4 + 4 * 2 * 3 + (1 + 2 + 1 + 3 + 3) - 3 AS by_formula_short_header
FROM   s;

\echo ''
\echo '--- NULL 값과 빈 문자열: 둘 다 문자열 영역을 쓰지 않아 크기가 같다 (차이는 ISNULL 비트뿐) ---'
SELECT pg_column_size('a=>NULL'::hstore) AS null_value,
       pg_column_size('a=>""'::hstore)   AS empty_string,
       pg_column_size('a=>x'::hstore)    AS one_char;

\echo ''
\echo '--- 검증 ---'
DO $$
DECLARE hex text;
BEGIN
  SELECT encode(substring(t_data FROM 5), 'hex') INTO hex FROM heap_page_items(get_raw_page('s', 0));
  -- 4f = 짧은 헤더(39바이트), 03000080 = 3쌍 + 새 형식 플래그, HEntry 6개(끝 위치 1·1·3·4·7·10, 첫째에 ISFIRST, NULL 값에 ISNULL), 문자열 "baa1ccc333"
  ASSERT hex = '4f0300008001000080010000400300000004000000070000000a00000062616131636363333333', '디스크 바이트가 예상과 같아야 한다: ' || hex;
  ASSERT (SELECT pg_column_size(attrs) FROM s) = 4 + 4 + 4 * 2 * 3 + 10 - 3, '크기 공식(짧은 헤더 -3)';
  ASSERT pg_column_size('a=>NULL'::hstore) = pg_column_size('a=>""'::hstore), 'NULL 값과 빈 문자열은 크기가 같다';
  RAISE NOTICE '✔ 저장 구조 검증 통과';
END $$;
