# ---------------------------------------------------------------------------
# lab 05 - FastAPI 뒤에서 쓰는 pg_cron
# 다른 4개 lab 과 동일한 이미지 - shared_preload_libraries=pg_cron 이 필요하다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-cron-05"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      postgresql-16-cron=1.6.8-1.pgdg13+1 \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
