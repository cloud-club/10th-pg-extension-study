-- ===========================================================================
-- 04. pg_trgm 과 나란히 비교 + 실무에서 알아둘 것
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_bigm;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS bench;
CREATE TABLE bench (doc text);
INSERT INTO bench SELECT 'lorem ipsum dolor sit amet number ' || g FROM generate_series(1, 20000) g;
INSERT INTO bench VALUES ('AB'), ('짧은 키워드 테스트도 잘 되는지 확인');

CREATE INDEX bench_bigm_idx ON bench USING gin (doc gin_bigm_ops);
CREATE INDEX bench_trgm_idx ON bench USING gin (doc gin_trgm_ops);

SET enable_seqscan = off;

\echo '--- 짧은 키워드(2글자) 검색: pg_bigm 인덱스의 비용(cost) ---'
DROP INDEX bench_trgm_idx;  -- 같은 쿼리에서 두 인덱스가 동시에 경쟁하지 않도록 하나씩 비교
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%AB%';

\echo ''
\echo '--- 같은 쿼리를 pg_trgm 인덱스로: Index Cond 는 똑같이 붙지만 비용이 다르다 ---'
DROP INDEX bench_bigm_idx;
CREATE INDEX bench_trgm_idx ON bench USING gin (doc gin_trgm_ops);
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%AB%';
\echo '  ^ EXPLAIN 상으로는 둘 다 "Index Cond" 가 붙어서 겉보기엔 같아 보이지만,'
\echo '    비용(cost)을 비교해보면 pg_trgm 쪽이 몇 백 배 크다 - 2만 행 중 4천 행(rows=4000)을'
\echo '    후보로 돌려준다는 뜻이다. 2글자로는 온전한 trigram(3글자 단위)을 못 만들어서'
\echo '    "쓸모 있는 조건"이 아니라 "사실상 전체에 가까운 후보"가 되기 때문이다.'
\echo '    pg_bigm 은 2글자로도 완전한 bigram(2글자 단위)을 그대로 만들 수 있어 비용이 훨씬 작다.'
\echo '    (문서 표현: "Full text search with 1-2 characters keyword" - trgm 은 Slow, bigm 은 Fast)'

CREATE INDEX bench_bigm_idx ON bench USING gin (doc gin_bigm_ops);

\echo ''
\echo '--- pg_bigm.gin_key_limit: 검색어의 2-gram 을 몇 개까지만 인덱스 조건에 쓸지 ---'
SHOW pg_bigm.gin_key_limit;
\echo '  기본 0 = 제한 없음(모든 2-gram 사용). 검색어가 아주 길면 GIN 스캔 자체의'
\echo '  오버헤드가 커지므로, 앞쪽 몇 개 2-gram 만 쓰고 나머지는 Recheck 에 맡기게 할 수 있다.'
SET pg_bigm.gin_key_limit = 2;
EXPLAIN SELECT count(*) FROM bench WHERE doc LIKE '%lorem ipsum dolor%';
RESET pg_bigm.gin_key_limit;
\echo '  ^ gin_key_limit 을 낮추면 인덱스 스캔은 가벼워지지만, 후보가 늘어나'
\echo '    Recheck 부담이 커진다 - 극단적으로 긴 키워드에서만 고려할 트레이드오프다.'

RESET enable_seqscan;

\echo ''
\echo '--- 정리: pg_trgm vs pg_bigm ---'
SELECT * FROM (VALUES
  ('n-gram 단위',        '3-gram (trigram)',            '2-gram (bigram)'),
  ('사용 가능 인덱스',    'GIN, GiST',                    'GIN 만'),
  ('사용 가능 연산자',    'LIKE, ILIKE, ~, ~*',           'LIKE 만'),
  ('한글 조각 생성',      '된다 - 멀티바이트는 CRC32 해싱(*1)', '된다 - 원본 바이트 그대로'),
  ('한글 2글자 검색어',   '조각 0개 -> 인덱스 전체 스캔',   '조각을 만든다'),
  ('구두점 192.168.0.1',  'KEEPONLYALNUM 이 단어 경계로 쪼갠다', '그대로 인덱싱'),
  ('1~2글자 키워드',      '느림(조건은 붙지만 선택도가 낮아 사실상 전체에 가까운 후보)', '빠름'),
  ('유사도 함수 대소문자', '구분 안 함',                    '구분함'),
  ('인덱스 컬럼 최대 크기', '~228MB',                       '~102MB')
) AS t(항목, pg_trgm, pg_bigm);
\echo '  (*1) "pg_trgm 은 KEEPONLYALNUM 때문에 한글을 걸러낸다"는 흔한 설명은 틀렸다.'
\echo '       show_trgm(''가나다라'') 를 직접 실행해보면 조각 5개가 정상 생성된다 -'
\echo '       ISWORDCHR 가 쓰는 t_isalnum_with_len() 은 멀티바이트를 인식하고,'
\echo '       한글은 유니코드상 알파벳이기 때문이다. 0x... 로 보이는 것은 trgm 타입이'
\echo '       고정 3바이트라 멀티바이트 조각을 CRC32 로 눌러 담기 때문이다.'
\echo '       pg_trgm 이 한글에서 약한 진짜 이유는 "2글자 검색어에서 조각을 못 만든다"이고,'
\echo '       KEEPONLYALNUM 이 실제로 문제를 일으키는 것은 구두점이다.'
\echo '       -> ../../bigm-vs-trgm/docs/01-ngram-index-internals.md'

\echo ''
\echo '--- 실무 체크리스트 ---'
SELECT * FROM (VALUES
  ('언제 쓰나',       '한글/CJK 텍스트에 LIKE ''%키워드%'' 를 자주 쓰는데 느릴 때 - 특히 짧은 키워드'),
  ('인덱스 종류',     'GIN 만 지원 - GiST 필요하면 pg_trgm 을 고려'),
  ('정확성',          'pg_bigm.enable_recheck 는 반드시 on 유지 (기본값)'),
  ('쓰기 성능',       'FASTUPDATE 기본 on - 쓰기 위주면 유지, 읽기 위주+최신성 중요하면 off 고려'),
  ('컬럼 크기 제한',  '~102MB 초과 시 인덱싱 자체가 에러 - 큰 텍스트는 앞부분만 별도 컬럼에 잘라 인덱싱'),
  ('preload',         '기능상 필수는 아니지만, GUC 를 postgresql.conf/ALTER SYSTEM 으로 일관되게'
                       ' 관리하려면 shared_preload_libraries 또는 session_preload_libraries 권장 (01 참고)'),
  ('대안',            '진짜 자연어 형태소 분석/랭킹이 필요하면 tsvector/tsquery(전문검색) 나'
                       ' ParadeDB pg_search 같은 BM25 검색 엔진을 검토')
) AS t(항목, 메모);
