-- ===========================================================================
-- 03. 운영 관점 - 이 부류를 쓸 때 알아야 할 것
-- ===========================================================================
\echo '--- 설정들 ---'
SELECT name AS 설정, setting AS 값, short_desc AS 설명
FROM   pg_settings WHERE name LIKE 'cron.%' ORDER BY name;

\echo ''
\echo '--- cron.database_name 의 의미 ---'
SHOW cron.database_name;
\echo '  ^ 스케줄 "테이블"이 사는 DB 입니다. 여기에만 cron 스키마가 생깁니다.'
\echo '    다른 DB 의 작업을 돌리려면 cron.schedule_in_database() 를 씁니다.'

\echo ''
\echo '--- 어떤 스키마에 설치되었나 ---'
SELECT e.extname, n.nspname AS 스키마, e.extrelocatable AS 이동가능
FROM   pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
WHERE  e.extname='pg_cron';

\echo ''
\echo '--- 실무 체크리스트 ---'
SELECT * FROM (VALUES
  ('중복 실행',   '이전 실행이 안 끝났는데 다음이 시작될 수 있다. 잡 자체에 락을 걸어라'),
  ('실패 알림',   'cron.job_run_details 의 status=failed 를 모니터링해야 한다'),
  ('이력 정리',   'job_run_details 는 계속 쌓인다. 주기적으로 삭제하는 잡을 따로 둬라'),
  ('타임존',      'cron 표현식은 서버 타임존 기준. TimeZone 설정을 확인하라'),
  ('HA 환경',     '스탠바이로 페일오버하면 잡이 그쪽에서 돈다. 중복 실행 주의'),
  ('권한',        '잡은 등록한 유저 권한으로 실행된다. 최소 권한 유저로 등록하라')
) AS t(항목, 주의사항);

\echo ''
\echo '--- 대안 비교 ---'
SELECT * FROM (VALUES
  ('OS cron + psql',   'DB 밖',  '표준적, DB 재시작과 무관',      '서버가 여러 대면 중복 실행 관리 필요'),
  ('pg_cron',          'DB 안',  '스케줄이 DB 에 있어 백업됨',    'extension 설치 필요, HA 시 주의'),
  ('애플리케이션 스케줄러', '앱',  '앱 로직과 통합 쉬움',           '앱이 죽으면 안 돌음'),
  ('Airflow 등',       '외부',   '의존성/재시도/모니터링 강력',   '인프라 하나 더')
) AS t(방식, 위치, 장점, 단점);

\echo ''
\echo '  → "DB 안에서 끝나는 단순 주기 작업"(파티션 생성, 오래된 데이터 삭제,'
\echo '    통계 갱신)에는 pg_cron 이 잘 맞습니다.'
\echo '    복잡한 의존성이나 재시도가 필요하면 전용 스케줄러를 쓰세요.'

\echo ''
\echo '--- 같은 부류의 다른 extension ---'
SELECT * FROM (VALUES
  ('pg_cron',      '스케줄러 워커'),
  ('TimescaleDB',  '압축/집계/보존 정책을 백그라운드로 수행'),
  ('pg_partman',   'BGW 모드로 파티션 자동 생성 (NO_BGW 로 끌 수도 있음)'),
  ('pg_squeeze',   '테이블 bloat 을 백그라운드로 정리'),
  ('pgagent',      '작업 스케줄러 (별도 데몬)')
) AS t(extension, 하는_일);
