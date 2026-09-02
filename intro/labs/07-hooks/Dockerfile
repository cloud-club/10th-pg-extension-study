# ---------------------------------------------------------------------------
# Lab 07 - (d) Hook + 공유메모리를 쓰는 Extension  (pg_stat_statements)
#
# 이 부류는 CREATE EXTENSION 만으로는 동작하지 않는다.
# shared_preload_libraries 설정이 docker-compose.yml 에 있으니 함께 보라.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm
LABEL org.opencontainers.image.title="pg-study-lab07-hooks"
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*
ENV POSTGRES_DB=study POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
