-- ===========================================================================
-- 02. 카탈로그에 없어도 동작은 한다
-- ===========================================================================
\echo '--- 미리 로드되어 있습니다 ---'
SHOW shared_preload_libraries;

\echo ''
\echo '--- GUC 가 등록되어 있습니다 (모듈이 _PG_init 에서 등록한 것) ---'
SELECT name AS 설정, setting AS 값, short_desc AS 설명
FROM   pg_settings WHERE name LIKE 'auto_explain%' ORDER BY name;

\echo ''
\echo '--- 평범한 쿼리를 하나 실행합니다 (EXPLAIN 을 붙이지 않습니다) ---'
DROP TABLE IF EXISTS t_demo;
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;
SELECT count(*) FROM t_demo WHERE id BETWEEN 1000 AND 2000;

\echo ''
\echo '--- 그런데 서버 로그에는 실행 계획이 남아 있습니다 ---'
\echo '  [컨테이너 셸] $ tail -c 4000 /var/lib/postgresql/data/log/postgresql.log | grep -A8 "t_demo WHERE id BETWEEN" | tail -12'
\! tail -c 4000 /var/lib/postgresql/data/log/postgresql.log | grep -A8 "t_demo WHERE id BETWEEN" | tail -12

\echo ''
\echo '  ^ 어떻게? auto_explain 이 ExecutorEnd_hook 에 자기 함수를 끼워넣었기 때문입니다.'
\echo '    쿼리가 끝날 때마다 그 함수가 호출되어 계획을 로그로 씁니다.'
\echo '    애플리케이션 코드를 한 줄도 바꾸지 않고 모든 쿼리의 계획을 얻는 방법입니다.'

\echo ''
\echo '--- 운영에서 쓰는 법 ---'
SELECT * FROM (VALUES
  ('auto_explain.log_min_duration', '-1(끄기) / 1000(1초 이상만). 0 은 절대 금물'),
  ('auto_explain.log_analyze',      'on 이면 실제 시간/행수까지. 오버헤드 있음'),
  ('auto_explain.sample_rate',      '0.01 = 1%만 기록. 부하 큰 서버에서 필수'),
  ('auto_explain.log_nested_statements', '함수 안의 쿼리까지 기록'),
  ('auto_explain.log_format',       'text / json / yaml - 로그 수집기 연동 시 json')
) AS t(설정, 권장);

\echo ''
\echo '  ⚠ 이 lab 은 log_min_duration=0 으로 "모든 쿼리"를 기록합니다. 실습용입니다.'
\echo '     운영에서 그렇게 하면 로그가 폭증하고 성능이 떨어집니다.'
\echo '     보통 log_min_duration=1000 (1초 이상) + sample_rate 로 시작합니다.'
