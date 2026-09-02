-- ===========================================================================
-- 03. 공유 메모리를 실제로 쓴다는 증거
-- ===========================================================================
\echo '--- pg_shmem_allocations: 서버가 할당한 공유 메모리 목록 ---'
SELECT name AS 이름, pg_size_pretty(size) AS 크기, allocated_size AS 실제바이트
FROM   pg_shmem_allocations
WHERE  name ILIKE '%stat_statements%'
ORDER  BY size DESC;

\echo ''
\echo '  ^ 이 메모리는 "모든 백엔드 프로세스가 공유"합니다.'
\echo '    그래서 A 세션이 실행한 쿼리 통계를 B 세션에서 볼 수 있습니다.'
\echo '    일반 extension 의 palloc 메모리는 세션이 끝나면 사라집니다.'

\echo ''
\echo '--- 다른 세션의 쿼리도 잡히는지 확인 ---'
\echo '  [컨테이너 셸] $ psql -U postgres -d study -c "SELECT count(*) FROM t_demo WHERE id < 12345;" > /dev/null'
\! psql -U postgres -d study -c "SELECT count(*) FROM t_demo WHERE id < 12345;" > /dev/null
SELECT left(query, 55) AS 쿼리, calls
FROM   pg_stat_statements WHERE query LIKE '%id < %' ORDER BY calls DESC LIMIT 3;
\echo '  ^ calls 가 늘었습니다. 별도 프로세스에서 실행한 쿼리도 같은 공유 메모리에 기록됩니다.'

\echo ''
\echo '--- 크기는 고정입니다 ---'
SHOW pg_stat_statements.max;
\echo '  ^ 이 개수를 넘으면 가장 덜 쓰인 항목부터 버립니다(LRU).'
\echo '    늘리려면 서버 재시작이 필요합니다 - 공유 메모리라서 그렇습니다.'

SELECT * FROM (VALUES
  ('pg_stat_statements.max',   '추적할 쿼리 개수 (기본 5000)'),
  ('pg_stat_statements.track', 'top / all / none - all 은 함수 안의 쿼리까지'),
  ('pg_stat_statements.track_utility', 'DDL 도 추적할지'),
  ('pg_stat_statements.save',  '재시작 시 통계를 파일로 보존할지')
) AS t(설정, 의미);

SELECT name, setting FROM pg_settings WHERE name LIKE 'pg_stat_statements%' ORDER BY name;
