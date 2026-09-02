-- ===========================================================================
-- 03. Python 을 쓰는 진짜 이유 - 표준 라이브러리와 SPI
-- ===========================================================================
\echo '======== ① 표준 라이브러리를 그대로 쓴다 ========'
\echo ''
\echo '--- 정규식으로 로그 파싱 (SQL 로는 번거로운 일) ---'
CREATE OR REPLACE FUNCTION py_parse_log(line text)
RETURNS TABLE(ts text, level text, msg text)
LANGUAGE plpython3u AS $$
    import re
    m = re.match(r'^\[(?P<ts>[^\]]+)\]\s+(?P<level>[A-Z]+)\s+(?P<msg>.*)$', line)
    if m:
        yield (m.group('ts'), m.group('level'), m.group('msg'))
$$;

SELECT * FROM py_parse_log('[2026-08-31 09:12:03] ERROR connection timeout after 30s');

\echo ''
\echo '--- 날짜 계산 ---'
CREATE OR REPLACE FUNCTION py_business_days(a date, b date) RETURNS int
LANGUAGE plpython3u AS $$
    from datetime import date, timedelta
    # ⚠ date/timestamp 도 str 로 넘어옵니다. 직접 파싱해야 합니다.
    d   = date.fromisoformat(a)
    end = date.fromisoformat(b)
    n = 0
    while d < end:
        if d.weekday() < 5:      # 월(0)~금(4)
            n += 1
        d += timedelta(days=1)
    return n
$$;

SELECT py_business_days('2026-08-31', '2026-09-14') AS "2주간 영업일";
\echo '  ⚠ date 도 str 로 옵니다 (jsonb 와 같은 함정). date.fromisoformat() 으로 파싱했습니다.'

\echo ''
\echo '--- 유니코드 정규화 (슬러그 만들기) ---'
CREATE OR REPLACE FUNCTION py_slug(t text) RETURNS text
LANGUAGE plpython3u AS $$
    import unicodedata, re
    s = unicodedata.normalize('NFKD', t)
    s = re.sub(r'[^\w\s-]', '', s).strip().lower()
    return re.sub(r'[-\s]+', '-', s)
$$;

SELECT py_slug('Hello, World!  PostgreSQL Extension 스터디') AS slug;

\echo ''
\echo '  ^ 이런 것들을 SQL 이나 PL/pgSQL 로 짜면 훨씬 길고 읽기 어렵습니다.'
\echo '    Python 표준 라이브러리가 통째로 들어온다는 것이 이 부류의 가치입니다.'

\echo ''
\echo '======== ② plpy - 함수 안에서 SQL 실행 ========'
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (id serial PRIMARY KEY, customer text, amount numeric, created date);
INSERT INTO orders (customer, amount, created)
SELECT (ARRAY['김철수','이영희','박민수'])[1+(g%3)],
       (g % 50 + 1) * 1000,
       DATE '2026-08-01' + (g % 30)
FROM generate_series(1, 300) g;

CREATE OR REPLACE FUNCTION py_customer_report(name text) RETURNS text
LANGUAGE plpython3u AS $$
    # plpy.prepare + execute 로 파라미터 바인딩 (SQL 인젝션 방지)
    plan = plpy.prepare(
        "SELECT count(*) AS n, sum(amount) AS total, max(created) AS last "
        "FROM orders WHERE customer = $1", ["text"])
    row = plpy.execute(plan, [name])[0]

    if row["n"] == 0:
        return f"{name}: 주문 없음"
    return (f"{name}: {row['n']}건, "
            f"총 {int(row['total']):,}원, "
            f"마지막 주문 {row['last']}")
$$;

SELECT py_customer_report('김철수') AS 리포트;
SELECT py_customer_report('없는사람') AS 리포트;

\echo ''
\echo '  ⚠ plpy.execute("... " + name) 처럼 문자열을 이어붙이면 SQL 인젝션입니다.'
\echo '    반드시 plpy.prepare 로 파라미터를 바인딩하세요.'
\echo '    (plpy.quote_literal / quote_ident 도 있습니다)'

\echo ''
\echo '--- 로그 남기기 ---'
CREATE OR REPLACE FUNCTION py_with_log(n int) RETURNS int
LANGUAGE plpython3u AS $$
    plpy.notice(f"입력값은 {n} 입니다")
    if n < 0:
        plpy.error("음수는 처리할 수 없습니다")   # 예외를 던진다
    return n * 2
$$;

SELECT py_with_log(21) AS 결과;
DO $$ BEGIN
    PERFORM py_with_log(-1);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '잡힘: %', SQLERRM; END $$;

\echo ''
\echo '--- 세션 간 상태 공유: SD 와 GD ---'
CREATE OR REPLACE FUNCTION py_counter() RETURNS int
LANGUAGE plpython3u AS $$
    # SD = 이 함수 전용 저장소, GD = 세션 전역 저장소
    SD['n'] = SD.get('n', 0) + 1
    return SD['n']
$$;

SELECT py_counter(), py_counter(), py_counter();
\echo '  ^ 같은 세션 안에서 값이 유지됩니다 (lab03 의 C static 변수와 같은 수명).'
\echo '    다른 세션에서는 다시 1 부터 시작합니다. 캐시 용도로 씁니다.'
