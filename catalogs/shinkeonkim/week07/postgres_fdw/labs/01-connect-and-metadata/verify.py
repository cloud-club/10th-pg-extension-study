import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'shared'))
from common import sql, explain, nodes, save, environment, Session, docker
RESULT = Path(__file__).resolve().parent / 'results' / 'run.json'
rows = sql("SELECT count(*) FROM remote_school.books WHERE id <= 10")
assert rows == '10', rows
try:
    sql("UPDATE remote_school.books SET title='forbidden' WHERE id=1")
    raise AssertionError('read-only role unexpectedly allowed UPDATE')
except RuntimeError as error:
    assert 'permission denied' in str(error), error
    denied = str(error)
assert sql("SELECT title FROM public.books WHERE id=1", 'remote') == 'Network handbook 1'
save(RESULT, {'environment': environment(), 'count_le_10': int(rows), 'read_only_update_error': denied})
print('Lab 01: 조회 10행과 읽기 계정 UPDATE 거절 확인')
