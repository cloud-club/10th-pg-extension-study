# ---------------------------------------------------------------------------
# PGXS Makefile - C Extension
#
#   make          → myext.c 를 컴파일하고 myext.so 로 링크
#   make install  → myext.so   → $(pg_config --pkglibdir)/
#                   myext.control, myext--1.0.sql → $(pg_config --sharedir)/extension/
# ---------------------------------------------------------------------------

EXTENSION = myext
DATA      = myext--1.0.sql

# 만들어질 공유 라이브러리 이름 (→ myext.so)
MODULE_big = myext

# 링크할 오브젝트 파일들
OBJS = myext.o

# 회귀 테스트: sql/myext_basic.sql 을 실행하고 expected/myext_basic.out 과 비교
REGRESS = myext_basic

PG_CONFIG = pg_config
PGXS := $(shell $(PG_CONFIG) --pgxs)
include $(PGXS)
