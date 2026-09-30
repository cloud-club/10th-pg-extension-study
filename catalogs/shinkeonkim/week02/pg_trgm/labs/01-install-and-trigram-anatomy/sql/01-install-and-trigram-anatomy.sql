-- ===========================================================================
-- 01. 설치 · 트라이그램 해부 - 조각이 실제로 어떻게 만들어지는가
--
-- 이 lab 의 목표는 "pg_trgm 을 써봤다"가 아니라, show_trgm() 출력만 보고
-- "이 검색어는 인덱스를 제대로 탈 수 있는가"를 판단할 수 있게 되는 것이다.
-- ===========================================================================

\echo '=== STEP 0. 설치가 얼마나 쉬운가 - pg_bigm 과의 첫 번째 차이 ==='
\echo '  pg_bigm 은 소스를 받아 PGXS 로 빌드해야 했다 (Dockerfile 54줄).'
\echo '  pg_trgm 은 contrib 이라 이미 서버에 들어 있다:'
\! ls /usr/share/postgresql/16/extension/ | grep '^pg_trgm'

\echo ''
\echo '--- .control 파일: trusted = true 가 있는지 보라 ---'
\! cat /usr/share/postgresql/16/extension/pg_trgm.control

CREATE EXTENSION IF NOT EXISTS pg_trgm;
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
\echo '  ^ PostgreSQL 16 의 default_version 은 1.6 이다.'
\echo '    pg_upgrade 로 올라온 DB 는 옛 버전이 남아있을 수 있다 -> ALTER EXTENSION pg_trgm UPDATE;'

\echo ''
\echo '=== STEP 1. trusted 확장이란 - 수퍼유저가 아니어도 설치된다 ==='
-- 이 스크립트는 여러 번 돌려도 같은 결과가 나와야 한다.
-- app 롤이 남아 있으면 그 롤이 소유한 객체(= 이 lab 이 만든 pg_trgm)부터 정리해야
-- DROP ROLE 이 성공한다 - 안 그러면 "role app cannot be dropped because some
-- objects depend on it" 로 두 번째 실행부터 실패한다.
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN
    EXECUTE 'DROP OWNED BY app';
    EXECUTE 'DROP ROLE app';
  END IF;
END
$$;

CREATE ROLE app LOGIN;
GRANT CREATE ON DATABASE study TO app;
GRANT CREATE ON SCHEMA public TO app;

SET ROLE app;
SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;
CREATE EXTENSION pg_trgm;
\echo '  ^ 수퍼유저가 아닌 app 롤로 설치에 성공했다.'
\echo '    pg_bigm 은 .control 에 trusted 가 없어 여기서 실패한다:'
\echo '      ERROR: permission denied to create extension "pg_bigm"'
\echo '      HINT:  Must be superuser to create this extension.'
\echo '    -> 매니지드 DB / 권한이 제한된 팀 DB 에서는 이 한 줄이 결론을 내버릴 수 있다.'
RESET ROLE;

\echo ''
\echo '=== STEP 2. 트라이그램 해부 - 패딩이 핵심이다 ==='
\echo '--- 영문 단어: 앞에 공백 2개(LPADDING), 뒤에 1개(RPADDING) ---'
SELECT show_trgm('word');
\echo '  {"  w"," wo",ord,"rd ",wor}  <- 4글자 단어에서 5개'
\echo '  공백 2개를 앞에 붙이는 이유: 3글자 조각 안에 "단어 첫 글자"를 표현하려면 그만큼 필요하다.'

SELECT show_trgm('ab');
\echo '  ^ 2글자여도 패딩 덕분에 조각이 3개 나온다. 이게 나중에 중요해진다 (STEP 5).'

\echo ''
\echo '--- 여러 단어: 단어마다 따로 패딩된다 ---'
SELECT show_trgm('full text search');

\echo ''
\echo '=== STEP 3. 한글은 정말 안 되는가 - 흔한 오해를 직접 확인한다 ==='
\echo '  많은 자료가 "pg_trgm 은 KEEPONLYALNUM 때문에 한글을 걸러낸다"고 말한다.'
\echo '  직접 재보자.'
SELECT show_trgm('가나다라');
\echo '  ^ 0x... 형태로 5개가 정상 생성된다. 걸러지지 않았다!'
\echo '    KEEPONLYALNUM 이 쓰는 ISWORDCHR 는 t_isalnum_with_len() 이라 멀티바이트를 인식하고,'
\echo '    한글은 유니코드상 알파벳이므로 그대로 단어 문자로 취급된다.'
\echo ''
\echo '    0x... 로 보이는 이유는 별개다: trgm 타입은 "char trgm[3]" 으로 정확히 3바이트인데'
\echo '    한글 3글자는 UTF-8 로 9바이트라, CRC32 로 눌러 3바이트에 담기 때문이다.'
\echo '      -> compact_trigram() in trgm_op.c: "use only 3 upper bytes from crc"'

SELECT array_length(show_trgm('풀텍스트검색'), 1) AS trgm_개수;
\echo '  ^ 6글자 + 패딩 3 - 3 + 1 = 7개. 영문과 똑같은 공식이다.'

\echo ''
\echo '=== STEP 4. 진짜 차이는 여기다 - KEEPONLYALNUM 은 구두점을 날린다 ==='
SELECT show_trgm('192.168.0.1');
\echo '  ^ 점(.)이 단어 구분자로 취급되어 192 / 168 / 0 / 1 네 조각으로 쪼개졌다.'
\echo '    "168.0" 이라는 연결 정보가 인덱스에서 사라진다.'
\echo '    IP, 시맨틱 버전, 파일 경로, 코드 식별자 검색에서 실제로 문제가 된다.'
\echo '    (pg_bigm 은 점을 그대로 인덱싱한다: {" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92})'

SELECT show_trgm('a-b-c');
\echo '  ^ 하이픈도 마찬가지. 각 조각이 다시 따로 패딩된다.'

\echo ''
\echo '--- IGNORECASE: 유사도가 대소문자를 구분하지 않는다 ---'
SELECT show_trgm('ABC') AS 대문자, show_trgm('abc') AS 소문자;
SELECT similarity('ABC', 'abc') AS pg_trgm_유사도;
\echo '  ^ 완전히 같다고 본다 (pg_bigm 은 소문자화를 안 해서 이 경우 0 이 나온다).'
\echo '    어느 쪽이 옳은 게 아니라 대상이 다르다 - 자연어면 trgm, 식별자면 bigm.'

\echo ''
\echo '=== STEP 5. 유사도 공식을 손으로 검산해본다 ==='
\echo '  trgm.h 에 DIVUNION 이 define 되어 있으므로 similarity() 는 자카드 유사도다:'
\echo '    similarity = 공통조각 / (len1 + len2 - 공통조각)'
SELECT array_length(show_trgm('abcd'), 1)  AS len1,
       array_length(show_trgm('abce'), 1)  AS len2,
       (SELECT count(*) FROM unnest(show_trgm('abcd')) a
                        JOIN unnest(show_trgm('abce')) b ON a = b) AS 공통,
       similarity('abcd', 'abce')          AS similarity;
\echo '  ^ 5, 5, 3 -> 3 / (5 + 5 - 3) = 3/7 = 0.428571...  공식과 정확히 일치한다.'

\echo ''
\echo '--- 한글 오탈자 한 글자 ---'
SELECT array_length(show_trgm('데이터베이스'), 1) AS len1,
       array_length(show_trgm('데이타베이스'), 1) AS len2,
       (SELECT count(*) FROM unnest(show_trgm('데이터베이스')) a
                        JOIN unnest(show_trgm('데이타베이스')) b ON a = b) AS 공통,
       similarity('데이터베이스', '데이타베이스') AS similarity;
\echo '  ^ 7, 7, 4 -> 4/10 = 0.4'
\echo '    참고로 pg_bigm 의 bigm_similarity() 는 같은 쌍에 0.714 를 준다.'
\echo '    공식이 다르기 때문이다 (bigm 은 공통/max(len1,len2), 자카드가 아니다).'
\echo '    -> 두 확장의 유사도 임계값을 같은 숫자로 두면 안 된다는 뜻이다.'
\echo '       자세한 대조: ../../bigm-vs-trgm/docs/02-source-side-by-side.md'

\echo ''
\echo '=== STEP 6. GUC 3개 - 훅도 워커도 공유메모리도 없다 ==='
SELECT name, setting, boot_val, context
FROM pg_settings WHERE name LIKE 'pg_trgm%' ORDER BY 1;
\echo '  ^ _PG_init() 이 하는 일은 이 GUC 3개 등록이 전부다.'
\echo '    pg_stat_statements(훅+공유메모리)나 pg_cron(백그라운드 워커)과는 부류가 다르다.'
\echo '    그래서 pg_trgm 은 shared_preload_libraries 가 필요 없다 (lab 04 에서 더 본다).'
