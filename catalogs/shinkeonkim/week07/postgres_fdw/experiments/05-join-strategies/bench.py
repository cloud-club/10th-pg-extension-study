"""같은 결과의 JOIN 경로와 준비 비용을 측정한다."""
import hashlib
import json
import statistics
import sys
import time
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'labs/shared'))
from common import Session, sql, nodes, save

def timed(session, query):
    start=time.perf_counter()
    output=session.query(query,timeout=60)
    return (time.perf_counter()-start)*1000,output

def summary(samples):
    return {'samples_ms':samples,'n':len(samples),'median_ms':statistics.median(samples),'min_ms':min(samples),'max_ms':max(samples)}

with Session() as local, Session('remote') as remote:
    # Dedicated disposable schemas; shared Lab tables and options are not changed.
    local.query('CREATE SCHEMA IF NOT EXISTS join_compare')
    remote.query('CREATE SCHEMA IF NOT EXISTS join_compare; GRANT USAGE ON SCHEMA join_compare TO fdw_reader')
    local.query('DROP TABLE IF EXISTS join_compare.keys; CREATE TABLE join_compare.keys(id integer PRIMARY KEY); INSERT INTO join_compare.keys SELECT n*100 FROM generate_series(1,1000) n; ANALYZE join_compare.keys')
    local.query("SET max_parallel_workers_per_gather=0")
    queries={
      'direct': 'SELECT b.id,b.title FROM remote_school.books b JOIN join_compare.keys k ON k.id=b.id',
      'key-array': 'SELECT b.id,b.title FROM remote_school.books b JOIN join_compare.keys k ON k.id=b.id WHERE b.id=ANY ((SELECT array_agg(id) FROM join_compare.keys)::integer[])',
      'remote-reduced': 'SELECT b.id,b.title FROM join_compare.remote_books b JOIN join_compare.keys k ON k.id=b.id',
      'local-staging': 'SELECT b.id,b.title FROM join_compare.staging b JOIN join_compare.keys k ON k.id=b.id',
    }
    prepare={
      'remote-reduced': (remote, 'DROP TABLE IF EXISTS join_compare.reduced; CREATE TABLE join_compare.reduced AS SELECT id,title FROM public.books WHERE id%100=0; CREATE UNIQUE INDEX ON join_compare.reduced(id); ANALYZE join_compare.reduced; GRANT SELECT ON join_compare.reduced TO fdw_reader'),
      'local-staging': (local, 'DROP TABLE IF EXISTS join_compare.staging; CREATE TABLE join_compare.staging AS SELECT id,title FROM remote_school.books; CREATE UNIQUE INDEX ON join_compare.staging(id); ANALYZE join_compare.staging'),
    }
    preparations={name:[] for name in queries}
    for name,(session,query) in prepare.items():
        for _ in range(5):
            ms,_=timed(session,query)
            if name=='remote-reduced':
                registration_ms,_=timed(local,"DROP FOREIGN TABLE IF EXISTS join_compare.remote_books; CREATE FOREIGN TABLE join_compare.remote_books(id integer,title text) SERVER school_remote OPTIONS(schema_name 'join_compare',table_name 'reduced')")
                ms+=registration_ms
            preparations[name].append(ms)
    local.query("DROP FOREIGN TABLE IF EXISTS join_compare.remote_books; CREATE FOREIGN TABLE join_compare.remote_books(id integer,title text) SERVER school_remote OPTIONS(schema_name 'join_compare',table_name 'reduced')")
    cases={name:{'preparation':summary(preparations[name]) if preparations[name] else None,'read_samples':[]} for name in queries}
    reference=None
    for round_no in range(12):
        # Rotate execution order to avoid always giving one case the first slot.
        names=list(queries);names=names[round_no%4:]+names[:round_no%4]
        for name in names:
            query="SELECT coalesce(json_agg(r ORDER BY r.id),'[]'::json) FROM ("+queries[name]+') r'
            ms,output=timed(local,query)
            rows=json.loads(output)
            if reference is None:reference=rows
            assert rows==reference and len(rows)==1000,name
            if round_no>=2:cases[name]['read_samples'].append(ms)
    for name,query in queries.items():
        plan=json.loads(local.query('EXPLAIN (ANALYZE,VERBOSE,BUFFERS,FORMAT JSON) '+query))[0]
        scans=[n for n in nodes(plan['Plan']) if n['Node Type']=='Foreign Scan']
        cases[name]['query']=query
        cases[name]['read']=summary(cases[name].pop('read_samples'))
        cases[name]['plan']=plan
        cases[name]['foreign_scans']=[{'rows':n['Actual Rows'],'loops':n['Actual Loops'],'remote_sql':n['Remote SQL']} for n in scans]
        prep=cases[name]['preparation']['median_ms'] if cases[name]['preparation'] else 0
        cases[name]['modeled_one_read_ms']=prep+cases[name]['read']['median_ms']
        cases[name]['modeled_ten_reads_ms']=prep+sum(cases[name]['read']['samples_ms'])
    sizes={'remote_reduced_bytes':int(remote.query("SELECT pg_total_relation_size('join_compare.reduced')")), 'local_staging_bytes':int(local.query("SELECT pg_total_relation_size('join_compare.staging')"))}
    save(HERE/'results/run.json',{'environment':{'postgresql':local.query('SELECT version()'),'source_rows':100000,'keys':1000,'network':'같은 호스트 Docker 내부 네트워크','timing':'지속 psql 세션 요청부터 JSON 결과 수신까지 Python perf_counter wall time','prepare_repeats':5,'read_warmups':2,'read_repeats':10,'measured_at':local.query('SELECT current_timestamp::text'),'server_options':json.loads(local.query("SELECT json_agg(json_build_object('server',srvname,'options',srvoptions)) FROM pg_foreign_server WHERE srvname='school_remote'")),'table_options':local.query("SELECT ftoptions FROM pg_foreign_table WHERE ftrelid='remote_school.books'::regclass"),'remote_log_statement':remote.query('SHOW log_statement')},'same_rows':True,'result_rows':len(reference),'result_sha256':hashlib.sha256(json.dumps(reference,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'sizes':sizes,'cases':cases})
    print(json.dumps({name:{'prepare_median_ms':c['preparation']['median_ms'] if c['preparation'] else 0,'read_median_ms':c['read']['median_ms'],'foreign_scans':[(s['rows'],s['loops']) for s in c['foreign_scans']]} for name,c in cases.items()},ensure_ascii=False,indent=2))
    # Results are retained; only this experiment's disposable objects are removed.
    local.query('DROP SCHEMA join_compare CASCADE')
    remote.query('DROP SCHEMA join_compare CASCADE')
