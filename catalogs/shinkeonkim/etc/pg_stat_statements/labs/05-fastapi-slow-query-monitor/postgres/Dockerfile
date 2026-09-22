# ---------------------------------------------------------------------------
# Lab 05 - postgres 서비스. 01~04 랩과 같은 pg_stat_statements 설정을 쓰되,
# 이번엔 psql 이 아니라 FastAPI 백엔드가 그 통계를 조회한다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pgss-05-postgres"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
