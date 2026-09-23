# ---------------------------------------------------------------------------
# 실험 07 - PostgreSQL 버전별 벤치 (16 / 17 / 18 / 19beta1)
#
# 같은 pg_bigm 소스(v1.2-20250903)를 각 메이저 버전의 서버 개발 헤더로 다시
# 빌드한다. PGXS 빌드라 버전마다 .so 가 따로 필요하기 때문이다.
#
#   docker build --build-arg PGVER=17 --build-arg PGTAG=17-trixie .
#
# PGTAG 를 따로 두는 것은 19 가 아직 GA 가 아니라 태그가 `19beta1-trixie`
# 이기 때문이다 (PGVER 은 경로에 쓰이는 메이저 번호라 `19`).
# ---------------------------------------------------------------------------
ARG PGTAG=16-trixie
FROM postgres:${PGTAG} AS build
ARG PGVER=16

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential git ca-certificates \
      postgresql-server-dev-${PGVER} libicu-dev postgresql-contrib-${PGVER} \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v1.2-20250903 --depth 1 \
      https://github.com/pgbigm/pg_bigm.git /build/pg_bigm

WORKDIR /build/pg_bigm
RUN make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/${PGVER}/bin/pg_config \
 && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/${PGVER}/bin/pg_config install \
 && ls -l "$(/usr/lib/postgresql/${PGVER}/bin/pg_config --pkglibdir)/pg_bigm.so"

FROM postgres:${PGTAG}
ARG PGVER=16

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib-${PGVER} \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/lib/postgresql/${PGVER}/lib/pg_bigm.so \
                  /usr/lib/postgresql/${PGVER}/lib/
COPY --from=build /usr/share/postgresql/${PGVER}/extension/pg_bigm.control \
                  /usr/share/postgresql/${PGVER}/extension/pg_bigm--1.0--1.1.sql \
                  /usr/share/postgresql/${PGVER}/extension/pg_bigm--1.1--1.2.sql \
                  /usr/share/postgresql/${PGVER}/extension/pg_bigm--1.2.sql \
                  /usr/share/postgresql/${PGVER}/extension/

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
