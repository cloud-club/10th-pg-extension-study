-- ===========================================================================
-- 04. ltree - 계층 경로를 값 하나로
-- ===========================================================================
DROP TABLE IF EXISTS catalog_tree;
CREATE TABLE catalog_tree (path ltree PRIMARY KEY, label text);
INSERT INTO catalog_tree VALUES
  ('electronics',                  '전자제품'),
  ('electronics.computer',         '컴퓨터'),
  ('electronics.computer.laptop',  '노트북'),
  ('electronics.computer.desktop', '데스크톱'),
  ('electronics.phone',            '휴대폰'),
  ('books',                        '도서'),
  ('books.tech',                   '기술서적'),
  ('books.tech.database',          '데이터베이스');

CREATE INDEX ON catalog_tree USING gist (path);

\echo '--- 전체 트리 ---'
SELECT path, label, nlevel(path) AS 깊이 FROM catalog_tree ORDER BY path;

\echo ''
\echo '--- <@ : 특정 노드의 모든 하위 ---'
SELECT path, label FROM catalog_tree WHERE path <@ 'electronics' ORDER BY path;

\echo ''
\echo '--- @> : 특정 노드의 모든 상위 (조상) ---'
SELECT path, label FROM catalog_tree
WHERE  path @> 'electronics.computer.laptop' ORDER BY path;

\echo ''
\echo '--- ~ : lquery 패턴 매칭 ---'
SELECT path FROM catalog_tree WHERE path ~ '*.computer.*' ORDER BY path;
SELECT path FROM catalog_tree WHERE path ~ '*{2}'  ORDER BY path;   -- 깊이 정확히 2

\echo ''
\echo '--- 경로 조작 함수 ---'
SELECT subpath('a.b.c.d', 0, 2) AS 앞_2단계,
       subltree('a.b.c.d', 1, 3) AS 중간,
       'a.b'::ltree || 'c.d'::ltree AS 이어붙이기,
       index('a.b.c.d', 'c')      AS c의_위치;

\echo ''
\echo '--- 대안 비교 ---'
SELECT * FROM (VALUES
  ('인접 리스트 (parent_id)', '단순, 표준',        '하위 전체 조회에 재귀 CTE 필요'),
  ('경로 문자열 (text)',      'extension 불필요',  'LIKE ''a.b.%'' - 상위 조회가 불편'),
  ('ltree',                   '양방향 조회 + 인덱스', 'PostgreSQL 전용, 경로 변경 시 갱신 필요'),
  ('클로저 테이블',           '가장 유연',          '테이블 하나 더, 쓰기 비용 큼')
) AS t(방식, 장점, 단점);

\echo ''
\echo '  → 트리가 자주 바뀌지 않고 "하위 전체/상위 전체" 조회가 잦다면 ltree 가 편합니다.'
\echo '    노드를 옮기면 하위 경로를 전부 갱신해야 한다는 점만 유의하세요.'
