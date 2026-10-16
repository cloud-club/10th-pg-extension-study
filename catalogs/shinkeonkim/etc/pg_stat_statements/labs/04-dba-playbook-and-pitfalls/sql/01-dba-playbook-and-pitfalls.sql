-- ===========================================================================
-- 04. 실무 플레이북 - 운영에서 실제로 던지는 쿼리들 + 알아둬야 할 함정
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT pg_stat_statements_reset();

DROP TABLE IF EXISTS t_demo;
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1, 50000) g;
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 5000;
SELECT h FROM t_demo WHERE id = 1;
SELECT h FROM t_demo WHERE id = 2;
SELECT h FROM t_demo WHERE id = 3;

\echo '=== (A) 총 시간을 가장 많이 잡아먹은 쿼리 - 튜닝 우선순위는 여기서 시작한다 ==='
SELECT left(query, 40) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 2) AS 총ms,
       round(100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::int AS "전체대비%"
FROM   pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;

\echo '  → 1초짜리를 1번 부르는 쿼리보다 1ms짜리를 10만 번 부르는 쪽이 서버를 더 힘들게 한다.'
\echo '    mean_exec_time 이 아니라 total_exec_time 으로 정렬하는 이유.'

\echo ''
\echo '=== (B) N+1 의심 - 유난히 calls 가 많은 단순 쿼리 ==='
SELECT left(query, 40) AS 쿼리, calls,
       round(mean_exec_time::numeric, 3) AS 평균ms
FROM   pg_stat_statements
WHERE  calls > 2 AND query ILIKE 'SELECT h FROM t_demo%'
ORDER  BY calls DESC LIMIT 5;
\echo '  → 애플리케이션 로그 없이도 "한 화면 그리는 데 같은 모양의 쿼리가 N번 날아간다"를'
\echo '    calls 숫자만으로 의심할 수 있다.'

\echo ''
\echo '=== (C) 실행 시간 편차 - 평균은 멀쩡한데 가끔 튀는 쿼리 ==='
SELECT left(query, 40) AS 쿼리, calls,
       round(mean_exec_time::numeric, 2) AS 평균ms,
       round(stddev_exec_time::numeric, 2) AS 표준편차,
       round(max_exec_time::numeric, 2) AS 최대ms
FROM   pg_stat_statements WHERE calls > 1 ORDER BY stddev_exec_time DESC NULLS LAST LIMIT 5;
\echo '  → 평균만 보면 놓치는 "가끔 락 대기·플랜 변경으로 튀는" 쿼리를 stddev 로 잡는다.'

\echo ''
\echo '=== (D) 배포 전후 비교 워크플로우 ==='
\echo '    1) 배포 전 같은 길이 구간의 스냅샷을 보관한다. 필요 시 이후 reset한다.'
\echo '    2) 트래픽을 충분히 받는다'
\echo '    3) 배포 전/후 스냅샷을 비교한다 (pg_stat_statements_info.stats_reset 로 구간 확인)'
SELECT * FROM pg_stat_statements_info;
\echo '  ^ stats_reset 이 마지막으로 리셋된 시각이다. "이 통계는 언제부터의 것인가"를 항상 확인하라.'

\echo ''
\echo '=== (E) 선택적 리셋 - userid/dbid/queryid 조건으로 지운다 ==='
SELECT queryid, left(query, 40) AS 쿼리, calls
FROM   pg_stat_statements
WHERE  query LIKE 'SELECT count(*) FROM t_demo WHERE id < %'
ORDER  BY queryid;

-- 위 결과에서 하나의 queryid 를 골라 그 항목만 리셋한다.
-- (기본 인자는 userid=0, dbid=0 → "전부 일치하지 않아도 이 queryid 만" 지운다는 뜻이 아니라
--  세 값을 모두 지정해야 "그 조합"만 지운다. 0 은 "이 필드는 조건에서 빼지 않는다"가 아니라
--  와일드카드처럼 동작한다 - 자세한 의미는 문서에서 재확인.)
DO $$
DECLARE target_qid bigint;
BEGIN
  SELECT queryid INTO target_qid
  FROM   pg_stat_statements
  WHERE  query LIKE 'SELECT count(*) FROM t_demo WHERE id < %'
  ORDER  BY queryid LIMIT 1;

  PERFORM pg_stat_statements_reset(0, 0, target_qid);
  RAISE NOTICE '리셋한 queryid = %', target_qid;
END $$;

\echo '--- 리셋 후: 해당 queryid의 항목이 사라진다 (userid/dbid=0은 와일드카드) ---'
SELECT queryid, left(query, 40) AS 쿼리, calls
FROM   pg_stat_statements
WHERE  query LIKE 'SELECT count(*) FROM t_demo WHERE id < %'
    OR query LIKE 'SELECT h FROM t_demo WHERE id = %'
ORDER  BY queryid;

\echo ''
\echo '=== (F) eviction: pg_stat_statements.max 를 넘기면 무슨 일이 벌어지나 ==='
SHOW pg_stat_statements.max;
SELECT pg_stat_statements_reset();

\echo '  서로 다른 "모양"의 쿼리 1200개를 만들어 max(1000) 를 넘겨본다'
\echo '  (컬럼 별칭(AS probe_1 등)은 정규화 대상이 아니라서 바꿔봐야 같은 queryid 로 묶인다 -'
\echo '   그래서 "모양"을 진짜로 다르게 만들려면 파스 트리 구조 자체가 달라야 한다.'
\echo '   여기서는 함수 호출 개수를 1개씩 늘려 타겟리스트 길이를 다르게 만든다.)'

SELECT pg_stat_statements_reset();
DO $$
DECLARE i int; cols text;
BEGIN
  FOR i IN 1..1200 LOOP
    SELECT string_agg('length(''a'')', ',') INTO cols FROM generate_series(1, i);
    EXECUTE format('SELECT %s', cols);
  END LOOP;
END $$;

SELECT count(*) AS "지금_저장된_항목수" FROM pg_stat_statements;
SELECT dealloc AS "GC_실행_횟수", stats_reset FROM pg_stat_statements_info;

\echo '  ^ 지금 저장된 항목수가 max 를 넘지 못한다.'
\echo '    주의: pg_stat_statements_info.dealloc 은 "쫓겨난 항목 개수"가 아니라'
\echo '    "가비지 컬렉션이 실행된 횟수"다. 해시테이블이 가득 차면 한 번의 GC 에서'
\echo '    usage 점수가 낮은 항목을 한꺼번에 최소 10개, 또는 전체의 5% 중 큰 쪽만큼 지운다'
\echo '    (entry_dealloc() 의 USAGE_DEALLOC_PERCENT). 그래서 dealloc=5 인데 실제로'
\echo '    지워진 항목은 수십~수백 개일 수 있다 - 이 값 자체를 "쫓겨난 개수"로 착각하지 말 것.'
\echo '    운영에서 dealloc 이 계속 증가한다 = max 를 늘려야 한다는 신호.'

\echo ''
\echo '=== (G) 보안: 쿼리 텍스트는 아무나 다 볼 수 있는가? ==='
DROP ROLE IF EXISTS demo_alice;
DROP ROLE IF EXISTS demo_bob_viewer;
DROP ROLE IF EXISTS demo_carol_bystander;
CREATE ROLE demo_alice LOGIN;
CREATE ROLE demo_bob_viewer LOGIN;
CREATE ROLE demo_carol_bystander LOGIN;     -- 아무 권한도 추가로 주지 않은 "구경꾼" role
GRANT pg_read_all_stats TO demo_bob_viewer; -- PostgreSQL 10+ 에 있는 내장 역할
GRANT SELECT ON t_demo TO demo_alice;       -- alice 가 쿼리를 실행할 수 있으려면 권한이 있어야 한다

SELECT pg_stat_statements_reset();

\echo '  alice 가 쿼리를 하나 실행한다 - 이 쿼리의 "텍스트"를 누가 볼 수 있는지가 관심사다'
SET SESSION AUTHORIZATION demo_alice;
SELECT count(*) FROM t_demo WHERE id = 999999;
RESET SESSION AUTHORIZATION;

-- 아래 네 시점 모두 "alice 가 실행자인 행"을 rolname 으로 찾는다.
-- query 로 찾지 않는 이유: 권한이 없는 시점에서는 query 컬럼 자체가
-- '<insufficient privilege>' 라는 문자열로 가려지기 때문에, query 내용으로 찾으려고 하면
-- 애초에 그 행을 못 찾는다 (NULL 이 아니라 "권한 없음" 문자열이라는 게 핵심 포인트다).

\echo ''
\echo '--- 슈퍼유저(postgres) 시점: 항상 전부 보인다 ---'
SELECT r.rolname AS 실행자, s.queryid, left(s.query, 40) AS 쿼리, s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';

\echo ''
\echo '--- alice 본인 시점: 자기 쿼리는 그대로 보인다 ---'
SET SESSION AUTHORIZATION demo_alice;
SELECT r.rolname AS 실행자, s.queryid, left(s.query, 40) AS 쿼리, s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';
RESET SESSION AUTHORIZATION;

\echo ''
\echo '--- carol(권한도 없고 본인이 실행하지도 않은 구경꾼) 시점 ---'
SET SESSION AUTHORIZATION demo_carol_bystander;
SELECT r.rolname AS 실행자, s.queryid, left(s.query, 40) AS 쿼리, s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';
RESET SESSION AUTHORIZATION;
\echo '  ^ 행 자체(calls 등 통계)는 그대로 보인다. 다만 queryid 는 NULL 로,'
\echo '    query 는 실제 텍스트 대신 문자열 <insufficient privilege> 로 가려진다.'
\echo '    ("가려진다"는 게 NULL 이 아니라 이 고정 문자열이라는 점이 실무에서 자주 놓치는 부분이다 -'
\echo '     이 문자열로 WHERE query = ... 검색을 하면 당연히 아무것도 안 걸린다.)'

\echo ''
\echo '--- bob_viewer(pg_read_all_stats 보유) 시점: 남의 쿼리 텍스트도 보인다 ---'
SET SESSION AUTHORIZATION demo_bob_viewer;
SELECT r.rolname AS 실행자, s.queryid, left(s.query, 40) AS 쿼리, s.calls
FROM   pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
WHERE  r.rolname = 'demo_alice';
RESET SESSION AUTHORIZATION;

DROP OWNED BY demo_alice, demo_bob_viewer, demo_carol_bystander;  -- 남은 GRANT 를 먼저 걷어내야 DROP ROLE 이 된다
DROP ROLE demo_alice;
DROP ROLE demo_bob_viewer;
DROP ROLE demo_carol_bystander;

\echo ''
\echo '  ^ pg_stat_statements 는 기본적으로 "남의 쿼리 텍스트"까지 노출할 잠재력이 있다.'
\echo '    pg_read_all_stats 를 함부로 뿌리면, 리터럴이 섞인 쿼리(track_utility=on 일 때의'
\echo '    COPY/SET 등 일부 유틸리티 문)를 통해 민감한 값이 다른 팀원에게 보일 수 있다.'
\echo '    운영에서는 이 역할을 모니터링 계정 하나에만 좁게 부여하는 것이 정석이다.'

\echo ''
\echo '=== 정리 ==='
SELECT * FROM (VALUES
  ('total_exec_time 로 정렬',      '평균이 아니라 총합 - 진짜 부하는 여기서 나온다'),
  ('calls 급증',                    'N+1 의심'),
  ('stddev_exec_time 큼',           '가끔 튀는 쿼리 - 락 대기/플랜 변경 의심'),
  ('shared_blks_read 큼',           '캐시 미스 - shared_buffers 또는 인덱스 검토'),
  ('temp_blks_written > 0',         'work_mem 부족 - 디스크 정렬/해시'),
  ('wal_bytes 큼',                  '복제 지연·아카이브 비용의 원인 후보'),
  ('total_plan_time ≈ total_exec_time', 'PREPARE 로 계획 재사용 검토'),
  ('dealloc 이 계속 증가',          'pg_stat_statements.max 부족')
) AS t(신호, 의미);
