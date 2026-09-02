-- ===========================================================================
-- 05. cube + earthdistance - extension 이 extension 위에 세워지는 예
-- ===========================================================================
\echo '--- earthdistance 의 control 파일을 보면 ---'
\echo '  [컨테이너 셸] $ grep -E "requires|comment" /usr/share/postgresql/16/extension/earthdistance.control'
\! grep -E "requires|comment" /usr/share/postgresql/16/extension/earthdistance.control

\echo ''
\echo '  ^ requires = cube. earthdistance 는 cube 타입 위에 만들어졌습니다.'
\echo '    (지구 표면의 점을 3차원 좌표 cube 로 표현합니다)'

\echo ''
\echo '--- 의존 관계도 pg_depend 에 기록됩니다 ---'
SELECT src.extname AS extension, tgt.extname AS 의존_대상, d.deptype
FROM   pg_depend d
JOIN   pg_extension src ON src.oid = d.objid    AND d.classid    = 'pg_extension'::regclass
JOIN   pg_extension tgt ON tgt.oid = d.refobjid AND d.refclassid = 'pg_extension'::regclass;

\echo ''
\echo '--- cube 타입 자체 ---'
SELECT '(1,2,3)'::cube                      AS 점,
       '(0,0,0),(1,1,1)'::cube              AS 상자,
       cube_distance('(0,0,0)', '(1,1,1)')  AS 거리,
       cube_dim('(1,2,3)')                  AS 차원수;

\echo ''
\echo '--- earthdistance: 위경도 두 점 사이 거리 (미터) ---'
SELECT round((earth_distance(
         ll_to_earth(37.5547, 126.9707),   -- 서울역
         ll_to_earth(37.4979, 127.0276)    -- 강남역
       ))::numeric) AS 미터;

\echo ''
\echo '  ^ ll_to_earth(위도, 경도) - 인자 순서가 (위도, 경도)입니다.'
\echo '    PostGIS 의 ST_Point(경도, 위도) 와 반대라서 자주 틀립니다.'

\echo ''
\echo '--- 반경 검색 + GiST 인덱스 ---'
DROP TABLE IF EXISTS places;
CREATE TABLE places (name text, lat float8, lon float8);
INSERT INTO places VALUES
  ('서울역', 37.5547, 126.9707), ('강남역', 37.4979, 127.0276),
  ('경복궁', 37.5796, 126.9770), ('남산타워', 37.5512, 126.9883),
  ('부산역', 35.1151, 129.0403);

CREATE INDEX idx_places_earth ON places USING gist (ll_to_earth(lat, lon));

SELECT name, round(earth_distance(ll_to_earth(lat,lon),
                                  ll_to_earth(37.5547,126.9707))::numeric) AS 미터
FROM   places
WHERE  earth_box(ll_to_earth(37.5547, 126.9707), 5000) @> ll_to_earth(lat, lon)
ORDER  BY 미터;

\echo ''
\echo '  → PostGIS 를 쓸 수 없거나(가벼운 환경), "대충 거리"만 필요할 때의 대안입니다.'
\echo '    지구를 완전한 구로 가정하므로 PostGIS 보다 정확도가 낮습니다.'
\echo '    본격적인 공간 연산(폴리곤, 교차 등)이 필요하면 PostGIS 로 가세요.'
