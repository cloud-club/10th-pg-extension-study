-- ===========================================================================
-- 05. unaccent - 악센트 제거 (전문 검색 사전으로도 동작)
-- ===========================================================================
\echo '--- 함수로 쓰기 ---'
SELECT unaccent('Café résumé naïve')  AS 정규화,
       unaccent('Müller Straße')      AS 독일어,
       unaccent('한글은 그대로')       AS 한글;

\echo ''
\echo '--- 왜 필요한가: 사용자는 악센트를 안 치고 검색합니다 ---'
DROP TABLE IF EXISTS menu;
CREATE TABLE menu (name text);
INSERT INTO menu VALUES ('Café Latte'), ('Crème Brûlée'), ('Jalapeño'), ('Americano');

SELECT name FROM menu WHERE name ILIKE '%creme%';
\echo '  ^ 0건. "Crème" 을 "creme" 으로 찾을 수 없습니다.'

SELECT name FROM menu WHERE unaccent(name) ILIKE unaccent('%creme%');
\echo '  ^ 찾았습니다.'

\echo ''
\echo '--- 인덱스를 태우려면 표현식 인덱스 + IMMUTABLE 래퍼 ---'
\echo '   unaccent() 는 사전(dictionary)에 의존해서 기본적으로 STABLE 입니다.'
\echo '   표현식 인덱스에는 IMMUTABLE 함수만 쓸 수 있으므로 래퍼가 필요합니다.'
SELECT provolatile FROM pg_proc WHERE proname='unaccent' LIMIT 1;

CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE INDEX idx_menu_unaccent ON menu (immutable_unaccent(name));
SELECT name FROM menu WHERE immutable_unaccent(name) = 'Creme Brulee';

\echo ''
\echo '  ⚠ 이 래퍼는 "사전이 바뀌지 않는다"고 약속하는 것입니다.'
\echo '     unaccent 사전 파일을 수정하면 인덱스가 실제와 어긋나므로 REINDEX 해야 합니다.'

\echo ''
\echo '--- unaccent 는 전문 검색 사전으로도 쓰입니다 ---'
SELECT to_tsvector('simple', unaccent('Crème Brûlée')) AS tsvector;

\echo ''
\echo '  → 다국어 검색에서는 unaccent + pg_trgm 조합이 흔합니다.'
\echo '    unaccent 로 정규화하고, 그 결과에 트라이그램 인덱스를 겁니다.'
