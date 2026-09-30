"""실험 실행기 — 카탈로그의 bench.sh 들과 같은 설계·같은 지표를 쓴다.

측정 원칙 (bigm-vs-trgm/experiments/README.md 와 동일):
  1. 벽시계 시간 대신 결정적 지표를 먼저 본다
     - 인덱스 스캔이 돌려준 행 / Rows Removed by Index Recheck / Buffers
     - 같은 데이터·같은 쿼리면 실행마다 거의 변하지 않는다. 시간은 보조 지표다.
  2. 난수 대신 id 나머지로 주입한다 — 실행마다 같은 비율, 같은 물리적 배치
  3. 선택도를 통제 변수로 명시한다 — 실제 매치 비율을 먼저 재서 기록한다
  4. 정답 행 수를 미리 알고 설계한다

세 패턴이 같은 행에 걸리게 하는 설계:
  주입 행 = "<검색어> <말뭉치 문장> <검색어>"
    %X%  앞쪽 검색어에 걸린다
    X%   문서가 검색어로 시작한다
    %X   문서가 검색어로 끝난다
  나머지 행은 뒤에 ' #<id>' 가 붙으므로 접미어 패턴에 절대 안 걸린다(오염 차단).

테이블·인덱스 캐시:
  같은 (버전, 행수) 조합은 테이블을 다시 만들지 않고, 같은 (버전, 행수, 엔진)은
  인덱스도 다시 만들지 않는다. 100만 행 인덱스 빌드가 30초라 이게 없으면
  두 번째 실험부터 쓸모없이 느려진다.
"""
from __future__ import annotations
import os, re, time
import psycopg

import corpus

PG_USER, PG_DB, PG_PASS = "postgres", "lab", "postgres"
PATTERNS = {"infix": "%{kw}%", "prefix": "{kw}%", "suffix": "%{kw}"}
PATTERN_LABEL = {"infix": "%검색어%", "prefix": "검색어%", "suffix": "%검색어"}
ENGINES = ("none", "bigm", "trgm")


def dsn(version: str) -> str:
    return f"host=pg{version} port=5432 dbname={PG_DB} user={PG_USER} password={PG_PASS}"


def _table(rows: int, kw: str) -> str:
    """검색어마다 주입 위치가 다르므로 테이블 이름에 검색어 해시를 넣는다."""
    import hashlib
    h = hashlib.sha1(kw.encode()).hexdigest()[:8]
    return f"docs_{rows}_{h}"


# ---------------------------------------------------------------------------
def _ensure_corpus_table(cur):
    cur.execute("SELECT to_regclass('corpus_raw')")
    if cur.fetchone()[0] is not None:
        cur.execute("SELECT count(*) FROM corpus_raw")
        if cur.fetchone()[0] > 0:
            return
    path, _ = corpus.ensure()
    cur.execute("DROP TABLE IF EXISTS corpus_raw")
    cur.execute("CREATE TABLE corpus_raw (id serial PRIMARY KEY, doc text NOT NULL)")
    # COPY ... FROM STDIN 으로 API 쪽 파일을 그대로 밀어넣는다.
    # (공유 볼륨을 쓰면 컨테이너 권한 문제가 생겨서 이 방식을 골랐다)
    with open(path, encoding="utf-8") as f, \
         cur.copy("COPY corpus_raw (doc) FROM STDIN") as cp:
        for line in f:
            line = line.rstrip("\n")
            if line:
                cp.write_row((line,))


def _ensure_table(cur, rows: int, kw: str, inject_mod: int) -> tuple[str, int, int]:
    tbl = _table(rows, kw)
    # 인덱스와 같은 이유로 테이블도 잠그고 만든다 (재시작 직후 경합)
    cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (tbl,))
    try:
        return _ensure_table_locked(cur, tbl, rows, kw, inject_mod)
    finally:
        cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (tbl,))


def _ensure_table_locked(cur, tbl: str, rows: int, kw: str, inject_mod: int):
    cur.execute("SELECT to_regclass(%s)", (tbl,))
    if cur.fetchone()[0] is None:
        _ensure_corpus_table(cur)
        cur.execute(f"CREATE TABLE {tbl} (id int PRIMARY KEY, doc text NOT NULL)")
        cur.execute(f"""
            INSERT INTO {tbl} (id, doc)
            SELECT g,
                   CASE WHEN g %% %s = 0
                        THEN %s || ' ' || c.doc || ' ' || %s
                        ELSE c.doc || ' #' || g
                   END
            FROM generate_series(1, %s) g
            JOIN corpus_raw c ON c.id = 1 + (g - 1) %% (SELECT count(*) FROM corpus_raw)
            ORDER BY g
        """, (inject_mod, kw, kw, rows))
        cur.execute(f"VACUUM ANALYZE {tbl}")
    cur.execute(f"SELECT count(*) FROM {tbl}")
    total = cur.fetchone()[0]
    return tbl, total, rows // inject_mod


def _ensure_index(cur, tbl: str, engine: str) -> float:
    """엔진에 맞는 인덱스를 보장한다. 이미 있으면 만들지 않고 0.0 을 돌려준다.

    두 가지 사고를 견뎌야 한다 — 둘 다 실제로 겪었다.

    (1) API 가 재시작되면 끊긴 백엔드의 CREATE INDEX 가 **서버에서는 계속 돈다.**
        재큐된 작업이 to_regclass 로 확인할 때는 아직 커밋 전이라 NULL 이 나오고,
        CREATE INDEX 를 또 쏘면 먼저 끝난 쪽과 부딪혀 UniqueViolation 이 난다.
        -> 이름 잠금(advisory lock)으로 줄을 세우고, IF NOT EXISTS 로 만든다.

    (2) 인덱스 생성이 중간에 끊기면 **invalid 인덱스**가 남을 수 있다.
        이건 있으나 마나여서 플래너가 안 쓰는데 to_regclass 에는 잡힌다.
        -> indisvalid 를 직접 확인하고, invalid 면 지우고 다시 만든다.
    """
    if engine == "none":
        return 0.0
    name = f"{tbl}_{engine}"

    # 같은 인덱스를 두 세션이 동시에 만들지 못하게 이름으로 잠근다.
    # (버려진 백엔드가 아직 돌고 있으면 여기서 기다린다)
    cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (name,))
    try:
        cur.execute(
            "SELECT c.oid, i.indisvalid FROM pg_class c"
            "  LEFT JOIN pg_index i ON i.indexrelid = c.oid"
            " WHERE c.relname = %s", (name,))
        row = cur.fetchone()
        if row is not None:
            if row[1]:                       # 유효한 인덱스가 이미 있다
                return 0.0
            cur.execute(f"DROP INDEX IF EXISTS {name}")   # invalid -> 다시 만든다

        opclass = "gin_bigm_ops" if engine == "bigm" else "gin_trgm_ops"
        t0 = time.time()
        cur.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {tbl} USING gin (doc {opclass})")
        secs = time.time() - t0
        cur.execute(f"VACUUM ANALYZE {tbl}")
        return round(secs, 2)
    finally:
        cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (name,))


# ---------------------------------------------------------------------------
_ROWS_RE   = re.compile(r"rows=([0-9.]+) loops=")
_BUF_RE    = re.compile(r"shared hit=(\d+)(?: read=(\d+))?")
_RECHECK_RE = re.compile(r"Rows Removed by Index Recheck: (\d+)")
_TIME_RE   = re.compile(r"Execution Time: ([0-9.]+)")


def _explain(cur, tbl: str, pattern: str, engine: str) -> dict:
    """지정한 엔진의 인덱스만 보이는 상태에서 잰다.

    함정: 같은 테이블에 bigm 과 trgm 인덱스가 둘 다 있으면 **플래너가 하나를 골라버린다.**
    실제로 처음에 이걸 놓쳐서 'trgm 의 2글자 %X%' 가 bigm 인덱스를 타고 정상으로
    나왔다 — 무너져야 맞는 칸인데. 카탈로그의 bench.sh 들이 "인덱스는 한 번에 하나만
    존재하게 한다"고 적어둔 이유가 이것이다.

    그렇다고 매번 인덱스를 지웠다 만들면 캐시가 무의미해진다(100만 행에서 30초).
    그래서 **트랜잭션 안에서 상대 인덱스를 DROP 하고 재고 ROLLBACK** 한다.
    롤백하면 인덱스가 되살아나므로 캐시는 그대로 남는다.
    """
    # 인덱스가 있는데도 플래너가 Seq Scan 을 고를 수 있다. 이 실험의 질문은
    # "플래너가 무엇을 고르나"가 아니라 "그 인덱스가 후보를 얼마나 좁히나"이므로
    # 경로를 강제한다. (플래너 선택 자체는 pg_bigm/experiments/00 에서 따로 본다)
    # psycopg3 는 '여러 문장 + 파라미터' 를 한 번에 못 보낸다.
    # (SET ...; EXPLAIN ... %s 를 붙여 보내면 거절당한다) 그래서 나눠 보낸다.
    if engine == "none":
        cur.execute("SET enable_indexscan=off")
        cur.execute("SET enable_bitmapscan=off")
        cur.execute("SET enable_seqscan=on")
    else:
        cur.execute("SET enable_seqscan=off")
        cur.execute("SET enable_indexscan=on")
        cur.execute("SET enable_bitmapscan=on")
    cur.execute(f"EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)"
                f" SELECT count(*) FROM {tbl} WHERE doc LIKE %s", (pattern,))
    plan = "\n".join(r[0] for r in cur.fetchall())

    idx_rows = idx_bufs = None
    for i, line in enumerate(plan.split("\n")):
        if "Bitmap Index Scan" in line:
            m = _ROWS_RE.search(line)
            # PG18 부터 actual rows 가 소수로 나온다 (rows=500.00). 정수로 못 박으면
            # 그 버전만 전부 빈칸이 된다 — 실제로 한 번 당했다.
            if m:
                idx_rows = int(float(m.group(1)))
            for nxt in plan.split("\n")[i + 1:i + 4]:
                b = _BUF_RE.search(nxt)
                if b:
                    idx_bufs = int(b.group(1)) + int(b.group(2) or 0)
                    break
            break

    rc = _RECHECK_RE.search(plan)
    ms = _TIME_RE.search(plan)
    return {
        "idx_rows": idx_rows,
        "recheck": int(rc.group(1)) if rc else 0,
        "buffers": idx_bufs,
        "ms": float(ms.group(1)) if ms else None,
        "plan_kind": "Seq Scan" if "Seq Scan" in plan else
                     ("Bitmap Heap Scan" if "Bitmap Heap Scan" in plan else "기타"),
        "plan": plan,
    }


def _measure(conn, cur, tbl: str, pattern: str, engine: str, all_engines) -> dict:
    """상대 인덱스를 트랜잭션 안에서만 치우고 재고, 롤백해서 되살린다."""
    others = [e for e in ("bigm", "trgm") if e != engine]
    # 'none' 이면 둘 다 치운다 — 인덱스가 아예 없는 상태를 재는 것이므로.
    if engine == "none":
        others = ["bigm", "trgm"]

    conn.autocommit = False
    try:
        for e in others:
            cur.execute(f"DROP INDEX IF EXISTS {tbl}_{e}")
        m = _explain(cur, tbl, pattern, engine)
    finally:
        conn.rollback()          # DROP 이 되돌아가 인덱스가 되살아난다
        conn.autocommit = True

    # 의도한 인덱스를 정말 썼는지 확인한다. 가정하지 말고 플랜에서 읽는다.
    used = re.search(r"Index Scan on (\S+)", m["plan"])
    m["index_used"] = used.group(1) if used else None
    m["index_ok"] = (engine == "none" and m["index_used"] is None) or \
                    (engine != "none" and m["index_used"] == f"{tbl}_{engine}")
    return m


# ---------------------------------------------------------------------------
def run(params: dict, on_progress=None) -> list[dict]:
    kw          = params["keyword"]
    rows        = int(params["rows"])
    inject_mod  = int(params.get("inject_mod", 1000))
    versions    = params["versions"]
    engines     = params["engines"]
    patterns    = params["patterns"]

    corpus.ensure()
    results, done, total_steps = [], 0, len(versions) * len(engines) * len(patterns)

    for v in versions:
        with psycopg.connect(dsn(v), autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS pg_bigm")
                cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
                cur.execute("SHOW server_version")
                server = cur.fetchone()[0]

                if on_progress:
                    on_progress(f"{done}/{total_steps} · PG{v} 데이터 준비")
                tbl, total, injected = _ensure_table(cur, rows, kw, inject_mod)

                for eng in engines:
                    build_sec = _ensure_index(cur, tbl, eng)
                    for pat in patterns:
                        like = PATTERNS[pat].format(kw=kw)
                        cur.execute(f"SELECT count(*) FROM {tbl} WHERE doc LIKE %s", (like,))
                        answer = cur.fetchone()[0]
                        m = _measure(conn, cur, tbl, like, eng, engines)
                        done += 1
                        if on_progress:
                            on_progress(f"{done}/{total_steps} · PG{v} {eng} {PATTERN_LABEL[pat]}")
                        results.append({
                            "version": v, "server": server, "engine": eng, "pattern": pat,
                            "pattern_label": PATTERN_LABEL[pat], "like": like,
                            "rows": total, "answer": answer,
                            "selectivity": round(100.0 * answer / total, 4) if total else 0,
                            "build_sec": build_sec or None,
                            **{k: m[k] for k in ("idx_rows", "recheck", "buffers", "ms",
                                                 "plan_kind", "index_used", "index_ok")},
                            "plan": m["plan"],
                        })
    return results
