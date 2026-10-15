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

cases={f'{width}-{fetch}':(width,fetch) for width in ('narrow','wide') for fetch in (100,1000,10000)}
measurements={k:[] for k in cases}
# 각 새 psql 세션에서 설정과 EXPLAIN을 실행하고 JSON을 읽는다.
def measure(width,fetch):
    cols='id,title' if width=='narrow' else 'id,title,payload'
    text=sql(f"ALTER SERVER school_remote OPTIONS (SET fetch_size '{fetch}'); EXPLAIN (ANALYZE,VERBOSE,FORMAT JSON) SELECT {cols} FROM remote_school.books WHERE id<=10000;")
    return json.loads(text)[0]
try:
    for width,fetch in cases.values():
        for _ in range(2): measure(width,fetch)
    order=list(cases)*10
    random.shuffle(order)
    plans={}
    for key in order:
        plan=measure(*cases[key]);plans[key]=plan
        assert plan['Plan']['Actual Rows']==10000
        measurements[key].append(plan['Execution Time'])
finally:
    sql("ALTER SERVER school_remote OPTIONS (SET fetch_size '100')")
save(RESULT,{'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':environment(),
 'warmups_per_case':2,'random_seed':7,'returned_rows':10000,
 'metric':'EXPLAIN Execution Time (ms), 새 로컬 psql 세션마다 실행',
 'cases':{k:summary(v) for k,v in measurements.items()},'plans':plans,
 'limitations':['같은 호스트 내부 RTT','log_statement 비활성 성능 측정','wire bytes·메모리·첫 행 시간 미측정','합성 payload']})
print(json.dumps({k:summary(v) for k,v in measurements.items()},ensure_ascii=False,indent=2))
