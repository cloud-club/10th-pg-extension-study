# ---------------------------------------------------------------------------
# Lab 01 - CREATE EXTENSION 내부 동작 해부
#
# contrib extension만 있으면 되므로 공식 이미지에 postgresql-contrib만 얹는다.
# (공식 postgres 이미지에는 이미 contrib가 포함되어 있지만, 어떤 패키지가
#  extension 파일을 깔아주는지 명시적으로 보여주기 위해 남겨둔다.)
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab01"
LABEL org.opencontainers.image.description="CREATE EXTENSION 내부 동작 관찰용 환경"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
