-- ===========================================================================
-- 02. pgcrypto - 암호화 함수 모음
-- ===========================================================================
\echo '--- 비밀번호 해싱 (bcrypt) ---'
SELECT crypt('my_password', gen_salt('bf', 8)) AS bcrypt_hash;

\echo ''
\echo '  같은 비밀번호를 두 번 해싱하면 결과가 다릅니다 (salt 가 매번 다름)'
SELECT crypt('same', gen_salt('bf', 8)) AS 첫번째,
       crypt('same', gen_salt('bf', 8)) AS 두번째;

\echo ''
\echo '--- 검증: 저장된 해시를 salt 로 다시 써서 비교한다 ---'
DROP TABLE IF EXISTS accounts;
CREATE TABLE accounts (id serial PRIMARY KEY, username text, pw_hash text);
INSERT INTO accounts (username, pw_hash)
VALUES ('alice', crypt('correct-horse', gen_salt('bf', 8)));

SELECT username,
       pw_hash = crypt('correct-horse', pw_hash) AS 맞는_비번,
       pw_hash = crypt('wrong-guess',   pw_hash) AS 틀린_비번
FROM   accounts;

\echo ''
\echo '--- 해시 / HMAC ---'
SELECT encode(digest('hello', 'sha256'), 'hex')            AS sha256,
       encode(hmac('hello', 'secret-key', 'sha256'), 'hex') AS hmac_sha256;

\echo ''
\echo '--- 대칭키 암호화 (PGP) ---'
SELECT pgp_sym_decrypt(
         pgp_sym_encrypt('민감한 데이터', 'my-key'),
         'my-key'
       ) AS 복호화_결과;

\echo ''
\echo '  ⚠ 주의: 암호화 키를 SQL 문에 그대로 쓰면 pg_stat_statements 나 로그에 남습니다.'
\echo '     실무에서는 애플리케이션에서 암호화하고 DB 에는 결과만 넣는 편이 안전합니다.'
\echo '     pgcrypto 는 "DB 안에서 해야만 하는" 경우에 씁니다.'

\echo ''
\echo '--- 어떤 함수들이 딸려왔나 (36개 중 12개) ---'
SELECT p.proname AS 함수, pg_get_function_identity_arguments(p.oid) AS 인자
FROM   pg_depend d
JOIN   pg_extension e ON e.oid = d.refobjid
JOIN   pg_proc p      ON p.oid = d.objid
WHERE  d.refclassid='pg_extension'::regclass AND d.classid='pg_proc'::regclass
  AND  d.deptype='e' AND e.extname='pgcrypto'
ORDER  BY p.proname LIMIT 12;
