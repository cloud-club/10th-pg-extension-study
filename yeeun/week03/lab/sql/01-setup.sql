-- ===========================================================================
-- 01. preload · CREATE EXTENSION · 설정 확인
-- ===========================================================================
\echo '--- 환경 ---'
SELECT version();
SHOW shared_preload_libraries;

\echo '--- Extension ---'
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_cron';

\echo '--- cron.* 설정 ---'
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'cron.%'
ORDER BY name;

\echo '--- 테스트 테이블 ---'
DROP TABLE IF EXISTS cron_test;
CREATE TABLE cron_test (
    id         bigserial PRIMARY KEY,
    note       text NOT NULL DEFAULT 'tick',
    created_at timestamptz NOT NULL DEFAULT now()
);
