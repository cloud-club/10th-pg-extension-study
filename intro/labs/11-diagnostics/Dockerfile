# ---------------------------------------------------------------------------
# Lab 11 - (h) 내부를 노출하는 진단 Extension
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab11-diagnostics"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
