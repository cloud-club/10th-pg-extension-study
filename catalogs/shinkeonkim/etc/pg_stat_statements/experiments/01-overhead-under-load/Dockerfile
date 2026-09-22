# ---------------------------------------------------------------------------
# experiment 01 - pg_stat_statements 오버헤드 측정용 이미지.
# 고정한 PostgreSQL 16 이미지의 pgbench와 pg_stat_statements를 사용한다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-pgss-exp01-overhead"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=bench \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
