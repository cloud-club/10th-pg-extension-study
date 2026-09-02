-- ===========================================================================
-- 03. tablefunc - crosstab(피벗) 과 계층 쿼리
-- ===========================================================================
DROP TABLE IF EXISTS sales;
CREATE TABLE sales (dept text, month text, revenue numeric);
INSERT INTO sales VALUES
  ('영업', '01', 100), ('영업', '02', 120), ('영업', '03', 140),
  ('개발', '01', 200), ('개발', '02', 180), ('개발', '03', 260),
  ('지원', '01',  50), ('지원', '02',  70), ('지원', '03',  60);

\echo '--- 원본 (세로로 긴 형태) ---'
SELECT * FROM sales ORDER BY dept, month;

\echo ''
\echo '--- crosstab 으로 피벗 (가로로 눕히기) ---'
SELECT * FROM crosstab(
    'SELECT dept, month, revenue FROM sales ORDER BY 1, 2',
    'SELECT DISTINCT month FROM sales ORDER BY 1'
) AS ct(부서 text, "1월" numeric, "2월" numeric, "3월" numeric);

\echo ''
\echo '  ^ 두 번째 인자가 "컬럼이 될 값들"의 목록입니다.'
\echo '    반환 컬럼을 AS 로 직접 선언해야 하는 게 crosstab 의 불편한 점입니다.'
\echo '    (PostgreSQL 은 함수의 반환 타입을 실행 전에 알아야 하기 때문)'

\echo ''
\echo '--- 순수 SQL 로도 같은 걸 할 수 있습니다 (FILTER 절) ---'
SELECT dept AS 부서,
       sum(revenue) FILTER (WHERE month='01') AS "1월",
       sum(revenue) FILTER (WHERE month='02') AS "2월",
       sum(revenue) FILTER (WHERE month='03') AS "3월"
FROM   sales GROUP BY dept ORDER BY dept;

\echo ''
\echo '  → 컬럼이 고정이면 FILTER 가 더 낫습니다.'
\echo '    crosstab 은 컬럼 목록을 쿼리로 뽑아야 할 때 의미가 있습니다.'

\echo ''
\echo '--- connectby: 계층 구조 펼치기 ---'
DROP TABLE IF EXISTS org;
CREATE TABLE org (id text, parent text, name text);
INSERT INTO org VALUES
  ('1', NULL, '대표'), ('2','1','개발본부'), ('3','1','영업본부'),
  ('4','2','백엔드팀'), ('5','2','프론트팀'), ('6','3','국내영업팀');

SELECT * FROM connectby('org', 'id', 'parent', '1', 0, '/')
  AS t(id text, parent text, level int, path text)
JOIN  org USING (id);

\echo ''
\echo '  → 요즘은 재귀 CTE(WITH RECURSIVE)로 하는 게 표준입니다.'
\echo '    connectby 는 Oracle CONNECT BY 에서 넘어온 레거시 코드에서 만납니다.'
