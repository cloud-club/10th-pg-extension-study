-- ===========================================================================
-- 01. pg_buffercache - 공유 버퍼 안을 들여다보기
--
--     이 부류는 새 기능을 더하지 않습니다.
--     PostgreSQL 내부 자료구조를 "SQL 로 볼 수 있게" 노출할 뿐입니다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

\echo '--- 이 extension 이 추가한 것 ---'
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid=d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='pg_buffercache'
ORDER  BY 1, 2;

\echo ''
\echo '  ^ 함수 몇 개와 뷰. 하는 일은 "메모리에 있는 버퍼 배열을 행으로 변환"입니다.'

\echo ''
\echo '--- 데이터를 만들고 읽어봅니다 ---'
DROP TABLE IF EXISTS hot_table;
DROP TABLE IF EXISTS cold_table;
CREATE TABLE hot_table  AS SELECT g AS id, repeat('x', 200) AS pad FROM generate_series(1,50000) g;
CREATE TABLE cold_table AS SELECT g AS id, repeat('y', 200) AS pad FROM generate_series(1,50000) g;
CREATE INDEX ON hot_table (id);
ANALYZE hot_table; ANALYZE cold_table;

\echo '  hot_table 만 여러 번 읽습니다'
SELECT count(*) FROM hot_table;
SELECT count(*) FROM hot_table WHERE id < 10000;
SELECT count(*) FROM hot_table WHERE id > 40000;

\echo ''
\echo '--- 지금 버퍼에 무엇이 올라와 있나 ---'
SELECT c.relname AS 관계, count(*) AS 버퍼수,
       pg_size_pretty(count(*) * 8192::bigint) AS 캐시크기,
       round(100.0 * count(*) / (SELECT count(*) FROM pg_buffercache), 1) AS "버퍼점유%"
FROM   pg_buffercache b JOIN pg_class c ON c.relfilenode = b.relfilenode
GROUP  BY c.relname ORDER BY 버퍼수 DESC LIMIT 10;

\echo ''
\echo '--- 전체 버퍼 사용 현황 ---'
SELECT count(*) AS 전체버퍼,
       count(*) FILTER (WHERE relfilenode IS NOT NULL) AS 사용중,
       count(*) FILTER (WHERE relfilenode IS NULL)     AS 비어있음,
       count(*) FILTER (WHERE isdirty)                 AS 더티
FROM   pg_buffercache;
SHOW shared_buffers;

\echo ''
\echo '--- usagecount: 얼마나 자주 쓰였나 (0~5) ---'
SELECT usagecount AS 사용횟수, count(*) AS 버퍼수
FROM   pg_buffercache WHERE relfilenode IS NOT NULL
GROUP  BY usagecount ORDER BY usagecount;

\echo ''
\echo '  ^ PostgreSQL 은 clock-sweep 알고리즘으로 버퍼를 교체합니다.'
\echo '    usagecount 가 높은 버퍼는 잘 안 쫓겨납니다.'
\echo ''
\echo '  실무 용도:'
\echo '    · "shared_buffers 를 늘려야 하나?" - 비어있음이 0 이고 히트율이 낮으면 예'
\echo '    · "어떤 테이블이 메모리를 다 먹고 있나?"'
\echo '    · ⚠ 이 뷰는 전체 버퍼를 훑으므로 부하가 있습니다. 운영에서 자주 돌리지 마세요.'
