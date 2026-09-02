-- ===========================================================================
-- 03. 언제 쓰고 언제 피하나 - 그리고 다른 AM 들
-- ===========================================================================
\echo '--- bloom 의 한계: 등치(=) 검색만 됩니다 ---'
SET max_parallel_workers_per_gather = 0;
EXPLAIN (COSTS OFF) SELECT count(*) FROM events WHERE c3 > 5;
\echo '  ^ 범위 검색은 인덱스를 못 씁니다. bloom 은 해시 기반이라 순서 개념이 없습니다.'

\echo ''
\echo '--- 선택도가 좋은 단일 컬럼이면 B-tree 가 낫습니다 ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events WHERE c3 = 5;
RESET max_parallel_workers_per_gather;

\echo ''
\echo '  ^ 플래너가 B-tree 를 골랐을 겁니다. bloom 은 항상 인덱스 전체를 훑기 때문입니다.'
\echo '    (블룸 필터는 "어디부터 볼지"를 모릅니다. 전부 확인해야 합니다)'

\echo ''
\echo '--- bloom 판단 기준 ---'
SELECT * FROM (VALUES
  ('쓰기 좋음', '컬럼이 많고(5개+) 어떤 조합으로 올지 모를 때'),
  ('쓰기 좋음', '각 컬럼의 선택도가 낮아(중복 많음) B-tree 가 별로일 때'),
  ('쓰기 좋음', '인덱스 저장 공간을 아껴야 할 때'),
  ('피할 것',   '범위 검색(>, <, BETWEEN)이 필요할 때'),
  ('피할 것',   '정렬(ORDER BY)에 인덱스를 쓰고 싶을 때'),
  ('피할 것',   '단일 컬럼 등치 검색 - B-tree 가 압도적'),
  ('피할 것',   'UNIQUE 제약 - 지원하지 않음')
) AS t(구분, 상황);

\echo ''
\echo '--- 새 AM 을 추가하는 다른 extension 들 ---'
SELECT * FROM (VALUES
  ('bloom',    'contrib',   '블룸 필터',        '다중 컬럼 등치 검색'),
  ('pgvector', '서드파티',  'IVFFlat / HNSW',   '벡터 유사도 검색'),
  ('rum',      '서드파티',  'GIN 개선판',       '전문검색 + 순위 정렬을 인덱스에서'),
  ('zombodb',  '서드파티',  'Elasticsearch 연동','인덱스가 사실상 ES'),
  ('pgroonga', '서드파티',  'Groonga 엔진',     '다국어 전문검색')
) AS t(extension, 출처, AM, 용도);

\echo ''
\echo '  ⚠ 헷갈리기 쉬운 것: pg_bigm 은 여기 끼지 않습니다.'
\echo '    2글자 색인을 하지만 새 AM 을 만드는 게 아니라'
\echo '    기존 GIN 에 연산자 클래스(gin_bigm_ops)를 더하는 lab06 부류입니다.'

\echo ''
\echo '--- 테이블 AM 도 있습니다 (더 깊은 확장) ---'
SELECT amname AS 이름, amtype,
       CASE amtype WHEN 'i' THEN '인덱스' WHEN 't' THEN '테이블' END AS 종류
FROM   pg_am ORDER BY amtype, amname;

\echo ''
\echo '  ^ amtype=''t'' 가 테이블 액세스 메서드입니다. 기본은 heap 하나뿐입니다.'
\echo '    "행을 파일에 어떻게 저장할지" 자체를 바꿉니다.'
\echo '    OrioleDB(MVCC 개선), Citus columnar(컬럼 저장) 등이 여기에 해당합니다.'
\echo '    Extension 으로 할 수 있는 가장 깊은 확장입니다.'

\echo ''
\echo '======== 이 lab 의 요점 ========'
\echo '  pg_am 에 항목이 생기는 extension 을 만났다면,'
\echo '  그건 "함수 몇 개 추가"가 아니라 "PostgreSQL 의 검색 방식 자체를 확장"한 것입니다.'
\echo '  그만큼 강력하지만, 그만큼 PostgreSQL 버전에 민감합니다.'
\echo '  (내부 API 가 바뀌면 재컴파일이 필요하고, 메이저 업그레이드 시 가장 먼저 확인할 대상)'
