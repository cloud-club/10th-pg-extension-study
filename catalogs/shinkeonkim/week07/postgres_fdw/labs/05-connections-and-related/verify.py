import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'shared'))
from common import sql, explain, nodes, save, environment, Session, docker
RESULT = Path(__file__).resolve().parent / 'results' / 'run.json'
sessions=[]
try:
    sql("ALTER SERVER school_remote OPTIONS (SET keep_connections 'true', SET application_name 'week07-connections')")
    for i in range(4):
        s = Session(); sessions.append(s)
        assert s.query('SELECT id FROM remote_school.books WHERE id=1') == '1'
        assert s.query('SELECT count(*) FROM postgres_fdw_get_connections()') == '1'
    connections = int(sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='week07-connections'",'remote'))
    assert connections == 4, connections
finally:
    for s in sessions: s.close()
    sql("ALTER SERVER school_remote OPTIONS (SET keep_connections 'false')")
with Session() as s:
    s.query('SELECT id FROM remote_school.books WHERE id=1')
    released = int(s.query('SELECT count(*) FROM postgres_fdw_get_connections()'))
assert released == 0, released
sql("ALTER SERVER school_remote OPTIONS (SET keep_connections 'true', SET application_name 'week07-labs')")
assert sql('SELECT count(*) FROM public.csv_books') == '3'
assert sql("SELECT count(*) FROM dblink('host=remote dbname=school user=fdw_reader password=study_only','SELECT id FROM public.books WHERE id<=3') AS r(id integer)") == '3'
save(RESULT, {'environment':environment(),'local_sessions':4,'remote_connections':connections,
              'keep_connections_false_remaining':released,'file_fdw_rows':3,'dblink_rows':3})
print('Lab 05: 세션별 연결 4개, keep_connections 해제, dblink/file_fdw 조회 확인')
