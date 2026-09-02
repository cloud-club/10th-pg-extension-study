# ---------------------------------------------------------------------------
# Lab 04 - (a) 함수를 추가하는 Extension
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab04-functions"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
