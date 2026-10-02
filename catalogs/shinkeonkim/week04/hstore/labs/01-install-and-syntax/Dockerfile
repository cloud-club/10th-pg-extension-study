# ---------------------------------------------------------------------------
# week04 catalog lab - hstore
#
# hstore 는 PostgreSQL 본체에 포함된 contrib 모듈이라 공식 이미지에 이미 들어 있다.
# 별도 패키지를 설치하지 않고, 버전은 다른 주차 실습과 같은 PostgreSQL 16.15 이미지로 고정한다.
# pageinspect(02), pgbench(04)도 같은 이미지에 들어 있다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-hstore"

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
