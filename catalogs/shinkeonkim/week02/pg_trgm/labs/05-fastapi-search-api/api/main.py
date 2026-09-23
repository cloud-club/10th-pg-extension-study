"""
pg_trgm 을 실제 백엔드에서 쓰는 예제.

pg_bigm 예제(../../../pg_bigm/labs/05-fastapi-search-api)와 나란히 읽으면
차이가 잘 보인다. pg_bigm 쪽은 "LIKE 를 그대로 쓰고 인덱스만 얹는다"가 전부였다면,
pg_trgm 은 애플리케이션이 신경 써야 할 것이 몇 가지 더 있다.

  1. 검색어가 3글자 미만이면 인덱스가 "전체 인덱스 스캔"으로 떨어진다.
     -> 짧은 검색어는 다른 경로(접두어 검색)로 보내야 한다. /search 가 그걸 한다.
  2. likequery() 같은 이스케이프 헬퍼가 없다. 직접 escape 해야 한다.
  3. 대신 pg_bigm 에 없는 것을 쓸 수 있다: 관련도 정렬(similarity),
     KNN 자동완성(<->), 정규식 검색.
"""
import os
import re
from contextlib import contextmanager

import psycopg
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="pg_trgm search demo")

DB_DSN = (
    f"host={os.environ.get('POSTGRES_HOST', 'postgres')} "
    f"port={os.environ.get('POSTGRES_PORT', '5432')} "
    f"dbname={os.environ.get('POSTGRES_DB', 'study')} "
    f"user={os.environ.get('POSTGRES_USER', 'postgres')} "
    f"password={os.environ.get('POSTGRES_PASSWORD', 'postgres')}"
)

# 트라이그램은 3글자다. 이보다 짧은 검색어로 '%q%' 를 만들면 조각이 하나도
# 안 나와서 GIN 이 인덱스 전체를 훑는다(GIN_SEARCH_MODE_ALL) - 인덱스가
# 없느니만 못한 상태다. labs/04-regex-and-tuning 에서 실측으로 확인한 내용.
MIN_SUBSTRING_LEN = 3


@contextmanager
def get_cursor():
    # 데모 수준의 연결 관리 - 요청마다 새 연결을 연다. 실제 서비스라면
    # psycopg_pool.ConnectionPool 같은 커넥션 풀을 쓰는 게 정석이다.
    with psycopg.connect(DB_DSN) as conn:
        with conn.cursor() as cur:
            yield cur


def like_escape(term: str) -> str:
    """
    pg_bigm 의 likequery() 에 해당하는 것이 pg_trgm 에는 없어서 직접 만든다.

    사용자가 '100%' 나 'a_b' 를 검색하면 %, _ 가 와일드카드로 해석돼버린다.
    ESCAPE '\\' 와 함께 써야 의미가 있다 (아래 쿼리들이 그렇게 쓴다).
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/articles/search")
def search_articles(q: str = Query(..., min_length=1, description="검색어")):
    """
    부분 문자열 검색. **검색어 길이에 따라 경로가 갈린다** - 이 예제의 핵심이다.

    - 3글자 이상: 평범한 LIKE '%q%'. GIN 인덱스가 제대로 후보를 좁힌다.
    - 2글자 이하: LIKE '%q%' 를 쓰면 인덱스 전체 스캔이 된다. 그래서 대신
      접두어 검색 LIKE 'q%' 로 보낸다 - 문자열 시작이 경계라 패딩(LPADDING 2)이
      붙어서 2글자여도 트라이그램이 만들어진다.

    의미가 "부분 일치 -> 접두어 일치" 로 바뀌므로, 응답에 어떤 경로를 탔는지
    함께 돌려준다. 실제 서비스라면 UI 에서 이걸 알려주거나, 짧은 검색어를
    아예 막거나, 이 컬럼만 pg_bigm 으로 따로 인덱싱하는 선택지가 있다.
    """
    escaped = like_escape(q)
    if len(q) >= MIN_SUBSTRING_LEN:
        mode, pattern = "substring", f"%{escaped}%"
    else:
        mode, pattern = "prefix", f"{escaped}%"

    with get_cursor() as cur:
        cur.execute(
            r"""
            SELECT id, title, left(body, 80) AS snippet
            FROM articles
            WHERE body LIKE %s ESCAPE '\'
            ORDER BY id
            LIMIT 20
            """,
            (pattern,),
        )
        rows = cur.fetchall()

    return {
        "query": q,
        "mode": mode,
        "note": (
            "3글자 이상이라 부분 문자열(%q%) 검색을 했다"
            if mode == "substring"
            else f"{len(q)}글자라 부분 문자열 검색은 인덱스 전체 스캔이 된다. "
            "접두어(q%) 검색으로 대체했다 - docs/02-internals-and-source.md 의 패딩 절 참고"
        ),
        "count": len(rows),
        "results": [{"id": r[0], "title": r[1], "snippet": r[2]} for r in rows],
    }


@app.get("/articles/similar")
def similar_articles(
    q: str = Query(..., min_length=1, description="오탈자가 있어도 되는 검색어"),
    threshold: float = Query(0.3, ge=0.0, le=1.0, description="유사도 임계값 (0~1)"),
):
    """
    유사도 검색 + 관련도 정렬. pg_bigm 의 =% 와 같은 자리지만 정렬까지 한다.

    함정: GUC 는 파라미터 바인딩(%s)이 안 된다. SET pg_trgm.similarity_threshold = %s
    는 문법 에러다. 그래서 값을 검증한 뒤 문자열로 끼워 넣어야 하는데,
    검증을 빼먹으면 그대로 SQL 인젝션이 된다.
    FastAPI 의 ge/le 로 범위를 강제하고, 여기서 float 로 한 번 더 캐스팅한다.
    """
    safe_threshold = float(threshold)  # 숫자가 아니면 여기서 예외가 난다
    with get_cursor() as cur:
        cur.execute(f"SET pg_trgm.similarity_threshold = {safe_threshold}")
        cur.execute(
            """
            SELECT id, title, round(similarity(title, %s)::numeric, 4) AS sim
            FROM articles
            WHERE title %% %s
            ORDER BY sim DESC, id
            LIMIT 10
            """,
            (q, q),
        )
        rows = cur.fetchall()

    return {
        "query": q,
        "threshold": safe_threshold,
        "count": len(rows),
        "results": [{"id": r[0], "title": r[1], "similarity": float(r[2])} for r in rows],
    }


@app.get("/articles/autocomplete")
def autocomplete(q: str = Query(..., min_length=1, description="자동완성 입력")):
    """
    KNN 자동완성 - pg_bigm 에는 대응물이 아예 없는 기능이다.

    ORDER BY title <-> %s LIMIT n 은 GiST 인덱스가 "가까운 것부터" 꺼내준다.
    임계값을 넘는 게 하나도 없어도 "그나마 가까운 N건"을 항상 돌려준다는 것이
    유사도 필터(%)와의 결정적 차이다 - "검색 결과 없음"을 피해야 하는 UI 에 맞다.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, round((title <-> %s)::numeric, 4) AS distance
            FROM articles
            ORDER BY title <-> %s
            LIMIT 5
            """,
            (q, q),
        )
        rows = cur.fetchall()

    return {
        "query": q,
        "results": [{"id": r[0], "title": r[1], "distance": float(r[2])} for r in rows],
    }


@app.get("/articles/regex")
def regex_search(pattern: str = Query(..., min_length=1, description="정규식 (POSIX)")):
    """
    정규식 검색 - 이것도 pg_bigm 에는 없다.

    다만 **한글에서는 인덱스가 도와주지 않는다.** PostgreSQL 정규식 엔진의
    MAX_SIMPLE_CHR(0x7FF) 위 문자(= UTF-8 3바이트 이상, 한글/한자/가나)는
    컬러를 펼칠 수 없어 트라이그램이 추출되지 않고, 인덱스 전체 스캔이 된다.
    응답에 그 경고를 함께 담는다.
    """
    if not pattern.strip():
        raise HTTPException(status_code=400, detail="빈 정규식")

    has_wide_char = any(ord(ch) > 0x7FF for ch in pattern)

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title
            FROM articles
            WHERE body ~ %s
            ORDER BY id
            LIMIT 20
            """,
            (pattern,),
        )
        rows = cur.fetchall()

    return {
        "pattern": pattern,
        "index_effective": not has_wide_char,
        "note": (
            "U+07FF 를 넘는 문자(한글 등)가 있어 정규식 트라이그램 추출이 동작하지 않는다. "
            "인덱스 전체 스캔이므로 큰 테이블에서는 LIKE 로 후보를 먼저 좁힐 것"
            if has_wide_char
            else "ASCII/2바이트 문자만 있어 인덱스가 정상 동작한다"
        ),
        "count": len(rows),
        "results": [{"id": r[0], "title": r[1]} for r in rows],
    }


@app.get("/articles/explain")
def explain(q: str = Query(..., min_length=1), mode: str = Query("substring")):
    """
    같은 검색어를 '%q%' 와 'q%' 로 각각 EXPLAIN 해서 차이를 눈으로 보여준다.
    운영에서 "이 쿼리가 인덱스 전체 스캔 상태인가"를 진단하는 방법 그대로다.
    """
    escaped = like_escape(q)
    pattern = f"%{escaped}%" if mode == "substring" else f"{escaped}%"
    with get_cursor() as cur:
        cur.execute("SET enable_seqscan = off")
        cur.execute(
            r"EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) "
            r"SELECT count(*) FROM articles WHERE body LIKE %s ESCAPE '\'",
            (pattern,),
        )
        plan = [r[0] for r in cur.fetchall()]

    idx_rows = None
    for line in plan:
        if "Bitmap Index Scan" in line:
            m = re.search(r"actual rows=(\d+)", line)
            if m:
                idx_rows = int(m.group(1))
            break

    return {
        "pattern": pattern,
        "index_scan_rows": idx_rows,
        "hint": (
            "인덱스 스캔이 돌려준 행 수가 테이블 전체 행 수에 가까우면 "
            "GIN_SEARCH_MODE_ALL(인덱스 전체 스캔) 상태다"
        ),
        "plan": plan,
    }
