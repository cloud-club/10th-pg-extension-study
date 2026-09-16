FROM postgres:16-trixie@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-cron=1.6.8-1.pgdg13+1 \
 && rm -rf /var/lib/apt/lists/*
