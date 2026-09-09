"""FastAPI — 브라우저에서 조건을 바꿔가며 실험을 돌리는 서버.

흐름:
  POST /api/runs      작업을 큐에 넣고 id 를 바로 돌려준다 (여기서 기다리지 않는다)
  GET  /api/runs/{id} 상태를 물어본다 — pending / running / done / failed / canceled
  GET  /api/runs      최근 목록
  POST /api/runs/{id}/cancel   아직 시작 안 한 것만 취소

워커는 하나만 돈다. 둘 이상이면 같은 PostgreSQL 에서 인덱스를 동시에 만들다
CPU 경합으로 시간 지표가 오염된다 — 이 카탈로그가 여러 번 당한 함정이다.
"""
from __future__ import annotations
import asyncio, os, traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

import bench, corpus, store

VERSIONS = [v.strip() for v in os.environ.get("PG_VERSIONS", "16,17,18").split(",") if v.strip()]
HERE = os.path.dirname(os.path.abspath(__file__))


class RunRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=40)
    rows: int = 100_000
    inject_mod: int = 1000
    versions: list[str] = Field(default_factory=lambda: VERSIONS[:1])
    engines: list[str] = Field(default_factory=lambda: ["none", "bigm", "trgm"])
    patterns: list[str] = Field(default_factory=lambda: ["infix", "prefix", "suffix"])

    @field_validator("rows")
    @classmethod
    def _rows(cls, v):
        if v not in (10_000, 100_000, 500_000, 1_000_000):
            raise ValueError("rows 는 10000 / 100000 / 500000 / 1000000 중 하나여야 합니다")
        return v

    @field_validator("versions")
    @classmethod
    def _versions(cls, v):
        bad = [x for x in v if x not in VERSIONS]
        if bad:
            raise ValueError(f"쓸 수 없는 버전: {bad} (가능: {VERSIONS})")
        if not v:
            raise ValueError("버전을 하나 이상 고르세요")
        return v

    @field_validator("engines")
    @classmethod
    def _engines(cls, v):
        bad = [x for x in v if x not in bench.ENGINES]
        if bad:
            raise ValueError(f"쓸 수 없는 엔진: {bad}")
        if not v:
            raise ValueError("엔진을 하나 이상 고르세요")
        return v

    @field_validator("patterns")
    @classmethod
    def _patterns(cls, v):
        bad = [x for x in v if x not in bench.PATTERNS]
        if bad:
            raise ValueError(f"쓸 수 없는 패턴: {bad}")
        if not v:
            raise ValueError("패턴을 하나 이상 고르세요")
        return v


async def worker():
    """pending 을 하나씩 꺼내 돌린다. 블로킹 코드라 스레드로 넘긴다."""
    while True:
        job = await asyncio.to_thread(store.take_next)
        if job is None:
            await asyncio.sleep(1.0)
            continue
        rid = job["id"]
        try:
            def go():
                return bench.run(job["params"] if isinstance(job["params"], dict)
                                 else __import__("json").loads(job["params"]),
                                 on_progress=lambda t: store.progress(rid, t))
            result = await asyncio.to_thread(go)
            await asyncio.to_thread(store.finish, rid, result, None)
        except Exception:
            await asyncio.to_thread(store.finish, rid, None, traceback.format_exc())


@asynccontextmanager
async def lifespan(app: FastAPI):
    requeued = store.init()
    if requeued:
        print(f"[lab] 재시작 전 돌던 작업 {requeued}건을 다시 큐에 넣었습니다")
    task = asyncio.create_task(worker())
    yield
    task.cancel()


app = FastAPI(title="pg-study 실험 서버", lifespan=lifespan)


@app.get("/api/meta")
def meta():
    return {
        "versions": VERSIONS,
        "engines": [
            {"key": "none", "label": "인덱스 없음", "note": "시퀀셜 스캔 강제 — 기준선"},
            {"key": "bigm", "label": "pg_bigm",   "note": "2-gram GIN"},
            {"key": "trgm", "label": "pg_trgm",   "note": "3-gram GIN"},
        ],
        "patterns": [
            {"key": "infix",  "label": "%검색어%", "note": "부분 일치 — 이 카탈로그의 주제"},
            {"key": "prefix", "label": "검색어%",  "note": "접두어 — 앞이 고정"},
            {"key": "suffix", "label": "%검색어",  "note": "접미어 — 뒤가 고정"},
        ],
        "row_choices": [10_000, 100_000, 500_000, 1_000_000],
        "corpus": corpus.source(),
        "note": "PostgreSQL 19beta1 은 pg_bigm 1.2 가 빌드되지 않아 제외했습니다.",
    }


@app.post("/api/runs")
def create_run(req: RunRequest):
    rid = store.create(req.model_dump())
    return {"id": rid, "status": "pending"}


@app.get("/api/runs")
def list_runs(limit: int = 30):
    return {"runs": store.recent(limit)}


@app.get("/api/runs/{run_id}")
def get_run(run_id: int):
    r = store.get(run_id)
    if not r:
        raise HTTPException(404, "그런 작업이 없습니다")
    return r


@app.post("/api/runs/{run_id}/cancel")
def cancel_run(run_id: int):
    if not store.get(run_id):
        raise HTTPException(404, "그런 작업이 없습니다")
    ok = store.cancel(run_id)
    return {"canceled": ok,
            "reason": None if ok else "이미 시작했거나 끝난 작업은 취소할 수 없습니다"}


app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))
