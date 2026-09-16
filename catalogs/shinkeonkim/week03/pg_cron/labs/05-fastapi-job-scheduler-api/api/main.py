"""
FastAPI 로 만든 pg_cron REST 래퍼 - "매번 SQL 을 직접 짜는 대신, 백엔드가
잡 스케줄러 API 하나를 갖고 있으면 어떤 모습일까"를 보여주는 최소 예제다.

실제 서비스라면 여기에 인증/인가, 사용자별 스코프, SQL 인젝션 방지를 위한
화이트리스트(임의의 SQL 을 그대로 cron.schedule 에 넘기는 건 위험하다 - 이
데모는 교육 목적으로 단순화했다) 등이 더 필요하다.
"""
import os

import psycopg
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

DB_DSN = (
    f"host={os.environ.get('DB_HOST', 'postgres')} "
    f"port={os.environ.get('DB_PORT', '5432')} "
    f"dbname={os.environ.get('DB_NAME', 'study')} "
    f"user={os.environ.get('DB_USER', 'postgres')} "
    f"password={os.environ.get('DB_PASSWORD', 'postgres')}"
)

app = FastAPI(title="pg_cron job scheduler API", version="1.0.0")


def get_conn():
    return psycopg.connect(DB_DSN, autocommit=True)


class JobCreate(BaseModel):
    name: str
    schedule: str
    sql: str


class JobPatch(BaseModel):
    active: bool


@app.get("/health")
def health():
    with get_conn() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.post("/jobs", status_code=201)
def create_job(job: JobCreate):
    if not job.name or not job.schedule or not job.sql:
        raise HTTPException(status_code=400, detail="name, schedule, sql 은 모두 필수다")
    try:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT cron.schedule(%s, %s, %s) AS jobid",
                (job.name, job.schedule, job.sql),
            ).fetchone()
        return {"jobid": row[0], "name": job.name, "schedule": job.schedule}
    except psycopg.Error as e:
        # pg_cron 자신이 스케줄 문법을 검증한다 - 그 에러를 그대로 클라이언트에 전달한다.
        # (예: schedule 문자열이 cron 문법도, "N seconds" 문법도 아니면 여기서 걸린다)
        raise HTTPException(status_code=400, detail=str(e).strip())


@app.get("/jobs")
def list_jobs():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT jobid, jobname, schedule, command, active "
            "FROM cron.job ORDER BY jobid"
        ).fetchall()
    return [
        {
            "jobid": r[0],
            "name": r[1],
            "schedule": r[2],
            "command": r[3],
            "active": r[4],
        }
        for r in rows
    ]


@app.get("/jobs/{name}/runs")
def job_runs(name: str, limit: int = Query(10, ge=1, le=100)):
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM cron.job WHERE jobname = %s AND username = current_user", (name,)
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail=f"job '{name}' not found")
        rows = conn.execute(
            """
            SELECT r.runid, r.status, r.return_message, r.start_time, r.end_time
            FROM   cron.job_run_details r
            JOIN   cron.job j ON j.jobid = r.jobid
            WHERE  j.jobname = %s AND j.username = current_user
            ORDER  BY r.runid DESC
            LIMIT  %s
            """,
            (name, limit),
        ).fetchall()
    return [
        {
            "runid": r[0],
            "status": r[1],
            "return_message": r[2],
            "start_time": r[3].isoformat() if r[3] else None,
            "end_time": r[4].isoformat() if r[4] else None,
        }
        for r in rows
    ]


@app.patch("/jobs/{name}")
def patch_job(name: str, patch: JobPatch):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT jobid FROM cron.job WHERE jobname = %s AND username = current_user", (name,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"job '{name}' not found")
        jobid = row[0]
        conn.execute(
            "SELECT cron.alter_job(%s, active := %s)", (jobid, patch.active)
        )
    return {"name": name, "active": patch.active}


@app.delete("/jobs/{name}", status_code=204)
def delete_job(name: str):
    with get_conn() as conn:
        job = conn.execute(
            "SELECT jobid FROM cron.job WHERE jobname = %s AND username = current_user", (name,)
        ).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail=f"job '{name}' not found")
        row = conn.execute("SELECT cron.unschedule(%s)", (job[0],)).fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail=f"job '{name}' not found")
    return None
