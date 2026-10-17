-- ===========================================================================
-- 03. 실행 이력 · Job 제거
-- ===========================================================================
\echo '--- 실행 이력 (job_run_details) ---'
SELECT
    j.jobname,
    d.status,
    d.return_message,
    d.start_time,
    d.end_time
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname = 'insert-cron-test'
ORDER BY d.start_time DESC
LIMIT 10;

\echo '--- Job 제거 ---'
SELECT cron.unschedule('insert-cron-test');

SELECT count(*) AS remaining_named_jobs
FROM cron.job
WHERE jobname = 'insert-cron-test';

\echo ''
\echo '  흐름 요약:'
\echo '  schedule 등록 → Background Worker가 감지 → SQL 실행 → job_run_details 기록'
