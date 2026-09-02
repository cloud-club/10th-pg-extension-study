-- ===========================================================================
-- 05. 언제 쓰고 언제 피하나
-- ===========================================================================
DROP TABLE IF EXISTS bench;
CREATE TABLE bench AS SELECT g AS id, 'text-' || g AS t FROM generate_series(1, 200000) g;

CREATE OR REPLACE FUNCTION sql_upper(t text)  RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT upper(t) $$;

CREATE OR REPLACE FUNCTION plpgsql_upper(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$ BEGIN RETURN upper(t); END $$;

CREATE OR REPLACE FUNCTION py_upper(t text) RETURNS text
LANGUAGE plpython3u IMMUTABLE STRICT AS $$ return t.upper() $$;

CREATE OR REPLACE FUNCTION perl_upper(t text) RETURNS text
LANGUAGE plperl IMMUTABLE STRICT AS $$ return uc($_[0]); $$;

\echo '--- 20만 행에 함수 적용 (같은 일을 언어만 바꿔서) ---'
\echo '\\timing on'
\timing on
\echo ''
\echo '[내장 upper()]'
SELECT count(upper(t))         FROM bench;
\echo '[LANGUAGE sql]'
SELECT count(sql_upper(t))     FROM bench;
\echo '[LANGUAGE plpgsql]'
SELECT count(plpgsql_upper(t)) FROM bench;
\echo '[LANGUAGE plperl]'
SELECT count(perl_upper(t))    FROM bench;
\echo '[LANGUAGE plpython3u]'
SELECT count(py_upper(t))      FROM bench;
\echo '\\timing off'
\timing off

\echo ''
\echo '  ^ 호출 오버헤드가 있습니다. 행마다 인터프리터를 오가야 하기 때문입니다.'
\echo '    SQL 로 표현할 수 있는 일이라면 SQL 로 하세요.'

\echo ''
\echo '--- 인터프리터는 백엔드 프로세스마다 따로 뜹니다 ---'
CREATE OR REPLACE FUNCTION py_interp_info() RETURNS text
LANGUAGE plpython3u AS $$
    import sys, os
    return f"pid={os.getpid()}  python={sys.version.split()[0]}"
$$;

SELECT py_interp_info() AS "이 세션의 인터프리터";
\echo '  [컨테이너 셸] $ psql -U postgres -d study -tAc "SELECT py_interp_info();" | sed \'s/^/  다른 세션: /\''
\! psql -U postgres -d study -tAc "SELECT py_interp_info();" | sed 's/^/  다른 세션: /'

\echo ''
\echo '  ^ pid 가 다릅니다. 세션마다 Python 인터프리터가 따로 초기화됩니다.'
\echo '    연결이 많으면 그만큼 메모리를 씁니다 (lab03 의 .so 로딩과 같은 구조).'
\echo '    커넥션 풀을 쓰면 완화됩니다.'

\echo ''
\echo '==================== 판단 기준 ===================='
SELECT * FROM (VALUES
  ('👍', '표준 라이브러리가 필요할 때', '정규식·날짜·인코딩·URL 파싱 등'),
  ('👍', '알고리즘이 복잡할 때',        'SQL/PL·pgSQL 로 짜면 읽기 어려운 로직'),
  ('👍', '데이터를 옮기지 않고 처리',   '큰 테이블을 앱으로 끌어오는 비용 회피'),
  ('👍', '트리거 안의 복잡한 검증',     '한 트랜잭션 안에서 끝내야 할 때'),
  ('👎', 'SQL 로 표현 가능한 일',       '집계·조인·필터는 SQL 이 압도적으로 빠름'),
  ('👎', '행마다 호출되는 무거운 함수', '호출 오버헤드 × 행 수'),
  ('👎', '외부 네트워크 호출',          'DB 트랜잭션이 외부 응답을 기다리게 됨'),
  ('👎', '클라우드 매니지드 DB',        'plpython3u 는 대개 못 씁니다')
) AS t(구분, 상황, 이유);

\echo ''
\echo '==================== 주의할 점 ===================='
\echo ''
\echo '  ① 외부 패키지 설치가 어렵습니다'
\echo '     numpy 를 쓰려면 서버에 pip install 하고 재시작해야 합니다.'
\echo '     컨테이너라면 이미지를 다시 빌드해야 합니다.'
\echo '     → 배포 파이프라인에 "DB 서버의 Python 패키지"가 끼어듭니다.'
\echo ''
\echo '  ② 트랜잭션 안에서 돕니다'
\echo '     함수가 느리면 그만큼 트랜잭션이 길어지고 락이 오래 잡힙니다.'
\echo '     네트워크 호출은 특히 위험합니다.'
\echo ''
\echo '  ③ 디버깅이 어렵습니다'
\echo '     스택 트레이스는 나오지만 중단점을 걸 수 없습니다.'
\echo '     plpy.notice() 로 찍어보는 게 현실적인 방법입니다.'
\echo ''
\echo '  ④ 버전이 서버에 묶입니다'
\echo '     Python 버전은 PostgreSQL 을 빌드할 때 정해집니다.'
SELECT py_interp_info() AS "이 서버의 Python";

\echo ''
\echo '--- 그 외의 절차적 언어들 ---'
SELECT * FROM (VALUES
  ('PL/pgSQL',  '기본 제공',  'SQL 과 가장 잘 맞음. 트리거의 기본 선택'),
  ('PL/Python', 'plpython3u', '표준 라이브러리·데이터 처리. untrusted'),
  ('PL/Perl',   'plperl(u)',  '텍스트 처리. trusted 버전 있음'),
  ('PL/v8',     'plv8',       'JavaScript. JSON 처리에 강함'),
  ('PL/R',      'plr',        '통계·분석'),
  ('PL/Java',   'pljava',     'JVM 생태계 활용'),
  ('PL/Rust',   'plrust',     'trusted 로 설계된 최신 시도')
) AS t(언어, extension, 특징);
