-- ===========================================================================
-- 02. Job 등록 (초 단위) — schedule → cron.job
-- pg_cron 은 '5 seconds' 같은 짧은 주기도 지원 (일반 cron 필드와 섞지 않음)
-- ===========================================================================
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'insert-cron-test';

\echo '--- 5초마다 INSERT Job 등록 ---'
SELECT cron.schedule(
    'insert-cron-test',
    '5 seconds',
    $$INSERT INTO cron_test(note) VALUES ('from pg_cron')$$
);

\echo '--- 등록된 Job ---'
SELECT jobid, jobname, schedule, command, active, database
FROM cron.job
ORDER BY jobid;

\echo '--- 스케줄러가 돌 시간을 잠깐 기다림 ---'
SELECT pg_sleep(12);

\echo '--- cron_test 에 쌓였는지 ---'
SELECT id, note, created_at
FROM cron_test
ORDER BY id;
