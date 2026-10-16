# yeeun week05 — postgres-json-schema
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="yeeun-week05-json-schema"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      git \
      make \
      postgresql-server-dev-16 \
 && git clone --depth 1 https://github.com/gavinwahl/postgres-json-schema.git /tmp/postgres-json-schema \
 && cd /tmp/postgres-json-schema \
 && make \
 && make install \
 && rm -rf /tmp/postgres-json-schema /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
