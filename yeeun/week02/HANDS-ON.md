# 같이 해보기 — `pg_stat_statements`

예시 데이터는 도서 목록(`books`)입니다.  
장르·제목만 보면 바로 어떤 테이블인지 알 수 있게 맞춰 두었습니다.

| | |
| --- | --- |
| 걸리는 시간 | 15~20분 |
| 필요 | Docker Desktop (로컬) |
| 목표 | Extension이 켜졌을 때만 보이는 능력(정규화·누적 통계)을 SQL로 확인 |

```bash
cd yeeun/week02/lab
./run.sh up
./run.sh psql
```

나가기: `\q`  
처음부터 다시: 호스트에서 `./run.sh down` 후 `./run.sh up`

> 이 실습은 **`pg_stat_statements` Extension을 켠 뒤에야** 통계 View·정규화·`calls` 합산이 생긴다는 걸 체감하는 게 목적입니다.

---

## 이 실습에서 재는 것

| 단계 | 무엇을 하나 | 성공하면 보이는 것 | 왜 하나 |
| --- | --- | --- | --- |
| 0 | preload + Extension + `books` | `extversion` 존재, 장르별 건수 | Extension 설치·preload가 되는지 |
| 1 | 장르만 다른 `count` | 상수가 `$1`로 바뀌고 **`calls`가 합쳐짐** | **정규화** = 이 Extension의 핵심 |
| 2 | 느린 소수 vs 잦은 다수 | **mean 1등 ≠ total 1등** | Slow Query식 “한 방”만 보면 놓치는 축 |

자동으로만 보고 싶으면 호스트에서 `./run.sh` 한 번이면 됩니다.

---

## STEP 0 — 왜 설정이 먼저인가

`pg_stat_statements` 는 Shared Memory에 통계를 쌓습니다.  
그래서 서버가 **시작할 때** 모듈을 올려야 하고, 이 lab은 `docker-compose.yml`에 이미 넣어 두었습니다.

```sql
SHOW shared_preload_libraries;
-- 기대: pg_stat_statements

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_stat_statements';
```

- `CREATE EXTENSION` → 현재 DB에 View/함수를 **등록**
- preload가 없으면 → 등록은 돼도 통계가 안 쌓이거나 조회가 실패할 수 있음  
→ “어떤 Extension은 `CREATE`만으로 부족하다”는 조사 내용이 여기서 만져집니다.

테이블이 없으면 한 번 만들어 둡니다. (이미 `./run.sh`를 돌렸다면 생략해도 됩니다.  
전체 스크립트는 `\i /lab/sql/01-setup.sql`)

```sql
DROP TABLE IF EXISTS books;
CREATE TABLE books (
    id      BIGSERIAL PRIMARY KEY,
    title   TEXT NOT NULL,
    author  TEXT NOT NULL,
    genre   TEXT NOT NULL,
    price   INTEGER NOT NULL
);

INSERT INTO books (title, author, genre, price)
SELECT
    (ARRAY[
        '데미안', '나미야 잡화점의 기적', '어린 왕자',
        '코스모스', '총 균 쇠', '사피엔스',
        '클린 코드', '디자인 패턴', '데이터베이스 개론'
    ])[1 + ((i - 1) % 9)],
    (ARRAY[
        '헤르만 헤세', '히가시노 게이고', '생텍쥐페리',
        '칼 세이건', '재레드 다이아몬드', '유발 하라리',
        '로버트 마틴', 'GoF', '김연수'
    ])[1 + ((i - 1) % 9)],
    (ARRAY['소설', '과학', '기술'])[1 + ((i - 1) % 3)],
    (8000 + (i % 50) * 200)
FROM generate_series(1, 100000) AS i;

ANALYZE books;

SELECT genre, count(*) FROM books GROUP BY genre ORDER BY genre;
```

예시로 들어 있는 책: 데미안, 코스모스, 클린 코드 등.  
장르는 `소설` / `과학` / `기술` 세 가지입니다.

---

## STEP 1 — 정규화 (같은 형태, 다른 상수)

### 왜 하나

사람 눈에는 SQL이 달라 보입니다.

```sql
… WHERE genre = '소설'
… WHERE genre = '과학'
```

Extension 없이 로그를 모으면 “다른 쿼리 두 개”로 보이기 쉽습니다.  
**정규화**를 하면 상수를 지워서 같은 패턴으로 묶습니다.

```text
… WHERE genre = $1
```

그래서 “장르별 권수 세기”라는 **한 패턴**이 DB 시간을 얼마나 쓰는지 물을 수 있습니다.  
이게 `pg_stat_statements`를 Extension으로 쓰는 이유의 핵심입니다.

### 확인

`genre`만 바꿔가며 같은 `count`를 실행하면, 통계에서 한 패턴으로 합쳐지는지.

```sql
SELECT pg_stat_statements_reset();
-- 통계를 비움. 지금부터 친 SQL만 셈.
```

```sql
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '과학';
SELECT count(*) FROM books WHERE genre = '기술';
```

한 번씩 더 실행한 뒤:

```sql
SELECT
    queryid,
    query,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements
WHERE query LIKE '%books%'
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC;
```

**볼 것**

| 컬럼 | 보면 |
| --- | --- |
| `query` | `'소설'` 등이 `$1`로 바뀌었는지 |
| **`calls`** | 실행 횟수가 **한 행에 합쳐졌는지** (예: 6) |
| `queryid` | 같은 패턴이면 같은 ID |

---

## STEP 2 — mean vs total (느린 것 vs 비싼 것)

### 왜 하나

**Slow Query Log**는 보통 “1초 넘는 실행만” 남깁니다.  
→ **한 방이 느린 SQL(A)** 은 잘 잡히고,  
→ **한 번은 짧은데 아주 자주 도는 SQL(B)** 은 안 남을 수 있습니다.

| 이름 | 뜻 | 질문에 답함 |
| --- | --- | --- |
| `mean_exec_time` | 한 번 평균 | “한 방이 얼마나 느리냐?” |
| `total_exec_time` | 누적 합 (≈ mean × calls) | “전체로 얼마나 잡아먹었냐?” |
| `calls` | 실행 횟수 | “얼마나 자주냐?” |

실습에서는 A/B를 일부러 만들어, **mean 순위와 total 순위가 갈리는지** 봅니다.

| | 역할 | 실습에서 쓰는 것 |
| --- | --- | --- |
| A | 드물지만 한 번이 느림 | `pg_sleep(0.05)` 2회 |
| B | 한 번은 가볍지만 자주 | `genre = '소설'` count 여러 번 |

`pg_sleep`은 실제 도서 조회가 아닙니다. “드물지만 느린 실행”을 **안전하게 흉내** 낸 것입니다.

### 확인

```sql
SELECT pg_stat_statements_reset();

SELECT pg_sleep(0.05);
SELECT pg_sleep(0.05);

SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
SELECT count(*) FROM books WHERE genre = '소설';
```

자동 실측과 같은 표(B 50회)를 보려면:

```text
\i /lab/sql/03-mean-vs-total.sql
```

또는 호스트에서 `./run.sh 03`.

```sql
-- 느린 쿼리 순위 (한 방)
SELECT left(query, 60) AS query, calls,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%' AND calls > 0
ORDER BY mean_exec_time DESC
LIMIT 5;

-- 비싼 쿼리 순위 (누적) ← 튜닝 우선순위에 더 가깝다
SELECT left(query, 60) AS query, calls,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%' AND calls > 0
ORDER BY total_exec_time DESC
LIMIT 5;
```

**볼 것**

| 정렬 | 보통 1등 | 의미 |
| --- | --- | --- |
| `mean_exec_time` | `pg_sleep` | Slow Query가 잘 잡는 쪽 |
| `total_exec_time` | 소설 `count` | 자주 불려서 **누적**이 큰 쪽 |

---

## 실습이 끝나면

1. 결과를 [catalogs/pg_stat_statements.md](catalogs/pg_stat_statements.md)과 맞춰 본다  
2. 조사 배경은 [notes/extension-overview.md](notes/extension-overview.md)  
3. 발표 후 최종본은 루트 `catalogs/pg_stat_statements.md` 로 PR

```text
pg_stat_statements  →  “무슨 SQL부터 볼지”  (정규화 + total)
EXPLAIN ANALYZE     →  “이 SQL이 왜 느린지”
Slow Query Log      →  “임계값 넘는 한 방”만 (대안·보완, 대체재는 아님)
```
