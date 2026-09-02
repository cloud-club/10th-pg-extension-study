-- ===========================================================================
-- 03. 업그레이드 스크립트 실행 (1.0 -> 1.1)
-- ===========================================================================
\echo '--- 현재 버전과 계산된 업그레이드 경로 ---'
SELECT extname, extversion FROM pg_extension WHERE extname='greetkor';
SELECT source, target, path FROM pg_extension_update_paths('greetkor') WHERE path IS NOT NULL;

\echo ''
\echo '--- 업그레이드 전 greet() 출력 ---'
SELECT greet('세계') AS before_upgrade;

\echo ''
\echo '--- ALTER EXTENSION greetkor UPDATE TO ''1.1'' ---'
ALTER EXTENSION greetkor UPDATE TO '1.1';
SELECT extname, extversion FROM pg_extension WHERE extname='greetkor';

\echo ''
\echo '--- (1) CREATE OR REPLACE 로 교체된 기존 함수 ---'
SELECT greet('세계') AS after_upgrade;

\echo ''
\echo '--- (2) 새로 추가된 함수 ---'
\echo '    greet_time 은 extract(hour FROM ...) 를 쓰므로 세션 TimeZone 을 탄다.'
\echo '    컨테이너 기본값은 Etc/UTC 라서, 한국 시각으로 판정하려면 이렇게 맞춘다.'
SET TimeZone = 'Asia/Seoul';
SELECT greet_time('세계', '2026-08-30 09:00+09') AS morning,
       greet_time('세계', '2026-08-30 14:00+09') AS afternoon,
       greet_time('세계', '2026-08-30 21:00+09') AS evening;
RESET TimeZone;

\echo ''
\echo '--- (3) 업그레이드가 추가한 설정 테이블 ---'
SELECT * FROM greetkor_config;

\echo ''
\echo '--- extconfig: pg_dump 가 "데이터까지" 덤프할 테이블로 등록되었다 ---'
SELECT extname, extconfig, extconfig::regclass[] AS tables, extcondition
FROM   pg_extension WHERE extname='greetkor';

\echo ''
\echo '--- 업그레이드 후 소속 객체 (테이블/시퀀스/인덱스까지 포함) ---'
\echo '\\dx+ greetkor'
\dx+ greetkor
