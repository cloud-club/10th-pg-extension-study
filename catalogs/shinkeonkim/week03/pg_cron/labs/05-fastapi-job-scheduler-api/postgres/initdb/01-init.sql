-- 최초 기동 시 1회 실행된다 (docker-entrypoint-initdb.d 관례).
-- cron.database_name=study 와 같은 DB 이므로 여기서 CREATE EXTENSION 이 허용된다.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- API 의 데모 잡("demo-heartbeat")이 기록할 대상 테이블.
CREATE TABLE IF NOT EXISTS heartbeat (
    id   serial PRIMARY KEY,
    tick timestamptz NOT NULL DEFAULT now()
);
