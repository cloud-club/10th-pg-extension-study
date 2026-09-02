# ---------------------------------------------------------------------------
# Lab 10 - (g) FDW: 외부 데이터를 테이블처럼
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab10-fdw"

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-contrib \
 && rm -rf /var/lib/apt/lists/*

# file_fdw 실습용 CSV (서버 로컬 파일이어야 한다)
RUN mkdir -p /lab/data \
 && printf 'id,city,population\n1,서울,9400000\n2,부산,3300000\n3,인천,2950000\n4,대구,2380000\n5,대전,1450000\n' \
      > /lab/data/cities.csv \
 && chown -R postgres:postgres /lab/data

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
