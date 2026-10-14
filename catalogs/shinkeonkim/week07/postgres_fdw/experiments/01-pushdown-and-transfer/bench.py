import datetime
import json
import random
import statistics
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2] / 'labs/shared'))
from common import sql, explain, nodes, Session, environment, save
random.seed(7)
RESULT=Path(__file__).resolve().parent/'results/run.json'

def summary(values):
    return {'n':len(values),'median_ms':statistics.median(values),'min_ms':min(values),'max_ms':max(values),'samples_ms':values}

queries={'remote_filter':'SELECT id,title FROM remote_school.books WHERE id<=10',
         'local_filter':'SELECT id,title FROM remote_school.books WHERE public.local_small(id)'}
measurements={k:[] for k in queries}
for q in queries.values():
    for _ in range(2): explain(q)
order=list(queries)*10
random.shuffle(order)
plans={}
for key in order:
    plan=explain(queries[key]);plans[key]=plan
    measurements[key].append(plan['Execution Time'])
a=sql('SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE id<=10')
z=sql('SELECT array_agg(id ORDER BY id) FROM remote_school.books WHERE public.local_small(id)')
assert a==z
removed=next(n['Rows Removed by Filter'] for n in nodes(plans['local_filter']['Plan']) if 'Rows Removed by Filter' in n)
assert removed==99990
save(RESULT, {'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':environment(),
 'warmups_per_case':2,'random_seed':7,'metric':'EXPLAIN Execution Time (ms), 새 로컬 psql 세션마다 실행',
 'cases':{k:summary(v) for k,v in measurements.items()},'plans':plans,'same_result':True,
 'local_rows_removed':removed,'limitations':['로컬 함수 호출 비용도 포함','wire bytes와 WAN RTT를 측정하지 않음','EXPLAIN 계측 비용 포함']})
print(json.dumps({k:summary(v) for k,v in measurements.items()},ensure_ascii=False,indent=2))
