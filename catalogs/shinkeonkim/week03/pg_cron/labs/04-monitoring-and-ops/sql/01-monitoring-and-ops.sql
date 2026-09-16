-- ===========================================================================
-- 04. 운영 관점 - 겹치는 실행, 권한, 모니터링, 정리, 대안 비교
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

\echo '--- (A) 같은 잡이 겹치면? 동시 실행이 아니라 "직렬화"된다 ---'
\echo '    1초마다 도는데 실행에 3초 걸리는 잡을 걸어본다.'
SELECT cron.schedule('overlap-test', '1 seconds', $$SELECT pg_sleep(3)$$) AS jobid;

SELECT pg_sleep(8);

SELECT runid, status, start_time, end_time,
       start_time - lag(end_time) OVER (ORDER BY runid) AS 이전실행_끝난뒤_간격
FROM   cron.job_run_details
WHERE  jobid = (SELECT jobid FROM cron.job WHERE jobname = 'overlap-test')
ORDER  BY runid;

\echo ''
\echo '  ^ start_time 간격이 "1초"가 아니라 실행 시간(3초)만큼 벌어진다.'
\echo '    한 잡의 이전 실행이 안 끝났으면 다음 트리거는 대기했다가 그 직후 시작한다 -'
\echo '    동시에 두 인스턴스가 도는 게 아니다. (다른 "잡"끼리는 병렬로 돈다 - 03 참고)'

DO $$
BEGIN
 IF (SELECT count(*) FROM cron.job_run_details r JOIN cron.job j USING(jobid)
     WHERE j.jobname='overlap-test' AND r.status='succeeded') < 2 THEN
   RAISE EXCEPTION '직렬화 확인에 필요한 완료 실행이 부족하다';
 END IF;
 IF EXISTS (
   SELECT 1 FROM (
     SELECT start_time, lag(end_time) OVER (ORDER BY runid) AS previous_end
     FROM cron.job_run_details r JOIN cron.job j USING(jobid) WHERE j.jobname='overlap-test'
   ) r WHERE start_time < previous_end
 ) THEN RAISE EXCEPTION '동일 잡의 실행 구간이 겹친다'; END IF;
END $$;
SELECT cron.unschedule('overlap-test');

\echo ''
\echo '--- (B) 잡은 "등록한 사용자"의 권한으로 실행된다 ---'
CREATE ROLE demo_limited_user LOGIN;
GRANT USAGE ON SCHEMA cron TO demo_limited_user;

SET SESSION AUTHORIZATION demo_limited_user;
SELECT cron.schedule('limited-job', '1 seconds', $$SELECT current_user$$) AS jobid;
SELECT username FROM cron.job WHERE jobname = 'limited-job';

\echo '  ^ database/username 컬럼 기본값이 cron.schedule() 을 호출한 세션 기준이다.'
\echo '    최소 권한 role 로 잡을 등록하면, 그 잡도 딱 그 권한만큼만 할 수 있다.'
\echo '    (cron.enable_superuser_jobs=off 로 슈퍼유저의 잡 등록 자체를 막을 수도 있다)'

\echo ''
\echo '--- 잡 이름은 사용자별로 유효범위가 나뉜다 (jobname, username) UNIQUE ---'
\echo '    그래서 이름으로 unschedule 하려면 "그 이름을 등록한 본인"이어야 한다 -'
\echo '    슈퍼유저라도 남의 job 을 이름으로 못 지운다. jobid 로는 지울 수 있다.'
RESET SESSION AUTHORIZATION;
DO $$
BEGIN
 BEGIN
   PERFORM cron.unschedule('limited-job');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'could not find valid entry for job%' THEN RAISE; END IF;
   RAISE NOTICE '예상대로 postgres는 다른 사용자의 잡을 이름으로 삭제할 수 없다';
   RETURN;
 END;
 RAISE EXCEPTION '이름 범위 검증 실패';
END $$;
SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname='limited-job' AND username='demo_limited_user';

DROP OWNED BY demo_limited_user;
DROP ROLE demo_limited_user;

\echo ''
\echo '--- (C) job_run_details 는 계속 쌓인다 - 직접 자기 자신으로 청소한다 ---'
SELECT cron.schedule(
         'cleanup-old-runs', '0 3 * * *',
         $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
       ) AS jobid;
SELECT jobname, schedule, left(command, 60) AS 명령 FROM cron.job WHERE jobname = 'cleanup-old-runs';
SELECT cron.unschedule('cleanup-old-runs');

\echo ''
\echo '--- (D) 이 lab 서버의 cron.* 설정 전체 ---'
SELECT name, setting, short_desc FROM pg_settings WHERE name LIKE 'cron.%' ORDER BY name;

\echo ''
\echo '--- (E) 실무 체크리스트 ---'
SELECT * FROM (VALUES
  ('중복/겹침',   '같은 잡은 자동으로 직렬화된다(A) - 그래도 잡 자체에 taking-too-long 알람은 따로 두자'),
  ('실패 알림',   'cron.job_run_details.status = ''failed'' 를 모니터링해야 한다 - 조용히 묻히기 쉽다'),
  ('이력 정리',   'job_run_details 는 자동으로 안 지워진다 - (C)처럼 자기 자신을 청소하는 잡을 등록'),
  ('타임존',      'cron.timezone (기본 GMT) 이 서버 타임존과 다를 수 있다 - 명시적으로 확인'),
  ('단일 설치',   'pg_cron 은 클러스터에 한 DB 에만 설치된다 - 다른 DB 는 schedule_in_database()'),
  ('HA/스탠바이', '핫 스탠바이에서는 launcher 가 아예 안 뜬다. 프라이머리가 바뀌면 새 프라이머리에서 뜬다'),
  ('연결 인증',   '기본 모드는 launcher 가 localhost 로 libpq 접속 - pg_hba.conf 에 trust/비밀번호 설정 필요'),
  ('권한',        '잡은 등록한 유저 권한으로 실행된다(B) - 최소 권한 유저로 등록하라')
) AS t(항목, 주의사항);

\echo ''
\echo '--- (F) 대안 비교 ---'
SELECT * FROM (VALUES
  ('OS cron + psql',       'DB 밖', '표준적, DB 재시작과 무관',        '서버가 여러 대면 중복 실행 관리 필요'),
  ('pg_cron',              'DB 안', '스케줄이 DB 에 있어 백업됨',      '클러스터의 한 DB에 설치, 복잡한 의존성 표현 불가'),
  ('애플리케이션 스케줄러', '앱',   '앱 로직과 통합 쉬움',             '앱이 죽으면 안 돌음'),
  ('Airflow 등',           '외부',  '의존성/재시도/모니터링 강력',      '인프라 하나 더')
) AS t(방식, 위치, 장점, 단점);

\echo '  → "DB 안에서 끝나는 단순 주기 작업"(파티션 생성, 오래된 데이터 삭제,'
\echo '    통계 갱신, 리프레시 머티리얼라이즈드 뷰)에는 pg_cron 이 잘 맞는다.'
\echo '    여러 단계가 서로 의존하거나 실패 시 복잡한 재시도가 필요하면 전용 스케줄러를 쓴다.'
