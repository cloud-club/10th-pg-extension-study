-- ===========================================================================
-- 03. pageinspect - 페이지 raw 바이트까지 내려가기
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pageinspect;

DROP TABLE IF EXISTS t_page;
CREATE TABLE t_page (id int, name text);
INSERT INTO t_page VALUES (1, 'hello'), (2, 'world'), (3, '한글');

\echo '--- 페이지 헤더 ---'
SELECT lsn, checksum, lower, upper, special, pagesize, version
FROM   page_header(get_raw_page('t_page', 0));

\echo ''
\echo '  lower = 라인 포인터 배열의 끝, upper = 튜플 데이터의 시작.'
\echo '  둘 사이가 빈 공간입니다. 8192 - (upper - lower) 가 사용 중인 바이트.'

\echo ''
\echo '--- 튜플 목록 ---'
SELECT lp AS 슬롯, lp_off AS 오프셋, lp_len AS 길이,
       t_xmin AS 생성_트랜잭션, t_xmax AS 삭제_트랜잭션, t_hoff AS 헤더크기
FROM   heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0;

\echo ''
\echo '--- MVCC 를 눈으로 보기: UPDATE 는 새 행을 만든다 ---'
UPDATE t_page SET name = 'HELLO' WHERE id = 1;

SELECT lp AS 슬롯, t_xmin, t_xmax, t_ctid AS 다음_버전_위치,
       CASE WHEN t_xmax = 0 THEN '살아있음' ELSE '이전 버전' END AS 상태
FROM   heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0;

\echo ''
\echo '  ^ 슬롯이 4개가 되었습니다. id=1 의 옛 버전은 t_xmax 가 채워졌고,'
\echo '    t_ctid 가 새 버전의 위치를 가리킵니다. 이것이 MVCC 의 실체입니다.'
\echo '    VACUUM 이 옛 버전을 치우기 전까지 파일에 남아 있습니다.'

\echo ''
\echo '--- 튜플 데이터 raw 16진수 ---'
SELECT lp, encode(t_data, 'hex') AS 바이트
FROM   heap_page_items(get_raw_page('t_page', 0)) WHERE lp_len > 0 LIMIT 2;

\echo ''
\echo '  [해독] 슬롯 2 = (2, ''world'')'
\echo '    02000000    id = 2            (int4, 리틀엔디언)'
\echo '    0d          varlena 짧은 헤더 → 길이 = 0x0d >> 1 = 6 (헤더1 + 문자5)'
\echo '    776f726c64  "world" 의 ASCII'

\echo ''
\echo '--- B-tree 인덱스 내부 ---'
CREATE INDEX idx_page ON t_page (id);
SELECT * FROM bt_metap('idx_page');
SELECT itemoffset, ctid, itemlen, data
FROM   bt_page_items('idx_page', 1) LIMIT 5;

\echo ''
\echo '  ^ ctid 가 힙의 (페이지, 슬롯) 위치입니다. 인덱스는 이 포인터만 들고 있습니다.'
\echo '    그래서 인덱스를 타도 힙을 한 번 더 읽어야 합니다 (Index Scan).'
\echo '    Visibility Map 이 "이 페이지는 다 보인다"고 하면 힙을 건너뜁니다 (Index Only Scan).'

\echo ''
\echo '  ⚠ pageinspect 는 superuser 전용입니다. 운영 서버에서 함부로 쓰지 마세요.'
\echo '     학습·디버깅·데이터 손상 조사에 씁니다.'
