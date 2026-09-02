-- greetkor--1.0--1.1.sql : 1.0 -> 1.1 업그레이드 스크립트
-- ALTER EXTENSION greetkor UPDATE TO '1.1'; 시 실행된다.
\echo Use "ALTER EXTENSION greetkor UPDATE TO '1.1'" to load this file. \quit

-- (1) 새 기능 추가
CREATE FUNCTION greet_time(name text, at timestamptz DEFAULT now())
RETURNS text LANGUAGE sql STABLE STRICT AS $$
    SELECT CASE
             WHEN extract(hour FROM at) < 12 THEN '좋은 아침이에요, '
             WHEN extract(hour FROM at) < 18 THEN '좋은 오후예요, '
             ELSE '좋은 저녁이에요, '
           END || name || '님!'
$$;

-- (2) 기존 함수 동작 변경은 CREATE OR REPLACE 로 (DROP 하면 pg_depend 가 깨진다)
CREATE OR REPLACE FUNCTION greet(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT '안녕하세요, ' || name || '님! 반갑습니다.' $$;

-- (3) extension 이 관리하는 설정 테이블 + pg_dump 연동
CREATE TABLE greetkor_config (
    key   text PRIMARY KEY,
    value text NOT NULL
);
INSERT INTO greetkor_config VALUES ('locale', 'ko_KR');

-- 이 테이블의 "데이터"는 extension 스크립트가 아니라 pg_dump 가 덤프하도록 등록
SELECT pg_extension_config_dump('greetkor_config', '');
