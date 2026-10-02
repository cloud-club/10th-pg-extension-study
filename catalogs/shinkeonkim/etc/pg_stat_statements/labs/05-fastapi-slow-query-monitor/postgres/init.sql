-- ===========================================================================
-- Lab 05 seed data - docker-entrypoint-initdb.d 에서 최초 기동 시 한 번 실행된다.
-- shared_preload_libraries=pg_stat_statements 는 docker-compose.yml 의 command 로 준다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE users (
    id   serial PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE orders (
    id         serial PRIMARY KEY,
    user_id    int NOT NULL REFERENCES users(id),
    item       text NOT NULL,   -- 일부러 인덱스를 안 만든다 - /orders/search 가 이 컬럼을 LIKE 로 훑는다
    amount     numeric(10,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (name)
SELECT 'user_' || g FROM generate_series(1, 200) g;

-- 대부분의 유저는 주문이 약 40개지만, user_id=1 은 별도로 25개를 갖게 해서
-- /users/1/orders 의 N+1 루프가 확실히 calls>20 을 만들도록 한다.
INSERT INTO orders (user_id, item, amount, created_at)
SELECT 1,
       (ARRAY['keyboard','monitor','mouse','headset','webcam','desk lamp','usb hub','laptop stand'])[1 + (g % 8)],
       (10 + random() * 490)::numeric(10,2),
       now() - (g || ' hours')::interval
FROM generate_series(1, 25) g;

INSERT INTO orders (user_id, item, amount, created_at)
SELECT (2 + (g % 199)),
       (ARRAY['keyboard','monitor','mouse','headset','webcam','desk lamp','usb hub','laptop stand',
              'notebook','chair','coffee mug','sticky notes','pen set','monitor arm','cable organizer'])[1 + (g % 15)],
       (5 + random() * 990)::numeric(10,2),
       now() - (g || ' minutes')::interval
FROM generate_series(1, 8000) g;

ANALYZE users;
ANALYZE orders;
