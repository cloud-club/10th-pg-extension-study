-- ===========================================================================
-- 04. 정규식 인덱스 검색 · 짧은 키워드 함정 · 운영 체크리스트
--
-- 이 lab 이 이 카탈로그에서 가장 중요하다. pg_trgm 의 두 가지 "조용한 실패"를
-- 직접 재현한다 - 둘 다 EXPLAIN 에 Index Cond 가 멀쩡히 붙기 때문에
-- 플랜을 대충 보면 정상으로 보인다.
--
--   (1) 짧은 키워드  -> 인덱스 "전체" 스캔 (시퀀셜 스캔보다 느리다)
--   (2) 한글 정규식  -> 마찬가지. LIKE 는 되는데 ~ 는 안 된다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\echo '=== 데이터 준비: 5만 행, 정답이 정확히 1행인 희귀어를 심는다 ==='
DROP TABLE IF EXISTS logs;
CREATE TABLE logs (id serial PRIMARY KEY, body text NOT NULL);

SELECT setseed(0.42);
INSERT INTO logs (body)
SELECT (ARRAY[
  'INFO  요청 처리 완료 latency=12ms endpoint=/api/items',
  'WARN  커넥션 풀 사용률이 높습니다 pool=18/20',
  'ERROR upstream timeout after 3000ms host=10.0.1.42',
  'INFO  캐시 적중률 통계를 갱신했습니다 ratio=0.87',
  'DEBUG 인덱스 재구성 작업을 시작합니다 table=orders'
])[1 + floor(random() * 5)::int] || ' seq=' || g
FROM generate_series(1, 50000) g;

-- 검색어 "제브" 를 서로 다른 위치에 한 건씩 심는다. 각 패턴이 정확히 1건씩
-- 맞도록 배치해야, 뒤에서 "인덱스가 후보를 몇 행까지 좁혔나"를 정답과 대조할 수 있다.
INSERT INTO logs (body) VALUES
  ('희귀한 제브라 zebra 한 건만 존재하는 로그'),  -- '%제브라%' 가 맞는 유일한 행
  ('제브 로 시작하는 로그 한 건'),                 -- '제브%'    가 맞는 유일한 행
  ('단어 사이에 제브 가 홀로 있는 로그'),          -- '% 제브 %' 가 맞는 유일한 행
  ('서버 주소는 192.168.0.1 입니다');
CREATE INDEX logs_gin ON logs USING gin (body gin_trgm_ops);
VACUUM ANALYZE logs;
SELECT count(*) AS 전체행수 FROM logs;

SET enable_seqscan = off;

\echo ''
\echo '#############################################################'
\echo '### 함정 1. 짧은 키워드 - 한 글자 차이로 모든 것이 바뀐다 ###'
\echo '#############################################################'
\echo ''
\echo '--- (a) 3글자 "제브라" : 정답 1행 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%제브라%';

\echo ''
\echo '--- (b) 2글자 "제브" : 정답은 3행. 한 글자만 줄였다 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%제브%';

\echo ''
\echo '  ^^^ 두 플랜을 나란히 비교하라. 봐야 할 곳은 세 줄이다:'
\echo '        Bitmap Index Scan ... (actual rows=???)   <- 인덱스가 후보를 얼마나 좁혔나'
\echo '        Rows Removed by Index Recheck: ???        <- 힙에서 몇 개를 버렸나'
\echo '        Buffers: shared hit=???                   <- 실제로 몇 페이지를 읽었나'
\echo ''
\echo '  (a) 는 후보가 1행(= 정답 그대로), (b) 는 후보가 테이블 전체다.'
\echo '  (b) 의 정답은 3행뿐인데 인덱스가 5만 행을 전부 후보로 올렸다 -'
\echo '  Rows Removed by Index Recheck 가 그 차이를 그대로 보여준다.'
\echo '  둘 다 "Index Cond" 가 붙어 있으므로 플랜만 훑으면 정상으로 보인다 -'
\echo '  이게 이 함정이 위험한 이유다.'
\echo ''
\echo '  원인은 소스 한 줄이다:'
\echo '      /* trgm_op.c - make_trigrams() */'
\echo '      if (charlen < 3)'
\echo '          return tptr;                 <- 조각을 하나도 안 만들고 포기'
\echo '  그리고 조각이 0개면:'
\echo '      /* trgm_gin.c */'
\echo '      if (trglen == 0)'
\echo '          *searchMode = GIN_SEARCH_MODE_ALL;   <- 인덱스 엔트리를 전부 읽는다'
\echo ''
\echo '  GIN_SEARCH_MODE_ALL 은 "인덱스를 안 쓴다"가 아니라 "인덱스를 통째로 읽는다"이다.'
\echo '  인덱스 읽기 비용 + 시퀀셜 스캔 비용을 둘 다 낸다 -> 인덱스가 없느니만 못하다.'
\echo ''
\echo '  (pg_bigm 은 같은 상황에서 조각을 1개 만들고 pmatch=true 로 부분 일치 탐색을 한다.'
\echo '   ../../bigm-vs-trgm/docs/01-ngram-index-internals.md 의 3장 참고)'

\echo ''
\echo '=== 그런데 우회할 수 있다: 패딩을 얻어내면 2글자도 산다 ==='
\echo '  get_wildcard_part() 의 주석:'
\echo '    "If the found word is bounded by non-word characters or string boundaries'
\echo '     then this function will include corresponding padding spaces into buf."'
\echo '  -> 경계가 %/_ 면 패딩을 못 붙이지만, 비단어 문자나 문자열 끝이면 붙인다.'

\echo ''
\echo '--- (c) 앞을 고정: LIKE ''제브%'' (LPADDING 2 가 적용된다) ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '제브%';

\echo ''
\echo '--- (d) 공백으로 감싸기: LIKE ''% 제브 %'' (공백 = 비단어 문자 경계) ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '% 제브 %';

\echo ''
\echo '  ^ (b) 의 actual rows(5만 행)와 비교하라. 같은 2글자 "제브" 인데'
\echo '    (c)/(d) 는 인덱스가 후보를 한 자릿수로 좁혔다 - 패딩이 생겼기 때문이다.'
\echo '    실무 처방: pg_bigm 을 못 쓰는 환경(수퍼유저 권한 없음 등)에서 짧은 키워드가'
\echo '    문제라면, 자동완성은 ''키워드%'' 로, 단어 검색은 ''% 키워드 %'' 로 바꾼다.'
\echo '    의미가 달라지는 것(부분 일치 -> 접두어/단어 일치)을 받아들일 수 있는지가 기준이다.'

\echo ''
\echo '########################################################'
\echo '### 함정 2. 정규식은 한글에서 아예 동작하지 않는다   ###'
\echo '########################################################'
\echo ''
\echo '--- (a) ASCII 정규식: 잘 된다 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body ~ 'zebra';

\echo ''
\echo '--- (b) 한글 정규식: 같은 문서 1건을 찾는데... ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body ~ '제브라';

\echo ''
\echo '--- (c) 대조군: 똑같은 한글을 LIKE 로 찾으면 잘 된다 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%제브라%';

\echo ''
\echo '  ^^^ (b) 만 전체 인덱스 스캔이다. LIKE 는 되는데 정규식만 안 된다.'
\echo ''
\echo '  이유는 pg_trgm 이 아니라 PostgreSQL 정규식 엔진에 있다.'
\echo '  정규식 경로(trgm_regexp.c)는 정규식을 NFA 로 컴파일한 뒤 "컬러(문자 집합)"를'
\echo '  개별 문자로 펼쳐 조각을 만드는데, 펼칠 수 없는 컬러는 포기한다:'
\echo '      if (charsCount < 0 || charsCount > COLOR_COUNT_LIMIT)'
\echo '          colorInfo->expandable = false;'
\echo '  그리고 pg_reg_getnumcharacters() 는 "high colormap" 에 있는 컬러에 -1 을 준다.'
\echo '  high colormap 의 경계는:'
\echo '      /* src/include/regex/regcustom.h */'
\echo '      #define MAX_SIMPLE_CHR  0x7FF   /* suitable value for Unicode */'
\echo ''
\echo '  U+07FF 는 UTF-8 에서 2바이트로 인코딩되는 마지막 코드포인트다.'
\echo '  -> 3바이트 이상 문자(한글, 한자, 가나, 이모지)는 정규식 조각 추출이 안 된다.'
\echo '  -> LIKE 경로는 문자를 직접 CRC32 해싱하므로 이 벽이 없다.'

\echo ''
\echo '--- 경계를 직접 확인해보자: 2바이트 문자는 되는가? ---'
INSERT INTO logs (body) VALUES ('café naïve résumé'), ('ΑΒΓΔΕ 그리스 문자');
VACUUM ANALYZE logs;
\echo '  (i) 2바이트 라틴 확장 (U+00EF) :'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, BUFFERS)
SELECT count(*) FROM logs WHERE body ~ 'naïve';
\echo '  (ii) 2바이트 그리스 (U+0391~) :'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, BUFFERS)
SELECT count(*) FROM logs WHERE body ~ 'ΑΒΓΔΕ';
\echo '  ^ 둘 다 후보 1행. 2바이트까지는 되고 3바이트부터 안 된다 - 경계가 정확히 U+07FF 다.'

\echo ''
\echo '--- 한글 정규식이 꼭 필요할 때의 2단 구성 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs
WHERE body LIKE '%제브라%'        -- 인덱스가 후보를 좁히고
  AND body ~ '제브라\s*zebra';    -- 정규식은 힙에서 필터로만 동작한다
\echo '  ^ LIKE 로 후보를 좁힌 뒤 정규식을 필터로 얹는다. 실무에서 쓸 만한 타협이다.'

\echo ''
\echo '=== STEP 3. KEEPONLYALNUM 이 구두점을 날린다 ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM logs WHERE body LIKE '%168.0%';
SELECT show_trgm('192.168.0.1') AS 점이_단어경계가_된다;
\echo '  ^ 192 / 168 / 0 / 1 로 쪼개져 "168.0" 이라는 연결 정보가 사라진다.'
\echo '    Rows Removed by Index Recheck 가 붙는 것을 확인하라 - 후보가 늘어났다는 뜻이다.'
\echo '    pg_bigm 은 점을 그대로 인덱싱해서 이 문제가 없다.'

\echo ''
\echo '=== STEP 4. preload 는 필요한가 ==='
SELECT name, setting, context FROM pg_settings WHERE name LIKE 'pg_trgm%' ORDER BY 1;
\echo '  ^ preload 없이 시작한 서버인데 GUC 가 보인다.'
\echo '    이 세션이 CREATE EXTENSION / 인덱스 지원 함수 호출로 이미 .so 를 로드했기 때문이다.'
\echo '    구조는 pg_bigm 과 똑같다 (_PG_init 이 GUC 만 등록, 훅/워커/공유메모리 없음).'
\echo '    차이는 공식 문서가 pg_trgm 에는 preload 를 요구하지 않는다는 것뿐이다.'
\echo '    ALTER SYSTEM SET pg_trgm.* 를 쓸 계획이 있다면 session_preload_libraries 를 고려한다.'
\echo '    (자세한 재현: ../../pg_bigm/labs/01-preload-and-guc-registration/)'

RESET enable_seqscan;

\echo ''
\echo '=== 운영 체크리스트 ==='
SELECT * FROM (VALUES
  ('가장 큰 함정',   '3글자 미만 키워드는 인덱스가 있는 게 없는 것보다 느리다.'
                     ' 애플리케이션에서 검색어 길이를 검증해 다른 경로로 보낼 것'),
  ('진단 방법',      'EXPLAIN (ANALYZE, BUFFERS) 에서 Bitmap Index Scan 의 actual rows 가'
                     ' 테이블 전체 행수와 비슷하면 GIN_SEARCH_MODE_ALL 상태다'),
  ('한글 정규식',    '~ 연산자는 3바이트 문자에서 인덱스 효과가 없다.'
                     ' LIKE 로 후보를 좁히고 정규식은 필터로만 쓸 것'),
  ('구두점 검색',    'IP/버전/경로/식별자는 KEEPONLYALNUM 때문에 쪼개진다 -> pg_bigm 고려'),
  ('인덱스 종류',    '기본은 GIN. ORDER BY <-> 가 필요할 때만 GiST'),
  ('GiST siglen',    '긴 텍스트면 기본 96비트가 포화된다. PG13+ 에서 siglen=64 등을 고려'),
  ('유사도 임계값',  '사용자 입력을 그대로 GUC 에 넣지 말 것. GUC 는 파라미터 바인딩이 안 되므로'
                     ' 값 검증 후 문자열로 끼워 넣어야 한다 (lab 05)'),
  ('FASTUPDATE',     'GIN 기본 on - pending list 가 쌓인다.'
                     ' 읽기 위주 + 최신성 중요하면 off 고려'),
  ('버전',           'pg_upgrade 후 ALTER EXTENSION pg_trgm UPDATE 를 잊지 말 것 -'
                     ' 옛 버전이 남으면 siglen 도 = 연산자도 못 쓴다')
) AS t(항목, 메모);
