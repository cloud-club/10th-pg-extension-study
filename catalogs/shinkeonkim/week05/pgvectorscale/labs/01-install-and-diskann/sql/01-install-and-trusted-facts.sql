-- trusted·superuser·requires는 전부 pg_available_extension_versions에서 바로 보인다.
SELECT name, version, superuser, trusted, relocatable, requires
FROM pg_available_extension_versions
WHERE name IN ('vector', 'vectorscale')
ORDER BY name;

-- 둘 다 trusted=f, superuser=t 다. vectorscale은 requires={vector} - CASCADE로 같이 설치한다.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'vectorscale') ORDER BY extname;

-- 비슈퍼유저가 실제로 거절당하는 장면은 자동 실행에 넣을 수 없다(ON_ERROR_STOP=1이라 에러가 나면
-- 스크립트 전체가 멈춘다) - HANDS-ON.md에서 ./run.sh psql로 직접 재현한다.
