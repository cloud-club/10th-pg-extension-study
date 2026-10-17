# yeeun week06 — btree_gist
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="yeeun-week06-btree-gist"

# 공식 이미지에 contrib(btree_gist) 포함. 명시적으로 16 contrib 보장.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib \
 && rm -rf /var/lib/apt/lists/* || true

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
