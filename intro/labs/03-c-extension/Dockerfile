# ---------------------------------------------------------------------------
# Lab 03 - C Extension 을 직접 컴파일해서 설치하기
#
# 빌드 단계에서 PGXS 로 myext.c → myext.so 를 만들고, 서버 라이브러리
# 디렉토리에 심는다. 컨테이너가 뜨면 CREATE EXTENSION myext; 로 바로 쓴다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm AS build

# C 컴파일에는 서버 헤더(postgres.h, fmgr.h)와 pgxs.mk 가 필요하다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      postgresql-server-dev-16 \
 && rm -rf /var/lib/apt/lists/*

COPY ext/ /build/myext/
WORKDIR /build/myext

# 1) 컴파일 + 링크 → myext.so
RUN make PG_CONFIG=/usr/bin/pg_config

# 2) 설치 (.so → pkglibdir, .control/.sql → sharedir/extension)
RUN make install PG_CONFIG=/usr/bin/pg_config \
 && echo "--- 설치 결과 ---" \
 && ls -l "$(pg_config --pkglibdir)/myext.so" \
 && ls -l "$(pg_config --sharedir)/extension/" | grep myext

# 3) .so 안의 심볼 목록을 파일로 남겨둔다 (최종 이미지에는 nm 이 없으므로)
RUN nm -D --defined-only "$(pg_config --pkglibdir)/myext.so" > /build/myext.symbols \
 && cat /build/myext.symbols

# ---------------------------------------------------------------------------
# 최종 이미지: 빌드 도구 없이 산출물(.so + .control + .sql)만 가져간다.
# 실무에서 extension 이미지를 슬림하게 만드는 방법이기도 하다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab03"

COPY --from=build /usr/lib/postgresql/16/lib/myext.so \
                  /usr/lib/postgresql/16/lib/
COPY --from=build /build/myext.symbols /lab/myext.symbols
COPY --from=build /usr/share/postgresql/16/extension/myext.control \
                  /usr/share/postgresql/16/extension/myext--1.0.sql \
                  /usr/share/postgresql/16/extension/

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
