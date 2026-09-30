# ---------------------------------------------------------------------------
# week02 catalog lab - pg_bigm
#
# pg_bigm 은 contrib 도, apt.postgresql.org(PGDG) 패키지도 아니다 - NTT DATA 가
# 만들고 지금은 pg_bigm Development Group 이 관리하는 서드파티 소스 배포판이다.
# (반면 3-gram 버전인 pg_trgm 은 PostgreSQL contrib 에 포함되어 있다 - 02 문서에서 비교)
#
# 그래서 intro/labs/03-c-extension 과 같은 방식으로, 소스를 받아 PGXS 로 직접
# 빌드한다. 최종 이미지에는 빌드 도구 없이 산출물(.so/.control/.sql)만 남긴다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      git \
      ca-certificates \
      postgresql-server-dev-16 libicu-dev \
      postgresql-contrib-16 \
 && rm -rf /var/lib/apt/lists/*

# 태그를 고정한다 - 이 lab 은 2025-09-03 릴리스(1.2 계열, PostgreSQL 16~19 지원)로 검증했다.
RUN git clone --branch v1.2-20250903 --depth 1 \
      https://github.com/pgbigm/pg_bigm.git /build/pg_bigm

WORKDIR /build/pg_bigm
RUN make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
 && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config install \
 && echo "--- 설치 결과 ---" \
 && ls -l "$(/usr/lib/postgresql/16/bin/pg_config --pkglibdir)/pg_bigm.so" \
 && ls "$(/usr/lib/postgresql/16/bin/pg_config --sharedir)/extension/" | grep bigm

# ---------------------------------------------------------------------------
# 최종 이미지 - pg_trgm(contrib) 도 함께 설치해 02/04 에서 나란히 비교한다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-bigm"

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib-16 \
 && rm -rf /var/lib/apt/lists/*

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
