# ---------------------------------------------------------------------------
# Lab 08 - (e) Extension 이 아닌 "모듈"  (auto_explain)
#
# auto_explain 은 .so 는 있지만 .control 이 없다.
# 그래서 CREATE EXTENSION 대상이 아니고, preload 로만 쓸 수 있다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm
LABEL org.opencontainers.image.title="pg-study-lab08-modules"
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*
ENV POSTGRES_DB=study POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
