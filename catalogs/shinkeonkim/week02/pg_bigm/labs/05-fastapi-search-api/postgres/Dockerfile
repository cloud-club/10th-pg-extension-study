# ---------------------------------------------------------------------------
# 05-fastapi-search-api - pg_bigm 을 실제 백엔드(FastAPI)에서 쓰는 예제의 DB 쪽.
# 빌드 방식은 01~04 lab 과 동일: PGDG 패키지가 없어서 소스를 PGXS 로 직접 빌드한다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      git \
      ca-certificates \
      postgresql-server-dev-16 libicu-dev \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v1.2-20250903 --depth 1 \
      https://github.com/pgbigm/pg_bigm.git /build/pg_bigm

WORKDIR /build/pg_bigm
RUN make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
 && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config install

FROM postgres:16-trixie

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-bigm-05-db"

COPY --from=build /usr/lib/postgresql/16/lib/pg_bigm.so \
                  /usr/lib/postgresql/16/lib/
COPY --from=build /usr/share/postgresql/16/extension/pg_bigm.control \
                  /usr/share/postgresql/16/extension/pg_bigm--1.0--1.1.sql \
                  /usr/share/postgresql/16/extension/pg_bigm--1.1--1.2.sql \
                  /usr/share/postgresql/16/extension/pg_bigm--1.2.sql \
                  /usr/share/postgresql/16/extension/

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
