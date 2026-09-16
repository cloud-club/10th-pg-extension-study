# ---------------------------------------------------------------------------
# yeeun week02 lab — pg_stat_statements 실측
# shared_preload_libraries 설정은 docker-compose.yml 의 command 에 있다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="yeeun-week02-pgss"

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
