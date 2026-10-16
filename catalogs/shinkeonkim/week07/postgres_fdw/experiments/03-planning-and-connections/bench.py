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

cases={f'estimate-{estimate}-keep-{keep}':(estimate,keep) for estimate in ('false','true') for keep in ('false','true')}
measurements={k:{'planning':[],'execution':[]} for k in cases}
try:
    order=list(cases);random.shuffle(order)
    for key in order:
        estimate,keep=cases[key]
        sql(f"ALTER SERVER school_remote OPTIONS (SET use_remote_estimate '{estimate}', SET keep_connections '{keep}')")
        with Session() as session:
            for i in range(12):
                plan=json.loads(session.query('EXPLAIN (ANALYZE,VERBOSE,FORMAT JSON) SELECT id,title FROM remote_school.books WHERE id<=10'))[0]
                if i>=2:
                    measurements[key]['planning'].append(plan['Planning Time'])
                    measurements[key]['execution'].append(plan['Execution Time'])
finally:
    sql("ALTER SERVER school_remote OPTIONS (SET use_remote_estimate 'false', SET keep_connections 'true')")
save(RESULT,{'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':environment(),
 'warmups_per_case':2,'random_seed':7,
 'metric':'지속 로컬 psql 세션의 EXPLAIN Planning/Execution Time (ms)',
 'cases':{k:{m:summary(v) for m,v in values.items()} for k,values in measurements.items()},
 'limitations':['각 조건 블록 내 반복, 조건 블록 순서만 섞음','실행 순서·캐시 영향 잔존','TLS 없는 내부 Docker 연결','앱 풀 대기 미포함']})
print(json.dumps({k:{m:summary(v) for m,v in values.items()} for k,values in measurements.items()},ensure_ascii=False,indent=2))
