-- ===========================================================================
-- 00. Extension 이 없던 시절 (~ PostgreSQL 9.0) 재현하기
--
--     9.1 이전에는 contrib 를 이렇게 설치했습니다:
--         $ psql -d mydb -f /usr/share/postgresql/8.4/contrib/hstore.sql
--
--     즉 "그냥 SQL 스크립트를 실행"하는 것이었습니다.
--     지금도 똑같이 해볼 수 있습니다. 설치 스크립트에서 안전장치 두 줄만 걷어내면
--     그게 바로 옛날 hstore.sql 입니다.
-- ===========================================================================

-- 재실행 가능하도록 정리.
-- 이 정리 코드 자체가 이 스크립트의 주제이기도 합니다 -
-- "옛날 방식으로 깔린 것"을 지우려면 이런 걸 직접 짜야 했습니다.
SET client_min_messages = warning;   -- CASCADE 알림 수십 줄을 숨긴다
DROP EXTENSION IF EXISTS hstore CASCADE;
DO $$
DECLARE r record;
BEGIN
    -- ① 타입부터 (여기 딸린 함수/연산자는 CASCADE 로 함께 사라진다)
    DROP TYPE IF EXISTS hstore  CASCADE;
    DROP TYPE IF EXISTS ghstore CASCADE;
    -- ② 그래도 남는 것들: 인자가 internal 이라 타입에 딸려있지 않은 함수들
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             WHERE p.probin LIKE '%hstore%'
               AND NOT EXISTS (SELECT 1 FROM pg_depend d
                               WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END $$;
RESET client_min_messages;

\echo '--- 지금의 설치 스크립트 (이게 옛날 contrib/hstore.sql 과 같은 내용입니다) ---'
\echo '  [컨테이너 셸] $ head -12 /usr/share/postgresql/16/extension/hstore--1.4.sql'
\! head -12 /usr/share/postgresql/16/extension/hstore--1.4.sql

\echo ''
\echo '  ^ 두 가지만 다릅니다:'
\echo '    ① \\echo ... \\quit  - psql 로 직접 실행하는 것을 막는 안전장치 (9.1 이후 추가)'
\echo '    ② MODULE_PATHNAME  - CREATE EXTENSION 이 control 파일 값으로 치환해줌'
\echo '    옛날에는 ①이 없었고, ②자리에 $libdir/hstore 가 그대로 적혀 있었습니다.'

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 옛날 방식으로 설치해보기                                 |'
\echo '+----------------------------------------------------------+'
\echo '  [컨테이너 셸] $ sed -e \'/^\\\\echo/d\' -e \'s|MODULE_PATHNAME|$libdir/hstore|g\' /usr/share/postgresql/16/extension/hstore--1.4.sql > /tmp/oldway.sql'
\! sed -e '/^\\echo/d' -e 's|MODULE_PATHNAME|$libdir/hstore|g' /usr/share/postgresql/16/extension/hstore--1.4.sql > /tmp/oldway.sql
\echo '  [컨테이너 셸] $ echo "  준비된 스크립트: $(wc -l < /tmp/oldway.sql) 줄"'
\! echo "  준비된 스크립트: $(wc -l < /tmp/oldway.sql) 줄"
\echo '\\i /tmp/oldway.sql'
\i /tmp/oldway.sql

\echo ''
\echo '--- 잘 됩니다. hstore 가 동작합니다 ---'
SELECT 'a=>1, b=>2'::hstore -> 'a'  AS 값,
       akeys('a=>1, b=>2'::hstore)  AS 키목록;

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 그런데 여기서부터 문제가 시작됩니다                      |'
\echo '+----------------------------------------------------------+'

\echo ''
\echo '--- 문제 ①  DB 는 hstore 를 "설치했다"고 생각하지 않습니다 ---'
\echo '\\dx'
\dx
\echo '  ^ 목록에 hstore 가 없습니다. 함수는 있는데 extension 은 없습니다.'

SELECT count(*) AS "hstore 가 만든 함수 수"
FROM   pg_proc WHERE probin LIKE '%hstore%';

SELECT count(*) AS "소속이 기록된 객체 수"
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.deptype = 'e' AND e.extname = 'hstore';

\echo ''
\echo '  ^ 함수 57개가 생겼는데 "누구 소속"인지 아무 데도 안 적혀 있습니다.'
\echo '    내가 만든 함수와 구분할 방법이 없습니다.'

\echo ''
\echo '--- 문제 ②  백업하면 함수 정의가 통째로 딸려 나옵니다 ---'
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -c "^CREATE FUNCTION"'
\! pg_dump -U postgres -d study | grep -c "^CREATE FUNCTION"
\echo '  [컨테이너 셸] $ echo "  ^ CREATE FUNCTION 문 개수입니다. 지금이라면 CREATE EXTENSION 한 줄이면 끝납니다."'
\! echo "  ^ CREATE FUNCTION 문 개수입니다. 지금이라면 CREATE EXTENSION 한 줄이면 끝납니다."
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -A2 "CREATE FUNCTION public.hstore_in" | head -3'
\! pg_dump -U postgres -d study | grep -A2 "CREATE FUNCTION public.hstore_in" | head -3

\echo ''
\echo '  ^ 백업 파일에 $libdir 경로가 박제됩니다.'
\echo '    복원 대상 서버의 hstore 버전이 다르면(함수 시그니처가 바뀌었다면)'
\echo '    복원이 깨집니다. pg_upgrade 가 어려웠던 이유입니다.'

\echo ''
\echo '--- 문제 ③④  지우지도, 다시 제대로 설치하지도 못합니다 ---'
CREATE TEMP TABLE _demo(순번 int, 시도 text, 결과 text);

DO $$ BEGIN
    EXECUTE 'DROP TYPE hstore';
    INSERT INTO _demo VALUES (1, 'DROP TYPE hstore', '성공 (예상 밖)');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO _demo VALUES (1, 'DROP TYPE hstore', SQLERRM);
END $$;

DO $$ BEGIN
    EXECUTE 'CREATE EXTENSION hstore';
    INSERT INTO _demo VALUES (2, 'CREATE EXTENSION hstore', '성공 (예상 밖)');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO _demo VALUES (2, 'CREATE EXTENSION hstore', SQLERRM);
END $$;

SELECT 시도, 결과 FROM _demo ORDER BY 순번;
DROP TABLE _demo;

\echo ''
\echo '  ③ 지우려면 57개 객체 이름을 전부 알아야 합니다.'
\echo '     그래서 옛날 contrib 에는 uninstall_hstore.sql 이 따로 들어 있었습니다.'
\echo ''
\echo '  ④ 이미 있는 객체와 충돌해서 제대로 설치할 수도 없습니다.'
\echo '     9.1 은 이 사람들을 위해 CREATE EXTENSION ... FROM unpackaged 를 뒀습니다.'
\echo '     (기존 객체를 extension 소속으로 편입시키는 전용 스크립트. PG 13 에서 제거)'

\echo ''
\echo '+----------------------------------------------------------+'
\echo '| 정리하고 제대로 설치하기                                 |'
\echo '+----------------------------------------------------------+'
CREATE TEMP TABLE _cleanup(남은_함수 int);
SET client_min_messages = warning;   -- "drop cascades to 78 other objects" 를 숨긴다
DO $$
DECLARE r record; n int := 0;
BEGIN
    DROP TYPE IF EXISTS hstore  CASCADE;
    DROP TYPE IF EXISTS ghstore CASCADE;
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             WHERE p.probin LIKE '%hstore%'
               AND NOT EXISTS (SELECT 1 FROM pg_depend d
                               WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
        n := n + 1;
    END LOOP;
    INSERT INTO _cleanup VALUES (n);
END $$;
RESET client_min_messages;

SELECT 남은_함수 AS "CASCADE 후에도 따로 지운 함수 수" FROM _cleanup;
DROP TABLE _cleanup;

\echo ''
\echo '  ^ 방금 무슨 일을 했는지 보세요.'
\echo '    · 타입이 두 개입니다 (hstore, ghstore - GiST 인덱스 보조 타입)'
\echo '    · CASCADE 로 지워도 인자가 internal 인 함수들은 안 지워집니다'
\echo '    · 결국 pg_proc 을 뒤져서 하나씩 찾아 지워야 했습니다'
\echo ''
\echo '    게다가 CASCADE 는 위험합니다 - hstore 컬럼을 쓰는 "내 테이블"이 있었다면'
\echo '    그것도 같이 날아갑니다. 이래서 uninstall_hstore.sql 이 따로 필요했습니다.'

CREATE EXTENSION hstore;
\echo '\\dx hstore'
\dx hstore
\echo ''
\echo '  ^ 이제 DB 가 "hstore 라는 패키지가 설치되어 있다"를 압니다.'
\echo '    이 차이가 9.1 이 만든 전부입니다. 다음 스크립트에서 이어집니다.'
