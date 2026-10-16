# ---------------------------------------------------------------------------
# week03 catalog lab - pg_cron 심화
#
# intro/labs/09-bgworker 가 "Background Worker 를 띄우는 extension" 부류의
# 대표 예시로 pg_cron 을 살짝 다뤘다면, 이 lab 은 pg_cron 자체가 주제다.
# 실행 아키텍처(libpq 연결 vs 진짜 bgworker) · 동시성 제한 · RLS ·
# 다른 DB 스케줄링 · 운영 함정까지 다룬다.
#
# pg_cron 은 contrib 가 아니라 서드파티(Citus/Microsoft)다. apt.postgresql.org 에서 받는다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-catalog-shinkeonkim-pg-cron"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      postgresql-16-cron=1.6.8-1.pgdg13+1 \
 && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
