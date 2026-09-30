"""
pg_bigm 을 실제 백엔드에서 쓰는 예제.

포인트는 딱 하나다 - 애플리케이션 코드는 그냥 LIKE 를 쓴다. pg_bigm 이 하는 일은
"그 LIKE 가 인덱스를 타게 만드는 것"뿐이라, 이 main.py 안 어디에도 pg_bigm 전용
쿼리 문법 같은 건 없다. 유일하게 pg_bigm 이 준 도구를 직접 쓰는 부분은
likequery()(안전한 이스케이프)와 =%/bigm_similarity()(유사도 검색) 뿐이다.
"""
import os
from contextlib import contextmanager

import psycopg
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="pg_bigm search demo")

DB_DSN = (
    f"host={os.environ.get('POSTGRES_HOST', 'postgres')} "
    f"port={os.environ.get('POSTGRES_PORT', '5432')} "
    f"dbname={os.environ.get('POSTGRES_DB', 'study')} "
    f"user={os.environ.get('POSTGRES_USER', 'postgres')} "
    f"password={os.environ.get('POSTGRES_PASSWORD', 'postgres')}"
)


@contextmanager
def get_cursor():
    # 데모 수준의 연결 관리 - 요청마다 새 연결을 연다. 실제 서비스라면
    # psycopg_pool.ConnectionPool 같은 커넥션 풀을 쓰는 게 정석이다.
    with psycopg.connect(DB_DSN) as conn:
        with conn.cursor() as cur:
            yield cur


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/articles/search")
def search_articles(q: str = Query(..., min_length=1, description="검색어 (짧은 한글 키워드도 가능)")):
    """
    LIKE + likequery() 기반 부분 문자열 검색.

    likequery(q) 가 q 안의 %, _, \\ 를 이스케이프하고 앞뒤에 %를 붙여준다 -
    애플리케이션이 f"%{q}%" 로 직접 문자열을 조립하면 사용자가 %나 _를 넣었을 때
    의도치 않은 패턴이 될 수 있는데, 그 문제를 pg_bigm 이 대신 해결해준다.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, left(body, 80) AS snippet
            FROM articles
            WHERE body LIKE likequery(%s)
            ORDER BY id
            LIMIT 20
            """,
            (q,),
        )
        rows = cur.fetchall()
    return {
        "query": q,
        "count": len(rows),
        "results": [{"id": r[0], "title": r[1], "snippet": r[2]} for r in rows],
    }


@app.get("/articles/similar")
def similar_articles(
    q: str = Query(..., min_length=1, description="제목과 비교할 검색어 (오탈자가 있어도 된다)"),
    threshold: float = Query(0.2, ge=0.0, le=1.0, description="pg_bigm.similarity_limit"),
):
    """
    =% 연산자 + bigm_similarity() 기반 유사도(오탈자 허용) 검색.

    pg_bigm.similarity_limit 은 GUC 라서 파라미터 바인딩(%s)이 아니라 SET 문 자체에
    값을 넣어야 한다 - threshold 를 float 로 검증했으므로 그대로 문자열 포매팅해도
    안전하다 (사용자 임의 문자열이 아니라 Query(..., ge=0.0, le=1.0) 로 이미 걸러졌다).
    """
    with get_cursor() as cur:
        cur.execute(f"SET pg_bigm.similarity_limit = {threshold}")
        # 연산자 =% 는 psycopg 의 %s 플레이스홀더 파서와 충돌하므로 %%로 이스케이프한다.
        cur.execute(
            """
            SELECT id, title, bigm_similarity(title, %s) AS score
            FROM articles
            WHERE title =%% %s
            ORDER BY score DESC
            LIMIT 10
            """,
            (q, q),
        )
        rows = cur.fetchall()
    return {
        "query": q,
        "threshold": threshold,
        "results": [{"id": r[0], "title": r[1], "score": round(r[2], 4)} for r in rows],
    }


@app.get("/articles/debug/bigm")
def debug_bigm(text: str = Query(..., min_length=1)):
    """text 가 2-gram 으로 어떻게 쪼개지는지 그대로 보여준다. 검색이 왜 안 맞는지
    프론트/백엔드 개발자가 디버깅할 때 쓰라고 만든 엔드포인트다."""
    with get_cursor() as cur:
        cur.execute("SELECT show_bigm(%s)", (text,))
        (bigrams,) = cur.fetchone()
    return {"text": text, "bigrams": bigrams}


@app.on_event("startup")
def check_db():
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
    except Exception as exc:  # pragma: no cover - 데모 스크립트의 기동 확인용
        raise HTTPException(status_code=500, detail=f"DB 연결 실패: {exc}")
