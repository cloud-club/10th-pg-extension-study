"""pgvector·pgvectorscale(week05) clotho 애니메이션 문서.

build.py 의 DOCS 에 `docs(kit)` 결과가 합쳐진다. 장면 빌더(Story)와 반올림은 hstore_docs 것을 그대로 쓴다.

수치는 손으로 적지 않는다. 실험 요약(src/data/pgvector-experiments.json)과 데모 캡처
(src/data/pgvector-demo.json)에서 읽으며, 파일이 없으면 멈춘다.
"""
from __future__ import annotations
import json
import os
import re

from hstore_docs import Story, rnd

HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(HERE, "..", "data", "pgvector-experiments.json")
DEMO = os.path.join(HERE, "..", "data", "pgvector-demo.json")


def load(path, how):
    if not os.path.exists(path):
        raise SystemExit(f"{os.path.basename(path)} 이 없다: {how} 를 먼저 실행하세요.")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cfg(configs, name):
    return next(c for c in configs if c["config"] == name)


def num(n, digits=0):
    return f"{n:,.{digits}f}" if digits else f"{rnd(n):,}"


def table_value(output, row_label, col=1):
    """psql aligned 표에서 row_label 로 시작하는 행의 col 번째 값을 꺼낸다."""
    for line in output.splitlines():
        cells = [c.strip() for c in line.split("|")]
        if cells and cells[0].startswith(row_label):
            return cells[col]
    raise SystemExit(f"데모 출력에서 '{row_label}' 행을 찾지 못했다")


def removed_by_filter(output):
    m = re.search(r"Rows Removed by Filter: (\d+)", output)
    return int(m.group(1)) if m else 0


# ---------------------------------------------------------------------------
# 1) 정확한 검색 vs 근사 검색, 그리고 recall@10 (실험 01)
# ---------------------------------------------------------------------------
def doc_exact_vs_ann(k, ex):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM"))
    rc = ex["recall"]
    n_rows = rc["n_vectors"]
    ef10, ef200 = cfg(rc["configs"], "hnsw_ef10"), cfg(rc["configs"], "hnsw_ef200")
    r10 = sum(ef10["recall"]) / 2
    r200 = sum(ef200["recall"]) / 2

    s = Story(k, "pgv-exact-vs-ann", "정확한 검색과 근사 검색, 그리고 recall@10",
              f"실험 01: {n_rows:,}행 · 128차원. 브루트포스는 정확하지만 전부 읽고, ANN 은 일부만 읽는 대신 놓칠 수 있다.",
              940, 500)

    c = s.chapter("1. 정확한 검색", "질의 하나마다 모든 행과의 거리를 계산하고 정렬한다", 7000)
    c.text(40, 96, "질의 벡터 q 와 테이블의 모든 행 - 하나도 빼지 않고 거리를 잰다", 200, 15, MUTED)
    for i in range(12):
        c.box(40 + i * 72, 116, 64, 44, BIGM, f"{i + 1}", 600 + i * 180, 16, ON_FILL)
    c.text(40, 214, f"{n_rows:,}행이면 질의마다 {n_rows:,}번 계산한다 - 인덱스 없는 ORDER BY <-> LIMIT 10", 3000, 15, INK)
    c.text(40, 250, "결과는 정확하다(정답 top-10). 대신 행 수에 비례해 느려진다.", 4200, 15, OK)

    c = s.chapter("2. 근사 검색(ANN)", "인덱스가 '가까워 보이는' 일부만 읽고 top-10 을 고른다", 8000)
    c.text(40, 96, "같은 12개 중 인덱스가 실제로 읽는 것만 칠한다", 200, 15, MUTED)
    visited = {1, 2, 4, 5, 8, 9}
    for i in range(12):
        col = TRGM if i in visited else DIM
        c.box(40 + i * 72, 116, 64, 44, col, f"{i + 1}", 500 + i * 120, 16, ON_FILL if i in visited else MUTED)
    c.text(40, 214, "읽은 칸(빨강)만 비교하니 빠르다. 안 읽은 칸에 정답이 있으면 놓친다.", 2600, 15, INK)
    c.text(40, 250, "HNSW 는 ef_search, IVFFlat 은 probes, DiskANN 은 query_search_list_size 로", 4000, 15, MUTED)
    c.text(40, 280, "'얼마나 넓게 읽을지'를 질의 시점에 정한다.", 4400, 15, MUTED)

    c = s.chapter("3. recall@10", "ANN 의 top-10 중 정답 top-10 에 든 비율", 8500)
    c.text(40, 96, "정답 top-10", 200, 15, MUTED)
    for i in range(10):
        c.box(40 + i * 86, 112, 78, 40, OK, f"정답{i + 1}", 400 + i * 80, 14, ON_FILL)
    c.text(40, 198, "ANN top-10 (6개는 정답과 같고 4개는 다르다)", 1800, 15, MUTED)
    for i in range(10):
        hit = i < 6
        c.box(40 + i * 86, 214, 78, 40, OK if hit else WARN, f"정답{i + 1}" if hit else f"다른{i - 5}",
              2200 + i * 80, 14, ON_FILL)
    c.text(40, 304, "recall@10 = 겹친 개수 / 10 = 6 / 10 = 0.6", 3600, 17, INK, "700")
    c.text(40, 340, "이 문서의 실험은 이 값을 질의 50개에 대해 평균 낸다.", 4600, 15, MUTED)

    c = s.chapter("4. 넓게 읽을수록", f"실험 01 · HNSW: ef_search 10 → 200", 8000)
    c.text(40, 96, "같은 데이터, 같은 정답. 질의 시점 파라미터만 바꿨다 (2회 평균)", 200, 15, MUTED)
    c.box(40, 116, 400, 52, BIGM, f"ef_search=10 · recall {r10:.2f}", 600, 18, ON_FILL)
    c.box(480, 116, 420, 52, OK, f"ef_search=200 · recall {r200:.2f}", 1400, 18, ON_FILL)
    c.text(40, 220, f"읽는 버퍼: 질의당 {num(ef10['buffers_per_query'][1])} → {num(ef200['buffers_per_query'][1])}", 2600, 16, INK)
    c.text(40, 256, "recall 이 오르는 만큼 비용도 오른다 - 이것이 ANN 의 기본 트레이드오프다.", 3800, 15, WARN)
    return s.build()


# ---------------------------------------------------------------------------
# 2) HNSW: 층이 있는 그래프를 그리디하게 내려간다 (실험 01·06)
# ---------------------------------------------------------------------------
def doc_hnsw_search(k, ex):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM, TSV = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM", "TSV"))
    sc = ex["scale"]["configs"]
    rc = ex["recall"]["configs"]
    e10_51k = sum(cfg(rc, "hnsw_ef10")["recall"]) / 2
    e10_300k = cfg(sc, "hnsw_ef10")["recall_at_10"]
    e100_300k = cfg(sc, "hnsw_ef100")["recall_at_10"]

    s = Story(k, "pgv-hnsw-search", "HNSW 는 층이 있는 그래프를 내려가며 찾는다",
              "위층에서 큰 걸음으로 가까운 곳까지 가고, 바닥층에서 ef_search 개 후보를 유지하며 넓힌다. 수치는 실험 01·06.",
              940, 500)

    c = s.chapter("1. 층이 있는 그래프", "모든 점은 바닥층에, 일부만 위층에도 있다", 7500)
    c.text(40, 96, "2층 (드문 점들 - 멀리 이어진 간선)", 200, 15, MUTED)
    for i, x in enumerate((80, 420, 760)):
        c.box(x, 112, 100, 40, TSV, f"L2-{i + 1}", 500 + i * 200, 15, ON_FILL)
    c.text(40, 196, "1층", 1400, 15, MUTED)
    for i in range(6):
        c.box(40 + i * 150, 212, 120, 40, BIGM, f"L1-{i + 1}", 1700 + i * 150, 15, ON_FILL)
    c.text(40, 296, "0층 (모든 점)", 2800, 15, MUTED)
    for i in range(10):
        c.box(40 + i * 88, 312, 80, 40, PANEL, f"{i + 1}", 3000 + i * 80, 15, INK, DIM)
    c.text(40, 400, "위층일수록 점이 적고 간선이 길다 - 고속도로와 골목길처럼.", 4400, 15, INK)

    c = s.chapter("2. 위에서 아래로", "각 층에서 질의에 가장 가까운 점으로 이동한 뒤 한 층 내려간다", 8000)
    c.text(40, 96, "진입점(L2-1)에서 출발 → 각 층에서 질의 q 쪽으로 그리디 이동", 200, 15, MUTED)
    c.box(80, 112, 100, 40, DIM, "L2-1", 400, 15, MUTED)
    c.box(420, 112, 100, 40, TRGM, "L2-2", 1200, 15, ON_FILL)
    c.text(560, 138, "← 2층에서 가장 가까움", 1600, 14, MUTED)
    c.box(460, 212, 120, 40, DIM, "L1-4", 2400, 15, MUTED)
    c.box(610, 212, 120, 40, TRGM, "L1-5", 3000, 15, ON_FILL)
    c.text(760, 238, "← 1층", 3400, 14, MUTED)
    c.box(656, 312, 80, 40, TRGM, "8", 4400, 15, ON_FILL)
    c.text(760, 338, "← 0층 출발점", 4800, 14, MUTED)
    c.text(40, 420, "위층에서 멀리 뛰어 질의 근처까지 빨리 간다. 정밀한 탐색은 0층에서.", 5600, 15, INK)

    c = s.chapter("3. 0층에서 ef_search 개", "후보 목록 크기 = ef_search. 목록이 꽉 차면 먼 후보부터 버린다", 8500)
    c.text(40, 96, "ef_search = 4 일 때 (작은 목록)", 200, 15, MUTED)
    for i in range(4):
        c.box(40 + i * 110, 112, 100, 40, BIGM, f"후보 {i + 1}", 500 + i * 200, 15, ON_FILL)
    c.text(40, 196, "목록이 작으면 근처만 보고 끝난다 → 빠르지만 정답을 놓친다", 1600, 15, WARN)
    c.text(40, 252, "ef_search = 10 일 때 (큰 목록)", 2800, 15, MUTED)
    for i in range(10):
        c.box(40 + i * 88, 268, 80, 40, OK, f"{i + 1}", 3100 + i * 120, 15, ON_FILL)
    c.text(40, 352, "더 많은 이웃을 펼쳐 본다 → 정답을 더 찾지만 읽는 페이지(버퍼)가 는다", 4600, 15, INK)

    c = s.chapter("4. 규모가 커지면", "실험 06 · 같은 ef_search=10, 행 수만 6배", 8000)
    c.text(40, 96, "ef_search=10 의 recall@10", 200, 15, MUTED)
    c.box(40, 112, 400, 52, BIGM, f"51,000행 · {e10_51k:.2f}", 500, 18, ON_FILL)
    c.box(480, 112, 420, 52, TRGM, f"301,000행 · {e10_300k:.2f}", 1500, 18, ON_FILL)
    c.text(40, 220, f"301,000행에서는 ef_search=100 으로 올려도 {e100_300k:.2f} - 싼 설정은 규모에 약하다.", 2800, 15, INK)
    c.text(40, 256, "같은 조건에서 DiskANN 의 가장 싼 설정은 1.00 이었다 (실험 06).", 4000, 15, OK)
    return s.build()


# ---------------------------------------------------------------------------
# 3) IVFFlat: lists 개 군집과 probes (실험 01 · 데모 캡처)
# ---------------------------------------------------------------------------
def doc_ivfflat_probes(k, ex, demo):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM, TSV = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM", "TSV"))
    rc = ex["recall"]["configs"]
    p1, p10, p50 = (cfg(rc, f"ivfflat_probes{p}") for p in (1, 10, 50))
    early = table_value(demo["ivf_recall"]["output"], "early")
    proper = table_value(demo["ivf_recall"]["output"], "proper")

    s = Story(k, "pgv-ivfflat-probes", "IVFFlat 은 군집 몇 개만 골라 훑는다",
              "빌드 때 k-means 로 lists 개 군집을 만들고, 질의 때 가까운 probes 개 군집만 읽는다. 수치는 실험 01 과 데모 캡처.",
              940, 500)

    c = s.chapter("1. lists 개 군집", "CREATE INDEX 시점의 데이터로 k-means 를 돌려 중심을 정한다", 7000)
    c.text(40, 96, "lists = 5 라면: 모든 행이 가장 가까운 중심의 목록에 들어간다", 200, 15, MUTED)
    for i in range(5):
        c.box(40 + i * 176, 116, 160, 100, PANEL, f"목록 {i + 1}", 600 + i * 250, 17, INK, DIM)
    c.text(40, 270, "중심은 빌드할 때 한 번 정해지고, 나중에 들어온 행은 기존 목록에 덧붙는다.", 2600, 15, INK)
    c.text(40, 306, "데이터 분포가 바뀌면 REINDEX 해야 중심이 다시 학습된다.", 3800, 15, MUTED)

    c = s.chapter("2. probes = 1", "질의에서 가장 가까운 중심 하나의 목록만 읽는다", 7500)
    c.text(40, 96, "질의 q 가 목록 2 와 3 의 경계 근처에 있다고 하자", 200, 15, MUTED)
    for i in range(5):
        col = BIGM if i == 1 else DIM
        c.box(40 + i * 176, 116, 160, 100, col, f"목록 {i + 1}", 400, 17, ON_FILL if i == 1 else MUTED)
    c.text(40, 270, "목록 2 만 읽는다. 목록 3 에 있는 진짜 이웃은 보지도 못한다.", 1600, 15, WARN)
    c.text(40, 306, f"실험 01 (lists=50): probes=1 → recall {sum(p1['recall']) / 2:.2f}, 질의당 버퍼 {num(p1['buffers_per_query'][1])}", 2800, 15, INK)

    c = s.chapter("3. probes 를 늘리면", "가까운 목록 여러 개를 읽는다 - probes = lists 면 전체 스캔", 8000)
    for i in range(5):
        col = BIGM if i in (1, 2) else DIM
        c.box(40 + i * 176, 116, 160, 100, col, f"목록 {i + 1}", 300, 17, ON_FILL if i in (1, 2) else MUTED)
    c.text(40, 270, f"probes=10 → recall {sum(p10['recall']) / 2:.2f}, 버퍼 {num(p10['buffers_per_query'][1])}", 1400, 16, INK)
    c.text(40, 306, f"probes=50(전체) → recall {sum(p50['recall']) / 2:.2f}, 버퍼 {num(p50['buffers_per_query'][1])}", 2600, 16, INK)
    c.text(40, 352, "다 읽으면 정확해지지만, 그건 인덱스 없이 다 읽는 것과 거의 같다.", 3800, 15, WARN)

    c = s.chapter("4. 빈 테이블에 먼저 만들면", "학습할 데이터가 없어 중심이 엉터리로 정해진다", 8000)
    c.box(40, 112, 860, 46, PANEL, "NOTICE: ivfflat index created with little data", 300, 17, WARN, DIM)
    c.text(40, 206, "pgvector 가 직접 경고한다: 'This will cause low recall.'", 1400, 15, INK)
    c.text(40, 252, "5,000행·8차원·lists=10·probes=1, 질의 100개의 recall@10", 2400, 15, MUTED)
    c.box(40, 270, 400, 50, WARN, f"빈 테이블에 먼저 · {early}", 2800, 17, ON_FILL)
    c.box(480, 270, 420, 50, OK, f"데이터 먼저 · {proper}", 3400, 17, ON_FILL)
    c.text(40, 376, "방향은 경고대로 낮았지만, 이 작은 데이터에서 차이는 크지 않았다.", 4600, 15, MUTED)
    c.text(40, 410, "인덱스 크기는 두 경우가 같다 - 크기로는 이 문제가 안 보인다.", 5600, 15, INK)
    return s.build()


# ---------------------------------------------------------------------------
# 4) 필터가 섞인 검색: HNSW 기본값 · iterative_scan · DiskANN 라벨 인덱스 (실험 07)
# ---------------------------------------------------------------------------
def doc_filtered_search(k, ex, demo):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM, TSV = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM", "TSV"))
    f = ex["filter"]
    cor, dup = f["datasets"]["correct"], f["datasets"]["duplicate_bug"]
    off = cfg(cor["configs"], "hnsw_iterative_off")
    rel = cfg(cor["configs"], "hnsw_iterative_relaxed_order")
    dk = cfg(cor["configs"], "diskann_label_filter")
    removed_off = removed_by_filter(demo["filter_hnsw_off_plan"]["output"])
    removed_rel = removed_by_filter(demo["filter_hnsw_relaxed_plan"]["output"])

    s = Story(k, "pgv-filtered-search", "필터가 섞인 검색: WHERE 로 거르기 vs 인덱스 안에서 거르기",
              f"실험 07: 라벨 10개 × 5,000행. 질의는 라벨 1 근처, 필터는 라벨 10. 질의당 버퍼·시간은 질의 {f['n_queries']}개 평균.",
              940, 520)

    c = s.chapter("1. 질의와 필터가 엇갈린다", "가장 가까운 점들은 라벨 1 인데, 원하는 건 라벨 10 안에서의 top-10", 7000)
    c.box(40, 112, 200, 90, BIGM, "라벨 1 군집", 300, 17, ON_FILL)
    c.box(270, 112, 110, 90, PANEL, "q", 900, 22, INK, DIM)
    c.box(700, 112, 200, 90, TSV, "라벨 10 군집", 1500, 17, ON_FILL)
    c.text(40, 256, "WHERE labels && ARRAY[10] ORDER BY embedding <-> q LIMIT 10", 2200, 16, INK)
    c.text(40, 292, "인덱스가 '가까운 순서'로 후보를 내주면, 앞쪽은 전부 라벨 1 이라 필터에 걸린다.", 3400, 15, MUTED)

    c = s.chapter("2. HNSW 기본값", "iterative_scan = off: ef_search(40) 개 후보만 보고 끝난다", 7500)
    for i in range(8):
        c.box(40 + i * 110, 112, 100, 40, DIM, "라벨 1", 300 + i * 120, 15, MUTED)
    c.text(40, 200, f"후보 {removed_off}개 전부 필터에서 탈락 (Rows Removed by Filter: {removed_off})", 1600, 15, WARN)
    c.box(40, 226, 300, 50, TRGM, f"결과 {num(off['avg_rows_returned'])}행", 2600, 20, ON_FILL)
    c.text(40, 330, "오류가 아니라 빈 결과다 - 조용히 틀린다. AWS 프로덕션 가이드가 경고하는 그대로.", 3600, 15, INK)

    c = s.chapter("3. iterative_scan = relaxed_order", "버린 후보에서 다시 이어 찾는다 - 라벨 10 에 닿을 때까지", 8500)
    for i in range(8):
        c.box(40 + i * 110, 112, 100, 40, DIM, "라벨 1", 200, 15, MUTED)
    c.text(40, 196, f"… 필터 탈락 {removed_rel:,}개를 지나서 …", 1200, 15, MUTED)
    for i in range(4):
        c.box(40 + i * 110, 222, 100, 40, TSV, "라벨 10", 2200 + i * 200, 15, ON_FILL)
    c.box(40, 300, 860, 50, OK, f"10행 · 질의당 {num(rel['buffers_per_query'])} 버퍼 · {rel['ms_per_query']:.1f} ms", 3400, 18, ON_FILL)
    c.text(40, 406, "결과는 채워진다. 대신 그래프를 넓게 훑느라 비싸다.", 4600, 15, INK)

    c = s.chapter("4. DiskANN 라벨 인덱스", "라벨이 인덱스 키에 들어 있다 - Index Cond 로 라벨 10 안에서 바로 찾는다", 8500)
    c.box(40, 112, 860, 46, PANEL, "CREATE INDEX ... USING diskann (embedding vector_l2_ops, labels)", 200, 16, INK, DIM)
    c.box(40, 196, 860, 50, OK, f"10행 · 질의당 {num(dk['buffers_per_query'])} 버퍼 · {dk['ms_per_query']:.1f} ms", 1200, 18, ON_FILL)
    c.text(40, 300, f"결과의 평균 거리 - 정답 {cor['avg_distance_exact']:.2f} · HNSW {rel['avg_distance_returned']:.2f} · DiskANN {dk['avg_distance_returned']:.2f}", 2600, 15, INK)
    c.text(40, 336, "DiskANN 은 약 9배 싸지만 결과가 정답에서 조금 더 멀다 - 공짜가 아니다.", 3800, 15, WARN)
    c.text(40, 372, f"대가는 빌드: HNSW {cor['hnsw_build_ms'] / 1000:.1f}초 · DiskANN {cor['diskann_build_ms'] / 1000:.1f}초", 5000, 15, MUTED)

    c = s.chapter("5. 첫 판의 실수", "같은 벡터가 5,000개씩 - 서로 다른 벡터는 10개뿐이었다", 8500)
    for i in range(6):
        c.box(40 + i * 146, 112, 136, 40, DIM, "같은 벡터", 200, 15, MUTED)
    c.text(40, 198, f"{dup['rows']:,}행 중 서로 다른 벡터 {dup['distinct_vectors']}개 (생성 SQL 의 InitPlan 버그)", 1000, 15, WARN)
    c.text(40, 234, f"HNSW 그래프가 끊어져 필터 없이도 {dup['hnsw_reachable_rows']}행에만 닿았다", 2200, 15, INK)
    c.text(40, 270, "그래서 어떤 iterative_scan 으로도 0행 - 첫 판은 이걸 HNSW 의 한계로 읽었다.", 3400, 15, INK)
    c.box(40, 306, 860, 50, OK, f"서로 다른 벡터 {cor['distinct_vectors']:,}개로 다시 재니 HNSW 도 {cor['hnsw_reachable_rows']:,}행 전부에 닿았다", 4800, 17, ON_FILL)
    return s.build()


def docs(kit):
    """build.py 가 호출한다. 이름 → 문서 dict."""
    ex = load(EXP, "python3 scripts/sync-pgvector-results.py")
    demo = load(DEMO, "python3 scripts/capture-pgvector-demo.py")
    return {
        "pgv-exact-vs-ann": doc_exact_vs_ann(kit, ex),
        "pgv-hnsw-search": doc_hnsw_search(kit, ex),
        "pgv-ivfflat-probes": doc_ivfflat_probes(kit, ex, demo),
        "pgv-filtered-search": doc_filtered_search(kit, ex, demo),
    }
