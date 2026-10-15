"""블로그 검토 페이지의 관측값과 원본 계획을 대조한다. DB를 변경하지 않는다."""
import json
from pathlib import Path
WEB=Path(__file__).resolve().parents[1]
raw=WEB.parent/'week07/postgres_fdw/experiments/04-blog-review/results/run.json'
d=json.loads(raw.read_text())
assert d['environment']['remote_rows']==100000
assert 'PostgreSQL 18.6' in d['environment']['postgresql']
expected={'plain-filter':(10,10),'inline-cte':(10,10),'materialized-outer-filter':(10,100000),'materialized-inner-filter':(10,10),'local-join':(3,100000),'array-filter-join':(3,3)}
for key,(output,transferred) in expected.items():
 case=d['cases'][key]
 assert case['rows']==case['plan']['Plan']['Actual Rows']==output,key
 assert len(case['foreign_scans'])==1,key
 assert case['foreign_scans'][0]['rows']==transferred,key
assert d['join_ids']=={'local-join':[1,1000,2000],'array-filter-join':[1,1000,2000]}
assert 'ANY' in d['cases']['array-filter-join']['foreign_scans'][0]['remote_sql']
assert 'WHERE' not in d['cases']['materialized-outer-filter']['foreign_scans'][0]['remote_sql']
assert set(d['guard_errors'])=={'updatable-false','truncatable-false'}
assert 'Update' in d['table_override_explain']
assert d['connections']=={'before_query':0,'after_query_transaction':1,'after_disconnect':0,'foreign_table_remains':True}
assert d['drop_foreign_table_remote_unchanged']
print('블로그 검토 원본: CTE 4개·JOIN 2개·차단·옵션·연결 검증 통과')
