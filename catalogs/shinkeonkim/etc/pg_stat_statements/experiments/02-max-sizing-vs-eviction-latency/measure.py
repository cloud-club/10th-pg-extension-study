#!/usr/bin/env python3
"""
서로 다른 "모양"의 쿼리 N개를 순서대로 실행하면서 문장 하나하나의 왕복 시간을
정밀하게(perf_counter) 측정한다. pg_stat_statements.max 를 작게 잡아 해시테이블
eviction(entry_dealloc GC) 이 자주 일어나게 만든 환경과, 절대 안 일어나게 만든
환경을 같은 스크립트로 비교하기 위한 것 - labs/04-dba-playbook-and-pitfalls 에서
쓴 "함수 호출 개수를 늘려 타겟리스트 길이를 다르게 만드는" 트릭을 그대로 재사용한다.
"""
import sys
import time
import statistics as st
import psycopg2

N = int(sys.argv[1]) if len(sys.argv) > 1 else 1600

if not 2 <= N <= 1664:
    raise SystemExit("N은 2~1664 범위여야 합니다 (기본 1600)")

conn = psycopg2.connect(host="127.0.0.1", user="postgres", password="postgres", dbname="bench")
conn.autocommit = True
cur = conn.cursor()

cur.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")
cur.execute("SELECT pg_stat_statements_reset();")

latencies_ms = []
t_start = time.perf_counter()
for i in range(1, N + 1):
    cols = ",".join(["length('a')"] * i)
    sql = f"SELECT {cols}"
    t0 = time.perf_counter()
    cur.execute(sql)
    cur.fetchall()
    latencies_ms.append((time.perf_counter() - t0) * 1000)
elapsed = time.perf_counter() - t_start

cur.execute("SELECT dealloc, stats_reset FROM pg_stat_statements_info;")
dealloc, stats_reset = cur.fetchone()
cur.execute("SELECT count(*) FROM pg_stat_statements;")
(stored,) = cur.fetchone()
cur.execute("SHOW pg_stat_statements.max;")
(max_setting,) = cur.fetchone()

lat_sorted = sorted(latencies_ms)


def pct(p):
    idx = min(len(lat_sorted) - 1, int(len(lat_sorted) * p))
    return lat_sorted[idx]


print(f"pg_stat_statements.max = {max_setting}")
print(f"statements executed    = {N}")
print(f"wall clock total       = {elapsed:.3f} s")
print(f"dealloc (GC passes)    = {dealloc}")
print(f"entries stored at end  = {stored}")
print(f"latency mean    (ms)   = {st.mean(latencies_ms):.4f}")
print(f"latency stdev   (ms)   = {st.stdev(latencies_ms):.4f}")
print(f"latency p50     (ms)   = {pct(0.50):.4f}")
print(f"latency p95     (ms)   = {pct(0.95):.4f}")
print(f"latency p99     (ms)   = {pct(0.99):.4f}")
print(f"latency max     (ms)   = {max(latencies_ms):.4f}")

# 뒤쪽 절반(=해시테이블이 다 찬 뒤, eviction 이 실제로 일어날 수 있는 구간)만 따로
half = latencies_ms[N // 2:]
print(f"-- 뒤쪽 50%(테이블이 다 찬 이후 구간)만 --")
print(f"latency mean    (ms)   = {st.mean(half):.4f}")
print(f"latency p95     (ms)   = {sorted(half)[int(len(half)*0.95)]:.4f}")
print(f"latency max     (ms)   = {max(half):.4f}")

cur.close()
conn.close()
