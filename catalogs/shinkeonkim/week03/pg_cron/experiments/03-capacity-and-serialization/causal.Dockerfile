FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94

ARG PG_CRON_COMMIT=5cedfa472ccc83567aa23ec645925ed8489a7797

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential ca-certificates git libkrb5-dev postgresql-server-dev-16 \
 && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/citusdata/pg_cron.git /build/pg_cron \
 && git -C /build/pg_cron checkout "$PG_CRON_COMMIT"

COPY waiting-tasks-not-polled.patch /tmp/waiting-tasks-not-polled.patch

ARG APPLY_WAITING_PATCH=0
RUN if [ "$APPLY_WAITING_PATCH" = "1" ]; then \
      git -C /build/pg_cron apply /tmp/waiting-tasks-not-polled.patch; \
    fi \
 && make -C /build/pg_cron -j2 \
 && make -C /build/pg_cron install
