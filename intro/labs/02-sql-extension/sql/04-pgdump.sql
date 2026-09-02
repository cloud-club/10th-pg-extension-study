-- ===========================================================================
-- 04. pg_dump 는 extension 을 어떻게 덤프하나
-- ===========================================================================
INSERT INTO greetkor_config VALUES ('timezone', 'Asia/Seoul')
ON CONFLICT (key) DO NOTHING;

\echo '--- 덤프 결과에서 greetkor 관련 부분만 ---'
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -A2 -B2 -i greetkor'
\! pg_dump -U postgres -d study | grep -A2 -B2 -i greetkor

\echo ''
\echo '=> 핵심 두 가지'
\echo '   1) 함수 정의는 하나도 덤프되지 않는다. CREATE EXTENSION 한 줄뿐.'
\echo '      복원 대상 서버에 greetkor 파일이 설치되어 있어야 복원된다.'
\echo '   2) 하지만 greetkor_config 의 "데이터"는 COPY 로 덤프된다.'
\echo '      pg_extension_config_dump() 로 등록했기 때문.'

\echo ''
\echo '--- 비교: extension 없이 만든 테이블은 스키마까지 통째로 덤프된다 ---'
CREATE TABLE IF NOT EXISTS plain_table (id int primary key, memo text);
INSERT INTO plain_table VALUES (1, 'hello') ON CONFLICT DO NOTHING;
\echo '  [컨테이너 셸] $ pg_dump -U postgres -d study | grep -A6 "CREATE TABLE public.plain_table"'
\! pg_dump -U postgres -d study | grep -A6 "CREATE TABLE public.plain_table"
