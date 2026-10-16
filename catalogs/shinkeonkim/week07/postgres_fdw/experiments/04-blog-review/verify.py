"""블로그의 CTE·옵션·연결 수명 주장을 기존 전용 Lab 환경에서 확인한다."""
import json
import subprocess
import sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'labs/shared'))
from common import sql, explain, nodes, Session, command, save
queries={
 'plain-filter': 'SELECT id FROM remote_school.books WHERE id<=10',
 'inline-cte': 'WITH r AS (SELECT id FROM remote_school.books) SELECT id FROM r WHERE id<=10',
 'materialized-outer-filter': 'WITH r AS MATERIALIZED (SELECT id FROM remote_school.books) SELECT id FROM r WHERE id<=10',
 'materialized-inner-filter': 'WITH r AS MATERIALIZED (SELECT id FROM remote_school.books WHERE id<=10) SELECT id FROM r',
 'local-join': 'SELECT b.id FROM remote_school.books b JOIN public.favorite_books f ON b.id=f.book_id',
 'array-filter-join': 'SELECT b.id FROM remote_school.books b JOIN public.favorite_books f ON b.id=f.book_id WHERE b.id = ANY ((SELECT array_agg(book_id) FROM public.favorite_books)::integer[])',
}
results={}
for name,query in queries.items():
 plan=explain(query)
 scans=[n for n in nodes(plan['Plan']) if n['Node Type']=='Foreign Scan']
 results[name]={'rows':plan['Plan']['Actual Rows'],'foreign_scans':[{'remote_sql':n['Remote SQL'],'rows':n['Actual Rows'],'loops':n['Actual Loops']} for n in scans],'plan':plan}
for name in list(queries)[:4]:assert results[name]['rows']==10,name
assert results['materialized-outer-filter']['foreign_scans'][0]['rows']==100000
for name in ('plain-filter','inline-cte','materialized-inner-filter'):
 assert results[name]['foreign_scans'][0]['rows']==10,name
 assert '<= 10' in results[name]['foreign_scans'][0]['remote_sql'],name
assert results['local-join']['rows']==results['array-filter-join']['rows']==3
join_ids={name:sorted(int(value) for value in sql(query).splitlines()) for name,query in queries.items() if name in ('local-join','array-filter-join')}
assert join_ids['local-join']==join_ids['array-filter-join']==[1,1000,2000]
assert results['array-filter-join']['foreign_scans'][0]['rows']==3
assert 'ANY' in results['array-filter-join']['foreign_scans'][0]['remote_sql']
errors={}
for name,query in {
 'updatable-false':"BEGIN; ALTER FOREIGN TABLE writable_school.tx_probe OPTIONS (ADD updatable 'false'); EXPLAIN UPDATE writable_school.tx_probe SET value='unchanged' WHERE id=1;",
 'truncatable-false':"BEGIN; ALTER FOREIGN TABLE writable_school.tx_probe OPTIONS (ADD truncatable 'false'); TRUNCATE writable_school.tx_probe;",
}.items():
 result=subprocess.run(command(),input=query,text=True,capture_output=True,timeout=30)
 assert result.returncode!=0,name
 assert ('does not allow' in result.stderr or 'not allow' in result.stderr),result.stderr
 errors[name]=result.stderr.strip()
# A table override allows planning despite a server default; it does not grant remote privileges.
with Session() as s:
 s.query("BEGIN; ALTER SERVER writable_remote OPTIONS (ADD updatable 'false'); ALTER FOREIGN TABLE writable_school.tx_probe OPTIONS (ADD updatable 'true')")
 override=s.query("EXPLAIN (VERBOSE) UPDATE writable_school.tx_probe SET value='unchanged' WHERE id=1")
 assert 'Update' in override
 s.query('ROLLBACK')
with Session() as s:
 initial=int(s.query('SELECT count(*) FROM postgres_fdw_get_connections()'))
 s.query('SELECT id FROM remote_school.books WHERE id=1')
 cached=int(s.query('SELECT count(*) FROM postgres_fdw_get_connections()'))
 disconnected=s.query("SELECT postgres_fdw_disconnect('school_remote')")
 remaining=int(s.query('SELECT count(*) FROM postgres_fdw_get_connections()'))
 metadata=s.query("SELECT to_regclass('remote_school.books') IS NOT NULL")
 assert (initial,cached,disconnected,remaining,metadata)==(0,1,'t',0,'t')
connections={'before_query':initial,'after_query_transaction':cached,'after_disconnect':remaining,'foreign_table_remains':metadata=='t'}
with Session() as s:
 s.query("BEGIN; CREATE FOREIGN TABLE public.blog_review_probe(id integer) SERVER school_remote OPTIONS (schema_name 'public',table_name 'books'); DROP FOREIGN TABLE public.blog_review_probe")
 assert sql("SELECT to_regclass('public.books') IS NOT NULL",'remote')=='t'
 s.query('ROLLBACK')
save(HERE/'results/run.json',{'environment':{'postgresql':sql('SELECT version()'),'remote_rows':int(sql('SELECT count(*) FROM books','remote'))},'cases':results,'join_ids':join_ids,'guard_errors':errors,'table_override_explain':override,'connections':connections,'drop_foreign_table_remote_unchanged':True,'scope':'단일 실행의 계획·결과·차단·연결 검증. WAN 성능과 커밋 장애는 미검증.'})
print(json.dumps({name:{'result':r['rows'],'foreign':[(n['rows'],n['loops']) for n in r['foreign_scans']]} for name,r in results.items()},ensure_ascii=False))
print('CTE·ANY·옵션 우선순위·쓰기 차단·연결 수명 검증 통과')
