import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'shared'))
from common import sql, explain, nodes, save, environment, Session, docker
RESULT = Path(__file__).resolve().parent / 'results' / 'run.json'
pushed = explain('SELECT id,title FROM remote_school.books WHERE id<=10')
local = explain('SELECT id,title FROM remote_school.books WHERE public.local_small(id)')
remote_node = next(n for n in nodes(pushed['Plan']) if 'Remote SQL' in n)
local_node = next(n for n in nodes(local['Plan']) if 'Remote SQL' in n)
assert 'WHERE' in remote_node['Remote SQL']
assert 'Filter' in local_node
assert local_node.get('Rows Removed by Filter',0) == 99990
assert sql('SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE id<=10') == sql('SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE public.local_small(id)')
sql("ALTER SERVER school_remote OPTIONS (SET extensions '')")
q = "SELECT id FROM remote_school.books WHERE similarity(title, 'PostgreSQL') > 0.3"
before = explain(q)
ids_before = sql("SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE similarity(title, 'PostgreSQL') > 0.3")
sql("ALTER SERVER school_remote OPTIONS (SET extensions 'pg_trgm')")
try:
    after = explain(q)
    stable_operator = explain("SELECT id FROM remote_school.books WHERE title % 'PostgreSQL'")
    assert any('Filter' in n and '%' in n.get('Filter','') for n in nodes(stable_operator['Plan']))
    ids_after = sql("SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE similarity(title, 'PostgreSQL') > 0.3")
    assert ids_before == ids_after
    assert any('similarity' in n.get('Remote SQL','') for n in nodes(after['Plan']))
finally:
    sql("ALTER SERVER school_remote OPTIONS (SET extensions '')")
save(RESULT, {'environment':environment(), 'pushed':pushed, 'local_filter':local,
              'stable_percent_operator':stable_operator, 'trgm_before':before, 'trgm_after':after, 'same_ids':ids_before == ids_after})
print('Lab 02: 같은 정답의 원격/로컬 필터, pg_trgm 전송 위치 확인')
