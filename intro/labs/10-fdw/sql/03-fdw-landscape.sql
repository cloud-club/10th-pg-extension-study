-- ===========================================================================
-- 03. FDW 생태계와 실무 판단
-- ===========================================================================
\echo '--- 지금 등록된 FDW 와 서버 ---'
SELECT fdwname AS FDW FROM pg_foreign_data_wrapper ORDER BY 1;
SELECT s.srvname AS 서버, f.fdwname AS FDW
FROM   pg_foreign_server s JOIN pg_foreign_data_wrapper f ON f.oid=s.srvfdw ORDER BY 1;

\echo ''
\echo '--- 주요 FDW 들 ---'
SELECT * FROM (VALUES
  ('postgres_fdw', 'contrib',   '다른 PostgreSQL',      '푸시다운 강력. 가장 성숙'),
  ('file_fdw',     'contrib',   '서버 로컬 CSV/TSV',    '읽기 전용, 인덱스 없음'),
  ('dblink',       'contrib',   '다른 PostgreSQL',      '레거시. 함수 기반. 신규는 postgres_fdw'),
  ('mysql_fdw',    '서드파티',  'MySQL',                ''),
  ('mongo_fdw',    '서드파티',  'MongoDB',              ''),
  ('oracle_fdw',   '서드파티',  'Oracle',               '마이그레이션에 자주 쓰임'),
  ('parquet_fdw',  '서드파티',  'Parquet 파일',         '데이터 레이크 조회'),
  ('multicorn',    '서드파티',  'Python 으로 직접 작성', 'REST API 등 무엇이든')
) AS t(FDW, 출처, 연결_대상, 비고);

\echo ''
\echo '--- 언제 쓰고 언제 피하나 ---'
SELECT * FROM (VALUES
  ('좋은 경우', '레거시 DB 점진적 마이그레이션 - 옛 DB 를 뷰처럼 붙여두고 조금씩 이전'),
  ('좋은 경우', '소량의 참조 데이터 조회 - 코드 테이블, 마스터 데이터'),
  ('좋은 경우', '일회성 분석 - CSV/로그를 SQL 로 훑어보기'),
  ('좋은 경우', '샤드 통합 조회 - 여러 DB 의 같은 테이블을 UNION 뷰로'),
  ('피할 경우', '대량 데이터의 실시간 조인 - 네트워크가 병목이 된다'),
  ('피할 경우', '푸시다운이 안 되는 조건 - 전체를 끌어오게 된다'),
  ('피할 경우', '원격이 느리거나 불안정 - 로컬 쿼리까지 같이 느려진다'),
  ('피할 경우', '강한 트랜잭션 보장이 필요 - 2PC 없이는 원자성이 없다')
) AS t(구분, 상황);

\echo ''
\echo '--- 성능을 위해 반드시 할 것 ---'
\echo '  ① EXPLAIN (VERBOSE) 로 "Remote SQL" 을 확인 - 무엇이 푸시다운되는지'
\echo '  ② 원격 테이블도 ANALYZE - 통계가 없으면 플래너가 헛짚는다'
\echo '  ③ use_remote_estimate 옵션 - 원격에 EXPLAIN 을 물어봐 더 정확한 계획을 세운다'
\echo '  ④ fetch_size 조정 - 기본 100행씩 가져온다. 대량이면 늘려라'

ALTER SERVER remote_pg OPTIONS (ADD use_remote_estimate 'true', ADD fetch_size '10000');
SELECT srvname, srvoptions FROM pg_foreign_server WHERE srvname='remote_pg';

ANALYZE remote.orders_remote;
EXPLAIN (COSTS OFF) SELECT count(*) FROM remote.orders_remote WHERE city='부산';
