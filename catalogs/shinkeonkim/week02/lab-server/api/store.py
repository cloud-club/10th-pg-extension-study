"""작업 큐 — SQLite 한 파일.

왜 큐가 필요한가:
  실험 하나가 인덱스를 새로 만들면 100만 행에서 30초쯤 걸린다. HTTP 요청 안에서
  그걸 끝내려 하면 타임아웃이 나고, 브라우저를 닫으면 결과도 잃는다.
  그래서 요청은 '작업을 등록'만 하고 바로 id 를 돌려주고, 워커가 뒤에서 돌린다.

왜 메모리가 아니라 파일인가:
  API 가 재시작돼도 큐가 남아야 한다. 컨테이너가 죽는 순간 running 이던 작업은
  결과가 없으므로, 기동할 때 그것들을 pending 으로 되돌려 다시 돌린다(requeue).
  SQLite 를 쓴 것은 이 규모에 그게 가장 단순해서다 — 별도 서비스가 필요 없다.
"""
from __future__ import annotations
import json, os, sqlite3, time, threading

_LOCK = threading.Lock()          # SQLite 쓰기는 직렬화한다 (워커 1 + API 요청들)
DB_PATH = os.path.join(os.environ.get("DATA_DIR", "/data"), "lab.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  status      TEXT NOT NULL,           -- pending / running / done / failed / canceled
  params      TEXT NOT NULL,           -- 요청 그대로 (JSON)
  progress    TEXT,                    -- "3/9 · pg17 trgm" 같은 사람이 읽는 진행 표시
  result      TEXT,                    -- 결과 행 배열 (JSON)
  error       TEXT,
  created_at  REAL NOT NULL,
  started_at  REAL,
  finished_at REAL
);
CREATE INDEX IF NOT EXISTS runs_status ON runs(status, id);
"""


def _conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _LOCK, _conn() as c:
        c.executescript(SCHEMA)
        # 죽기 전에 running 이던 것은 결과가 없다 -> 다시 큐에 넣는다
        n = c.execute(
            "UPDATE runs SET status='pending', started_at=NULL,"
            " progress='재시작 후 다시 큐에 넣음' WHERE status='running'"
        ).rowcount
    return n


def create(params: dict) -> int:
    with _LOCK, _conn() as c:
        cur = c.execute(
            "INSERT INTO runs (status, params, created_at) VALUES ('pending', ?, ?)",
            (json.dumps(params, ensure_ascii=False), time.time()),
        )
        return cur.lastrowid


def take_next() -> dict | None:
    """가장 오래된 pending 하나를 running 으로 바꾸고 돌려준다."""
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT * FROM runs WHERE status='pending' ORDER BY id LIMIT 1"
        ).fetchone()
        if not row:
            return None
        c.execute("UPDATE runs SET status='running', started_at=? WHERE id=?",
                  (time.time(), row["id"]))
        return dict(row)


def progress(run_id: int, text: str):
    with _LOCK, _conn() as c:
        c.execute("UPDATE runs SET progress=? WHERE id=?", (text, run_id))


def finish(run_id: int, result: list | None = None, error: str | None = None):
    with _LOCK, _conn() as c:
        c.execute(
            "UPDATE runs SET status=?, result=?, error=?, finished_at=?, progress=NULL"
            " WHERE id=?",
            ("failed" if error else "done",
             json.dumps(result, ensure_ascii=False) if result is not None else None,
             error, time.time(), run_id),
        )


def cancel(run_id: int) -> bool:
    """아직 시작 안 한 것만 취소한다. 돌고 있는 것은 중간에 끊지 않는다 —
    인덱스를 만드는 중에 끊으면 DB 에 찌꺼기가 남는다."""
    with _LOCK, _conn() as c:
        return c.execute(
            "UPDATE runs SET status='canceled', finished_at=? WHERE id=? AND status='pending'",
            (time.time(), run_id),
        ).rowcount > 0


def _hydrate(row) -> dict:
    d = dict(row)
    d["params"] = json.loads(d["params"])
    d["result"] = json.loads(d["result"]) if d["result"] else None
    for k in ("created_at", "started_at", "finished_at"):
        d[k] = round(d[k], 3) if d[k] else None
    if d["started_at"]:
        end = d["finished_at"] or time.time()
        d["elapsed"] = round(end - d["started_at"], 1)
    return d


def get(run_id: int) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        return _hydrate(row) if row else None


def recent(limit: int = 30) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, status, params, progress, error, created_at, started_at, finished_at"
            "  FROM runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["params"] = json.loads(d["params"])
        d["result"] = None
        for k in ("created_at", "started_at", "finished_at"):
            d[k] = round(d[k], 3) if d[k] else None
        if d["started_at"]:
            end = d["finished_at"] or time.time()
            d["elapsed"] = round(end - d["started_at"], 1)
        out.append(d)
    return out
