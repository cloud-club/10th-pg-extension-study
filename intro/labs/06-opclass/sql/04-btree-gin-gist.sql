-- ===========================================================================
-- 04. btree_gin / btree_gist - "GIN·GiST 에 평범한 타입을 넣게 해주는" extension
-- ===========================================================================
\echo '======== btree_gin: 복합 GIN 인덱스 만들기 ========'
\echo ''
\echo '  문제: GIN 은 원래 배열·jsonb·트라이그램처럼 "여러 값을 가진" 타입용입니다.'
\echo '        text, int 같은 평범한 타입은 GIN 에 넣을 수 없습니다.'
\echo '        그래서 "level = ERROR AND msg LIKE %999%" 같은 복합 조건을'
\echo '        인덱스 하나로 처리할 수 없었습니다.'

DROP TABLE IF EXISTS logs;
CREATE TABLE logs AS
SELECT g AS id, (ARRAY['INFO','WARN','ERROR'])[1+(g%3)] AS level,
       'message ' || g AS msg
FROM   generate_series(1, 100000) g;
ANALYZE logs;

\echo ''
\echo '--- btree_gin 덕분에 text 컬럼을 GIN 에 넣을 수 있습니다 ---'
CREATE INDEX idx_logs_multi ON logs USING gin (level, msg gin_trgm_ops);
ANALYZE logs;

EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM logs WHERE level='ERROR' AND msg LIKE '%999%';

\echo ''
\echo '  ^ Index Cond 에 두 조건이 모두 들어갔습니다.'
\echo '    btree_gin 이 없으면 level(text) 을 GIN 에 넣을 수 없어 이 인덱스 자체가 불가능합니다.'

\echo ''
\echo '======== btree_gist: 배제 제약(EXCLUDE) ========'
\echo ''
\echo '  가장 실용적인 쓰임은 "겹치는 예약을 막는" 것입니다.'

DROP TABLE IF EXISTS reservations;
CREATE TABLE reservations (
    id     serial PRIMARY KEY,
    room   int,
    period tstzrange,
    -- room 이 "같고"(=) period 가 "겹치면"(&&) 거부한다.
    -- = 연산자를 GiST 에서 쓰려면 btree_gist 가 필요하다.
    EXCLUDE USING gist (room WITH =, period WITH &&)
);

INSERT INTO reservations (room, period)
VALUES (101, '[2026-09-01 10:00, 2026-09-01 12:00)');
\echo '  101호 10~12시 예약 완료'

DO $$ BEGIN
    INSERT INTO reservations (room, period)
    VALUES (101, '[2026-09-01 11:00, 2026-09-01 13:00)');
EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE '거부됨: 같은 방의 겹치는 시간대입니다';
END $$;

INSERT INTO reservations (room, period)
VALUES (102, '[2026-09-01 11:00, 2026-09-01 13:00)');
\echo '  102호 11~13시는 다른 방이라 OK'

INSERT INTO reservations (room, period)
VALUES (101, '[2026-09-01 12:00, 2026-09-01 14:00)');
\echo '  101호 12~14시는 안 겹쳐서 OK (범위가 [) 라 12시는 경계)'

SELECT * FROM reservations ORDER BY room, period;

\echo ''
\echo '  → 이런 무결성은 애플리케이션 코드로 하면 동시성 문제가 생깁니다.'
\echo '    (두 요청이 동시에 "빈 시간"을 확인하고 둘 다 INSERT)'
\echo '    DB 제약으로 두면 그런 경합이 원천 차단됩니다. btree_gist 의 핵심 가치입니다.'
