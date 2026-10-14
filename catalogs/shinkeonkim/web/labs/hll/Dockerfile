FROM postgres:18.6
ARG HLL_PACKAGE_VERSION=2.21-1.pgdg13+2
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-hll=${HLL_PACKAGE_VERSION} \
 && rm -rf /var/lib/apt/lists/*
