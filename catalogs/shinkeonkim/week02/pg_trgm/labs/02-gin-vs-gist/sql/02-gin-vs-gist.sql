-- ===========================================================================
-- 02. GIN vs GiST - 같은 트라이그램, 완전히 다른 자료구조
--
-- pg_bigm 은 GIN 만 지원한다. pg_trgm 은 GiST 도 지원하는데, 그게 언제
-- 이득이고 언제 손해인지를 EXPLAIN 의 "버퍼 수"로 확정한다.
--
-- 핵심 관전 포인트: 실행 시간(CPU 노이즈에 흔들림) 대신
--   - Bitmap Index Scan 이 돌려준 actual rows  (인덱스가 후보를 얼마나 좁혔나)
--   - Buffers: shared hit                        (실제로 몇 페이지를 읽었나)
-- 이 두 값을 본다. 이건 실행마다 거의 변하지 않는 결정적인 지표다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\echo '=== 데이터 준비: 5만 행, 한/영 혼합. 시드를 고정해 재현 가능하게 한다 ==='
DROP TABLE IF EXISTS docs;
CREATE TABLE docs (id serial PRIMARY KEY, body text NOT NULL);

SELECT setseed(0.42);
INSERT INTO docs (body)
SELECT (ARRAY[
  '오늘 배포한 기능의 응답 속도를 측정하고 리포트를 남겼다',
  'PostgreSQL 확장 기능으로 부분 문자열 조회를 개선하는 방법',
  'The quarterly report shows steady growth across all regions',
  'FastAPI 와 함께 사용하면 개발 생산성이 눈에 띄게 높아진다',
  'A quick brown fox jumps over the lazy dog near the river',
  '데이터베이스 튜닝은 측정 없이 추측만으로 진행하면 안 된다',
  'Continuous integration pipelines catch regressions early',
  '사용자 경험 향상을 위해 지연 시간을 지속적으로 관찰한다'
])[1 + floor(random() * 8)::int] || ' (문서 ' || g || ')'
FROM generate_series(1, 50000) g;

-- 정답이 정확히 1행인 희귀 문자열을 심어둔다. "인덱스가 후보를 1행까지
-- 좁혔는가"를 보려면 정답 개수를 알고 있어야 한다.
INSERT INTO docs (body) VALUES ('희귀한 제브라 zebra 한 건만 존재하는 문서');
VACUUM ANALYZE docs;

SELECT count(*) AS 전체행수 FROM docs;

\echo ''
\echo '=== STEP 1. GIN 인덱스 ==='
CREATE INDEX docs_gin ON docs USING gin (body gin_trgm_ops);
SELECT pg_size_pretty(pg_relation_size('docs_gin')) AS gin_크기;

SET enable_seqscan = off;
\echo '--- GIN: LIKE %제브라% (정답 1행) ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
\echo '  ^ Bitmap Index Scan 의 actual rows 와 Buffers 를 기억해 두라.'

\echo ''
\echo '--- GIN 은 KNN(<->) 정렬을 못 한다 ---'
EXPLAIN (COSTS OFF)
SELECT body FROM docs ORDER BY body <-> '희귀한 제브라' LIMIT 3;
\echo '  ^ Index Scan 이 아니라 Sort 가 나온다. GIN 에는 <-> 를 위한 정렬 지원 함수가 없다.'

DROP INDEX docs_gin;

\echo ''
\echo '=== STEP 2. GiST 인덱스 (기본 siglen = 12바이트 = 96비트) ==='
CREATE INDEX docs_gist ON docs USING gist (body gist_trgm_ops);
SELECT pg_size_pretty(pg_relation_size('docs_gist')) AS gist_siglen12_크기;

\echo '--- GiST: 똑같은 LIKE %제브라% ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
\echo '  ^ 정답 1행을 찾는 것은 같지만 Buffers 가 자릿수 단위로 크다.'
\echo '    GiST 는 트라이그램을 96비트 비트맵에 해싱해 OR 로 합친 "시그니처"를 저장한다'
\echo '    (blooom filter 와 같은 손실 압축). 서로 다른 조각이 같은 비트로 떨어지므로'
\echo '    false positive 가 많고, 트리를 훨씬 많이 뒤져야 한다.'

\echo ''
\echo '--- 그런데 GiST 만 할 수 있는 게 있다: KNN ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT body FROM docs ORDER BY body <-> '희귀한 제브라' LIMIT 3;
\echo '  ^ "Index Scan ... Order By: (body <-> ...)"'
\echo '    정렬을 인덱스가 직접 수행한다. 전체를 정렬하지 않고 가까운 것부터 꺼낸다.'
SELECT body, round(similarity(body, '희귀한 제브라')::numeric, 4) AS sim
FROM docs ORDER BY body <-> '희귀한 제브라' LIMIT 3;

DROP INDEX docs_gist;

\echo ''
\echo '=== STEP 3. siglen 을 키우면 - PostgreSQL 13+ 의 연산자 클래스 파라미터 ==='
\echo '  trgm.h: #define SIGLEN_DEFAULT (sizeof(int) * 3)  -> 12바이트 = 96비트'
\echo '  긴 텍스트를 96비트에 담으면 비트가 다 차서 ALLISTRUE 로 접히고,'
\echo '  그 서브트리는 필터 역할을 잃는다. siglen 을 키우면 포화가 늦춰진다.'

CREATE INDEX docs_gist64 ON docs USING gist (body gist_trgm_ops(siglen=64));
SELECT pg_size_pretty(pg_relation_size('docs_gist64')) AS gist_siglen64_크기;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT count(*) FROM docs WHERE body LIKE '%제브라%';
\echo '  ^ 기본 siglen 12 일 때와 Buffers 를 비교해 보라.'
\echo '    (PostgreSQL 13 미만이면 이 구문 자체가 에러다 - pg_trgm 1.5 에서 추가됐다)'
DROP INDEX docs_gist64;

RESET enable_seqscan;

\echo ''
\echo '=== 정리: 언제 GiST 인가 ==='
SELECT * FROM (VALUES
  ('구조',            'GIN: 역색인(조각 -> TID 목록)', 'GiST: 시그니처 비트맵(손실 압축)'),
  ('LIKE / 정규식',   '훨씬 빠르다',                    '느리다 - 버퍼가 자릿수로 차이난다'),
  ('ORDER BY <->',    '불가능',                         '가능 - GiST 를 쓰는 유일한 이유'),
  ('인덱스 크기',     '보통 더 작다',                    '더 크다'),
  ('튜닝 손잡이',     'FASTUPDATE, gin_pending_list_limit', 'siglen (PG13+)'),
  ('pg_bigm 에는',    '있다 (gin_bigm_ops)',            '없다 - GIN 전용이다')
) AS t(항목, GIN, GiST);
\echo '  결론: 기본은 GIN. ORDER BY col <-> ... LIMIT n 이 필요할 때만 GiST 를 고른다.'
\echo '        둘 다 필요하면 인덱스를 두 개 만들어도 된다 (쓰기 비용을 감당할 수 있다면).'
