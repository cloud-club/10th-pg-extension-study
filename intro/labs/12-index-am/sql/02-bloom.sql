-- ===========================================================================
-- 02. bloom - "여러 컬럼 중 아무거나" 검색하기
-- ===========================================================================
\echo '--- 문제 상황: 어떤 컬럼으로 검색할지 미리 알 수 없다 ---'
\echo '   B-tree 복합 인덱스 (a, b, c) 는 a 부터 써야 효율적입니다.'
\echo '   b 만으로, 또는 c 만으로 검색하면 잘 안 듭니다.'
\echo '   컬럼이 6개면 조합이 너무 많아 인덱스를 다 만들 수 없습니다.'

-- 주의: 테이블이 좁으면 Seq Scan 이 워낙 싸서 플래너가 bloom 을 안 씁니다.
--       실제로 bloom 을 쓰는 상황(넓은 행 + 많은 행)을 만들어야 의미가 있습니다.
DROP TABLE IF EXISTS events;
CREATE TABLE events AS
SELECT g AS id,
       (g % 7)   AS c1, (g % 11)  AS c2, (g % 13) AS c3,
       (g % 17)  AS c4, (g % 19)  AS c5, (g % 23) AS c6,
       repeat('x', 150) AS payload      -- 현실적인 행 크기
FROM   generate_series(1, 500000) g;
ANALYZE events;
SELECT pg_size_pretty(pg_relation_size('events')) AS 테이블_크기;

\echo ''
\echo '--- 인덱스 없이 ---'
SET max_parallel_workers_per_gather = 0;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c3 = 5 AND c5 = 10;

\echo ''
\echo '--- bloom 인덱스 하나로 모든 컬럼 조합 커버 ---'
CREATE INDEX idx_events_bloom ON events USING bloom (c1, c2, c3, c4, c5, c6)
  WITH (length = 80, col1 = 2, col2 = 2, col3 = 2, col4 = 2, col5 = 2, col6 = 2);
ANALYZE events;

EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c3 = 5 AND c5 = 10;

\echo ''
\echo '--- 다른 조합도 같은 인덱스가 처리합니다 ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c1 = 3 AND c6 = 7;

EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c2 = 4 AND c4 = 9 AND c6 = 2;
RESET max_parallel_workers_per_gather;

\echo ''
\echo '--- 원리: 블룸 필터 ---'
\echo '  각 행의 값들을 해시해서 고정 길이 비트맵(시그니처)에 기록합니다.'
\echo '  검색할 때 "이 비트가 켜져 있지 않으면 확실히 없다"를 판단합니다.'
\echo '  → 거짓 양성(false positive)은 있지만 거짓 음성은 없습니다.'
\echo '  → 그래서 Bitmap Heap Scan 의 Recheck Cond 로 다시 확인합니다.'
\echo '     실행 계획의 "Rows Removed by Index Recheck" 가 거짓 양성의 양입니다.'

\echo ''
\echo '--- 크기 비교 ---'
CREATE INDEX idx_c1 ON events (c1);
CREATE INDEX idx_c2 ON events (c2);
CREATE INDEX idx_c3 ON events (c3);
CREATE INDEX idx_c4 ON events (c4);
CREATE INDEX idx_c5 ON events (c5);
CREATE INDEX idx_c6 ON events (c6);

SELECT 'bloom 1개 (6컬럼 전부 커버)' AS 방식,
       pg_size_pretty(pg_relation_size('idx_events_bloom')) AS 크기
UNION ALL
SELECT 'B-tree 6개 (컬럼당 1개)',
       pg_size_pretty(pg_relation_size('idx_c1') + pg_relation_size('idx_c2')
                    + pg_relation_size('idx_c3') + pg_relation_size('idx_c4')
                    + pg_relation_size('idx_c5') + pg_relation_size('idx_c6'));

\echo '  ^ 게다가 B-tree 6개로도 "c3 AND c5" 같은 조합은 BitmapAnd 로 합쳐야 합니다.'
\echo '    bloom 은 인덱스 하나가 모든 조합을 커버합니다.'
