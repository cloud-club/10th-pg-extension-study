# ---------------------------------------------------------------------------
# Lab 13 - 다른 프로그래밍 언어로 함수 짜기 (절차적 언어 extension)
#
# PL/Python 과 PL/Perl 을 설치한다.
# 둘 다 "언어 자체가 extension" 이라는 점이 이 lab 의 주제다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab13-pl-languages"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-plpython3-16 \
      postgresql-plperl-16 \
 && rm -rf /var/lib/apt/lists/* \
 && ls /usr/share/postgresql/16/extension/ | grep -E "plpython|plperl"

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
