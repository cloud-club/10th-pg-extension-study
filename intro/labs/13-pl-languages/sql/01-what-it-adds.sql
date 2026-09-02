-- ===========================================================================
-- 01. 절차적 언어(PL) extension 은 무엇을 추가하는가
--
--     이 부류는 다른 어떤 부류와도 다른 카탈로그를 건드립니다: pg_language
-- ===========================================================================
\echo '--- 설치 전: 이 DB 가 아는 언어 ---'
SELECT lanname AS 언어, lanpltrusted AS trusted, lanplcallfoid::regproc AS handler
FROM   pg_language ORDER BY oid;

\echo ''
\echo '  internal - PostgreSQL 내장 C 함수'
\echo '  c        - 외부 .so 의 C 함수 (lab03 에서 쓴 것)'
\echo '  sql      - SQL 본문 함수 (lab00 에서 쓴 것)'
\echo '  plpgsql  - 기본 제공. 이것도 extension 입니다!'

\echo ''
\echo '--- plpgsql 도 extension 입니다 ---'
SELECT extname, extversion FROM pg_extension WHERE extname='plpgsql';
\echo '  ^ 새 DB 를 만들면 자동으로 설치될 뿐, 특별한 존재가 아닙니다.'

\echo ''
\echo '--- 설치 ---'
CREATE EXTENSION IF NOT EXISTS plpython3u;
CREATE EXTENSION IF NOT EXISTS plperl;

\echo ''
\echo '--- 설치 후: 언어가 늘었습니다 ---'
SELECT lanname AS 언어, lanpltrusted AS trusted, lanplcallfoid::regproc AS handler
FROM   pg_language ORDER BY oid;

\echo ''
\echo '--- 이 extension 들이 추가한 객체 ---'
SELECT e.extname,
       count(*) FILTER (WHERE d.classid='pg_language'::regclass) AS 언어,
       count(*) FILTER (WHERE d.classid='pg_proc'::regclass)     AS 함수,
       count(*) FILTER (WHERE d.classid='pg_type'::regclass)     AS 타입
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND  e.extname IN ('plpgsql','plpython3u','plperl')
GROUP  BY e.extname ORDER BY e.extname;

\echo ''
\echo '  ^ pg_language 컬럼에 1 이 있으면 "절차적 언어를 추가하는 부류"입니다.'
\echo '    함수 2~3개는 handler / inline / validator 입니다:'

SELECT l.lanname AS 언어,
       l.lanplcallfoid::regproc AS "handler (함수 실행)",
       l.laninline::regproc     AS "inline (DO 블록)",
       l.lanvalidator::regproc  AS "validator (문법 검사)"
FROM   pg_language l WHERE l.lanispl ORDER BY l.lanname;

\echo ''
\echo '--- handler 는 어디서 오나 ---'
SELECT p.proname AS handler, l.lanname AS "구현 언어", p.probin AS "공유 라이브러리"
FROM   pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE  p.proname IN ('plpgsql_call_handler','plpython3_call_handler','plperl_call_handler');

\echo ''
\echo '  ^ handler 자체는 C 로 짜여 있습니다.'
\echo '    즉 PL 언어 extension 은 "C extension 위에 세워진 것"입니다.'
\echo '    Python 함수를 부르면 → C handler 가 호출되고 → 그 안에서 Python 인터프리터가 돕니다.'
