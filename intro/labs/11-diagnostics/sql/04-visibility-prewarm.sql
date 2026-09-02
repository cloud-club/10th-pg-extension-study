-- ===========================================================================
-- 04. pg_visibility / pg_prewarm - VACUUM 과 캐시를 다루는 도구
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_visibility;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;

DROP TABLE IF EXISTS t_vis;
CREATE TABLE t_vis AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;
CREATE INDEX ON t_vis (id);

\echo '======== pg_visibility - Index Only Scan 이 되는 이유 ========'
\echo ''
\echo '--- VACUUM 전: Visibility Map 이 비어 있습니다 ---'
SELECT count(*) AS 전체페이지,
       count(*) FILTER (WHERE all_visible) AS all_visible,
       count(*) FILTER (WHERE all_frozen)  AS all_frozen
FROM   pg_visibility_map('t_vis');

ANALYZE t_vis;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM t_vis WHERE id BETWEEN 100 AND 200;

\echo ''
\echo '--- VACUUM 후 ---'
VACUUM t_vis;
SELECT count(*) AS 전체페이지,
       count(*) FILTER (WHERE all_visible) AS all_visible,
       count(*) FILTER (WHERE all_frozen)  AS all_frozen
FROM   pg_visibility_map('t_vis');

EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM t_vis WHERE id BETWEEN 100 AND 200;

\echo ''
\echo '  ^ "Heap Fetches: 0" 이 되었는지 보세요.'
\echo '    Visibility Map 이 "이 페이지의 모든 행은 누구에게나 보인다"고 보증하면'
\echo '    힙을 읽지 않고 인덱스만으로 답합니다 (Index Only Scan).'
\echo '    → VACUUM 이 성능에 직접 영향을 주는 이유 중 하나입니다.'

\echo ''
\echo '======== pg_prewarm - 재시작 후 캐시 예열 ========'
\echo ''
\echo '  서버를 재시작하면 shared_buffers 가 비어 첫 쿼리들이 전부 디스크를 칩니다.'
\echo '  pg_prewarm 은 그걸 미리 채워둡니다.'

SELECT pg_prewarm('t_vis') AS 로드한_블록수;

CREATE EXTENSION IF NOT EXISTS pg_buffercache;
SELECT c.relname, count(*) AS 버퍼수
FROM   pg_buffercache b JOIN pg_class c ON c.relfilenode=b.relfilenode
WHERE  c.relname = 't_vis' GROUP BY c.relname;

\echo ''
\echo '  ^ autoprewarm 기능(shared_preload_libraries 필요)을 켜면'
\echo '    종료 시 버퍼 목록을 저장했다가 시작 시 자동으로 다시 채웁니다.'

\echo ''
\echo '--- 이 부류 정리 ---'
SELECT * FROM (VALUES
  ('pg_buffercache', '공유 버퍼 내용',        'shared_buffers 사이징'),
  ('pgstattuple',    'bloat / dead tuple',    'VACUUM·repack 필요성 판단'),
  ('pageinspect',    '페이지 raw 구조',       '학습, 데이터 손상 조사'),
  ('pg_visibility',  'Visibility Map',        'Index Only Scan 이 안 되는 이유 추적'),
  ('pg_freespacemap','Free Space Map',        '공간 재사용 상태'),
  ('pg_prewarm',     '캐시 예열',             '재시작 후 성능 회복'),
  ('pgrowlocks',     '행 잠금 상태',          '락 경합 조사')
) AS t(extension, 노출하는_것, 실무_용도);

\echo ''
\echo '  → 이 부류는 "기능"이 아니라 "관찰 수단"입니다.'
\echo '    평소엔 필요 없다가, 문제가 생겼을 때 원인을 좁히는 데 결정적입니다.'
