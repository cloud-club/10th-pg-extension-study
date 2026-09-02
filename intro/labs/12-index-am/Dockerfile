# ---------------------------------------------------------------------------
# Lab 12 - (i) 새 인덱스 액세스 메서드를 추가하는 Extension
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab12-index-am"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
