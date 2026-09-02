# ---------------------------------------------------------------------------
# PGXS Makefile - SQL-only Extension
#
#   make install   → .control 과 .sql 을 $SHAREDIR/extension/ 으로 복사
#   그게 전부다. 컴파일할 C 코드가 없으므로 MODULE_big / OBJS 도 없다.
# ---------------------------------------------------------------------------

# .control 파일 이름과 반드시 일치해야 한다
EXTENSION = greetkor

# $SHAREDIR/extension/ 으로 설치될 SQL 파일들
DATA = greetkor--1.0.sql greetkor--1.0--1.1.sql

# pg_config 가 PostgreSQL 설치 정보를 전부 알려준다
PG_CONFIG = pg_config
PGXS := $(shell $(PG_CONFIG) --pgxs)
include $(PGXS)
