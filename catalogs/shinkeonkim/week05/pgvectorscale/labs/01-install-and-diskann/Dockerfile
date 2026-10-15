# ---------------------------------------------------------------------------
# week05 catalog lab - pgvectorscale
#
# pgvectorscale은 Rust/pgrx로 빌드하는 확장이라 postgres:16-trixie에 직접 빌드하지 않고,
# pgvector + pgvectorscale + timescaledb가 이미 빌드되어 있는 공식 이미지를 그대로 쓴다.
# vectorscale은 vector를 요구하므로(requires='vector') 같은 이미지가 둘 다 담고 있는 쪽이 간단하다.
# ---------------------------------------------------------------------------
FROM timescale/timescaledb-ha@sha256:e9f34d8dd27621ec3933386eb07b70021d15b8116247362e0537bbff94ef0769

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pgvectorscale"

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
