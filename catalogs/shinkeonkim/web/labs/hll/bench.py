"""hll 기능·집합 병합·오차 분포·서버 실행 시간을 전용 DB에서 검증한다."""
import json
import math
import statistics
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
COMPOSE=['docker','compose','-f',str(ROOT/'compose.yaml')]
def sql(query):
    p=subprocess.run(COMPOSE+['exec','-T','db','psql','-X','-qAt','-U','postgres','-d','study','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,timeout=120)
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout.strip()
def scalar(query):return json.loads(sql(query))
def plan(query):return scalar('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query)[0]
def summarize(values):return {'n':len(values),'samples_ms':values,'median_ms':statistics.median(values),'min_ms':min(values),'max_ms':max(values)}
sql((ROOT/'setup.sql').read_text())
# Keep server execution comparisons serial and record the configuration.
sql("ALTER DATABASE study SET max_parallel_workers_per_gather=0")
small=scalar("SELECT json_build_object('rows',count(*),'distinct',count(DISTINCT id),'estimate',hll_cardinality(hll_add_agg(hll_hash_integer(id))),'null_hash_is_null',hll_hash_integer(NULL) IS NULL) FROM (VALUES (1),(1),(2),(3),(NULL)) v(id)")
assert small['rows']==5 and small['distinct']==small['estimate']==3 and small['null_hash_is_null']
duplicate=sql("SELECT hll_add_agg(hll_hash_integer(n))=hll_add_agg(hll_hash_integer(n)) FILTER (WHERE copy=1) FROM generate_series(1,5000) n CROSS JOIN generate_series(1,3) copy")=='t'
assert duplicate
empty=scalar("SELECT json_build_object('empty',hll_cardinality(hll_empty()),'aggregate_no_rows_is_null',hll_add_agg(hll_hash_integer(n)) IS NULL) FROM generate_series(1,0) n")
assert empty['empty']==0 and empty['aggregate_no_rows_is_null']
transitions=[]
for n in [0,1,10,160,161,500,1000,10000]:
    transitions.append(scalar(f"SELECT json_build_object('n',{n},'type',hll_type(s),'estimate',hll_cardinality(s),'binary_bytes',octet_length(hll_send(s)),'column_bytes',pg_column_size(s)) FROM (SELECT coalesce(hll_add_agg(hll_hash_integer(i)),hll_empty()) s FROM generate_series(1,{n}) i) q"))
prepare=plan('CREATE TABLE hll_lab.daily AS SELECT day,hll_add_agg(hll_hash_integer(user_id),11,5,-1,1) sketch FROM hll_lab.events GROUP BY day')
weekly=scalar("SELECT json_build_object('events',(SELECT count(*) FROM hll_lab.events),'exact',(SELECT count(DISTINCT user_id) FROM hll_lab.events),'sum_daily_exact',(SELECT sum(n) FROM (SELECT count(DISTINCT user_id) n FROM hll_lab.events GROUP BY day) q),'sum_daily_estimates',sum(hll_cardinality(sketch)),'merged',hll_cardinality(hll_union_agg(sketch)),'merge_matches_direct',hll_union_agg(sketch)=(SELECT hll_add_agg(hll_hash_integer(user_id),11,5,-1,1) FROM hll_lab.events),'daily_binary_bytes',sum(octet_length(hll_send(sketch)))) FROM hll_lab.daily")
assert weekly['events']==210000 and weekly['exact']==25000 and weekly['sum_daily_exact']==70000 and weekly['merge_matches_direct']
hash_seed_checks=[]
for kind,seed in [('integer',0),('integer',4),('text',0),('text',5)]:
    expr=f'hll_hash_integer(i,{seed})' if kind=='integer' else f'hll_hash_text(i::text,{seed})'
    hash_seed_checks.append(scalar(f"SELECT json_build_object('kind','{kind}','seed',{seed},'distinct_hash_texts',count(DISTINCT ({expr})::text),'occupied_buckets',count(DISTINCT (({expr})::text::bigint & 2047)),'low_bit_zero_count',count(*) FILTER(WHERE (({expr})::text::bigint & 1)=0),'estimate',hll_cardinality(hll_add_agg({expr},11,5,0,0))) FROM generate_series(1,50000) i"))
precision=[]
for p in [8,11,14]:
    trials=scalar(f"SELECT json_agg(r ORDER BY trial) FROM (SELECT seed AS trial,hll_cardinality(hll_add_agg(hll_hash_text('trial-'||seed||'/user-'||i,0),{p},5,0,0)) estimate,octet_length(hll_send(hll_add_agg(hll_hash_text('trial-'||seed||'/user-'||i,0),{p},5,0,0))) binary_bytes FROM generate_series(0,19) seed CROSS JOIN generate_series(1,50000) i GROUP BY seed) r")
    errors=[(x['estimate']-50000)/50000 for x in trials]
    precision.append({'log2m':p,'m':2**p,'exact':50000,'trials':trials,'mean_signed_error_pct':statistics.mean(errors)*100,'rmse_pct':math.sqrt(statistics.mean(x*x for x in errors))*100,'max_abs_error_pct':max(abs(x) for x in errors)*100,'theoretical_rse_pct':1.04/math.sqrt(2**p)*100})
# Incompatible register counts are rejected; no remote data or shared DB is involved.
try:
    sql('SELECT hll_union(hll_empty(8),hll_empty(11))')
    raise AssertionError('incompatible union unexpectedly accepted')
except RuntimeError as err:
    mismatch=str(err).strip()
queries={'exact_raw':'SELECT count(DISTINCT user_id) FROM hll_lab.events','hll_raw':'SELECT hll_cardinality(hll_add_agg(hll_hash_integer(user_id),11,5,-1,1)) FROM hll_lab.events','hll_daily_union':'SELECT hll_cardinality(hll_union_agg(sketch)) FROM hll_lab.daily'}
cases={name:[] for name in queries};plans={}
for q in queries.values():
    for _ in range(2):plan(q)
for round_no in range(10):
    names=list(queries);names=names[round_no%3:]+names[:round_no%3]
    for name in names:
        pl=plan(queries[name]);cases[name].append(pl['Execution Time']);plans[name]=pl
version=scalar("SELECT json_build_object('postgresql',version(),'hll',(SELECT extversion FROM pg_extension WHERE extname='hll'),'work_mem',current_setting('work_mem'),'parallel_workers',current_setting('max_parallel_workers_per_gather'),'measured_at',current_timestamp)")
version['package']=subprocess.check_output(COMPOSE+['exec','-T','db','dpkg-query','-W','postgresql-18-hll'],text=True).strip()
version['image']=json.loads(subprocess.check_output(['docker','image','inspect','shinkeonkim-hll-lab:pg18.6'],text=True))[0]['Id']
result={'environment':version,'small':small,'empty':empty,'duplicate_invariant':duplicate,'transitions':transitions,'weekly':weekly,'precision':precision,'hash_seed_checks':hash_seed_checks,'incompatible_union_error':mismatch,'daily_build':prepare,'daily_relation_bytes':int(sql("SELECT pg_total_relation_size('hll_lab.daily')")),'benchmarks':{name:{**summarize(samples),'plan':plans[name],'query':queries[name]} for name,samples in cases.items()},'scope':'합성 210000행, 예열된 단일 세션, EXPLAIN 서버 시간. RSS·앱 지연·동시 부하 미측정.'}
(ROOT/'results').mkdir(exist_ok=True)
daily_ranges=scalar("SELECT json_agg(r ORDER BY day) FROM (SELECT day,min(user_id) first_id,max(user_id) last_id,count(*) events,count(DISTINCT user_id) exact_users FROM hll_lab.events GROUP BY day) r")
(ROOT/'results/daily-ranges.json').write_text(json.dumps(daily_ranges,ensure_ascii=False,indent=2)+'\n')
(ROOT/'results/run.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'environment':version,'weekly':weekly,'precision':[{k:v for k,v in row.items() if k!='trials'} for row in precision],'benchmarks':{name:summarize(samples) for name,samples in cases.items()}},ensure_ascii=False,indent=2))
