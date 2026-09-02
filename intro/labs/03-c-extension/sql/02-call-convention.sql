-- ===========================================================================
-- 02. V1 호출 규약 - SQL 값이 C 로 어떻게 넘어가나
-- ===========================================================================
\echo '--- (1) 정수 전달: PG_GETARG_INT32 / PG_RETURN_INT32 ---'
SELECT myext_add(2, 3)                AS simple,
       myext_add(-10, 4)              AS negative,
       myext_add(2147483647, 0)       AS int_max;

\echo ''
\echo '--- 오버플로는 C 에서 그대로 wrap 된다 (실무 C extension 이라면 검사해야 함) ---'
SELECT myext_add(2147483647, 1) AS overflow;

\echo ''
\echo '--- (2) 가변 길이 text 전달: PG_GETARG_TEXT_PP + text_to_cstring ---'
SELECT myext_hello('스터디') AS result;
SELECT myext_hello('') AS empty_string;

\echo ''
\echo '--- (3) STRICT 의 의미 ---'
\echo '    myext_add 는 STRICT  -> 인자가 NULL 이면 C 함수를 아예 호출하지 않고 NULL 반환'
SELECT myext_add(1, NULL) AS strict_result;

\echo '    myext_double_or_zero 는 STRICT 아님 -> C 함수가 호출되고 PG_ARGISNULL 로 직접 처리'
SELECT myext_double_or_zero(21)   AS with_value,
       myext_double_or_zero(NULL) AS with_null;

\echo ''
\echo '--- proisstrict 컬럼으로 확인 ---'
SELECT proname, proisstrict FROM pg_proc
WHERE proname IN ('myext_add','myext_double_or_zero') ORDER BY proname;

\echo ''
\echo '--- (4) volatility 는 플래너가 함수를 몇 번 부를지 결정한다 ---'
SELECT proname, provolatile,
       CASE provolatile WHEN 'i' THEN 'IMMUTABLE - 상수 폴딩/인덱스 사용 가능'
                        WHEN 's' THEN 'STABLE    - 한 쿼리 안에서 동일 결과 보장'
                        WHEN 'v' THEN 'VOLATILE  - 매 행마다 호출' END AS meaning
FROM pg_proc WHERE proname LIKE 'myext%' ORDER BY proname;

\echo ''
\echo '--- IMMUTABLE 함수는 플래너가 상수로 접어버린다 (Output 에 5 만 남는다) ---'
EXPLAIN (VERBOSE, COSTS OFF) SELECT myext_add(2, 3);
\echo '--- VOLATILE 함수는 실행 시점까지 호출이 남는다 ---'
EXPLAIN (VERBOSE, COSTS OFF) SELECT myext_hello('x');
