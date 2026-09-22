# ---------------------------------------------------------------------------
# etc catalog lab - pg_stat_statements 심화
#
# intro/labs/07-hooks 가 "Hook + 공유메모리" 부류의 대표 예시로 이 익스텐션을
# 살짝 다뤘다면, 이 lab 은 pg_stat_statements 자체가 주제다.
# 정규화 · 통계 컬럼 전체 · 버전별 기능 · 운영 플레이북까지 다룬다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-stat-statements"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
