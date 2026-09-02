-- ===========================================================================
-- 01. 인덱스 액세스 메서드(AM) - extension 이 할 수 있는 가장 깊은 확장
-- ===========================================================================
\echo '--- PostgreSQL 이 기본 제공하는 인덱스 AM ---'
SELECT amname AS 이름, amhandler::regproc AS handler_함수
FROM   pg_am WHERE amtype='i' ORDER BY amname;

\echo ''
\echo '  ^ handler 는 C 함수입니다.'
\echo '    "이 인덱스를 어떻게 만들고, 어떻게 스캔하고, 어떻게 비용을 추정할지"를'
\echo '    구조체(IndexAmRoutine)에 채워서 돌려줍니다. 수십 개의 콜백 함수입니다.'
\echo '    → SQL 로는 절대 만들 수 없습니다. 반드시 C extension 이어야 합니다.'

\echo ''
\echo '--- bloom 을 설치하면 목록이 늘어납니다 ---'
CREATE EXTENSION IF NOT EXISTS bloom;

SELECT amname AS 이름, amhandler::regproc AS handler_함수
FROM   pg_am WHERE amtype='i' ORDER BY amname;

\echo ''
\echo '--- bloom 이 추가한 것 ---'
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_am'::regclass      THEN (SELECT amname  FROM pg_am      WHERE oid=d.objid)
         WHEN 'pg_proc'::regclass    THEN (SELECT proname FROM pg_proc    WHERE oid=d.objid)
         WHEN 'pg_opclass'::regclass THEN (SELECT opcname FROM pg_opclass WHERE oid=d.objid)
         WHEN 'pg_opfamily'::regclass THEN (SELECT opfname FROM pg_opfamily WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='bloom'
ORDER  BY 1, 2;

\echo ''
\echo '  ^ pg_am 에 항목이 생기는 extension 은 흔하지 않습니다.'
\echo '    bloom(contrib), rum, pgvector(ivfflat/hnsw), pgroonga, zombodb 정도입니다.'

\echo ''
\echo '--- 각 AM 은 어떤 연산자를 지원하는가 ---'
SELECT am.amname AS AM, count(DISTINCT opc.opcname) AS 연산자클래스수
FROM   pg_am am LEFT JOIN pg_opclass opc ON opc.opcmethod = am.oid
WHERE  am.amtype='i' GROUP BY am.amname ORDER BY am.amname;

\echo ''
\echo '  ^ 연산자 클래스가 "이 AM 으로 이 타입을 이 연산자로 검색할 수 있다"를 정의합니다.'
\echo '    lab06 에서 본 pg_trgm 은 기존 AM(GiST/GIN)에 연산자 클래스만 더한 것이고,'
\echo '    bloom 은 AM 자체를 새로 만든 것입니다. 확장의 깊이가 다릅니다.'
