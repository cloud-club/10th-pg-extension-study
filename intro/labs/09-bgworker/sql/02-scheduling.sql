-- ===========================================================================
-- 02. 스케줄 등록하고 실제로 도는지 보기
-- ===========================================================================
DROP TABLE IF EXISTS heartbeat;
CREATE TABLE heartbeat (id serial PRIMARY KEY, tick timestamptz DEFAULT now());

\echo '--- 기존 잡 정리 ---'
DO $$
DECLARE j record;
BEGIN
    FOR j IN SELECT jobname FROM cron.job LOOP
        PERFORM cron.unschedule(j.jobname);
    END LOOP;
END $$;

\echo ''
\echo '--- 잡 등록 (cron 표현식) ---'
SELECT cron.schedule('heartbeat',      '* * * * *',   $$INSERT INTO heartbeat DEFAULT VALUES$$) AS jobid;
SELECT cron.schedule('nightly-vacuum', '0 3 * * *',   'VACUUM ANALYZE heartbeat') AS jobid;
SELECT cron.schedule('weekly-report',  '0 9 * * MON', 'SELECT 1') AS jobid;

SELECT jobid, jobname AS 잡이름, schedule AS 스케줄,
       left(command, 40) AS 명령, database AS DB, active AS 활성
FROM   cron.job ORDER BY jobid;

\echo ''
\echo '--- 1초 단위 스케줄도 됩니다 (pg_cron 1.5+) ---'
SELECT cron.schedule('fast-tick', '1 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$) AS jobid;

\echo '  5초 기다립니다...'
SELECT pg_sleep(5);

\echo ''
\echo '--- 실제로 실행되었나 ---'
SELECT count(*) AS 기록된_행수 FROM heartbeat;
SELECT id, tick FROM heartbeat ORDER BY id LIMIT 5;

\echo ''
\echo '--- 실행 이력 ---'
SELECT jobid, status, left(return_message, 30) AS 결과,
       start_time, end_time
FROM   cron.job_run_details ORDER BY runid DESC LIMIT 5;

\echo ''
\echo '  ^ 백그라운드 워커가 우리 세션과 무관하게 INSERT 를 실행했습니다.'
\echo '    job_run_details 에 성공/실패가 기록되므로 모니터링에 쓸 수 있습니다.'

-- 정리
SELECT cron.unschedule('fast-tick');
SELECT cron.unschedule('heartbeat');
SELECT cron.unschedule('nightly-vacuum');
SELECT cron.unschedule('weekly-report');
