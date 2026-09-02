# ---------------------------------------------------------------------------
# Lab 02 - SQL-only Extension 직접 만들어 설치하기
#
# 빌드 단계에서 PGXS(make install)로 greetkor 를 이미지에 심는다.
# 컨테이너를 띄우면 pg_available_extensions 에 greetkor 가 보인다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab02"

# PGXS 를 쓰려면 서버 개발 패키지가 필요하다 (pgxs.mk, 서버 헤더)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      postgresql-server-dev-16 \
 && rm -rf /var/lib/apt/lists/*

# extension 소스를 넣고 PGXS 로 설치
COPY ext/ /build/greetkor/
RUN cd /build/greetkor \
 && make install \
 # 설치 결과 확인 - 빌드 로그에서 바로 보인다
 && ls -l "$(pg_config --sharedir)/extension/" | grep greetkor

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
