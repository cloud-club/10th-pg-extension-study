-- 공식 postgres 이미지는 최초 기동 시 이 디렉터리(/docker-entrypoint-initdb.d)의
-- 스크립트를 한 번만 실행한다. cron.schedule_in_database() 실습을 위해
-- study 말고 다른 데이터베이스를 하나 미리 만들어둔다.
CREATE DATABASE otherdb;
