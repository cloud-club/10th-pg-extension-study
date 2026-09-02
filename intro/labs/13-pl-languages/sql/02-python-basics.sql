-- ===========================================================================
-- 02. Python 으로 함수 짜기
-- ===========================================================================
\echo '--- 가장 단순한 예 ---'
CREATE OR REPLACE FUNCTION py_add(a int, b int) RETURNS int
LANGUAGE plpython3u AS $$
    return a + b
$$;

SELECT py_add(2, 3) AS 결과;

\echo ''
\echo '  ^ 함수 본문이 그냥 Python 입니다.'
\echo '    인자는 이름 그대로 지역 변수가 되고, return 이 반환값이 됩니다.'

\echo ''
\echo '--- 타입 매핑: SQL 타입 ↔ Python 타입 ---'
CREATE OR REPLACE FUNCTION py_typecheck(
    i int, b bigint, n numeric, t text, bl boolean,
    arr int[], j jsonb, d date, ts timestamptz
) RETURNS text
LANGUAGE plpython3u AS $$
    return "\n".join([
        f"int         -> {type(i).__name__}  ({i})",
        f"bigint      -> {type(b).__name__}  ({b})",
        f"numeric     -> {type(n).__name__}  ({n})",
        f"text        -> {type(t).__name__}  ({t})",
        f"boolean     -> {type(bl).__name__}  ({bl})",
        f"int[]       -> {type(arr).__name__}  ({arr})",
        f"jsonb       -> {type(j).__name__}  ({j})",
        f"date        -> {type(d).__name__}  ({d})",
        f"timestamptz -> {type(ts).__name__}  ({ts})",
    ])
$$;

\echo ''
SELECT py_typecheck(1, 2, 3.5, 'hi', true, ARRAY[1,2,3], '{"k":"v"}'::jsonb,
                    DATE '2026-08-31', TIMESTAMPTZ '2026-08-31 09:00+09');

\echo ''
\echo '  눈여겨볼 것:'
\echo '   · numeric → Decimal 입니다 (float 이 아님). 정밀도가 보존됩니다.'
\echo '   · int[]   → list 로 자동 변환됩니다. 다차원 배열은 중첩 list 가 됩니다.'
\echo '   · jsonb   → dict 가 아니라 str 입니다! json.loads() 를 직접 불러야 합니다.'
\echo '   · date / timestamptz → 이것도 str 입니다. date.fromisoformat() 등으로 파싱하세요.'
\echo '     (PL/Python 이 자동 변환해주는 것은 숫자 · 문자 · 불리언 · 배열까지입니다)'

\echo ''
\echo '--- jsonb 를 실제로 다루려면 ---'
CREATE OR REPLACE FUNCTION py_json_keys(j jsonb) RETURNS text[]
LANGUAGE plpython3u AS $$
    import json
    return sorted(json.loads(j).keys())     # str 이므로 직접 파싱
$$;

SELECT py_json_keys('{"b":2, "a":1, "c":3}'::jsonb) AS 키목록;

\echo ''
\echo '--- NULL 처리 ---'
CREATE OR REPLACE FUNCTION py_nullable(t text) RETURNS text
LANGUAGE plpython3u AS $$
    if t is None:
        return "받은 값이 NULL 입니다"
    return f"받은 값: {t}"
$$;

SELECT py_nullable('hello') AS 값이_있을_때, py_nullable(NULL) AS NULL_일_때;
\echo '  ^ SQL 의 NULL 은 Python 의 None 입니다. STRICT 를 안 붙이면 직접 처리해야 합니다.'

\echo ''
\echo '--- 여러 행 반환 (SETOF) ---'
CREATE OR REPLACE FUNCTION py_split(s text, sep text) RETURNS SETOF text
LANGUAGE plpython3u AS $$
    for part in s.split(sep):
        yield part.strip()
$$;

SELECT * FROM py_split('사과, 배, 감, 귤', ',');
\echo '  ^ yield 로 여러 행을 반환합니다. Python 제너레이터가 그대로 동작합니다.'

\echo ''
\echo '--- 복합 타입 반환 ---'
DROP TYPE IF EXISTS parsed_url CASCADE;
CREATE TYPE parsed_url AS (scheme text, host text, path text, port int);

CREATE OR REPLACE FUNCTION py_parse_url(u text) RETURNS parsed_url
LANGUAGE plpython3u AS $$
    from urllib.parse import urlparse
    p = urlparse(u)
    return {"scheme": p.scheme, "host": p.hostname,
            "path": p.path, "port": p.port}
$$;

SELECT * FROM py_parse_url('https://www.postgresql.org:443/docs/16/plpython.html');
\echo '  ^ dict 를 반환하면 복합 타입으로 매핑됩니다.'
