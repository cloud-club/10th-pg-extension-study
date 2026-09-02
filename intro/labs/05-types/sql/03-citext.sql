-- ===========================================================================
-- 03. citext - 대소문자를 구분하지 않는 text
-- ===========================================================================
\echo '--- 문제: 이메일은 대소문자를 구분하지 않아야 하는데... ---'
DROP TABLE IF EXISTS users_plain;
CREATE TABLE users_plain (email text PRIMARY KEY);
INSERT INTO users_plain VALUES ('User@Example.com');
INSERT INTO users_plain VALUES ('USER@EXAMPLE.COM');   -- 중복인데 들어간다!
SELECT * FROM users_plain;
\echo '  ^ 같은 사람이 두 번 가입했습니다. text 는 대소문자를 다르게 봅니다.'

\echo ''
\echo '--- 해결 1: citext 타입 ---'
DROP TABLE IF EXISTS users_ci;
CREATE TABLE users_ci (email citext PRIMARY KEY);
INSERT INTO users_ci VALUES ('User@Example.com');
DO $$ BEGIN
    INSERT INTO users_ci VALUES ('USER@EXAMPLE.COM');
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '거부됨: citext 는 대소문자가 달라도 같은 값으로 봅니다';
END $$;

SELECT email, email = 'user@example.COM' AS 대소문자_무관_비교 FROM users_ci;

\echo ''
\echo '--- 인덱스도 그대로 탑니다 (ILIKE 와의 결정적 차이) ---'
INSERT INTO users_ci
SELECT 'user' || g || '@example.com' FROM generate_series(1, 50000) g;
ANALYZE users_ci;

EXPLAIN (COSTS OFF) SELECT * FROM users_ci WHERE email = 'USER12345@EXAMPLE.COM';

\echo ''
\echo '--- 해결 2: 그냥 lower() 로 저장하기 (extension 없이) ---'
\echo '   장점: 표준 SQL, 이식성 좋음'
\echo '   단점: 넣을 때/찾을 때 매번 lower() 를 빠뜨리지 않아야 함'
\echo ''
\echo '--- 해결 3: 표현식 인덱스 + 제약 (extension 없이) ---'
DROP TABLE IF EXISTS users_expr;
CREATE TABLE users_expr (email text);
CREATE UNIQUE INDEX ON users_expr (lower(email));
INSERT INTO users_expr VALUES ('User@Example.com');
DO $$ BEGIN
    INSERT INTO users_expr VALUES ('USER@EXAMPLE.COM');
EXCEPTION WHEN unique_violation THEN RAISE NOTICE '거부됨: 표현식 유니크 인덱스'; END $$;

\echo ''
\echo '  → citext 는 "컬럼 타입 하나 바꾸면 끝"이라 코드가 깨끗해집니다.'
\echo '    대신 이 타입을 지원하지 않는 도구/ORM 이 있을 수 있습니다.'
\echo '    셋 다 정답이 될 수 있으니 트레이드오프를 이해하고 고르세요.'
