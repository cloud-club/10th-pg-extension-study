"""
Lab 05 - pg_stat_statements 를 실제 백엔드(FastAPI)에서 쓰는 예시.

/users/{id}/orders     일부러 N+1 으로 짠 엔드포인트 (버그)
/orders/search         인덱스 없는 컬럼에 LIKE 를 거는 엔드포인트 (버그)
/admin/*               pg_stat_statements 를 그대로 얹은 "우리 서비스의 perf 대시보드"

버그 엔드포인트를 몇 번 호출한 뒤 /admin/top-queries 와 /admin/n-plus-one-suspects 를
호출해보면, docs/04-production-playbook.md 에 적어둔 "calls 급증 = N+1 의심" 같은
휴리스틱이 실제 API 트래픽에서도 그대로 통한다는 걸 확인할 수 있다.
"""
import os

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, Query

app = FastAPI(title="pg_stat_statements lab - order service")

DSN = os.environ.get(
    "DATABASE_URL",
    "host=postgres port=5432 dbname=study user=postgres password=postgres",
)


def get_conn():
    return psycopg.connect(DSN, row_factory=dict_row, autocommit=True)


@app.get("/users/{user_id}/orders")
def get_user_orders(user_id: int):
    """일부러 N+1 으로 짠 엔드포인트.

    "유저 하나, 주문 여러 개"를 한 번에 안 가져오고, id 목록을 먼저 뽑은 뒤
    주문마다 별도 쿼리를 던진다 - 흔히 ORM 을 무심코 쓸 때 생기는 패턴이다.
    """
    with get_conn() as conn:
        order_ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM orders WHERE user_id = %s", (user_id,)
            ).fetchall()
        ]
        orders = []
        for oid in order_ids:
            row = conn.execute(
                "SELECT * FROM orders WHERE id = %s", (oid,)
            ).fetchone()
            orders.append(row)
    return {"user_id": user_id, "count": len(orders), "orders": orders}


@app.get("/orders/search")
def search_orders(item: str = Query(..., min_length=1)):
    """인덱스 없는 item 컬럼을 LIKE 로 훑는 엔드포인트 - 일부러 비효율적이다."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM orders WHERE item LIKE '%%' || %s || '%%' LIMIT 50",
            (item,),
        ).fetchall()
    return {"item": item, "count": len(rows), "orders": rows}


@app.post("/admin/reset-stats")
def reset_stats():
    with get_conn() as conn:
        conn.execute("SELECT pg_stat_statements_reset()")
    return {"status": "reset"}


@app.get("/admin/top-queries")
def top_queries(limit: int = Query(5, ge=1, le=100)):
    """docs/04-production-playbook.md 의 '총 시간 기준 정렬' 을 그대로 API 로 노출."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT left(query, 80) AS query, calls,
                   round(total_exec_time::numeric, 2) AS total_ms,
                   round(mean_exec_time::numeric, 3)  AS mean_ms
            FROM   pg_stat_statements
            ORDER  BY total_exec_time DESC
            LIMIT  %s
            """,
            (limit,),
        ).fetchall()
    return {"top_queries": rows}


@app.get("/admin/n-plus-one-suspects")
def n_plus_one_suspects():
    """'calls 가 비정상적으로 많다' 는 휴리스틱만으로 N+1 을 의심해본다."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT left(query, 80) AS query, calls,
                   round(mean_exec_time::numeric, 3) AS mean_ms
            FROM   pg_stat_statements
            WHERE  calls > 20
            ORDER  BY calls DESC
            """
        ).fetchall()
    return {"suspects": rows}
