# ---------------------------------------------------------------------------
# experiment 02 - pg_stat_statements.max 크기와 eviction(entry_dealloc GC) 이
# 실제 쿼리 지연시간에 측정 가능한 영향을 주는지 확인하는 이미지.
#
# python3-psycopg2 를 함께 설치해, 문장 단위 왕복 시간을 정밀하게 재는
# measure.py 를 이 컨테이너 안에서(호스트 포트포워딩을 제외하며 loopback TCP 비용은 포함) 실행한다.
# ---------------------------------------------------------------------------
FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

LABEL org.opencontainers.image.title="pg-study-pgss-exp02-eviction"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-contrib \
      python3-psycopg2 \
 && rm -rf /var/lib/apt/lists/*

COPY measure.py /usr/local/bin/measure.py

ENV POSTGRES_DB=bench \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
