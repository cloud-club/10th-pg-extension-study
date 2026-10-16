# ---------------------------------------------------------------------------
# experiment 01 - scheduling jitter measurement
# 동일한 postgres+pg_cron 이미지, labs/ 와는 별개 실험용 컨테이너.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pgcron-exp01"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      postgresql-16-cron=1.6.8-1.pgdg13+1 \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
