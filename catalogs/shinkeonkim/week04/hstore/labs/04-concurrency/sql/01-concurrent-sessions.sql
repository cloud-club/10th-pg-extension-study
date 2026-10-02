-- ===========================================================================
-- 01. 같은 hstore 행을 여러 세션이 갱신하면 — 컨테이너 안에서 psql 세션을 여러 개 띄워 본다
--     (각 시나리오는 /lab/scripts/*.sh 가 세션을 나눠 실행한다)
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS hstore;

\echo '--- 1. 같은 행이면 다른 키를 바꿔도 기다린다 (잠금 단위는 행이다) ---'
\! bash /lab/scripts/s1-row-lock.sh
\if :SHELL_ERROR
  SELECT 1 / 0 AS "시나리오 검증 실패";
\endif

\echo ''
\echo '--- 2. 읽고 통째로 쓰면 유실된다 ---'
\! bash /lab/scripts/s2-lost-update.sh
\if :SHELL_ERROR
  SELECT 1 / 0 AS "시나리오 검증 실패";
\endif

\echo ''
\echo '--- 3. 유실을 막는 두 방법 ---'
\! bash /lab/scripts/s3-atomic-vs-for-update.sh
\if :SHELL_ERROR
  SELECT 1 / 0 AS "시나리오 검증 실패";
\endif

\echo ''
\echo '--- 4. REPEATABLE READ 에서는 오류가 난다 ---'
\! bash /lab/scripts/s4-repeatable-read.sh
\if :SHELL_ERROR
  SELECT 1 / 0 AS "시나리오 검증 실패";
\endif

\echo ''
\echo '--- 5. pgbench: 카운터 400번 올리기 ---'
\! bash /lab/scripts/s5-counter-pgbench.sh
\if :SHELL_ERROR
  SELECT 1 / 0 AS "시나리오 검증 실패";
\endif
