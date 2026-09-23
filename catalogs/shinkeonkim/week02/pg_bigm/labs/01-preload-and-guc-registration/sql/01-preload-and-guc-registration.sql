-- ===========================================================================
-- 01. pg_bigm 은 "왜" preload 를 권장하나 - pg_stat_statements/pg_cron 과는
--     완전히 다른 이유다. 이 lab 은 일부러 shared_preload_libraries 없이 띄웠다.
-- ===========================================================================
\echo '--- 이 서버는 아무것도 preload 하지 않았다 ---'
SHOW shared_preload_libraries;

\echo ''
\echo '--- CREATE EXTENSION - preload 없이도 성공한다 ---'
CREATE EXTENSION pg_bigm;
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_bigm';

\echo ''
\echo '--- 카탈로그에 남긴 흔적 ---'
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid = d.objid)
         WHEN 'pg_operator'::regclass THEN (SELECT oprname FROM pg_operator WHERE oid = d.objid)
         WHEN 'pg_opclass'::regclass THEN (SELECT opcname FROM pg_opclass WHERE oid = d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
  AND  e.extname = 'pg_bigm' AND d.classid IN ('pg_proc'::regclass, 'pg_operator'::regclass, 'pg_opclass'::regclass)
ORDER  BY 1, 2;
\echo '  ^ 함수 몇 개, 연산자(=%), GIN 연산자 클래스(gin_bigm_ops) - 훅도 백그라운드 워커도 없다.'
\echo '    pg_stat_statements/pg_cron 과 근본적으로 다른 부류다.'

\echo ''
\echo '--- 그런데 왜 공식 문서는 preload 를 요구할까? 실제로 재현해본다 ---'
\echo '    지금 이 세션은 방금 CREATE EXTENSION 을 "직접 실행"했다.'
\echo '    CREATE FUNCTION ... AS ''MODULE_PATHNAME'' 은 심볼이 실제로 있는지'
\echo '    검증하려고 그 자리에서 .so 를 dlopen 한다 - 그래서 지금 이 세션은'
\echo '    이미 pg_bigm.so 가 로드되어 있다. pg_settings 로 확인해보자.'
SELECT name, vartype, source, setting
FROM   pg_settings WHERE name = 'pg_bigm.similarity_limit';
\echo '  ^ vartype=real, source=default - 진짜 GUC 로 등록되어 있다 (placeholder 아님).'
\echo '    "함수 한 번도 안 불렀는데" 이미 이렇게 된 이유가 CREATE FUNCTION 의 심볼 검증이다.'

\echo ''
\echo '--- 먼저 "평범한 SET" 이 아무 세션에서나 되는 걸 확인한다 - 그런데 이건 pg_bigm 과 무관하다 ---'
\! psql -U postgres -d study -c "SET whatever_random_ext.foo = 1; SHOW whatever_random_ext.foo;" 2>&1
\echo '  ^ pg_bigm 근처에도 안 간 아무 이름으로도 SET 은 항상 성공한다 (PostgreSQL 의 범용'
\echo '    "placeholder GUC" 메커니즘 - 점(.)이 들어간 이름이면 아직 모르는 것도 일단 받아준다).'
\echo '    "SET 이 되니까 preload 가 필요 없다"고 여기서 착각하기 쉽다 - 실제 차이는 다음 단계에 있다.'

\echo ''
\echo '--- 이번엔 "이미 설치돼 있는 걸 보기만 하는" 새 세션"에서 ALTER SYSTEM SET 을 해본다 ---'
\echo '    (이 세션이 아직 ALTER SYSTEM 을 한 번도 안 써봤어야 정확히 재현된다 - 그래서 순서가 중요하다)'
\! psql -U postgres -d study -c "ALTER SYSTEM SET pg_bigm.similarity_limit = 0.5;" 2>&1
\echo '  ^ "unrecognized configuration parameter" 로 실패한다.'
\echo '    그 새 세션(backend)은 pg_bigm 함수를 한 번도 부른 적이 없어서 .so 가 아직'
\echo '    그 프로세스 메모리에 없다 - 카탈로그에 설치돼 있는 것과'
\echo '    "이 백엔드 프로세스가 그 코드를 메모리에 올렸는가"는 별개의 문제다.'
\echo '    (평범한 SET 과 달리 ALTER SYSTEM SET 은 placeholder 를 새로 만들어주지 않는다)'

\echo ''
\echo '--- 반면 지금 이 세션(CREATE EXTENSION 을 직접 실행한 세션)에서는 바로 된다 ---'
ALTER SYSTEM SET pg_bigm.similarity_limit = 0.42;
ALTER SYSTEM RESET pg_bigm.similarity_limit;  -- 원복 (auto.conf 를 더럽히지 않는다)
SELECT pg_reload_conf();
\echo '  ^ 에러 없이 성공한다 - 이 세션은 이미 .so 를 메모리에 갖고 있기 때문이다.'
\echo '    같은 명령이 세션에 따라 되기도, 안 되기도 하는 게 바로 preload 미비의 실제 증상이다.'

\echo ''
\echo '--- 정리: preload 가 있으면 무엇이 달라지나 ---'
SELECT * FROM (VALUES
  ('CREATE EXTENSION',              '차이 없음 - preload 없이도 된다'),
  ('LIKE 검색 / GIN 인덱스 사용',    '차이 없음 - 첫 사용 시 그 백엔드가 알아서 .so 를 로드한다'),
  ('SET (세션 내에서 임시로)',       '차이 없음 - placeholder 메커니즘이 항상 받아준다'),
  ('ALTER SYSTEM SET / postgresql.conf', '★ preload 가 있어야 모든 세션에서 즉시, 일관되게 인식된다'),
  ('서버 시작 직후 첫 접속',         '★ preload 없으면 그 세션이 함수를 부르기 전까지 GUC 가 진짜로 등록 안 됨')
) AS t(항목, preload_없을_때);
