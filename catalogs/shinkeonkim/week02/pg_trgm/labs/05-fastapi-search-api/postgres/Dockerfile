# ---------------------------------------------------------------------------
# 05-fastapi-search-api - pg_trgm 을 실제 백엔드(FastAPI)에서 쓰는 예제의 DB 쪽.
#
# pg_bigm 쪽 같은 lab 의 Dockerfile 과 비교해 보라 - 저쪽은 소스를 git clone 해서
# PGXS 로 빌드하는 24줄짜리 멀티스테이지 빌드였다. pg_trgm 은 contrib 이라
# postgresql-contrib-16 한 줄이면 끝난다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib-16 \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
