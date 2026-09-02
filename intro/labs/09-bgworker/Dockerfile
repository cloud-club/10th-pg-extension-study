# ---------------------------------------------------------------------------
# Lab 09 - (f) Background Worker 를 띄우는 Extension  (pg_cron)
#
# pg_cron 은 contrib 가 아니라 서드파티다. apt.postgresql.org 에서 받는다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm
LABEL org.opencontainers.image.title="pg-study-lab09-bgworker"
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      postgresql-16-cron \
 && rm -rf /var/lib/apt/lists/*
ENV POSTGRES_DB=study POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
