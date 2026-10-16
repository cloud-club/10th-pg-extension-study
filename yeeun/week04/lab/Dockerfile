# yeeun week04 lab — pg_repack (Bloat · VACUUM · repack 크기 비교)
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="yeeun-week04-repack"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-16-repack \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
