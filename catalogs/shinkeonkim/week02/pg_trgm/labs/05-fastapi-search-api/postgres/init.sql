-- ===========================================================================
-- 05-fastapi-search-api - 초기 데이터
--
-- 검색 대상 문자열은 스터디 공용 예시를 쓴다:
--   클라우드클럽(6) / 클둥이·김신건(3) / 클클·코아·신건·신컨(2)
-- 길이가 고르게 분포하고, 신건/신컨 은 한 글자만 다른 오탈자 쌍이라
-- 유사도 검색 예시로 그대로 쓸 수 있다.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE articles (
  id    serial PRIMARY KEY,
  title text NOT NULL,
  body  text NOT NULL
);

INSERT INTO articles (title, body) VALUES
  ('클라우드클럽 스터디 안내',       '클라우드클럽 10기 PostgreSQL 확장 스터디 참여 안내와 일정 공지입니다'),
  ('클라우드 클럽 운영 회고',        '클라우드 클럽 운영진이 한 기수를 마치며 남기는 회고 문서입니다'),
  ('클라으드클럽 오탈자 예시',       '제목에 오타가 있는 문서 - 유사도 검색으로만 찾을 수 있다'),
  ('클둥이 모임 후기',               '클둥이 들이 모여 인덱스 튜닝을 이야기한 날의 후기입니다'),
  ('클클 짧은 키워드 테스트',        '클클 은 2글자라 트라이그램을 만들 수 없는 대표적인 예시다'),
  ('김신건 발표 자료',               '김신건 이 준비한 pg_bigm 과 pg_trgm 비교 발표 자료입니다'),
  ('김신컨 오탈자 문서',             '김신건 을 한 글자 틀리게 쓴 문서 - 유사도 검색 대상이다'),
  ('신건 님 질문 정리',              '신건 님이 스터디에서 남긴 질문들을 정리했습니다'),
  ('신컨 오탈자 질문',               '신건 을 신컨 으로 잘못 쓴 경우를 다루는 문서입니다'),
  ('코아 검색 사례',                 '코아 라는 2글자 키워드로 검색했을 때의 동작을 정리했다'),
  ('PostgreSQL GIN index guide',     'A practical guide to GIN indexes and how the posting list works'),
  ('cloudclub english note',         'CloudClub study note written in English for trigram search demo'),
  ('서버 접속 정보',                 '개발 서버 주소는 192.168.0.1 이고 스테이징은 192.168.0.2 입니다'),
  ('배포 버전 기록',                 '지난 배포는 v1.2.3 이었고 이번 배포는 v1.3.0 입니다'),
  ('에러 로그 샘플',                 'ERROR upstream timeout after 3000ms host=10.0.1.42 재시도 필요'),
  -- Recheck 예시. 주의: 3-gram 에서 'trivial' 은 'trial' 의 거짓 양성이 아니다
  -- ('ria' 조각이 없어 인덱스 단계에서 탈락한다). 3-gram 의 거짓 양성은 'arterial triage'
  -- 처럼 tri/ria/ial 이 흩어져 전부 존재하는 경우다.
  ('trial 의 거짓 양성',             'arterial triage 는 tri/ria/ial 을 다 갖고 있지만 trial 은 없다'),
  ('trial 과 trivial',               'He is awaiting trial. It was a trivial mistake. 2-gram 기준 Recheck 예시');

-- 검색 대상이 너무 적으면 인덱스 효과를 볼 수 없으므로 채워 넣는다.
INSERT INTO articles (title, body)
SELECT '문서 제목 ' || g, '본문 내용 ' || g || ' 검색 성능 측정을 위한 채움 데이터입니다'
FROM generate_series(1, 20000) g;

-- GIN: 부분 문자열 · 정규식 검색용
CREATE INDEX articles_body_gin  ON articles USING gin (body  gin_trgm_ops);
-- GiST: KNN(<->) 자동완성용. GIN 으로는 ORDER BY <-> 를 할 수 없다.
CREATE INDEX articles_title_gist ON articles USING gist (title gist_trgm_ops);
-- 유사도 필터(%) 는 GIN 이 더 빠르다
CREATE INDEX articles_title_gin  ON articles USING gin (title gin_trgm_ops);

VACUUM ANALYZE articles;
