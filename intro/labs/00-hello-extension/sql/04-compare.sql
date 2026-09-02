-- ===========================================================================
-- 04. old_hello  vs  hello  - 나란히 놓고 보기
--
--     두 함수는 하는 일이 같습니다. 만든 방식만 다릅니다.
--     그 차이가 실제로 무엇을 바꾸는지 항목별로 확인합니다.
-- ===========================================================================
\echo '--- 하는 일은 같습니다 ---'
SELECT old_hello('세계') AS "old_hello (옛날 방식)",
       hello('세계')     AS "hello (extension)";

\echo ''
\echo '  ^ 결과 문구만 다릅니다 (hello 는 1.1 로 업그레이드했으므로).'
\echo '    함수로서의 성격은 완전히 같습니다.'

CREATE TEMP TABLE cmp(순번 int, 항목 text, old_hello text, hello text);

-- ① 카탈로그에 패키지로 잡히나
INSERT INTO cmp VALUES (1, '패키지로 인식되나',
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname='old_hello')
       THEN '예' ELSE '아니오 (\dx 에 없음)' END,
  CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname='hello')
       THEN '예 (\dx 에 보임)' ELSE '아니오' END);

-- ② 소속 기록
INSERT INTO cmp
SELECT 2, 'pg_depend 소속 기록',
  (SELECT count(*)::text || ' 건' FROM pg_depend d JOIN pg_proc p ON p.oid=d.objid
   WHERE p.proname='old_hello' AND d.deptype='e'),
  (SELECT count(*)::text || ' 건' FROM pg_depend d JOIN pg_proc p ON p.oid=d.objid
   WHERE p.proname IN ('hello','bye') AND d.deptype='e');

-- ③ 버전
INSERT INTO cmp VALUES (3, '설치된 버전을 알 수 있나',
  '없음 (개념 자체가 없음)',
  (SELECT '있음 - ' || extversion FROM pg_extension WHERE extname='hello'));

-- ④ 개별 DROP 이 막히나
DO $$
DECLARE a text; b text;
BEGIN
    BEGIN
        EXECUTE 'DROP FUNCTION old_hello(text)';
        a := '그냥 지워짐 (실수 방지 없음)';
        -- 되살려둔다
        EXECUTE $f$ CREATE FUNCTION old_hello(name text) RETURNS text
                    LANGUAGE sql IMMUTABLE STRICT
                    AS 'SELECT ''Hello, '' || name || ''!''' $f$;
    EXCEPTION WHEN OTHERS THEN a := '거부됨';
    END;
    BEGIN
        EXECUTE 'DROP FUNCTION hello(text)';
        b := '그냥 지워짐';
    EXCEPTION WHEN OTHERS THEN b := '거부됨 (extension 이 필요로 함)';
    END;
    INSERT INTO cmp VALUES (4, '함수 하나만 DROP 하면', a, b);
END $$;

-- ⑤ 통째로 제거
INSERT INTO cmp VALUES (5, '통째로 제거하려면',
  '함수 이름을 전부 알아야 함',
  'DROP EXTENSION 한 줄');

-- ⑥ 업그레이드
INSERT INTO cmp VALUES (6, '새 버전 배포',
  '스크립트 재실행 → 충돌. 무엇이 바뀌었는지 직접 diff',
  'ALTER EXTENSION ... UPDATE (경로는 PostgreSQL 이 계산)');

\echo ''
\echo '============================================================'
SELECT 항목, old_hello AS "old_hello (옛날 방식)", hello AS "hello (extension)"
FROM   cmp ORDER BY 순번;
DROP TABLE cmp;

\echo ''
\echo '--- ⑦ pg_dump 결과 비교 ---'
\echo '  [컨테이너 셸] $ echo "  [old_hello] 백업에 나오는 내용:"'
\! echo "  [old_hello] 백업에 나오는 내용:"
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -A3 "^CREATE FUNCTION public.old_hello" | sed \'s/^/    /\''
\! pg_dump -U postgres -d study | grep -A3 "^CREATE FUNCTION public.old_hello" | sed 's/^/    /'
\echo '  [컨테이너 셸] $ echo "  [hello] 백업에 나오는 내용:"'
\! echo "  [hello] 백업에 나오는 내용:"
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -E "CREATE EXTENSION IF NOT EXISTS hello|^CREATE FUNCTION public.hello" | sed \'s/^/    /\''
\! pg_dump -U postgres -d study | grep -E "CREATE EXTENSION IF NOT EXISTS hello|^CREATE FUNCTION public.hello" | sed 's/^/    /'

\echo ''
\echo '  ^ old_hello 는 함수 본문이 통째로 백업에 들어갑니다.'
\echo '    hello 는 CREATE EXTENSION 한 줄뿐입니다 - 본문은 서버의 파일이 제공합니다.'
\echo ''
\echo '    함수가 하나일 땐 차이가 사소해 보이지만,'
\echo '    hstore 처럼 함수가 57개면 백업 파일에 57개 정의가 박제됩니다.'
\echo '    복원 대상 서버의 버전이 다르면 그대로 깨집니다.'
\echo '    → 📦 lab01 / 00-the-old-way.sql 에서 실제 contrib 로 재현합니다.'

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 정리                                                     |'
\echo '+----------------------------------------------------------+'
\echo '  두 함수가 하는 일은 같았습니다.'
\echo '  달라진 건 "DB 가 이것들을 하나의 패키지로 아느냐" 뿐입니다.'
\echo ''
\echo '  그 하나가 버전 관리 · 통째 삭제 · 백업 · 의존성 추적을 전부 가능하게 만듭니다.'
\echo '  9.1 이 추가한 것이 정확히 이것입니다.'
