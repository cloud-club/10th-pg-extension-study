-- ===========================================================================
-- 01. auto_explain 은 Extension 이 아닙니다
-- ===========================================================================
\echo '--- 설치 가능한 extension 목록에 없습니다 ---'
SELECT count(*) AS "auto_explain 이 목록에 있나?"
FROM   pg_available_extensions WHERE name='auto_explain';

\echo ''
\echo '--- CREATE EXTENSION 을 시도하면 ---'
DO $$ BEGIN
    EXECUTE 'CREATE EXTENSION auto_explain';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END $$;

\echo ''
\echo '--- 이유: control 파일이 없습니다 ---'
\echo '  [컨테이너 셸] $ ls /usr/share/postgresql/16/extension/ | grep -c auto_explain || echo "  control/sql 파일: 0개"'
\! ls /usr/share/postgresql/16/extension/ | grep -c auto_explain || echo "  control/sql 파일: 0개"

\echo ''
\echo '--- 그런데 .so 는 있습니다 ---'
\echo '  [컨테이너 셸] $ ls -l /usr/lib/postgresql/16/lib/auto_explain.so'
\! ls -l /usr/lib/postgresql/16/lib/auto_explain.so

\echo ''
\echo '+--------------------------------------------------------------+'
\echo '|  Extension  =  .control + .sql  (+ .so)                      |'
\echo '|               -> 카탈로그에 기록됨, 버전 관리됨, DROP 가능   |'
\echo '|                                                              |'
\echo '|  Module     =  .so 만                                        |'
\echo '|               -> 카탈로그 기록 없음, 버전 개념 없음          |'
\echo '|               -> LOAD 또는 *_preload_libraries 로만 로드     |'
\echo '+--------------------------------------------------------------+'

\echo ''
\echo '--- 다른 모듈들 (control 파일 없이 .so 만 있는 것들) ---'
\echo '  [컨테이너 셸] $ for f in /usr/lib/postgresql/16/lib/*.so; do b=$(basename "$f" .so); [ -f "/usr/share/postgresql/16/extension/$b.control" ] || echo "  $b"; done | head -12'
\! for f in /usr/lib/postgresql/16/lib/*.so; do b=$(basename "$f" .so); [ -f "/usr/share/postgresql/16/extension/$b.control" ] || echo "  $b"; done | head -12

\echo ''
\echo '  ^ 목록에 섞여 있는 것이 세 종류입니다.'
\echo '    · 쓸 수 있는 모듈      - auto_explain, passwordcheck, auth_delay ...'
\echo '    · 내부용 라이브러리    - euc_kr_and_mic 같은 인코딩 변환기 등'
\echo '    · extension 의 라이브러리인데 이름이 달라서 낀 것 - _int (= intarray)'
\echo '      → 마지막 경우는 03 번 스크립트에서 자세히 봅니다.'
