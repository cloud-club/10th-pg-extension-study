-- ===========================================================================
-- 03. 잡은 실제로 "어떻게" 실행되나 - 기본 모드(libpq 연결) vs
--     background worker 모드, 그리고 동시 실행 개수 제한
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

\echo '--- 지금 이 lab 의 실행 모드 ---'
SHOW cron.use_background_workers;
\echo '  off(기본값)이면, launcher 는 libpq 로 로컬 서버에 "진짜 접속"해서 잡을 돌린다.'
\echo '  그래서 실행 중인 잡은 pg_stat_activity 에 평범한 client backend 로 보인다.'
\echo '  (on 으로 바꾸려면 shared_preload_libraries 처럼 서버 재시작이 필요하다 -'
\echo '   HANDS-ON.md 의 "직접 실험해볼 것"에서 직접 재현해본다)'

\echo ''
\echo '--- 3초 자는 잡을 하나 예약하고, 도는 도중에 pg_stat_activity 를 본다 ---'
SELECT cron.schedule('sleeper', '1 seconds', $$SELECT pg_sleep(3)$$) AS jobid;

SELECT pg_sleep(2.5);  -- 잡이 시작될 시간을 준다 (다음 1초 틱 + 접속 시간 여유)

SELECT pid, backend_type, application_name AS app, left(query, 30) AS 실행중인_쿼리
FROM   pg_stat_activity
WHERE  application_name = 'pg_cron' AND pid <> pg_backend_pid();

\echo ''
\echo '  ^ backend_type 이 "client backend" 다. pg_cron 이 만든 별도 프로세스 종류가'
\echo '    아니라, 우리가 psql 로 접속한 것과 똑같은 방식의 연결이다.'
\echo '    application_name = pg_cron 으로 구분할 수 있다.'

SELECT cron.unschedule('sleeper');
-- unschedule은 jobCanceled 경로를 통해 실행 중 작업에도 영향을 준다.
-- 취소 반영/세션 종료는 비동기이므로 잠시 기다린다.
SELECT pg_sleep(1.5);

\echo ''
\echo '--- 동시 실행 개수 제한: cron.max_running_jobs ---'
SHOW cron.max_running_jobs;
\echo '  이 lab 은 docker-compose.yml 에서 5로 낮춰뒀다 (기본값은 32).'
\echo '  1초마다 도는 "3초짜리" 잡을 8개 동시에 걸어서 한계를 넘겨본다.'

DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..8 LOOP
    PERFORM cron.schedule('load-' || i, '1 seconds', 'SELECT pg_sleep(3)');
  END LOOP;
END $$;

SELECT pg_sleep(2);  -- 잡들이 시작되고 겹칠 시간을 준다

DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_stat_activity WHERE application_name='pg_cron' AND state='active';
 IF n < 1 OR n > current_setting('cron.max_running_jobs')::int THEN
  RAISE EXCEPTION '실행 백엔드 수가 예상 범위를 벗어났다: %', n;
 END IF;
END $$;
SELECT count(*) AS 동시_실행중인_pg_cron_백엔드
FROM   pg_stat_activity WHERE application_name = 'pg_cron';

\echo ''
\echo '  ^ 8개를 걸었지만 동시에 도는 건 cron.max_running_jobs(5) 를 넘지 않는다.'
\echo '    상한과 정상 진행은 별개다. 실험 03에서는 1.6.8의 포화 조건에서 startup timeout을 관찰했다.'
\echo '    (README 의 표현: "queued and starts as soon as the first one completes"'
\echo '     는 "같은 잡"이 겹칠 때의 이야기이고, max_running_jobs 는 서버 전체의 상한이다)'

\echo ''
\echo '--- 정리 ---'
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;
