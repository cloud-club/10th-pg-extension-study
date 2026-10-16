# ---------------------------------------------------------------------------
# week05 catalog lab - pgvector
#
# pgvector는 contrib가 아니라 별도 빌드가 필요한 확장이다. 공식 이미지(pgvector/pgvector)가
# postgres:16-trixie 베이스에 pgvector를 이미 빌드해 넣어 배포하므로 그 이미지를 그대로 쓴다.
# ---------------------------------------------------------------------------
FROM pgvector/pgvector@sha256:7b822b0aac60967beb1ea5e576b8602c94c300a157d187f385ae3e0da199b90a

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pgvector"

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
