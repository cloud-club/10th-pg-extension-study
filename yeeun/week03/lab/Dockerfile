# ---------------------------------------------------------------------------
# yeeun week03 lab — pg_cron
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="yeeun-week03-pgcron"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      postgresql-16-cron \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
