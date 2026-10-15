-- ===========================================================================
-- 01. 설치 확인 + 예시 데이터 (도서)
-- ===========================================================================
\echo '--- 환경 ---'
SELECT version();
SHOW shared_preload_libraries;
SHOW compute_query_id;

\echo '--- Extension 설치 ---'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_stat_statements';

\echo '--- 예시 테이블: books ---'
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

SELECT
    genre,
    count(*) AS books,
    round(avg(price)) AS avg_price
FROM books
GROUP BY genre
ORDER BY genre;
