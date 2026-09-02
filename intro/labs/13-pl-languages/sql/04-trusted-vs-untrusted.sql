-- ===========================================================================
-- 04. plpython3u 의 'u' - trusted 와 untrusted 의 차이
-- ===========================================================================
\echo '--- 이름부터 다릅니다 ---'
SELECT lanname AS 언어, lanpltrusted AS trusted,
       CASE WHEN lanpltrusted THEN '일반 유저도 함수 작성 가능'
            ELSE 'superuser 만 함수 작성 가능' END AS 의미
FROM   pg_language WHERE lanispl ORDER BY lanname;

\echo ''
\echo '  plpython3u 의 u = untrusted 입니다. plperl 은 trusted 이고,'
\echo '  별도의 plperlu(untrusted) 가 따로 있습니다.'

\echo ''
\echo '--- untrusted 가 위험한 이유: 뭐든 할 수 있습니다 ---'
CREATE OR REPLACE FUNCTION py_read_server_file(path text) RETURNS text
LANGUAGE plpython3u AS $$
    with open(path) as f:
        return f.read()[:120]
$$;

SELECT py_read_server_file('/etc/hostname') AS "서버 파일을 읽었다";

\echo ''
CREATE OR REPLACE FUNCTION py_run_shell() RETURNS text
LANGUAGE plpython3u AS $$
    import subprocess
    return subprocess.run(['whoami'], capture_output=True, text=True).stdout.strip()
$$;

SELECT py_run_shell() AS "쉘 명령을 실행했다";

\echo ''
\echo '  ⚠ DB 함수 하나가 서버 파일을 읽고 쉘을 실행했습니다.'
\echo '     PostgreSQL 프로세스 권한(보통 postgres 유저)으로 무엇이든 할 수 있습니다.'
\echo '     그래서 untrusted 언어는 superuser 만 함수를 만들 수 있습니다.'

\echo ''
\echo '--- 일반 유저로 시도하면 ---'
DO $$ BEGIN
    CREATE ROLE app_user LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT CREATE ON SCHEMA public TO app_user;

SET ROLE app_user;
DO $$ BEGIN
    EXECUTE $f$ CREATE FUNCTION bad() RETURNS text
                LANGUAGE plpython3u AS 'return open("/etc/passwd").read()' $f$;
    RAISE NOTICE 'plpython3u: 함수 생성 성공 (예상 밖)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'plpython3u -> %', SQLERRM; END $$;

DO $$ BEGIN
    EXECUTE $f$ CREATE FUNCTION ok_perl(t text) RETURNS text
                LANGUAGE plperl AS 'return uc($_[0]);' $f$;
    RAISE NOTICE 'plperl (trusted): 함수 생성 성공';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'plperl -> %', SQLERRM; END $$;
RESET ROLE;

SELECT ok_perl('hello') AS "trusted 언어로 만든 함수";

\echo ''
\echo '--- trusted 언어는 위험한 일을 막아둡니다 ---'
DO $$ BEGIN
    EXECUTE $f$ CREATE FUNCTION perl_read() RETURNS text
                LANGUAGE plperl AS 'open(F, "/etc/hostname"); return <F>;' $f$;
    PERFORM perl_read();
    RAISE NOTICE 'plperl 로 파일 읽기 성공 (예상 밖)';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'plperl 로 파일 읽기 -> %', SQLERRM; END $$;

\echo ''
\echo '  ^ 같은 Perl 이지만 trusted 버전은 파일 I/O 를 막습니다.'
\echo '    막을 수 없는 언어(Python)는 아예 untrusted 로만 제공됩니다.'

\echo ''
\echo '--- 정리 ---'
SELECT * FROM (VALUES
  ('plpgsql',    'trusted',   '기본 제공. SQL 중심 로직'),
  ('plperl',     'trusted',   '샌드박스. 파일/네트워크 차단'),
  ('plperlu',    'untrusted', '제한 없음. superuser 전용'),
  ('plpython3u', 'untrusted', '제한 없음. superuser 전용 (trusted 버전 없음)'),
  ('pltcl',      'trusted',   'pltclu 가 untrusted 버전'),
  ('plv8',       'trusted',   'JavaScript. V8 샌드박스')
) AS t(언어, 종류, 비고);

\echo ''
\echo '  ⚠ 클라우드 매니지드 DB 에서는 superuser 가 없으므로'
\echo '     plpython3u 를 아예 못 쓰거나, 벤더가 제한적으로만 열어줍니다.'
\echo '     예를 들어 AWS RDS 는 plpython3u 를 제공하지 않습니다.'
\echo '     (벤더 문서에서 반드시 확인하세요 - 지원 목록은 자주 바뀝니다)'

-- 정리
DROP FUNCTION IF EXISTS py_read_server_file(text);
DROP FUNCTION IF EXISTS py_run_shell();
DROP FUNCTION IF EXISTS ok_perl(text);
