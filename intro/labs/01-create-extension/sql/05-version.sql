-- ===========================================================================
-- 05. 버전 관리 - 업그레이드 경로는 그래프 탐색(BFS)으로 계산된다
-- ===========================================================================
\echo '--- hstore 가 제공하는 모든 버전 ---'
SELECT name, version, installed, trusted, relocatable
FROM   pg_available_extension_versions
WHERE  name = 'hstore'
ORDER  BY version;

\echo ''
\echo '--- 실제 스크립트 파일들 (= 업그레이드 그래프의 노드와 에지) ---'
\echo '  [컨테이너 셸] $ ls /usr/share/postgresql/16/extension/ | grep \'^hstore--\''
\! ls /usr/share/postgresql/16/extension/ | grep '^hstore--'

\echo ''
\echo '--- find_update_path() 가 BFS 로 계산한 경로 (1.4 에서 출발) ---'
\echo '    NOTE: hstore--1.4--1.8.sql 같은 직행 스크립트가 없어도 경유 경로를 찾아낸다'
SELECT source, target, path
FROM   pg_extension_update_paths('hstore')
WHERE  source = '1.4' AND path IS NOT NULL
ORDER  BY target;

\echo ''
\echo '--- 도달 불가능한 조합은 path 가 NULL 로 나온다 (역방향 = 다운그레이드 불가) ---'
SELECT source, target, coalesce(path, '(경로 없음)') AS path
FROM   pg_extension_update_paths('hstore')
WHERE  target = '1.4' AND source > '1.4'
ORDER  BY source
LIMIT  5;

\echo ''
\echo '--- [실험] 낮은 버전으로 설치했다가 최신으로 올려보기 ---'
DROP EXTENSION IF EXISTS hstore CASCADE;
CREATE EXTENSION hstore VERSION '1.4';
SELECT extname, extversion AS installed_now FROM pg_extension WHERE extname='hstore';

\echo '  -> ALTER EXTENSION hstore UPDATE;  (중간 버전 스크립트를 순서대로 실행)'
ALTER EXTENSION hstore UPDATE;
SELECT extname, extversion AS after_update FROM pg_extension WHERE extname='hstore';

\echo ''
\echo '--- 동작 확인 ---'
SELECT 'name=>John, age=>30'::hstore -> 'name'  AS name,
       akeys('a=>1, b=>2'::hstore)              AS keys;
