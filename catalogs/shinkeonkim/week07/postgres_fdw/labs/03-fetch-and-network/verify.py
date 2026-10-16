import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'shared'))
from common import sql, explain, nodes, save, environment, Session, docker
RESULT = Path(__file__).resolve().parent / 'results' / 'run.json'
import datetime
import re
# 기능 확인만 수행한다. statement 로그 비용이 있어 속도 비교에 사용하지 않는다.
counts = {}
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
sql("ALTER ROLE fdw_reader SET log_statement = 'all'", 'remote')
try:
    for fetch in (100,1000):
        marker = f'week07-fetch-{fetch}'
        query = f"""ALTER SERVER school_remote OPTIONS (SET fetch_size '{fetch}', SET application_name '{marker}');
        EXPLAIN (ANALYZE, VERBOSE, FORMAT JSON) SELECT id,title FROM remote_school.books WHERE id<=10000;"""
        sql(query)
    log = docker('logs', '--since', start, 'remote')
    for fetch in (100,1000):
        counts[str(fetch)] = len(re.findall(rf'week07-fetch-{fetch} .*statement: FETCH', log))
    assert counts['100'] == 101, counts
    assert counts['1000'] == 11, counts
finally:
    sql("ALTER ROLE fdw_reader RESET log_statement", 'remote')
    sql("ALTER SERVER school_remote OPTIONS (SET fetch_size '100', SET application_name 'week07-labs')")
save(RESULT, {'environment':environment(),'returned_rows':10000,'observed_fetch_commands':counts,
              'measurement':'원격 statement 로그의 FETCH 횟수. 지연 성능 비교 아님.'})
print('Lab 03: 실제 FETCH 횟수', counts)
