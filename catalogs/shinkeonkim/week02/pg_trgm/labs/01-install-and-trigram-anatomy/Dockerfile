# ---------------------------------------------------------------------------
# week02 catalog lab - pg_trgm
#
# pg_bigm 의 Dockerfile 이 54줄인 것과 비교해 보라. pg_trgm 은 PostgreSQL
# contrib 이라 소스를 받아 빌드할 필요가 없다 - postgresql-contrib-16 패키지만
# 설치하면 끝이고, 버전은 PostgreSQL 메이저 버전이 결정한다.
#
# 이 "설치 난이도 차이" 자체가 두 확장을 고르는 실제 기준 중 하나다
# (docs/04-production-playbook.md 의 trusted / 수퍼유저 권한 절 참고).
# ---------------------------------------------------------------------------
FROM postgres:16-trixie

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-trgm"

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib-16 \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
