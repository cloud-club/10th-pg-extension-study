-- ===========================================================================
-- 02. 스케줄 문법 · 이름 있는/없는 잡 · 다른 DB 에 스케줄링 · 잡 수정
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DROP TABLE IF EXISTS heartbeat;
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());

\echo '--- 기존 잡 정리 ---'
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

\echo ''
\echo '--- cron 문법: 표준 5필드 + 초 단위 + 매월 마지막 날 ---'
SELECT cron.schedule('every-minute',      '* * * * *',   $$SELECT 1$$)                     AS jobid;
SELECT cron.schedule('every-5-min',       '*/5 * * * *', $$SELECT 1$$)                     AS jobid;
SELECT cron.schedule('nightly-vacuum',    '0 3 * * *',   'VACUUM ANALYZE heartbeat')       AS jobid;
SELECT cron.schedule('end-of-month',      '0 12 $ * *',  $$SELECT 'payroll'$$)             AS jobid;  -- $ = 그 달의 마지막 날 (pg_cron 1.6+)
SELECT cron.schedule('fast-tick',         '2 seconds',   $$INSERT INTO heartbeat DEFAULT VALUES$$) AS jobid;  -- 1~59초 간격 (1.5+)

\echo ''
\echo '--- 이름 없이 등록할 수도 있다 (schedule, command 두 인자짜리 오버로드) ---'
DO $$
BEGIN
  BEGIN
    EXECUTE 'SELECT cron.schedule(''SELECT 1'')';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '예상대로 1인자 오버로드가 없다';
    RETURN;
  END;
  RAISE EXCEPTION '예상하지 못한 1인자 오버로드';
END $$;
SELECT cron.schedule('* * * * *', $$SELECT pg_catalog.now()$$) AS jobid;  -- jobname 이 자동으로 NULL 인 채로 등록된다

SELECT jobid, jobname AS 이름, schedule, left(command, 30) AS 명령, database AS DB, active
FROM   cron.job ORDER BY jobid;

\echo ''
\echo '  ^ 이름을 안 주면 jobname 이 NULL 이다. cron.unschedule() 은 이름과 id 오버로드가'
\echo '    둘 다 있으니, 이름 없는 잡은 id 로 지워야 한다.'

\echo ''
\echo '--- 다른 데이터베이스에 스케줄링: cron.schedule_in_database() ---'
\echo '    (cron.job 은 study 에만 있지만, database 컬럼이 otherdb 를 가리키게 등록한다)'
SELECT cron.schedule_in_database(
         'otherdb-heartbeat', '3 seconds', $$SELECT pg_catalog.now()$$, 'otherdb'
       ) AS jobid;

SELECT jobid, jobname, database FROM cron.job WHERE database = 'otherdb';

\echo ''
\echo '  5초 기다린다 (fast-tick / otherdb-heartbeat 가 실제로 도는지 보려고)...'
SELECT pg_sleep(5);

DO $$
DECLARE deadline timestamptz := clock_timestamp() + interval '20 seconds';
BEGIN
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM heartbeat)
      AND EXISTS (SELECT 1 FROM cron.job_run_details WHERE database='otherdb' AND status='succeeded');
    IF clock_timestamp() > deadline THEN RAISE EXCEPTION 'heartbeat 또는 otherdb 실행 실패: cron.job_run_details를 확인하세요'; END IF;
    PERFORM pg_sleep(0.2);
  END LOOP;
END $$;
SELECT count(*) AS 기록된_행수 FROM heartbeat;
SELECT id, tick FROM heartbeat ORDER BY id LIMIT 5;

\echo ''
\echo '--- 실행 이력에도 otherdb 잡이 잡힌다 (실행은 study 의 launcher 가 시킨다) ---'
SELECT jobid, database, status, left(command, 25) AS 명령
FROM   cron.job_run_details
WHERE  database IN ('study', 'otherdb')
ORDER  BY runid DESC LIMIT 8;

\echo ''
\echo '--- 잡 수정: cron.alter_job() - unschedule 후 재등록할 필요 없다 ---'
SELECT jobid FROM cron.job WHERE jobname = 'every-minute' \gset target_
SELECT cron.alter_job(:target_jobid, schedule := '*/2 * * * *');
SELECT cron.alter_job(:target_jobid, active := false);  -- 지우지 않고 잠시 꺼두기

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobid = :target_jobid;

\echo ''
\echo '--- 정리 ---'
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;
SELECT count(*) AS 남은_잡_수 FROM cron.job;
