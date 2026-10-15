-- pgvector 설치 전 확인: trusted·superuser 여부는 pg_available_extension_versions 에 바로 있다.
-- (trusted=false, superuser=true 면 일반 사용자는 CREATE EXTENSION 을 할 수 없다는 뜻)
SELECT name, version, superuser, trusted, relocatable, requires
FROM pg_available_extension_versions
WHERE name = 'vector';

CREATE EXTENSION IF NOT EXISTS vector;

SELECT extname, extversion, extrelocatable FROM pg_extension WHERE extname = 'vector';

-- vector 외에 halfvec(16비트 절반 정밀도) · sparsevec(희소 벡터) · bit(이진 벡터) 타입도 들어온다.
SELECT typname FROM pg_type WHERE typname IN ('vector', 'halfvec', 'sparsevec');

-- 리터럴과 차원 수 검증
SELECT '[1,2,3]'::vector;
SELECT '[1,2,3]'::vector(3);
-- 차원이 안 맞으면 즉시 에러로 거절한다 (조용히 자르거나 채우지 않는다).
-- ON_ERROR_STOP=1 로 자동 실행하는 스크립트에서는 실제로 에러를 내면 전체가 멈추므로,
-- 이 실패 사례는 HANDS-ON.md 에서 ./run.sh psql 로 직접 쳐서 확인한다.
